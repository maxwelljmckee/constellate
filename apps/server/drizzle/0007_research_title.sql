-- Slice 7 follow-up: abbreviated title for research outputs.
--
-- The research handler emits a short user-facing title separate from the
-- full query text. UI displays the title prominently with the query as
-- deemphasized subtext. Existing rows get a default title derived from
-- their query (first 60 chars) so they remain renderable.

ALTER TABLE "research_outputs"
  ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint

UPDATE "research_outputs"
SET "title" = LEFT(query, 60) || CASE WHEN LENGTH(query) > 60 THEN '…' ELSE '' END
WHERE "title" IS NULL;--> statement-breakpoint

ALTER TABLE "research_outputs"
  ALTER COLUMN "title" SET NOT NULL;
