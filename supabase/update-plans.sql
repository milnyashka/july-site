-- Run in Supabase SQL Editor to migrate from old 4-plan setup
-- Safe to re-run: remaps old purchases, then removes legacy plans

alter table public.profiles
  add column if not exists currency text not null default 'usd'
  check (currency in ('rub', 'usd'));

alter table public.plans
  add column if not exists price_rub numeric(10, 2),
  add column if not exists price_usd numeric(10, 2),
  add column if not exists duration_hours int;

-- 1) Add new plans first (old IDs stay until references are cleared)
insert into public.plans (id, price, price_rub, price_usd, duration_hours, duration_days, sort_order) values
  ('3h', 0.15, 10.00, 0.15, 3, null, 1),
  ('6h', 0.20, 15.00, 0.20, 6, null, 2),
  ('12h', 0.45, 38.00, 0.45, 12, null, 3),
  ('1d', 0.70, 55.00, 0.70, null, 1, 4),
  ('7d', 4.50, 350.00, 4.50, null, 7, 5),
  ('14d', 6.80, 539.00, 6.80, null, 14, 6),
  ('30d', 11.00, 849.00, 11.00, null, 30, 7)
on conflict (id) do update set
  price = excluded.price,
  price_rub = excluded.price_rub,
  price_usd = excluded.price_usd,
  duration_hours = excluded.duration_hours,
  duration_days = excluded.duration_days,
  sort_order = excluded.sort_order;

-- 2) Remap historical purchases (FK blocks DELETE on plans otherwise)
update public.purchases set plan_id = '1d'  where plan_id = 'trial';
update public.purchases set plan_id = '7d'  where plan_id = 'week';
update public.purchases set plan_id = '30d' where plan_id = 'month';
update public.purchases set plan_id = '30d' where plan_id = 'lifetime';

-- 3) Remove legacy keys and plans
delete from public.license_keys where plan_id in ('trial', 'week', 'month', 'lifetime');
delete from public.plans where id in ('trial', 'week', 'month', 'lifetime');

insert into public.license_keys (key, plan_id) values
  ('JULY-3H-DEMO-0001', '3h'),
  ('JULY-6H-DEMO-0001', '6h'),
  ('JULY-12H-DEMO-0001', '12h'),
  ('JULY-1D-DEMO-0001', '1d'),
  ('JULY-7D-DEMO-0001', '7d'),
  ('JULY-14D-DEMO-0001', '14d'),
  ('JULY-30D-DEMO-0001', '30d')
on conflict (key) do nothing;

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

create or replace function public.purchase_plan(
  p_user_id uuid,
  p_plan_id text,
  p_currency text default 'usd'
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
begin
  if p_currency = 'rub' then
    select price_rub into v_price from plans where id = p_plan_id;
  else
    select price_usd into v_price from plans where id = p_plan_id;
  end if;

  if v_price is null then
    return json_build_object('error', 'invalid_plan');
  end if;

  select balance into v_balance from profiles where id = p_user_id for update;
  if v_balance is null then
    return json_build_object('error', 'no_profile');
  end if;
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

  insert into purchases (user_id, plan_id, license_key, amount)
  values (p_user_id, p_plan_id, v_key, v_price);

  insert into transactions (user_id, type, amount, description)
  values (p_user_id, 'purchase', -v_price, 'purchase:' || p_plan_id);

  return json_build_object('success', true, 'key', v_key, 'plan_id', p_plan_id);
end;
$$;