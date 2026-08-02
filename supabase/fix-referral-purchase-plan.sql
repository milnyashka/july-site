-- Обновление Хранимой Процедуры purchase_plan с учетом 15% Реферальной скидки
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
  v_balance numeric;
  v_account_frozen boolean;
  v_balance_frozen boolean;
  v_roles text[];
  v_price numeric;
  v_spent_usd numeric := 0;
  v_tier_discount numeric := 0;
  v_key_id uuid;
  v_key text;
  v_purchase_id uuid;
  v_referred_by_code text;
  v_referred_by_owner_id uuid;
  v_discounted_purchases_count integer;
  v_has_referral_discount boolean := false;
begin
  select balance, account_frozen, balance_frozen, roles, referred_by_code, referred_by_owner_id, discounted_purchases_count
  into v_balance, v_account_frozen, v_balance_frozen, v_roles, v_referred_by_code, v_referred_by_owner_id, v_discounted_purchases_count
  from profiles
  where id = p_user_id;

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

  -- Накопительная скидка тира
  v_spent_usd := public.get_product_spend_usd(p_user_id);
  if v_spent_usd >= 500 then
    v_tier_discount := 0.20;
  elsif v_spent_usd >= 250 then
    v_tier_discount := 0.10;
  elsif v_spent_usd >= 100 then
    v_tier_discount := 0.05;
  end if;

  v_price := round(v_price * (1 - v_tier_discount), 2);

  -- 15% Реферальная скидка на первые 3 покупки
  if v_referred_by_owner_id is not null and coalesce(v_discounted_purchases_count, 0) < 3 then
    v_price := round(v_price * 0.85, 2);
    v_has_referral_discount := true;
  end if;

  if v_balance < v_price then
    return json_build_object('error', 'insufficient_balance');
  end if;

  select id, key into v_key_id, v_key
  from license_keys
  where plan_id = p_plan_id and used = false
  limit 1
  for update skip locked;

  if v_key_id is null then
    v_key := 'JULY-' || upper(p_plan_id) || '-' || upper(substring(md5(random()::text) from 1 for 6)) || '-' || upper(substring(md5(random()::text) from 1 for 6));
  else
    update license_keys
    set used = true,
        assigned_to = p_user_id,
        assigned_at = now()
    where id = v_key_id;
  end if;

  -- Списание баланса и инкремент счетчика скидок
  update profiles
  set balance = balance - v_price,
      discounted_purchases_count = case when v_has_referral_discount then coalesce(discounted_purchases_count, 0) + 1 else discounted_purchases_count end
  where id = p_user_id;

  -- Сохранение покупки
  insert into purchases (user_id, plan_id, license_key, amount, amount_usd, currency)
  values (
    p_user_id,
    p_plan_id,
    v_key,
    v_price,
    case when p_currency = 'rub' then round(v_price / 90.0, 2) else v_price end,
    p_currency
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (p_user_id, 'purchase', -v_price, 'Покупка ключа ' || p_plan_id);

  return json_build_object(
    'success', true,
    'key', v_key,
    'purchase_id', v_purchase_id,
    'amount_paid', v_price,
    'plan_id', p_plan_id
  );
end;
$$;
