import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { email, amount, note } = await request.json();
  const parsed = parseFloat(amount);
  const normalizedEmail = String(email ?? '').toLowerCase().trim();

  if (!normalizedEmail || !parsed || parsed <= 0 || parsed > 10000) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const { data: profile } = await service
    .from('profiles')
    .select('id, email, balance, currency')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const description = note
    ? `topup:manual:${String(note).slice(0, 100)}`
    : 'topup:manual';

  const { data, error } = await service.rpc('add_balance', {
    p_user_id: profile.id,
    p_amount: parsed,
    p_description: description,
  });

  if (error || data?.error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const { data: updated } = await service
    .from('profiles')
    .select('balance')
    .eq('id', profile.id)
    .single();

  return NextResponse.json({
    success: true,
    email: profile.email,
    added: parsed,
    balance: Number(updated?.balance ?? 0),
    currency: profile.currency === 'rub' ? 'rub' : 'usd',
  });
}