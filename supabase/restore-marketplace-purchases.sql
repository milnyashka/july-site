-- Восстановление public.marketplace_purchases (безопасно перезапускать)
-- Нужны: public.profiles + public.marketplace_listings
-- НЕ трогает transactions_type_check (частая причина ошибки в marketplace-p2p.sql)

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception 'Нет таблицы profiles — сначала запусти schema.sql';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'marketplace_listings'
  ) then
    raise exception 'Нет таблицы marketplace_listings — сначала запусти add-roles-system.sql';
  end if;
end $$;

-- колонки листингов (нужны для FK и покупки)
alter table public.marketplace_listings
  add column if not exists delivery_content text not null default '';

alter table public.marketplace_listings
  add column if not exists category text not null default 'other';

alter table public.marketplace_listings
  add column if not exists buyer_id uuid references public.profiles (id);

alter table public.marketplace_listings
  add column if not exists sold_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_listings_category_check'
  ) then
    alter table public.marketplace_listings
      add constraint marketplace_listings_category_check
      check (category in ('accounts', 'keys', 'tools', 'other'));
  end if;
end $$;

-- сама таблица покупок
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

alter table public.marketplace_purchases
  add column if not exists buyer_paid numeric(10, 2);

alter table public.marketplace_purchases
  add column if not exists buyer_currency text;

alter table public.marketplace_purchases
  add column if not exists status text not null default 'open';

alter table public.marketplace_purchases
  add column if not exists reviewed_at timestamptz;

alter table public.marketplace_purchases
  add column if not exists reviewed_by uuid references public.profiles (id);

alter table public.marketplace_purchases
  add column if not exists reject_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_purchases_buyer_currency_check'
  ) then
    alter table public.marketplace_purchases
      add constraint marketplace_purchases_buyer_currency_check
      check (buyer_currency is null or buyer_currency in ('rub', 'usd'));
  end if;
end $$;

alter table public.marketplace_purchases drop constraint if exists marketplace_purchases_status_check;
alter table public.marketplace_purchases
  add constraint marketplace_purchases_status_check
  check (status in ('open', 'pending_review', 'completed', 'rejected', 'disputed', 'refunded'));

create index if not exists marketplace_purchases_buyer_idx
  on public.marketplace_purchases (buyer_id, created_at desc);

create index if not exists marketplace_purchases_seller_idx
  on public.marketplace_purchases (seller_id, created_at desc);

create index if not exists marketplace_purchases_status_idx
  on public.marketplace_purchases (status, created_at desc);

alter table public.marketplace_purchases enable row level security;

drop policy if exists "Buyers read own marketplace purchases" on public.marketplace_purchases;
create policy "Buyers read own marketplace purchases" on public.marketplace_purchases
  for select using (auth.uid() = buyer_id);

drop policy if exists "Sellers read own marketplace sales" on public.marketplace_purchases;
create policy "Sellers read own marketplace sales" on public.marketplace_purchases
  for select using (auth.uid() = seller_id);