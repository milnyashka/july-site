-- Маркет v2: все юзеры продают, RU/EN описания, чат buyer↔seller
-- Запусти в Supabase SQL Editor

-- Двуязычные поля лота
alter table public.marketplace_listings
  add column if not exists title_ru text,
  add column if not exists title_en text,
  add column if not exists description_ru text not null default '',
  add column if not exists description_en text not null default '';

update public.marketplace_listings
set
  title_ru = coalesce(title_ru, title),
  title_en = coalesce(title_en, title),
  description_ru = case when description_ru = '' then coalesce(description, '') else description_ru end,
  description_en = case when description_en = '' then coalesce(description, '') else description_en end
where title_ru is null or title_en is null;

alter table public.marketplace_listings
  alter column title_ru set not null,
  alter column title_en set not null;

-- Публичный каталог
drop view if exists public.marketplace_listings_public;
create view public.marketplace_listings_public as
select
  id,
  seller_id,
  title,
  title_ru,
  title_en,
  description,
  description_ru,
  description_en,
  price,
  currency,
  category,
  status,
  created_at,
  updated_at
from public.marketplace_listings;

grant select on public.marketplace_listings_public to anon, authenticated;

-- Чат
create table if not exists public.marketplace_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.marketplace_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_threads_buyer_idx
  on public.marketplace_threads (buyer_id, updated_at desc);

create index if not exists marketplace_threads_seller_idx
  on public.marketplace_threads (seller_id, updated_at desc);

create index if not exists marketplace_messages_thread_idx
  on public.marketplace_messages (thread_id, created_at asc);

alter table public.marketplace_threads enable row level security;
alter table public.marketplace_messages enable row level security;

drop policy if exists "Participants read threads" on public.marketplace_threads;
create policy "Participants read threads" on public.marketplace_threads
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers create threads" on public.marketplace_threads;
create policy "Buyers create threads" on public.marketplace_threads
  for insert with check (auth.uid() = buyer_id and buyer_id <> seller_id);

drop policy if exists "Participants read messages" on public.marketplace_messages;
create policy "Participants read messages" on public.marketplace_messages
  for select using (
    exists (
      select 1 from public.marketplace_threads t
      where t.id = thread_id
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

drop policy if exists "Participants send messages" on public.marketplace_messages;
create policy "Participants send messages" on public.marketplace_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.marketplace_threads t
      where t.id = thread_id
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

-- Обновить purchase: title из RU (fallback)
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
  v_seller_balance numeric;
  v_buyer_charge numeric;
  v_fee numeric;
  v_payout numeric;
  v_purchase_id uuid;
  v_title text;
  v_rub_per_usd constant numeric := 79;
begin
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

  select balance into v_seller_balance
  from profiles where id = v_listing.seller_id for update;

  if v_seller_balance is null then
    return json_build_object('error', 'seller_not_found');
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

  v_fee := round(v_listing.price * 0.05, 2);
  v_payout := round(v_listing.price - v_fee, 2);

  update profiles set balance = balance - v_buyer_charge where id = p_buyer_id;
  update profiles set balance = balance + v_payout where id = v_listing.seller_id;

  update marketplace_listings
  set status = 'sold',
      buyer_id = p_buyer_id,
      sold_at = now(),
      updated_at = now()
  where id = p_listing_id;

  insert into marketplace_purchases (
    listing_id, buyer_id, seller_id, title, price, currency,
    fee, seller_payout, delivery_content, buyer_paid, buyer_currency
  )
  values (
    v_listing.id, p_buyer_id, v_listing.seller_id, v_title,
    v_listing.price, v_listing.currency, v_fee, v_payout, v_listing.delivery_content,
    v_buyer_charge, v_buyer_currency
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (p_buyer_id, 'marketplace_buy', -v_buyer_charge, 'marketplace:' || v_title);

  insert into transactions (user_id, type, amount, description)
  values (v_listing.seller_id, 'marketplace_sale', v_payout, 'marketplace_sale:' || v_title);

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'delivery_content', v_listing.delivery_content,
    'title', v_title,
    'price', v_listing.price,
    'listing_currency', v_listing.currency,
    'buyer_paid', v_buyer_charge,
    'buyer_currency', v_buyer_currency
  );
end;
$$;