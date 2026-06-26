-- Причина заморозки аккаунта
alter table public.profiles
  add column if not exists account_freeze_reason text;

create or replace function public.moderate_user(
  p_target_email text,
  p_account_frozen boolean default null,
  p_balance_frozen boolean default null,
  p_freeze_reason text default null
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
    account_frozen = case
      when p_account_frozen is not null then p_account_frozen
      else account_frozen
    end,
    account_freeze_reason = case
      when p_account_frozen = true then nullif(trim(p_freeze_reason), '')
      when p_account_frozen = false then null
      else account_freeze_reason
    end,
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
    'balance_frozen', v_profile.balance_frozen,
    'account_freeze_reason', v_profile.account_freeze_reason
  );
end;
$$;