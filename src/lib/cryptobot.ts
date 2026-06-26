import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rubToUsd, type Currency } from '@/lib/currency';

const MAINNET_API = 'https://pay.crypt.bot/api';
const TESTNET_API = 'https://testnet-pay.crypt.bot/api';

export type CryptobotInvoice = {
  invoice_id: number;
  status: string;
  amount: string;
  fiat?: string;
  bot_invoice_url?: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
  pay_url?: string;
  payload?: string;
};

type CryptobotResponse<T> = {
  ok: boolean;
  result?: T;
  error?: string;
};

export function isCryptobotConfigured(): boolean {
  return Boolean(process.env.CRYPTOBOT_API_TOKEN?.trim());
}

function apiBase(): string {
  return process.env.CRYPTOBOT_TESTNET === 'true' ? TESTNET_API : MAINNET_API;
}

function apiToken(): string {
  const token = process.env.CRYPTOBOT_API_TOKEN?.trim();
  if (!token) throw new Error('CRYPTOBOT_NOT_CONFIGURED');
  return token;
}

async function cryptobotRequest<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${apiBase()}/${method}`, {
    method: 'POST',
    headers: {
      'Crypto-Pay-API-Token': apiToken(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as CryptobotResponse<T>;

  if (!data.ok || data.result === undefined) {
    throw new Error(data.error ?? `CRYPTOBOT_${method.toUpperCase()}_FAILED`);
  }

  return data.result;
}

export async function cryptobotGetMe() {
  return cryptobotRequest<{ app_id: number; name: string }>('getMe');
}

export async function createCryptobotInvoice(params: {
  amountRub: number;
  description: string;
  payload: string;
  returnUrl: string;
}): Promise<CryptobotInvoice> {
  return cryptobotRequest<CryptobotInvoice>('createInvoice', {
    currency_type: 'fiat',
    fiat: 'RUB',
    amount: String(params.amountRub),
    description: params.description.slice(0, 1024),
    payload: params.payload.slice(0, 4096),
    paid_btn_name: 'callback',
    paid_btn_url: params.returnUrl,
    expires_in: 3600,
    allow_comments: false,
    allow_anonymous: true,
    accepted_assets: 'USDT,TON,TRX,BTC,ETH,LTC',
  });
}

export async function getCryptobotInvoice(invoiceId: string | number): Promise<CryptobotInvoice | null> {
  const result = await cryptobotRequest<{ items?: CryptobotInvoice[] }>('getInvoices', {
    invoice_ids: String(invoiceId),
  });

  const items = result.items ?? (Array.isArray(result) ? (result as CryptobotInvoice[]) : []);
  return items[0] ?? null;
}

export function verifyCryptobotWebhook(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !isCryptobotConfigured()) return false;

  const secret = crypto.createHash('sha256').update(apiToken()).digest();
  const check = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    if (check.length !== signatureHeader.length) return false;
    return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

type TopupRow = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  method: string;
  external_id: string | null;
};

export async function creditCryptobotTopup(
  service: SupabaseClient,
  topup: TopupRow,
  invoice?: CryptobotInvoice | null
) {
  if (topup.status === 'paid') {
    return { credited: false, reason: 'already_paid' as const };
  }

  let inv = invoice;

  if (!inv && topup.external_id) {
    inv = await getCryptobotInvoice(topup.external_id);
  }

  if (!inv || inv.status !== 'paid') {
    return { credited: false, reason: 'not_paid' as const };
  }

  if (inv.payload && inv.payload !== topup.id) {
    return { credited: false, reason: 'payload_mismatch' as const };
  }

  const { data: profile } = await service
    .from('profiles')
    .select('currency')
    .eq('id', topup.user_id)
    .single();

  const currency: Currency = profile?.currency === 'rub' ? 'rub' : 'usd';
  let creditAmount = Number(topup.amount);

  if (currency === 'usd') {
    creditAmount = rubToUsd(creditAmount);
  }

  await service.rpc('add_balance', {
    p_user_id: topup.user_id,
    p_amount: creditAmount,
    p_description: 'topup:cryptobot',
    p_topup_id: topup.id,
  });

  return { credited: true, creditAmount };
}

export function cryptobotPayUrl(invoice: CryptobotInvoice): string {
  return (
    invoice.bot_invoice_url ??
    invoice.web_app_invoice_url ??
    invoice.mini_app_invoice_url ??
    invoice.pay_url ??
    ''
  );
}