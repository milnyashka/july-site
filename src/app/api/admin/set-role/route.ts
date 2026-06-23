import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

const VALID_ROLES = new Set(['user', 'reseller']);

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { email, role } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!role || typeof role !== 'string' || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
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
    .update({ role })
    .eq('email', normalizedEmail)
    .select('id, email, balance, currency, role')
    .maybeSingle();

  if (dbError) {
    return NextResponse.json({ error: 'server_error', detail: dbError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: authUser } = await service.auth.admin.getUserById(profile.id);
  const { error: metaError } = await service.auth.admin.updateUserById(profile.id, {
    user_metadata: {
      ...(authUser?.user?.user_metadata ?? {}),
      role,
    },
  });

  if (metaError) {
    return NextResponse.json({
      error: 'metadata_update_failed',
      detail: metaError.message,
      email: profile.email,
      role: profile.role === 'reseller' ? 'reseller' : 'user',
    }, { status: 500 });
  }

  return NextResponse.json({
    email: profile.email,
    balance: Number(profile.balance),
    currency: profile.currency === 'rub' ? 'rub' : 'usd',
    role: profile.role === 'reseller' ? 'reseller' : 'user',
  });
}