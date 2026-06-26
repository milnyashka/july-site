import { validateUsername } from '@/lib/username';
import { createClient, createServiceClient, isServiceConfigured } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type UsernameError =
  | 'invalid_format'
  | 'taken'
  | 'no_profile'
  | 'already_set'
  | 'unauthorized'
  | 'server_error';

function isDuplicateUsernameError(message: string, code?: string) {
  return (
    code === '23505' ||
    message.includes('profiles_username_lower_idx') ||
    message.includes('duplicate key')
  );
}

async function ensureProfile(userId: string, email: string | undefined) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  if (profile) return profile;

  if (profileError) {
    const { data: basic } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (basic) return { username: null };
  }

  if (!email) return null;

  await supabase.from('profiles').insert({
    id: userId,
    email: email.toLowerCase(),
    currency: 'rub',
  });

  const { data: created } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  return created;
}

async function updateUsernameDirect(userId: string, username: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId)
    .is('username', null)
    .select('username')
    .maybeSingle();

  if (!error && data?.username) {
    return { ok: true as const, username: String(data.username) };
  }

  if (error && isDuplicateUsernameError(error.message, error.code)) {
    return { ok: false as const, error: 'taken' as const };
  }

  if (isServiceConfigured()) {
    const admin = createServiceClient();
    const { data: existing } = await admin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    if (existing?.username) {
      return { ok: false as const, error: 'already_set' as const };
    }

    const { data: adminData, error: adminError } = await admin
      .from('profiles')
      .update({ username })
      .eq('id', userId)
      .is('username', null)
      .select('username')
      .maybeSingle();

    if (!adminError && adminData?.username) {
      return { ok: true as const, username: String(adminData.username) };
    }

    if (adminError && isDuplicateUsernameError(adminError.message, adminError.code)) {
      return { ok: false as const, error: 'taken' as const };
    }

    return {
      ok: false as const,
      error: 'server_error' as const,
      detail: adminError?.message ?? error?.message,
    };
  }

  return {
    ok: false as const,
    error: 'server_error' as const,
    detail: error?.message,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' satisfies UsernameError }, { status: 401 });
  }

  const body = await request.json();
  const username = typeof body.username === 'string' ? body.username.trim() : '';

  const formatError = validateUsername(username);
  if (formatError) {
    return NextResponse.json({ error: formatError as UsernameError }, { status: 400 });
  }

  const profile = await ensureProfile(user.id, user.email);
  if (!profile) {
    return NextResponse.json({ error: 'no_profile' satisfies UsernameError }, { status: 400 });
  }

  if (profile.username) {
    return NextResponse.json({ error: 'already_set' satisfies UsernameError }, { status: 403 });
  }

  const { data, error } = await supabase.rpc('set_username', {
    p_user_id: user.id,
    p_username: username,
  });

  const rpcResult =
    typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : null;

  if (!error && rpcResult && !rpcResult.error && (rpcResult.success || rpcResult.username)) {
    const saved = String(rpcResult.username ?? username);
    return NextResponse.json({ success: true, username: saved });
  }

  if (rpcResult?.error) {
    const rpcError = String(rpcResult.error) as UsernameError;
    const status =
      rpcError === 'taken' ? 409 : rpcError === 'already_set' ? 403 : 400;
    return NextResponse.json({ error: rpcError }, { status });
  }

  const fallback = await updateUsernameDirect(user.id, username);
  if (fallback.ok) {
    return NextResponse.json({ success: true, username: fallback.username });
  }

  const status =
    fallback.error === 'taken' ? 409 : fallback.error === 'already_set' ? 403 : 500;

  return NextResponse.json(
    { error: fallback.error, detail: 'detail' in fallback ? fallback.detail : undefined },
    { status }
  );
}