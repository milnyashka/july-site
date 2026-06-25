import { createClient, createServiceClient } from '@/lib/supabase/server';
import { creditPlategaTopup } from '@/lib/platega-topup';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: pending } = await service
    .from('topup_requests')
    .select('id, user_id, amount, status, method, external_id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .in('method', ['sbp', 'crypto'])
    .not('external_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!pending?.length) {
    return NextResponse.json({ confirmed: 0 });
  }

  let confirmed = 0;

  for (const topup of pending) {
    try {
      const result = await creditPlategaTopup(service, topup);
      if (result.credited) confirmed++;
    } catch (err) {
      console.error('[topup/confirm] error for', topup.id, err);
    }
  }

  return NextResponse.json({ confirmed });
}