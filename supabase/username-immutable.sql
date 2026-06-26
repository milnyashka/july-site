-- Никнейм нельзя менять после установки (только первый раз)
-- Запусти в Supabase SQL Editor, если add-usernames.sql уже был применён раньше

create or replace function public.set_username(
  p_user_id uuid,
  p_username text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_clean text;
  v_current text;
  v_email text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return json_build_object('error', 'unauthorized');
  end if;

  v_clean := trim(p_username);

  if v_clean is null or v_clean = '' then
    return json_build_object('error', 'invalid_format');
  end if;

  if v_clean !~ '^[a-zA-Z]{6,20}$' then
    return json_build_object('error', 'invalid_format');
  end if;

  select username into v_current
  from public.profiles
  where id = p_user_id;

  if not found then
    select lower(email) into v_email from auth.users where id = p_user_id;
    if v_email is null then
      return json_build_object('error', 'no_profile');
    end if;
    insert into public.profiles (id, email, currency)
    values (p_user_id, v_email, 'rub')
    on conflict (id) do nothing;
    v_current := null;
  end if;

  if v_current is not null and v_current <> '' then
    return json_build_object('error', 'already_set');
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(v_clean)
      and id <> p_user_id
  ) then
    return json_build_object('error', 'taken');
  end if;

  update public.profiles
  set username = v_clean
  where id = p_user_id
    and (username is null or username = '');

  if not found then
    return json_build_object('error', 'no_profile');
  end if;

  return json_build_object('success', true, 'username', v_clean);
end;
$$;