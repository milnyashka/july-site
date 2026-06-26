-- Открытые сделки: без премодерации, чат, спор → модератор
-- Запусти в Supabase SQL Editor после marketplace-spendable-balance.sql

-- last seen
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create or replace view public.profiles_public as
select id, username, avatar_url, last_seen_at
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- статус open
alter table public.marketplace_purchases drop constraint if exists marketplace_purchases_status_check;
alter table public.marketplace_purchases
  add constraint marketplace_purchases_status_check
  check (status in ('open', 'pending_review', 'completed', 'rejected', 'disputed', 'refunded'));

-- Покупка → открытая сделка (без выплаты продавцу)
create or replace function public.purchase_marketplace_listing(
  p_buyer_id uuid,
  p_listing_id uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_buyer_currency text;
  v_buyer_frozen_acc boolean;
  v_buyer_frozen_bal boolean;
  v_available numeric;
  v_buyer_charge numeric;
  v_fee numeric;
  v_payout numeric;
  v_purchase_id uuid;
  v_title text;
  v_rub_per_usd constant numeric := 79;
  v_commission constant numeric := 0.10;
begin
  perform release_marketplace_holds(p_buyer_id);

  select * into v_listing
  from marketplace_listings
  where id = p_listing_id and status = 'active'
  for update;

  if v_listing.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if v_listing.seller_id = p_buyer_id then
    return json_build_object('error', 'own_listing');
  end if;

  if coalesce(trim(v_listing.delivery_content), '') = '' then
    return json_build_object('error', 'no_delivery');
  end if;

  v_title := coalesce(nullif(trim(v_listing.title_ru), ''), nullif(trim(v_listing.title_en), ''), v_listing.title);

  select currency, account_frozen, balance_frozen
  into v_buyer_currency, v_buyer_frozen_acc, v_buyer_frozen_bal
  from profiles where id = p_buyer_id for update;

  if v_buyer_currency is null then
    return json_build_object('error', 'no_profile');
  end if;

  if v_buyer_frozen_acc then
    return json_build_object('error', 'account_frozen');
  end if;

  if v_buyer_frozen_bal then
    return json_build_object('error', 'balance_frozen');
  end if;

  v_available := get_available_balance(p_buyer_id);

  if v_buyer_currency = v_listing.currency then
    v_buyer_charge := v_listing.price;
  elsif v_listing.currency = 'usd' and v_buyer_currency = 'rub' then
    v_buyer_charge := round(v_listing.price * v_rub_per_usd, 2);
  elsif v_listing.currency = 'rub' and v_buyer_currency = 'usd' then
    v_buyer_charge := round(v_listing.price / v_rub_per_usd, 2);
  else
    return json_build_object('error', 'currency_mismatch');
  end if;

  if v_available < v_buyer_charge then
    return json_build_object('error', 'insufficient_balance');
  end if;

  v_fee := round(v_listing.price * v_commission, 2);
  v_payout := round(v_listing.price - v_fee, 2);

  update profiles set balance = balance - v_buyer_charge where id = p_buyer_id;

  update marketplace_listings
  set status = 'sold',
      buyer_id = p_buyer_id,
      sold_at = now(),
      updated_at = now()
  where id = p_listing_id;

  insert into marketplace_purchases (
    listing_id, buyer_id, seller_id, title, price, currency,
    fee, seller_payout, delivery_content, buyer_paid, buyer_currency, status
  )
  values (
    v_listing.id, p_buyer_id, v_listing.seller_id, v_title,
    v_listing.price, v_listing.currency, v_fee, v_payout, v_listing.delivery_content,
    v_buyer_charge, v_buyer_currency, 'open'
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (p_buyer_id, 'marketplace_buy', -v_buyer_charge, 'marketplace:' || v_title);

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'status', 'open',
    'title', v_title,
    'price', v_listing.price,
    'listing_currency', v_listing.currency,
    'buyer_paid', v_buyer_charge,
    'buyer_currency', v_buyer_currency,
    'delivery_content', v_listing.delivery_content
  );
end;
$$;

-- Покупатель подтверждает сделку → выплата продавцу
create or replace function public.confirm_marketplace_purchase(
  p_buyer_id uuid,
  p_purchase_id uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.marketplace_purchases%rowtype;
begin
  select * into v_purchase
  from marketplace_purchases
  where id = p_purchase_id and buyer_id = p_buyer_id and status = 'open'
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  update marketplace_purchases
  set status = 'completed',
      reviewed_at = now()
  where id = p_purchase_id;

  update profiles
  set balance = balance + v_purchase.seller_payout
  where id = v_purchase.seller_id;

  insert into transactions (user_id, type, amount, description)
  values (
    v_purchase.seller_id,
    'marketplace_sale',
    v_purchase.seller_payout,
    'marketplace_sale:' || v_purchase.title
  );

  insert into marketplace_balance_holds (
    purchase_id, seller_id, amount, currency, release_at, balance_credited
  )
  values (
    v_purchase.id,
    v_purchase.seller_id,
    v_purchase.seller_payout,
    v_purchase.currency,
    now() + interval '24 hours',
    true
  )
  on conflict (purchase_id) do nothing;

  return json_build_object(
    'success', true,
    'status', 'completed',
    'seller_payout', v_purchase.seller_payout
  );
end;
$$;

grant execute on function public.confirm_marketplace_purchase(uuid, uuid) to authenticated;

-- Возврат покупателю + снова активный лот
create or replace function public.refund_marketplace_purchase(
  p_purchase_id uuid,
  p_actor_id uuid,
  p_reason text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.marketplace_purchases%rowtype;
  v_seller_available numeric;
  v_hold public.marketplace_balance_holds%rowtype;
begin
  select * into v_purchase
  from marketplace_purchases
  where id = p_purchase_id
    and status in ('open', 'disputed', 'completed', 'pending_review')
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if v_purchase.status = 'completed' or v_purchase.status = 'disputed' then
    v_seller_available := get_available_balance(v_purchase.seller_id);
    if v_seller_available < v_purchase.buyer_paid then
      return json_build_object('error', 'insufficient_seller_balance');
    end if;

    update profiles
    set balance = balance - v_purchase.buyer_paid
    where id = v_purchase.seller_id;

    select * into v_hold
    from marketplace_balance_holds
    where purchase_id = p_purchase_id and released_at is null
    for update;

    if v_hold.id is not null then
      update marketplace_balance_holds
      set released_at = now()
      where id = v_hold.id;
    end if;
  end if;

  update profiles
  set balance = balance + v_purchase.buyer_paid
  where id = v_purchase.buyer_id;

  insert into transactions (user_id, type, amount, description)
  values (
    v_purchase.buyer_id,
    'marketplace_buy',
    v_purchase.buyer_paid,
    'marketplace_refund:' || v_purchase.title
  );

  update marketplace_listings
  set status = 'active',
      buyer_id = null,
      sold_at = null,
      updated_at = now()
  where id = v_purchase.listing_id;

  update marketplace_purchases
  set status = 'refunded',
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      reject_reason = nullif(trim(p_reason), '')
  where id = p_purchase_id;

  update marketplace_disputes
  set status = 'resolved',
      resolved_at = now()
  where purchase_id = p_purchase_id and status = 'open';

  return json_build_object('success', true, 'status', 'refunded');
end;
$$;

grant execute on function public.refund_marketplace_purchase(uuid, uuid, text) to authenticated;

-- Продавец инициирует возврат
create or replace function public.seller_refund_marketplace_purchase(
  p_seller_id uuid,
  p_purchase_id uuid,
  p_reason text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.marketplace_purchases%rowtype;
begin
  select * into v_purchase
  from marketplace_purchases
  where id = p_purchase_id and seller_id = p_seller_id
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  return refund_marketplace_purchase(p_purchase_id, p_seller_id, p_reason);
end;
$$;

grant execute on function public.seller_refund_marketplace_purchase(uuid, uuid, text) to authenticated;

-- Модератор: завершить в пользу продавца
create or replace function public.approve_marketplace_purchase(
  p_purchase_id uuid,
  p_reviewer_id uuid default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.marketplace_purchases%rowtype;
begin
  select * into v_purchase
  from marketplace_purchases
  where id = p_purchase_id and status in ('pending_review', 'open', 'disputed')
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
  end if;

  if v_purchase.status = 'completed' then
    return json_build_object('success', true, 'status', 'completed');
  end if;

  update marketplace_purchases
  set status = 'completed',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
  where id = p_purchase_id;

  update profiles
  set balance = balance + v_purchase.seller_payout
  where id = v_purchase.seller_id;

  insert into transactions (user_id, type, amount, description)
  values (
    v_purchase.seller_id,
    'marketplace_sale',
    v_purchase.seller_payout,
    'marketplace_sale:' || v_purchase.title
  );

  insert into marketplace_balance_holds (
    purchase_id, seller_id, amount, currency, release_at, balance_credited
  )
  values (
    v_purchase.id,
    v_purchase.seller_id,
    v_purchase.seller_payout,
    v_purchase.currency,
    now() + interval '24 hours',
    true
  )
  on conflict (purchase_id) do nothing;

  update marketplace_disputes
  set status = 'resolved',
      resolved_at = now()
  where purchase_id = p_purchase_id and status = 'open';

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase.id,
    'status', 'completed',
    'delivery_content', v_purchase.delivery_content,
    'seller_payout', v_purchase.seller_payout,
    'hold_release_at', (now() + interval '24 hours')
  );
end;
$$;

-- Модератор: возврат покупателю
create or replace function public.reject_marketplace_purchase(
  p_purchase_id uuid,
  p_reviewer_id uuid default null,
  p_reason text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
begin
  return refund_marketplace_purchase(p_purchase_id, p_reviewer_id, p_reason);
end;
$$;

-- heartbeat
create or replace function public.touch_last_seen(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return;
  end if;
  update profiles set last_seen_at = now() where id = p_user_id;
end;
$$;

grant execute on function public.touch_last_seen(uuid) to authenticated;