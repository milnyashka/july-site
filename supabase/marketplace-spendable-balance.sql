-- Замороженные средства (холд 24ч) нельзя тратить до разморозки
-- Запусти в Supabase SQL Editor после marketplace-escrow-reviews.sql

alter table public.marketplace_balance_holds
  add column if not exists balance_credited boolean not null default false;

-- Старые холды (деньги ещё не на балансе) — помечаем для release
update public.marketplace_balance_holds
set balance_credited = false
where released_at is null and balance_credited is distinct from true;

create or replace function public.get_locked_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric
  from public.marketplace_balance_holds
  where seller_id = p_user_id
    and released_at is null;
$$;

create or replace function public.get_available_balance(p_user_id uuid)
returns numeric
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_locked numeric;
begin
  select balance into v_balance
  from public.profiles
  where id = p_user_id;

  if v_balance is null then
    return 0;
  end if;

  v_locked := public.get_locked_balance(p_user_id);
  return greatest(round(v_balance - v_locked, 2), 0);
end;
$$;

create or replace function public.get_wallet_balance(p_user_id uuid)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_locked numeric;
begin
  perform public.release_marketplace_holds(p_user_id);

  select balance into v_balance
  from public.profiles
  where id = p_user_id;

  if v_balance is null then
    return json_build_object('balance', 0, 'locked', 0, 'available', 0);
  end if;

  v_locked := public.get_locked_balance(p_user_id);

  return json_build_object(
    'balance', v_balance,
    'locked', v_locked,
    'available', greatest(round(v_balance - v_locked, 2), 0)
  );
end;
$$;

-- Разморозка: для новых холдов баланс уже зачислен, только снимаем блокировку
create or replace function public.release_marketplace_holds(p_user_id uuid default null)
returns numeric
language plpgsql
security definer set search_path = public
as $$
declare
  v_hold record;
  v_total numeric := 0;
  v_title text;
begin
  for v_hold in
    select h.*, p.title
    from marketplace_balance_holds h
    join marketplace_purchases p on p.id = h.purchase_id
    where h.released_at is null
      and h.release_at <= now()
      and (p_user_id is null or h.seller_id = p_user_id)
    for update of h
  loop
    if not coalesce(v_hold.balance_credited, false) then
      update profiles
      set balance = balance + v_hold.amount
      where id = v_hold.seller_id;

      v_title := coalesce(v_hold.title, 'marketplace sale');

      insert into transactions (user_id, type, amount, description)
      values (
        v_hold.seller_id,
        'marketplace_sale',
        v_hold.amount,
        'marketplace_sale:' || v_title
      );

      update marketplace_balance_holds
      set balance_credited = true
      where id = v_hold.id;
    end if;

    update marketplace_balance_holds
    set released_at = now()
    where id = v_hold.id;

    v_total := v_total + v_hold.amount;
  end loop;

  return v_total;
end;
$$;

-- Одобрение: деньги на баланс сразу, но заблокированы на 24ч
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
  where id = p_purchase_id and status = 'pending_review'
  for update;

  if v_purchase.id is null then
    return json_build_object('error', 'not_found');
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
  );

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

-- Покупка лота: только доступный баланс
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
    v_buyer_charge, v_buyer_currency, 'pending_review'
  )
  returning id into v_purchase_id;

  insert into transactions (user_id, type, amount, description)
  values (p_buyer_id, 'marketplace_buy', -v_buyer_charge, 'marketplace:' || v_title);

  return json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'status', 'pending_review',
    'title', v_title,
    'price', v_listing.price,
    'listing_currency', v_listing.currency,
    'buyer_paid', v_buyer_charge,
    'buyer_currency', v_buyer_currency
  );
end;
$$;

-- Продукты: только доступный баланс
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
  v_available numeric;
  v_key text;
  v_key_id uuid;
  v_roles text[];
  v_spent_usd numeric;
  v_tier_discount numeric := 0;
  v_amount_usd numeric;
  v_account_frozen boolean;
  v_balance_frozen boolean;
