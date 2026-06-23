import crypto from 'crypto';

type CreateInvoiceParams = {
  amount: string;
  orderId: string;
  returnUrl: string;
  successUrl?: string;
  callbackUrl: string;
};

export async function createCryptomusInvoice(params: CreateInvoiceParams) {
  const merchantId = process.env.CRYPTOMUS_MERCHANT_ID;
  const apiKey = process.env.CRYPTOMUS_API_KEY;

  if (!merchantId || !apiKey) {
    throw new Error('Cryptomus not configured');
  }

  const body: Record<string, unknown> = {
    amount: params.amount,
    currency: 'USD',
    order_id: params.orderId,
    url_return: params.returnUrl,
    url_callback: params.callbackUrl,
    is_payment_multiple: false,
    lifetime: 3600,
  };

  if (params.successUrl) {
    body.url_success = params.successUrl;
  }

  const jsonBody = JSON.stringify(body);
  const sign = crypto
    .createHash('md5')
    .update(Buffer.from(jsonBody).toString('base64') + apiKey)
    .digest('hex');

  const res = await fetch('https://api.cryptomus.com/v1/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      merchant: merchantId,
      sign,
    },
    body: jsonBody,
  });

  const data = await res.json();

  if (!res.ok || data.state !== 0) {
    throw new Error(data.message ?? 'Cryptomus invoice failed');
  }

  return data.result as { url: string; uuid: string };
}

export function verifyCryptomusWebhook(rawBody: string) {
  const apiKey = process.env.CRYPTOMUS_API_KEY;
  if (!apiKey) return false;

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const sign = payload.sign;
    if (typeof sign !== 'string') return false;

    delete payload.sign;
    const jsonBody = JSON.stringify(payload).replace(/\//g, '\\/');
    const expected = crypto
      .createHash('md5')
      .update(Buffer.from(jsonBody).toString('base64') + apiKey)
      .digest('hex');

    return expected === sign;
  } catch {
    return false;
  }
}