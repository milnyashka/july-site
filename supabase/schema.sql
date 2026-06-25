-- Run in Supabase SQL Editor (https://supabase.com/dashboard)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  balance numeric(10, 2) not null default 0 check (balance >= 0),
  currency text not null default 'usd' check (currency in ('rub', 'usd')),
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'reseller')),
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  price numeric(10, 2) not null,
  price_rub numeric(10, 2) not null,
  price_usd numeric(10, 2) not null,
  duration_hours int,
  duration_days int,
  sort_order int not null default 0
);

insert into public.plans (id, price, price_rub, price_usd, duration_hours, duration_days, sort_order) values
  ('3h', 0.15, 10.00, 0.15, 3, null, 1),
  ('6h', 0.20, 15.00, 0.20, 6, null, 2),
  ('12h', 0.45, 38.00, 0.45, 12, null, 3),
  ('1d', 0.70, 55.00, 0.70, null, 1, 4),
  ('7d', 4.50, 350.00, 4.50, null, 7, 5),
  ('14d', 6.80, 539.00, 6.80, null, 14, 6),
  ('30d', 11.00, 849.00, 11.00, null, 30, 7)
on conflict (id) do nothing;

create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  plan_id text not null references public.plans (id),
  used boolean not null default false,
  assigned_to uuid references public.profiles (id),
  assigned_at timestamptz
);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null,
  method text not null check (method in ('crypto', 'card', 'sbp', 'cryptobot')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  external_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('topup', 'purchase')),
  amount numeric(10, 2) not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  license_key text not null,
  amount numeric(10, 2) not null,
  amount_usd numeric(10, 2),
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, currency)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'currency', 'usd')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atomic purchase: deduct balance + assign key
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
begin
  if p_currency = 'rub' then
    select price_rub into v_price from plans where id = p_plan_id;
  else
    select price_usd into v_price from plans where id = p_plan_id;
  end if;
  if v_price is null then
    return json_build_object('error', 'invalid_plan');
  end if;

  select balance, coalesce(role, 'user') into v_balance, v_role
  from profiles where id = p_user_id for update;

  if v_balance is null then
    return json_build_object('error', 'no_profile');
  end if;

  if p_reseller_pricing and v_role = 'reseller' then
    v_price := round(v_price * 0.5, 2);
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

-- Add balance after confirmed top-up
create or replace function public.add_balance(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_topup_id uuid default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
begin
  if p_amount <= 0 then
    return json_build_object('error', 'invalid_amount');
  end if;

  update profiles set balance = balance + p_amount where id = p_user_id;

  insert into transactions (user_id, type, amount, description)
  values (p_user_id, 'topup', p_amount, p_description);

  if p_topup_id is not null then
    update topup_requests set status = 'paid' where id = p_topup_id;
  end if;

  return json_build_object('success', true);
end;
$$;

-- RLS (safe to re-run)
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.purchases enable row level security;
alter table public.topup_requests enable row level security;
alter table public.license_keys enable row level security;
alter table public.plans enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Users read own transactions" on public.transactions;
create policy "Users read own transactions" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Users read own purchases" on public.purchases;
create policy "Users read own purchases" on public.purchases
  for select using (auth.uid() = user_id);

drop policy if exists "Users read own topups" on public.topup_requests;
create policy "Users read own topups" on public.topup_requests
  for select using (auth.uid() = user_id);

drop policy if exists "Anyone reads plans" on public.plans;
create policy "Anyone reads plans" on public.plans
  for select using (true);

-- Seed example keys (replace with your real keys)
insert into public.license_keys (key, plan_id) values
  ('JULY-3H-DEMO-0001', '3h'),
  ('JULY-6H-DEMO-0001', '6h'),
  ('JULY-12H-DEMO-0001', '12h'),
  ('JULY-1D-DEMO-0001', '1d'),
  ('JULY-7D-DEMO-0001', '7d'),
  ('JULY-14D-DEMO-0001', '14d'),
  ('JULY-30D-DEMO-0001', '30d')
on conflict (key) do nothing;