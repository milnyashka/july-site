import crypto from 'crypto';

const sellixCheckoutUrls: Record<number, string | undefined> = {
  2: process.env.SELLIX_CHECKOUT_2,
  5: process.env.SELLIX_CHECKOUT_5,
  10: process.env.SELLIX_CHECKOUT_10,
  15: process.env.SELLIX_CHECKOUT_15,
  25: process.env.SELLIX_CHECKOUT_25,
  100: process.env.SELLIX_CHECKOUT_100,
  300: process.env.SELLIX_CHECKOUT_300,
  500: process.env.SELLIX_CHECKOUT_500,
  1000: process.env.SELLIX_CHECKOUT_1000,
  2000: process.env.SELLIX_CHECKOUT_2000,
};

export function getSellixCheckoutUrl(amount: number, email: string): string | null {
  const baseUrl = sellixCheckoutUrls[amount];
  if (!baseUrl) return null;

  const url = new URL(baseUrl);
  url.searchParams.set('email', email);
  return url.toString();
}

export function verifySellixWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.SELLIX_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function parseSellixTopupAmount(productTitle: string): number | null {
  const match = productTitle.match(/\$(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}