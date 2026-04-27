// End-to-end seed validation script for slice 1.
// 1. Creates a test auth.users row via Supabase admin API
// 2. Fires the local /webhooks/supabase-signup endpoint with the user_id
// 3. Queries Postgres to verify 1 agent + 20 wiki_pages + 1 user_settings exist
// 4. Re-fires webhook → confirms idempotent "skipped" response
// 5. Cleans up: deletes the test user (cascades the seed)
//
// Run via: pnpm --filter @audri/server exec tsx --env-file=../../.env.local scripts/validate-seed.ts

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3000';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!supabaseUrl || !serviceKey || !dbUrl || !webhookSecret) {
    throw new Error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SUPABASE_WEBHOOK_SECRET');
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sql = postgres(dbUrl, { prepare: false });

  const testEmail = `seed-test-${Date.now()}@audri.test`;
  let userId: string | undefined;

  try {
    console.log(`[1/5] creating test user ${testEmail}…`);
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'audri-test-password-' + Date.now(),
      email_confirm: true,
    });
    if (createErr || !createdUser.user) throw createErr ?? new Error('no user');
    userId = createdUser.user.id;
    console.log(`     → user_id ${userId}`);

    console.log('[2/5] firing webhook (first call)…');
    const r1 = await fetch(`${SERVER_URL}/webhooks/supabase-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: webhookSecret },
      body: JSON.stringify({
        type: 'INSERT',
        schema: 'auth',
        table: 'users',
        record: { id: userId, email: testEmail },
        old_record: null,
      }),
    });
    const r1Body = await r1.json();
    console.log(`     → ${r1.status}`, r1Body);
    if (!r1.ok) throw new Error('webhook failed');
    if (r1Body.status !== 'created') throw new Error(`expected status=created got ${r1Body.status}`);

    console.log('[3/5] verifying DB rows…');
    const [agentCount] = await sql`SELECT COUNT(*)::int AS c FROM agents WHERE user_id = ${userId}`;
    const [pageCount] = await sql`SELECT COUNT(*)::int AS c FROM wiki_pages WHERE user_id = ${userId}`;
    const [settingsCount] = await sql`SELECT COUNT(*)::int AS c FROM user_settings WHERE user_id = ${userId}`;
    console.log(`     agents: ${agentCount?.c}, wiki_pages: ${pageCount?.c}, user_settings: ${settingsCount?.c}`);
    if (agentCount?.c !== 1 || pageCount?.c !== 20 || settingsCount?.c !== 1) {
      throw new Error('seed counts wrong');
    }

    console.log('[4/5] firing webhook again (idempotency check)…');
    const r2 = await fetch(`${SERVER_URL}/webhooks/supabase-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: webhookSecret },
      body: JSON.stringify({
        type: 'INSERT',
        schema: 'auth',
        table: 'users',
        record: { id: userId, email: testEmail },
        old_record: null,
      }),
    });
    const r2Body = await r2.json();
    console.log(`     → ${r2.status}`, r2Body);
    if (r2Body.status !== 'skipped') throw new Error('expected idempotent skip');

    console.log('[5/5] cleanup: deleting test user…');
    await admin.auth.admin.deleteUser(userId);
    console.log('     → deleted');

    console.log('\n✅ seed validation passed');
  } catch (err) {
    console.error('\n❌ validation failed:', err);
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
        console.log(`(cleaned up user ${userId})`);
      } catch {}
    }
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
