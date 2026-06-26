-- Reseller -50% only when purchased via reseller flow (p_reseller_pricing = true)
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