-- Slice 5: rxdb-supabase compatibility.
--
-- rxdb-supabase's replication plugin requires a boolean `_deleted` column to
-- track soft-deletes for sync. Our schema uses `tombstoned_at` as the soft-
-- delete signal. Add a generated column on the synced tables so rxdb-supabase
-- sees what it needs without changing application logic.
--
-- Generated columns are server-managed; INSERT/UPDATE on the column itself
-- will fail (Postgres rejects writes to GENERATED ALWAYS), so client edits
-- can't accidentally tamper with deletion state.

ALTER TABLE "wiki_pages"
  ADD COLUMN IF NOT EXISTS "_deleted" boolean
  GENERATED ALWAYS AS (tombstoned_at IS NOT NULL) STORED;--> statement-breakpoint

ALTER TABLE "wiki_sections"
  ADD COLUMN IF NOT EXISTS "_deleted" boolean
  GENERATED ALWAYS AS (tombstoned_at IS NOT NULL) STORED;
