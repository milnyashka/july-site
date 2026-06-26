-- Несколько ролей на аккаунт + логи модераторов
-- Запусти в Supabase SQL Editor

alter table public.profiles
  add column if not exists roles text[] not null default array['user']::text[];

-- Миграция из одиночного role
update public.profiles
set roles = array[role]::text[]
where role is not null
  and (roles is null or roles = '{}' or roles = array['user']::text[]);

update public.profiles
set roles = array['user']::text[]
where roles is null or cardinality(roles) = 0;

-- Синхронизация role = главная роль (макс. ранг)
create or replace function public.sync_profile_primary_role()
returns trigger
language plpgsql
as $$
declare
  r text;
  best text := 'user';
  rank int := 0;
  cur_rank int;
begin
  if new.roles is null or cardinality(new.roles) = 0 then
    new.roles := array['user']::text[];
  end if;

  foreach r in array new.roles loop
    cur_rank := case r
      when 'owner' then 100
      when 'moderator_senior' then 80
      when 'moderator' then 70
      when 'seller' then 50
      when 'reseller' then 40
      when 'user' then 10
      else 0
    end;
    if cur_rank > rank then
      rank := cur_rank;
      best := r;
    end if;
  end loop;

  new.role := best;
  return new;
end;
$$;

drop trigger if exists profiles_sync_primary_role on public.profiles;
create trigger profiles_sync_primary_role
  before insert or update of roles on public.profiles
  for each row execute function public.sync_profile_primary_role();

update public.profiles set roles = roles;

-- Логи модераторов
create table if not exists public.moderator_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text not null,
  actor_roles text[] not null default '{}',
  action text not null,
  target_email text,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists moderator_logs_created_idx
  on public.moderator_logs (created_at desc);

alter table public.moderator_logs enable row level security;

-- purchase_plan: reseller в массиве roles
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
  v_roles text[];
  v_spent_usd numeric;
  v_tier_discount numeric := 0;
  v_amount_usd numeric;
  v_account_frozen boolean;
  v_balance_frozen boolean;
begin
  select balance, coalesce(roles, array['user']::text[]), account_frozen, balance_frozen
  into v_balance, v_roles, v_account_frozen, v_balance_frozen
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

  if p_reseller_pricing and 'reseller' = any(v_roles) then
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

-- protected: любая staff-роль в массиве
create or replace function public.moderate_user(
  p_target_email text,
  p_account_frozen boolean default null,
  p_balance_frozen boolean default null
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

  if coalesce(v_profile.roles, array[v_profile.role]::text[])
      && array['owner', 'moderator', 'moderator_senior']::text[] then
    return json_build_object('error', 'protected_role');
  end if;

  update profiles set
    account_frozen = coalesce(p_account_frozen, account_frozen),
    balance_frozen = coalesce(p_balance_frozen, balance_frozen)
  where id = v_profile.id
  returning * into v_profile;

  return json_build_object(
    'success', true,
    'email', v_profile.email,
    'role', v_profile.role,
    'roles', v_profile.roles,
    'balance', v_profile.balance,
    'currency', v_profile.currency,
    'account_frozen', v_profile.account_frozen,
    'balance_frozen', v_profile.balance_frozen
  );
end;
$$;

create or replace function public.moderator_zero_balance(p_target_email text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_balance numeric;
begin
  select * into v_profile
  from profiles
  where lower(email) = lower(trim(p_target_email))
  for update;

  if v_profile.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if coalesce(v_profile.roles, array[v_profile.role]::text[])
      && array['owner', 'moderator', 'moderator_senior']::text[] then
    return json_build_object('error', 'protected_role');
  end if;

  v_old_balance := v_profile.balance;

  if v_old_balance = 0 then
    return json_build_object(
      'success', true,
      'email', v_profile.email,
      'balance', 0,
      'currency', v_profile.currency,
      'zeroed', 0
    );
  end if;

  update profiles set balance = 0 where id = v_profile.id
  returning * into v_profile;

  insert into transactions (user_id, type, amount, description)
  values (v_profile.id, 'purchase', -v_old_balance, 'moderator:zero_balance');

  return json_build_object(
    'success', true,
    'email', v_profile.email,
    'balance', 0,
    'currency', v_profile.currency,
    'zeroed', v_old_balance
  );
end;
$$;

create or replace function public.moderator_delete_purchase(p_purchase_id uuid)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
  v_roles text[];
begin
  select * into v_purchase
  from purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  select coalesce(roles, array[role]::text[]) into v_roles
  from profiles where id = v_purchase.user_id;

  if v_roles && array['owner', 'moderator', 'moderator_senior']::text[] then
    return json_build_object('error', 'protected_role');
  end if;

  update license_keys
  set used = false, assigned_to = null, assigned_at = null
  where key = v_purchase.license_key;

  delete from purchases where id = v_purchase.id;

  return json_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'license_key', v_purchase.license_key,
    'plan_id', v_purchase.plan_id
  );
end;
$$;