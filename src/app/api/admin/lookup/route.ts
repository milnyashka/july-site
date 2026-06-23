import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const { data: profile, error: dbError } = await service
    .from('profiles')
    .select('id, email, balance, currency, role, created_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (dbError) {
    return NextResponse.json({ error: 'server_error', detail: dbError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    balance: Number(profile.balance),
    currency: profile.currency === 'rub' ? 'rub' : 'usd',
    role: profile.role === 'reseller' ? 'reseller' : 'user',
    createdAt: profile.created_at,
  });
}