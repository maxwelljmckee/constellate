-- Slice 6 follow-up: enable Supabase Realtime on the synced wiki tables.
--
-- Supabase Realtime only forwards postgres_changes events for tables enrolled
-- in the `supabase_realtime` publication. Without this, the rxdb-supabase
-- client subscribes successfully but never receives row-change events, so
-- server-side ingestion writes only land on the next pull (i.e., app reload).
--
-- REPLICA IDENTITY FULL is also set so DELETE / UPDATE events carry the full
-- old row — needed for the rxdb-supabase plugin to resolve which local doc
-- the event corresponds to (it filters client-side by user_id / id).

ALTER TABLE "wiki_pages" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER TABLE "wiki_sections" REPLICA IDENTITY FULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wiki_pages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.wiki_pages';
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wiki_sections'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.wiki_sections';
  END IF;
END $$;
