-- 6 ролей + заморозки + reseller −40% + маркет (заготовка)
-- Запусти в Supabase SQL Editor

-- Снять старый check на role
alter table public.profiles drop constraint if exists profiles_role_check;

-- Новые поля заморозки
alter table public.profiles
  add column if not exists account_frozen boolean not null default false,
  add column if not exists balance_frozen boolean not null default false,
  add column if not exists licenses_hidden boolean not null default false;

-- Миграция старых ролей
update public.profiles set role = 'user' where role is null or role not in (
  'owner', 'moderator', 'moderator_senior', 'reseller', 'user', 'seller'
);

alter table public.profiles
  alter column role set default 'user';

alter table public.profiles
  add constraint profiles_role_check check (
    role in ('owner', 'moderator', 'moderator_senior', 'reseller', 'user', 'seller')
  );

-- Маркет: P2P листинги (роль seller)
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price > 0),
  currency text not null default 'usd' check (currency in ('rub', 'usd')),
  status text not null default 'draft' check (status in ('draft', 'active', 'sold', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_listings_seller_idx
  on public.marketplace_listings (seller_id);

create index if not exists marketplace_listings_status_idx
  on public.marketplace_listings (status) where status = 'active';

alter table public.marketplace_listings enable row level security;

drop policy if exists "Anyone reads active listings" on public.marketplace_listings;
create policy "Anyone reads active listings" on public.marketplace_listings
  for select using (status = 'active');

drop policy if exists "Sellers manage own listings" on public.marketplace_listings;
create policy "Sellers manage own listings" on public.marketplace_listings
  for all using (auth.uid() = seller_id);

-- purchase_plan: reseller −40% (платишь 60%), проверка заморозок
create or replace function public.purchase_plan(
  p_user_id uuid,
  p_plan_id text,
  p_currency text default 'usd',
  p_reseller_pricing boolean default false
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_price numeric;
  v_balance numeric;
  v_key text;
  v_key_id uuid;
  v_role text;
  v_spent_usd numeric;
  v_tier_discount numeric := 0;
  v_amount_usd numeric;
  v_account_frozen boolean;
  v_balance_frozen boolean;
begin
  select balance, coalesce(role, 'user'), account_frozen, balance_frozen
  into v_balance, v_role, v_account_frozen, v_balance_frozen
  from profiles where id = p_user_id for update;

  if v_balance is null then
    return json_build_object('error', 'no_profile');
  end if;

  if v_account_frozen then
    return json_build_object('error', 'account_frozen');
  end if;

  if v_balance_frozen then
    return json_build_object('error', 'balance_frozen');
  end if;

  if p_currency = 'rub' then
    select price_rub into v_price from plans where id = p_plan_id;
  else
    select price_usd into v_price from plans where id = p_plan_id;
  end if;
  if v_price is null then
    return json_build_object('error', 'invalid_plan');
  end if;

  if p_reseller_pricing and v_role = 'reseller' then
    v_price := round(v_price * 0.6, 2);
  end if;

  select coalesce(sum(amount_usd), 0) into v_spent_usd
  from purchases where user_id = p_user_id;

  if v_spent_usd >= 500 then
    v_tier_discount := 0.20;
  elsif v_spent_usd >= 250 then
    v_tier_discount := 0.10;
  elsif v_spent_usd >= 100 then
    v_tier_discount := 0.05;
  end if;

  v_price := round(v_price * (1 - v_tier_discount), 2);

  if v_balance < v_price then
    return json_build_object('error', 'insufficient_balance');
  end if;

  select id, key into v_key_id, v_key
  from license_keys
  where plan_id = p_plan_id and used = false
  order by id
  limit 1
  for update skip locked;

  if v_key is null then
    return json_build_object('error', 'no_keys');
  end if;

  update profiles set balance = balance - v_price where id = p_user_id;
  update license_keys
  set used = true, assigned_to = p_user_id, assigned_at = now()
  where id = v_key_id;

  if p_currency = 'rub' then
    v_amount_usd := round(v_price / 79.0, 2);
  else
    v_amount_usd := v_price;
  end if;

  insert into purchases (user_id, plan_id, license_key, amount, amount_usd)
  values (p_user_id, p_plan_id, v_key, v_price, v_amount_usd);

  insert into transactions (user_id, type, amount, description)
  values (p_user_id, 'purchase', -v_price, 'purchase:' || p_plan_id);

  return json_build_object('success', true, 'key', v_key, 'plan_id', p_plan_id);
end;
$$;

-- Модератор: заморозка реселлера
create or replace function public.moderate_reseller(
  p_target_email text,
  p_account_frozen boolean default null,
  p_balance_frozen boolean default null,
  p_licenses_hidden boolean default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from profiles
  where lower(email) = lower(trim(p_target_email))
  for update;

  if v_profile.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if v_profile.role <> 'reseller' then
    return json_build_object('error', 'not_reseller');
  end if;

  update profiles set
    account_frozen = coalesce(p_account_frozen, account_frozen),
    balance_frozen = coalesce(p_balance_frozen, balance_frozen),
    licenses_hidden = coalesce(p_licenses_hidden, licenses_hidden)
  where id = v_profile.id
  returning * into v_profile;

  return json_build_object(
    'success', true,
    'email', v_profile.email,
    'role', v_profile.role,
    'account_frozen', v_profile.account_frozen,
    'balance_frozen', v_profile.balance_frozen,
    'licenses_hidden', v_profile.licenses_hidden
  );
end;
$$;