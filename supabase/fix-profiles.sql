-- Run once if users exist in Auth but profiles table is empty

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);