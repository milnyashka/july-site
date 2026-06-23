import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'july_admin';

export function getAdminToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return crypto.createHash('sha256').update(`${password}:july-admin-v1`).digest('hex');
}

export function verifyAdminToken(token: string | undefined | null) {
  const expected = getAdminToken();
  if (!expected || !token) return false;
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}