-- Автоконвертация валют при покупке на маркете (курс 79 ₽ = $1)
-- Запусти в Supabase SQL Editor

alter table public.marketplace_purchases
  add column if not exists buyer_paid numeric(10, 2),
  add column if not exists buyer_currency text check (buyer_currency in ('rub', 'usd'));

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
  v_buyer_balance numeric;
  v_buyer_currency text;
  v_buyer_frozen_acc boolean;
  v_buyer_frozen_bal boolean;
  v_seller_balance numeric;
  v_seller_currency text;
  v_buyer_charge numeric;
  v_fee numeric;
  v_payout numeric;
  v_purchase_id uuid;
  v_rub_per_usd constant numeric := 79;
begin
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

  select balance, currency, account_frozen, balance_frozen
  into v_buyer_balance, v_buyer_currency, v_buyer_frozen_acc, v_buyer_frozen_bal
  from profiles where id = p_buyer_id for update;

  if v_buyer_balance is null then
    return json_build_object('error', 'no_profile');
  end if;

  if v_buyer_frozen_acc then
    return json_build_object('error', 'account_frozen');
  end if;

  if v_buyer_frozen_bal then
    return json_build_object('error', 'balance_frozen');
  end if;

  select balance, currency into v_seller_balance, v_seller_currency
  from profiles where id = v_listing.seller_id for update;

  if v_seller_balance is null then
    return json_build_object('error', 'seller_not_found');
  end if;

  if v_buyer_currency = v_listing.currency then
    v_buyer_charge := v_listing.price;
  elsif v_listing.currency = 'usd' and v_buyer_currency = 'rub' then
    v_buyer_charge := round(v_listing.price * v_rub_per_usd, 2);
  elsif v_listing.currency = 'rub' and v_buyer_currency = 'usd' then
    v_buyer_charge := round(v_listing.price / v_rub_per_usd, 2);
  else
    return json_build_object('error', 'currency_mismatch');
  end if;

  if v_buyer_balance < v_buyer_charge then
    return json_build_object('error', 'insufficient_balance');
  end if;

  v_fee := round(v_listing.price * 0.05, 2);
  v_payout := round(v_listing.price - v_fee, 2);

  update profiles set balance = balance - v_buyer_charge where id = p_buyer_id;
  update profiles set balance = balance + v_payout where id = v_listing.seller_id;

  update marketplace_listings
  set status = 'sold',
      buyer_id = p_buyer_id,
      sold_at = now(),
      updated_at = now()
  where id = p_listing_id;

  insert into marketplace_purchases (
    listing_id, buyer_id, seller_id, title, price, currency,
    fee, seller_payout, delivery_content, buyer_paid, buyer_currency
  )
  values (
    v_listing.id, p_buyer_id, v_listing.seller_id, v_listing.title,
    v_listing.price, v_listing.currency, v_fee, v_payout, v_listing.delivery_content,
    v_buyer_charge, v_buyer_currency
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (
    p_buyer_id,
    'marketplace_buy',
    -v_buyer_charge,
    'marketplace:' || v_listing.title
  );

  insert into transactions (user_id, type, amount, description)
  values (
    v_listing.seller_id,
    'marketplace_sale',
    v_payout,
    'marketplace_sale:' || v_listing.title
  );

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'delivery_content', v_listing.delivery_content,
    'title', v_listing.title,
    'price', v_listing.price,
    'listing_currency', v_listing.currency,
    'buyer_paid', v_buyer_charge,
    'buyer_currency', v_buyer_currency
  );
end;
$$;