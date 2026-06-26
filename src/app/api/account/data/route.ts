import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [purchasesRes, transactionsRes] = await Promise.all([
    supabase
      .from('purchases')
      .select('license_key, plan_id, amount, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('type, amount, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    purchases: purchasesRes.data ?? [],
    transactions: transactionsRes.data ?? [],
  });
}