-- Минимум крипто-вывода: 250 ₽ к получению + комиссия $3.5
-- Запусти в Supabase SQL Editor (обновляет request_withdrawal)

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

  if v_balance < p_amount then
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