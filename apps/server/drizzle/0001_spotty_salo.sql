-- Slice 5 RLS: client-readable wiki content for the authenticated user.
-- Scope: wiki_pages + wiki_sections only. Other tables stay locked until later
-- slices need them. Server (service_role) bypasses RLS via Postgres role
-- bypassrls attribute and is unaffected.

-- ── wiki_pages ──────────────────────────────────────────────────────────────
-- Client can SELECT/UPDATE/DELETE its own user-scope pages. INSERT is server-
-- only — pages are created via ingestion or future explicit-create endpoints,
-- never via direct client writes. Agent-scope pages (scope='agent') are never
-- visible to clients per Invariant 1 of specs/agents-and-scope.md.

CREATE POLICY "wiki_pages_select_own_user_scope"
  ON "wiki_pages"
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND scope = 'user');--> statement-breakpoint

CREATE POLICY "wiki_pages_update_own_user_scope"
  ON "wiki_pages"
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND scope = 'user')
  WITH CHECK (user_id = auth.uid() AND scope = 'user');--> statement-breakpoint

CREATE POLICY "wiki_pages_delete_own_user_scope"
  ON "wiki_pages"
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND scope = 'user');--> statement-breakpoint

-- ── wiki_sections ──────────────────────────────────────────────────────────
-- Client can SELECT/UPDATE sections belonging to its own user-scope pages.
-- INSERT + DELETE server-only (sections are created via ingestion;
-- "deletion" happens via tombstone UPDATE, not row delete).

CREATE POLICY "wiki_sections_select_own_user_scope"
  ON "wiki_sections"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "wiki_pages" p
      WHERE p.id = "wiki_sections".page_id
        AND p.user_id = auth.uid()
        AND p.scope = 'user'
    )
  );--> statement-breakpoint

CREATE POLICY "wiki_sections_update_own_user_scope"
  ON "wiki_sections"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "wiki_pages" p
      WHERE p.id = "wiki_sections".page_id
        AND p.user_id = auth.uid()
        AND p.scope = 'user'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "wiki_pages" p
      WHERE p.id = "wiki_sections".page_id
        AND p.user_id = auth.uid()
        AND p.scope = 'user'
    )
  );
