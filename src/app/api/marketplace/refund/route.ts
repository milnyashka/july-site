import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  if (!purchaseId) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('seller_refund_marketplace_purchase', {
    p_seller_id: user.id,
    p_purchase_id: purchaseId,
    p_reason: reason || null,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status = data.error === 'insufficient_seller_balance' ? 402 : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  return NextResponse.json({ success: true, status: data.status });
}