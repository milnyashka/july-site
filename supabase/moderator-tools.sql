-- Модератор: любой юзер (кроме staff), ключи, заморозка, обнуление баланса
-- Запусти в Supabase SQL Editor после add-roles-system.sql

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

  if v_profile.role in ('owner', 'moderator', 'moderator_senior') then
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

  if v_profile.role in ('owner', 'moderator', 'moderator_senior') then
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
  v_role text;
begin
  select * into v_purchase
  from purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  select role into v_role from profiles where id = v_purchase.user_id;

  if v_role in ('owner', 'moderator', 'moderator_senior') then
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

-- Старая функция → обёртка без licenses_hidden
drop function if exists public.moderate_reseller(text, boolean, boolean, boolean);

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
begin
  return moderate_user(p_target_email, p_account_frozen, p_balance_frozen);
end;
$$;