begin
  perform release_marketplace_holds(p_user_id);

  select coalesce(roles, array['user']::text[]), account_frozen, balance_frozen
  into v_roles, v_account_frozen, v_balance_frozen
  from profiles where id = p_user_id for update;

  if not found then
    return json_build_object('error', 'no_profile');
  end if;

  if v_account_frozen then
    return json_build_object('error', 'account_frozen');
  end if;

  if v_balance_frozen then
    return json_build_object('error', 'balance_frozen');
  end if;

  v_available := get_available_balance(p_user_id);

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

  v_spent_usd := public.get_product_spend_usd(p_user_id);

  if v_spent_usd >= 500 then
    v_tier_discount := 0.20;
  elsif v_spent_usd >= 250 then
    v_tier_discount := 0.10;
  elsif v_spent_usd >= 100 then
    v_tier_discount := 0.05;
  end if;

  v_price := round(v_price * (1 - v_tier_discount), 2);

  if v_available < v_price then
    return json_build_object('error', 'insufficient_balance');
  end if;

  select id, key into v_key_id, v_key
  from license_keys
  where plan_id = p_plan_id and used = false
  limit 1
  for update skip locked;

  if v_key_id is null then
    return json_build_object('error', 'no_keys');
  end if;

  update license_keys set used = true, used_by = p_user_id, used_at = now()
  where id = v_key_id;

  update profiles set balance = balance - v_price where id = p_user_id;

  if p_currency = 'rub' then
    v_amount_usd := round(v_price / 79, 2);
  else
    v_amount_usd := v_price;
  end if;

  insert into purchases (user_id, plan_id, license_key, amount, amount_usd)
  values (p_user_id, p_plan_id, v_key, v_price, v_amount_usd);

  insert into transactions (user_id, type, amount, description)
  values (p_user_id, 'purchase', -v_price, 'plan:' || p_plan_id);

  return json_build_object('success', true, 'key', v_key, 'plan_id', p_plan_id);
end;
$$;

-- Вывод: только доступный баланс
create or replace function public.request_withdrawal(
  p_user_id uuid,
  p_method text,
  p_amount numeric,
  p_destination text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_available numeric;
  v_currency text;
  v_frozen_acc boolean;
  v_frozen_bal boolean;
  v_fee numeric;
  v_net numeric;
  v_amount_rub numeric;
  v_min_rub constant numeric := 250;
  v_crypto_fee_usd constant numeric := 3.5;
  v_card_pct constant numeric := 0.03;
  v_card_fixed_rub constant numeric := 30;
  v_rub_per_usd constant numeric := 79;
  v_request_id uuid;
  v_dest text;
begin
  perform release_marketplace_holds(p_user_id);

  if p_method not in ('crypto', 'card') then
    return json_build_object('error', 'invalid_method');
  end if;

  v_dest := trim(p_destination);
  if length(v_dest) < 8 then
    return json_build_object('error', 'invalid_destination');
  end if;

  if p_amount <= 0 then
    return json_build_object('error', 'invalid_amount');
  end if;

  select balance, currency, account_frozen, balance_frozen
  into v_balance, v_currency, v_frozen_acc, v_frozen_bal
  from profiles where id = p_user_id for update;

  if v_balance is null then
    return json_build_object('error', 'no_profile');
  end if;

  if v_frozen_acc or v_frozen_bal then
    return json_build_object('error', 'balance_frozen');
  end if;

  v_available := get_available_balance(p_user_id);

  if v_currency = 'rub' then
    v_amount_rub := p_amount;
  else
    v_amount_rub := round(p_amount * v_rub_per_usd, 2);
  end if;

  if p_method = 'crypto' then
    if v_currency = 'usd' then
      v_fee := v_crypto_fee_usd;
      if p_amount < round(v_min_rub / v_rub_per_usd + v_crypto_fee_usd, 2) then
        return json_build_object('error', 'below_minimum');
      end if;
    else
      v_fee := round(v_crypto_fee_usd * v_rub_per_usd, 2);
      if p_amount < v_min_rub + v_fee then
        return json_build_object('error', 'below_minimum');
      end if;
    end if;
  else
    if v_amount_rub < v_min_rub then
      return json_build_object('error', 'below_minimum');
    end if;
    if v_currency = 'rub' then
      v_fee := round(p_amount * v_card_pct + v_card_fixed_rub, 2);
    else
      v_fee := round(p_amount * v_card_pct + round(v_card_fixed_rub / v_rub_per_usd, 2), 2);
    end if;
  end if;

  v_net := round(p_amount - v_fee, 2);

  if v_fee >= p_amount or v_net <= 0 then
    return json_build_object('error', 'fee_too_high');
  end if;

  if v_available < p_amount then
    return json_build_object('error', 'insufficient_balance');
  end if;

  update profiles set balance = balance - p_amount where id = p_user_id;

  insert into withdrawal_requests (
    user_id, method, amount, fee, net_amount, currency, destination, status
  )
  values (
    p_user_id, p_method, p_amount, v_fee, v_net, v_currency, v_dest, 'pending'
  )
  returning id into v_request_id;

  insert into transactions (user_id, type, amount, description)
  values (
    p_user_id,
    'withdrawal',
    -p_amount,
    'withdrawal:' || p_method || ':' || v_request_id::text
  );

  return json_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount', p_amount,
    'fee', v_fee,
    'net_amount', v_net,
    'currency', v_currency
  );
end;
$$;

grant execute on function public.get_locked_balance(uuid) to authenticated;
grant execute on function public.get_available_balance(uuid) to authenticated;
grant execute on function public.get_wallet_balance(uuid) to authenticated;