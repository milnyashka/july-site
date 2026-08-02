-- Таблица реферальных промокодов
create table if not exists public.referral_promocodes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  discount_percent numeric not null default 15,
  commission_percent numeric not null default 15,
  max_discounted_purchases integer not null default 3,
  created_at timestamptz not null default now()
);

-- Индексы и RLS
create index if not exists referral_promocodes_code_idx on public.referral_promocodes (lower(code));
create index if not exists referral_promocodes_owner_idx on public.referral_promocodes (owner_id);

alter table public.referral_promocodes enable row level security;

drop policy if exists "Anyone can read promocodes" on public.referral_promocodes;
create policy "Anyone can read promocodes" on public.referral_promocodes
  for select using (true);

-- Новые колонки в профилях пользователей
alter table public.profiles add column if not exists referred_by_code text;
alter table public.profiles add column if not exists referred_by_owner_id uuid;
alter table public.profiles add column if not exists discounted_purchases_count integer default 0;

-- Функция проверки промокода
create or replace function public.check_promocode(p_code text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_promo public.referral_promocodes%rowtype;
  v_owner_email text;
begin
  select * into v_promo
  from referral_promocodes
  where lower(code) = lower(trim(p_code));

  if v_promo.id is null then
    return json_build_object('valid', false, 'error', 'not_found');
  end if;

  select email into v_owner_email from profiles where id = v_promo.owner_id;

  return json_build_object(
    'valid', true,
    'code', v_promo.code,
    'owner_id', v_promo.owner_id,
    'owner_email', v_owner_email,
    'discount_percent', v_promo.discount_percent
  );
end;
$$;

-- Функция привязки промокода к пользователю
create or replace function public.apply_registration_promocode(p_user_id uuid, p_code text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_promo public.referral_promocodes%rowtype;
begin
  select * into v_promo
  from referral_promocodes
  where lower(code) = lower(trim(p_code));

  if v_promo.id is null then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  if v_promo.owner_id = p_user_id then
    return json_build_object('success', false, 'error', 'own_code');
  end if;

  update profiles
  set referred_by_code = v_promo.code,
      referred_by_owner_id = v_promo.owner_id,
      discounted_purchases_count = 0
  where id = p_user_id;

  return json_build_object('success', true, 'code', v_promo.code);
end;
$$;
