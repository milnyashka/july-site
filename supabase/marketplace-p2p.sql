-- P2P маркет между пользователями
-- Запусти в Supabase SQL Editor после add-roles-system.sql

alter table public.marketplace_listings
  add column if not exists delivery_content text not null default '',
  add column if not exists category text not null default 'other'
    check (category in ('accounts', 'keys', 'tools', 'other')),
  add column if not exists buyer_id uuid references public.profiles (id),
  add column if not exists sold_at timestamptz;

create table if not exists public.marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  price numeric(10, 2) not null,
  currency text not null check (currency in ('rub', 'usd')),
  fee numeric(10, 2) not null,
  seller_payout numeric(10, 2) not null,
  delivery_content text not null,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_purchases_buyer_idx
  on public.marketplace_purchases (buyer_id, created_at desc);

create index if not exists marketplace_purchases_seller_idx
  on public.marketplace_purchases (seller_id, created_at desc);

alter table public.marketplace_purchases enable row level security;

drop policy if exists "Buyers read own marketplace purchases" on public.marketplace_purchases;
create policy "Buyers read own marketplace purchases" on public.marketplace_purchases
  for select using (auth.uid() = buyer_id);

drop policy if exists "Sellers read own marketplace sales" on public.marketplace_purchases;
create policy "Sellers read own marketplace sales" on public.marketplace_purchases
  for select using (auth.uid() = seller_id);

-- Расширить типы транзакций
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('topup', 'purchase', 'marketplace_buy', 'marketplace_sale'));

-- Публичный каталог без delivery_content
create or replace view public.marketplace_listings_public as
select
  id,
  seller_id,
  title,
  description,
  price,
  currency,
  category,
  status,
  created_at,
  updated_at
from public.marketplace_listings;

grant select on public.marketplace_listings_public to anon, authenticated;

-- Атомарная покупка листинга
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
  v_fee numeric;
  v_payout numeric;
  v_purchase_id uuid;
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

  if v_buyer_currency <> v_listing.currency then
    return json_build_object('error', 'currency_mismatch');
  end if;

  if v_buyer_balance < v_listing.price then
    return json_build_object('error', 'insufficient_balance');
  end if;

  select balance into v_seller_balance
  from profiles where id = v_listing.seller_id for update;

  if v_seller_balance is null then
    return json_build_object('error', 'seller_not_found');
  end if;

  v_fee := round(v_listing.price * 0.05, 2);
  v_payout := round(v_listing.price - v_fee, 2);

  update profiles set balance = balance - v_listing.price where id = p_buyer_id;
  update profiles set balance = balance + v_payout where id = v_listing.seller_id;

  update marketplace_listings
  set status = 'sold',
      buyer_id = p_buyer_id,
      sold_at = now(),
      updated_at = now()
  where id = p_listing_id;

  insert into marketplace_purchases (
    listing_id, buyer_id, seller_id, title, price, currency,
    fee, seller_payout, delivery_content
  )
  values (
    v_listing.id, p_buyer_id, v_listing.seller_id, v_listing.title,
    v_listing.price, v_listing.currency, v_fee, v_payout, v_listing.delivery_content
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (
    p_buyer_id,
    'marketplace_buy',
    -v_listing.price,
    'marketplace:' || v_listing.title
  );

  insert into transactions (user_id, type, amount, description)
  values (
    v_listing.seller_id,
    'marketplace_sale',
    v_payout,
    'marketplace_sale:' || v_listing.title
  );

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'delivery_content', v_listing.delivery_content,
    'title', v_listing.title,
    'price', v_listing.price
  );
end;
$$;