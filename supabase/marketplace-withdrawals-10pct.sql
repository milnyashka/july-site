-- Комиссия маркета 10% + вывод на крипту / карту RU
-- Запусти в Supabase SQL Editor

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  method text not null check (method in ('crypto', 'card')),
  amount numeric(10, 2) not null check (amount > 0),
  fee numeric(10, 2) not null check (fee >= 0),
  net_amount numeric(10, 2) not null check (net_amount > 0),
  currency text not null check (currency in ('rub', 'usd')),
  destination text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests (status, created_at desc);

create index if not exists withdrawal_requests_user_idx
  on public.withdrawal_requests (user_id, created_at desc);

alter table public.withdrawal_requests enable row level security;

drop policy if exists "Users read own withdrawals" on public.withdrawal_requests;
create policy "Users read own withdrawals" on public.withdrawal_requests
  for select using (auth.uid() = user_id);

-- Типы транзакций: вывод
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in (
    'topup', 'purchase', 'marketplace_buy', 'marketplace_sale',
    'withdrawal', 'withdrawal_refund'
  ));

-- Покупка на маркете: комиссия 10%
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
  v_commission constant numeric := 0.10;
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

  v_fee := round(v_listing.price * v_commission, 2);
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

-- Заявка на вывод (баланс списывается сразу)
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

-- Админ: завершить или отклонить (возврат на баланс)
create or replace function public.process_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_note text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_req public.withdrawal_requests%rowtype;
begin
  if p_action not in ('completed', 'rejected') then
    return json_build_object('error', 'invalid_action');
  end if;

  select * into v_req
  from withdrawal_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_req.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if p_action = 'rejected' then
    update profiles
    set balance = balance + v_req.amount
    where id = v_req.user_id;

    insert into transactions (user_id, type, amount, description)
    values (
      v_req.user_id,
      'withdrawal_refund',
      v_req.amount,
      'withdrawal_refund:' || v_req.id::text
    );
  end if;

  update withdrawal_requests
  set status = p_action,
      admin_note = nullif(trim(p_admin_note), ''),
      processed_at = now()
  where id = p_request_id;

  return json_build_object('success', true, 'status', p_action);
end;
$$;