import type { SupabaseClient } from '@supabase/supabase-js';
import { usdtToCreditAmount, type Currency } from '@/lib/currency';
import { getPlategaTransactionStatus } from '@/lib/platega';

type TopupRow = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  method: string;
  external_id: string | null;
};

type CallbackLike = {
  id: string;
  amount?: number;
  status: string;
};

export async function creditPlategaTopup(
  service: SupabaseClient,
  topup: TopupRow,
  callback?: CallbackLike
) {
  if (topup.status === 'paid') {
    return { credited: false, reason: 'already_paid' as const };
  }

  let status = callback?.status?.toUpperCase();
  let paidAmount = callback?.amount != null ? Number(callback.amount) : undefined;

  if (!status || paidAmount == null) {
    if (!topup.external_id) {
      return { credited: false, reason: 'no_external_id' as const };
    }

    const tx = await getPlategaTransactionStatus(topup.external_id);
    status = tx.status?.toUpperCase();
    const rawPaid = tx.paymentDetails?.amount;
    paidAmount = rawPaid != null ? Number(rawPaid) : undefined;
  }

  if (status !== 'CONFIRMED') {
    return { credited: false, reason: 'not_confirmed' as const, status };
  }

  const expected = Number(topup.amount);

  // Сумма в callback/Platega может включать комиссию (50 → 54.25)
  if (
    paidAmount != null &&
    !Number.isNaN(paidAmount) &&
    paidAmount + 0.01 < expected
  ) {
    return { credited: false, reason: 'amount_mismatch' as const };
  }

  const description =
    topup.method === 'crypto'
      ? 'topup:crypto'
      : topup.method === 'sbp'
        ? 'topup:sbp'
        : `topup:${topup.method}`;

  let creditAmount = topup.amount;

  if (topup.method === 'crypto') {
    const { data: profile } = await service
      .from('profiles')
      .select('currency')
      .eq('id', topup.user_id)
      .single();

    const currency: Currency =
      profile?.currency === 'rub' ? 'rub' : 'usd';

    creditAmount = usdtToCreditAmount(expected, currency);
  }

  await service.rpc('add_balance', {
    p_user_id: topup.user_id,
    p_amount: creditAmount,
    p_description: description,
    p_topup_id: topup.id,
  });

  return { credited: true, creditAmount };
}

export async function findTopupForCallback(
  service: SupabaseClient,
  callback: { id: string; payload?: string }
) {
  const { data: topupByExternal } = await service
    .from('topup_requests')
    .select('id, user_id, amount, status, method, external_id')
    .eq('external_id', callback.id)
    .maybeSingle();

  if (topupByExternal) return topupByExternal;

  if (callback.payload) {
    const { data: topupByPayload } = await service
      .from('topup_requests')
      .select('id, user_id, amount, status, method, external_id')
      .eq('id', callback.payload)
      .maybeSingle();
    return topupByPayload;
  }

  return null;
}