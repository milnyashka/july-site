import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, getAdminToken } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const token = getAdminToken();
  if (!token) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}