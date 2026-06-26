-- Маркет: премодерация покупок, холд 24ч, отзывы, споры
-- Запусти в Supabase SQL Editor после marketplace-withdrawals-10pct.sql

-- Статус сделки
alter table public.marketplace_purchases
  add column if not exists status text not null default 'completed';

alter table public.marketplace_purchases
  add column if not exists reviewed_at timestamptz;

alter table public.marketplace_purchases
  add column if not exists reviewed_by uuid references public.profiles (id);

alter table public.marketplace_purchases
  add column if not exists reject_reason text;

update public.marketplace_purchases
set status = 'completed'
where status is null or status = '';

alter table public.marketplace_purchases drop constraint if exists marketplace_purchases_status_check;
alter table public.marketplace_purchases
  add constraint marketplace_purchases_status_check
  check (status in ('pending_review', 'completed', 'rejected', 'disputed', 'refunded'));

create index if not exists marketplace_purchases_status_idx
  on public.marketplace_purchases (status, created_at desc);

-- Холд выплаты продавцу (24ч после одобрения модератором)
create table if not exists public.marketplace_balance_holds (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.marketplace_purchases (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null check (currency in ('rub', 'usd')),
  release_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_balance_holds_seller_idx
  on public.marketplace_balance_holds (seller_id, release_at)
  where released_at is null;

alter table public.marketplace_balance_holds enable row level security;

drop policy if exists "Sellers read own holds" on public.marketplace_balance_holds;
create policy "Sellers read own holds" on public.marketplace_balance_holds
  for select using (auth.uid() = seller_id);

-- Отзывы о продавце
create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.marketplace_purchases (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists marketplace_reviews_seller_idx
  on public.marketplace_reviews (seller_id, created_at desc);

alter table public.marketplace_reviews enable row level security;

drop policy if exists "Anyone reads reviews" on public.marketplace_reviews;
create policy "Anyone reads reviews" on public.marketplace_reviews
  for select using (true);

drop policy if exists "Buyers create reviews" on public.marketplace_reviews;
create policy "Buyers create reviews" on public.marketplace_reviews
  for insert with check (auth.uid() = reviewer_id);

-- Споры / обращения в поддержку по сделке
create table if not exists public.marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.marketplace_purchases (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists marketplace_disputes_status_idx
  on public.marketplace_disputes (status, created_at desc);

alter table public.marketplace_disputes enable row level security;

drop policy if exists "Participants read disputes" on public.marketplace_disputes;
create policy "Participants read disputes" on public.marketplace_disputes
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers open disputes" on public.marketplace_disputes;
create policy "Buyers open disputes" on public.marketplace_disputes
  for insert with check (auth.uid() = buyer_id);

-- Освобождение холдов (вызывается при выводе / загрузке профиля)
create or replace function public.release_marketplace_holds(p_user_id uuid default null)
returns numeric
language plpgsql
security definer set search_path = public
as $$
declare
  v_hold record;
  v_total numeric := 0;
  v_title text;
begin
  for v_hold in
    select h.*, p.title
    from marketplace_balance_holds h
    join marketplace_purchases p on p.id = h.purchase_id
    where h.released_at is null
      and h.release_at <= now()
      and (p_user_id is null or h.seller_id = p_user_id)
    for update of h
  loop
    update profiles
    set balance = balance + v_hold.amount
    where id = v_hold.seller_id;

    v_title := coalesce(v_hold.title, 'marketplace sale');

    insert into transactions (user_id, type, amount, description)
    values (
      v_hold.seller_id,
      'marketplace_sale',
      v_hold.amount,
      'marketplace_sale:' || v_title
    );

    update marketplace_balance_holds
    set released_at = now()
    where id = v_hold.id;

    v_total := v_total + v_hold.amount;
  end loop;

  return v_total;
end;
$$;

-- Покупка: списание с покупателя, ожидание проверки, без выплаты продавцу
create or replace function public.purchase_marketplace_listing(
  p_buyer_id uuid,
  p_listing_id uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_buyer_balance numeric;
  v_buyer_currency text;
  v_buyer_frozen_acc boolean;
  v_buyer_frozen_bal boolean;
  v_buyer_charge numeric;
  v_fee numeric;
  v_payout numeric;
  v_purchase_id uuid;
  v_title text;
  v_rub_per_usd constant numeric := 79;
  v_commission constant numeric := 0.10;
begin
  perform release_marketplace_holds(p_buyer_id);

  select * into v_listing
  from marketplace_listings
  where id = p_listing_id and status = 'active'
  for update;

  if v_listing.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if v_listing.seller_id = p_buyer_id then
    return json_build_object('error', 'own_listing');
  end if;

  if coalesce(trim(v_listing.delivery_content), '') = '' then
    return json_build_object('error', 'no_delivery');
  end if;

  v_title := coalesce(nullif(trim(v_listing.title_ru), ''), nullif(trim(v_listing.title_en), ''), v_listing.title);

  select balance, currency, account_frozen, balance_frozen
  into v_buyer_balance, v_buyer_currency, v_buyer_frozen_acc, v_buyer_frozen_bal
  from profiles where id = p_buyer_id for update;

  if v_buyer_balance is null then
    return json_build_object('error', 'no_profile');
  end if;

  if v_buyer_frozen_acc then
    return json_build_object('error', 'account_frozen');
  end if;

  if v_buyer_frozen_bal then
    return json_build_object('error', 'balance_frozen');
  end if;

  if v_buyer_currency = v_listing.currency then
    v_buyer_charge := v_listing.price;
  elsif v_listing.currency = 'usd' and v_buyer_currency = 'rub' then
    v_buyer_charge := round(v_listing.price * v_rub_per_usd, 2);
  elsif v_listing.currency = 'rub' and v_buyer_currency = 'usd' then
    v_buyer_charge := round(v_listing.price / v_rub_per_usd, 2);
  else
    return json_build_object('error', 'currency_mismatch');
  end if;

  if v_buyer_balance < v_buyer_charge then
    return json_build_object('error', 'insufficient_balance');
  end if;

  v_fee := round(v_listing.price * v_commission, 2);
  v_payout := round(v_listing.price - v_fee, 2);

  update profiles set balance = balance - v_buyer_charge where id = p_buyer_id;

  update marketplace_listings
  set status = 'sold',
      buyer_id = p_buyer_id,
      sold_at = now(),
      updated_at = now()
  where id = p_listing_id;

  insert into marketplace_purchases (
    listing_id, buyer_id, seller_id, title, price, currency,
    fee, seller_payout, delivery_content, buyer_paid, buyer_currency, status
  )
  values (
    v_listing.id, p_buyer_id, v_listing.seller_id, v_title,
    v_listing.price, v_listing.currency, v_fee, v_payout, v_listing.delivery_content,
    v_buyer_charge, v_buyer_currency, 'pending_review'
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (p_buyer_id, 'marketplace_buy', -v_buyer_charge, 'marketplace:' || v_title);

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'status', 'pending_review',
    'title', v_title,
    'price', v_listing.price,
    'listing_currency', v_listing.currency,
    'buyer_paid', v_buyer_charge,
    'buyer_currency', v_buyer_currency
  );
end;
$$;

-- Модератор: одобрить сделку → выдача товара + холд 24ч
create or replace function public.approve_marketplace_purchase(
  p_purchase_id uuid,
  p_reviewer_id uuid default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.marketplace_purchases%rowtype;
begin
  select * into v_purchase
  from marketplace_purchases
  where id = p_purchase_id and status = 'pending_review'
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  update marketplace_purchases
  set status = 'completed',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
  where id = p_purchase_id;

  insert into marketplace_balance_holds (
    purchase_id, seller_id, amount, currency, release_at
  )
  values (
    v_purchase.id,
    v_purchase.seller_id,
    v_purchase.seller_payout,
    v_purchase.currency,
    now() + interval '24 hours'
  );

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase.id,
    'status', 'completed',
    'delivery_content', v_purchase.delivery_content,
    'seller_payout', v_purchase.seller_payout,
    'hold_release_at', (now() + interval '24 hours')
  );
end;
$$;

-- Модератор: отклонить → возврат покупателю, лот снова активен
create or replace function public.reject_marketplace_purchase(
  p_purchase_id uuid,
  p_reviewer_id uuid default null,
  p_reason text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.marketplace_purchases%rowtype;
begin
  select * into v_purchase
  from marketplace_purchases
  where id = p_purchase_id and status = 'pending_review'
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  update profiles
  set balance = balance + v_purchase.buyer_paid
  where id = v_purchase.buyer_id;

  insert into transactions (user_id, type, amount, description)
  values (
    v_purchase.buyer_id,
    'marketplace_buy',
    v_purchase.buyer_paid,
    'marketplace_refund:' || v_purchase.title
  );

  update marketplace_listings
  set status = 'active',
      buyer_id = null,
      sold_at = null,
      updated_at = now()
  where id = v_purchase.listing_id;

  update marketplace_purchases
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      reject_reason = nullif(trim(p_reason), '')
  where id = p_purchase_id;

  return json_build_object('success', true, 'status', 'rejected');
end;
$$;

-- Вывод: сначала освобождаем холды
create or replace function public.request_withdrawal(
  p_user_id uuid,
  p_method text,
  p_amount numeric,
  p_destination text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_currency text;
  v_frozen_acc boolean;
  v_frozen_bal boolean;
  v_fee numeric;
  v_net numeric;
  v_amount_rub numeric;
  v_min_rub constant numeric := 250;
  v_crypto_fee_usd constant numeric := 3.5;
  v_card_pct constant numeric := 0.03;
  v_card_fixed_rub constant numeric := 30;
  v_rub_per_usd constant numeric := 79;
  v_request_id uuid;
  v_dest text;
begin
  perform release_marketplace_holds(p_user_id);

  if p_method not in ('crypto', 'card') then
    return json_build_object('error', 'invalid_method');
  end if;

  v_dest := trim(p_destination);
  if length(v_dest) < 8 then
    return json_build_object('error', 'invalid_destination');
  end if;

  if p_amount <= 0 then
    return json_build_object('error', 'invalid_amount');
  end if;

  select balance, currency, account_frozen, balance_frozen
  into v_balance, v_currency, v_frozen_acc, v_frozen_bal
  from profiles where id = p_user_id for update;

  if v_balance is null then
    return json_build_object('error', 'no_profile');
  end if;

  if v_frozen_acc or v_frozen_bal then
    return json_build_object('error', 'balance_frozen');
  end if;

  if v_currency = 'rub' then
    v_amount_rub := p_amount;
  else
    v_amount_rub := round(p_amount * v_rub_per_usd, 2);
  end if;

  if p_method = 'crypto' then
    if v_currency = 'usd' then
      v_fee := v_crypto_fee_usd;
      if p_amount < round(v_min_rub / v_rub_per_usd + v_crypto_fee_usd, 2) then
        return json_build_object('error', 'below_minimum');
      end if;
    else
      v_fee := round(v_crypto_fee_usd * v_rub_per_usd, 2);
      if p_amount < v_min_rub + v_fee then
        return json_build_object('error', 'below_minimum');
      end if;
    end if;
  else
    if v_amount_rub < v_min_rub then
      return json_build_object('error', 'below_minimum');
    end if;
    if v_currency = 'rub' then
      v_fee := round(p_amount * v_card_pct + v_card_fixed_rub, 2);
    else
      v_fee := round(p_amount * v_card_pct + round(v_card_fixed_rub / v_rub_per_usd, 2), 2);
    end if;
  end if;

  v_net := round(p_amount - v_fee, 2);

  if v_fee >= p_amount or v_net <= 0 then
    return json_build_object('error', 'fee_too_high');
  end if;

  if v_balance < p_amount then
    return json_build_object('error', 'insufficient_balance');
  end if;

  update profiles set balance = balance - p_amount where id = p_user_id;

  insert into withdrawal_requests (
    user_id, method, amount, fee, net_amount, currency, destination, status
  )
  values (
    p_user_id, p_method, p_amount, v_fee, v_net, v_currency, v_dest, 'pending'
  )
  returning id into v_request_id;

  insert into transactions (user_id, type, amount, description)
  values (
    p_user_id,
    'withdrawal',
    -p_amount,
    'withdrawal:' || p_method || ':' || v_request_id::text
  );

  return json_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount', p_amount,
    'fee', v_fee,
    'net_amount', v_net,
    'currency', v_currency
  );
end;
$$;

-- Публичная статистика продавца
create or replace view public.marketplace_seller_stats as
select
  p.id as seller_id,
  count(distinct mp.id) filter (where mp.status = 'completed') as completed_sales,
  coalesce(round(avg(mr.rating)::numeric, 2), 0) as avg_rating,
  count(mr.id)::int as review_count
from public.profiles p
left join public.marketplace_purchases mp on mp.seller_id = p.id
left join public.marketplace_reviews mr on mr.seller_id = p.id
where exists (
  select 1 from public.marketplace_listings ml where ml.seller_id = p.id
)
group by p.id;

grant select on public.marketplace_seller_stats to anon, authenticated;