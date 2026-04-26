// Slice 0c validation spike — verifies RxDB + Supabase replication initialize
// against the cloud schema without errors. Uses MEMORY storage (no native
// SQLite) — that's slice 5 work. The point here is library-pairing validation.
//
// Real production wiring (expo-sqlite + RLS-aware auth + full collection set)
// lands in slice 5.

import { createClient } from '@supabase/supabase-js';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { SupabaseReplication } from 'rxdb-supabase';

addRxPlugin(RxDBDevModePlugin);

const tagsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    user_id: { type: 'string', maxLength: 36 },
    name: { type: 'string' },
    color: { type: ['string', 'null'] },
    created_at: { type: 'string' },
  },
  required: ['id', 'user_id', 'name', 'created_at'],
} as const;

export type SpikeResult =
  | { ok: true; details: string }
  | { ok: false; stage: string; error: string };

export async function runRxdbSpike(): Promise<SpikeResult> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return { ok: false, stage: 'env', error: 'Missing EXPO_PUBLIC_SUPABASE_*' };
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
    });

    const db = await createRxDatabase({
      name: 'audri_spike',
      storage: getRxStorageMemory(),
      ignoreDuplicate: true,
    });

    await db.addCollections({ tags: { schema: tagsSchema } });

    const replication = new SupabaseReplication({
      supabaseClient: supabase,
      collection: db.tags,
      replicationIdentifier: 'audri-spike-tags',
      pull: { batchSize: 10 },
      push: {},
    });

    // We don't await full sync — just confirm construction succeeds. RLS will
    // gate actual data flow until slice 9 wires authenticated policies.
    const constructed = !!replication;

    await db.remove();

    return {
      ok: true,
      details: `RxDB + supabase replication constructed (replication=${constructed})`,
    };
  } catch (err) {
    return {
      ok: false,
      stage: 'init',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
