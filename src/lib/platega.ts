const PLATEGA_API = 'https://app.platega.io';

export const PLATEGA_PAYMENT_METHOD = {
  SBP_QR: 2,
  ERIP: 3,
  CARD: 11,
  INTERNATIONAL: 12,
  CRYPTO: 13,
} as const;

type CreateTransactionParams = {
  amount: number;
  currency?: string;
  description: string;
  returnUrl: string;
  failedUrl: string;
  payload: string;
  paymentMethod?: number;
};

type PlategaTransactionResponse = {
  transactionId: string;
  redirect: string;
  status: string;
};

export type PlategaCallbackPayload = {
  id: string;
  amount: number;
  currency: string;
  status: 'CONFIRMED' | 'CANCELED' | 'CHARGEBACK' | 'CHARGEBACKED';
  paymentMethod: number;
  payload?: string;
};

function getCredentials() {
  const merchantId = process.env.PLATEGA_MERCHANT_ID;
  const apiKey = process.env.PLATEGA_API_KEY;
  if (!merchantId || !apiKey) {
    throw new Error('Platega not configured');
  }
  return { merchantId, apiKey };
}

function plategaHeaders(merchantId: string, apiKey: string) {
  return {
    'Content-Type': 'application/json',
    'X-MerchantId': merchantId,
    'X-Secret': apiKey,
  };
}

export async function createPlategaTransaction(
  params: CreateTransactionParams
): Promise<PlategaTransactionResponse> {
  const { merchantId, apiKey } = getCredentials();

  const body: Record<string, unknown> = {
    paymentDetails: {
      amount: params.amount,
      currency: params.currency ?? 'RUB',
    },
    description: params.description,
    return: params.returnUrl,
    failedUrl: params.failedUrl,
    payload: params.payload,
  };

  if (params.paymentMethod != null) {
    body.paymentMethod = params.paymentMethod;
  }

  const res = await fetch(`${PLATEGA_API}/transaction/process`, {
    method: 'POST',
    headers: plategaHeaders(merchantId, apiKey),
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error === 'string'
          ? data.error
          : 'Platega transaction failed';
    throw new Error(message);
  }

  const transactionId = data.transactionId ?? data.id;
  const redirect = data.redirect;

  if (!transactionId || !redirect) {
    throw new Error('Platega response missing transactionId or redirect');
  }

  return {
    transactionId: String(transactionId),
    redirect: String(redirect),
    status: String(data.status ?? 'PENDING'),
  };
}

export type PlategaTransactionStatus = {
  id: string;
  status: string;
  payload?: string;
  paymentDetails?: { amount?: number; currency?: string };
};

export async function getPlategaTransactionStatus(
  transactionId: string
): Promise<PlategaTransactionStatus> {
  const { merchantId, apiKey } = getCredentials();

  const res = await fetch(`${PLATEGA_API}/transaction/${transactionId}`, {
    method: 'GET',
    headers: plategaHeaders(merchantId, apiKey),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? 'Platega status check failed');
  }

  return data as PlategaTransactionStatus;
}

export function verifyPlategaWebhook(request: Request): boolean {
  const merchantId = process.env.PLATEGA_MERCHANT_ID;
  const apiKey = process.env.PLATEGA_API_KEY;
  if (!merchantId || !apiKey) return false;

  const headerMerchant = request.headers.get('X-MerchantId');
  const headerSecret = request.headers.get('X-Secret');

  return headerMerchant === merchantId && headerSecret === apiKey;
}

export function parsePlategaCallback(rawBody: string): PlategaCallbackPayload | null {
  try {
    const payload = JSON.parse(rawBody) as PlategaCallbackPayload;
    if (!payload.id || !payload.status) return null;
    return payload;
  } catch {
    return null;
  }
}

