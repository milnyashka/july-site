import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const email = (process.argv[2] ?? 'milnyashka@gmail.com').toLowerCase();
const username = process.argv[3] ?? 'Milashka';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: prof, error: findErr } = await sb
  .from('profiles')
  .select('id, email, username')
  .ilike('email', email)
  .maybeSingle();

if (findErr) {
  console.error('FIND_ERR', findErr.message);
  process.exit(1);
}

let userId = prof?.id;

if (!userId) {
  const { data: list, error: authErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authErr) {
    console.error('AUTH_ERR', authErr.message);
    process.exit(1);
  }
  const u = list.users.find((x) => x.email?.toLowerCase() === email);
  if (!u) {
    console.error('USER_NOT_FOUND', email);
    process.exit(1);
  }
  userId = u.id;
  await sb.from('profiles').upsert({ id: userId, email, currency: 'rub' }, { onConflict: 'id' });
}

const { data: taken } = await sb
  .from('profiles')
  .select('id, email')
  .ilike('username', username)
  .neq('id', userId)
  .maybeSingle();

if (taken) {
  console.error('TAKEN_BY', taken.email);
  process.exit(1);
}

const { data: updated, error: updErr } = await sb
  .from('profiles')
  .update({ username })
  .eq('id', userId)
  .select('id, email, username')
  .single();

if (updErr) {
  console.error('UPDATE_ERR', updErr.message);
  process.exit(1);
}

console.log('OK', JSON.stringify(updated));