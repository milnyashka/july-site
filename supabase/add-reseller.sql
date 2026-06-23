-- Run in Supabase SQL Editor

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'reseller'));

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
  v_role text;
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

  if v_role = 'reseller' then
    v_price := round(v_price * 0.5, 2);
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