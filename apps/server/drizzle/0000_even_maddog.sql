CREATE TYPE "public"."agent_task_kind" AS ENUM('research');--> statement-breakpoint
CREATE TYPE "public"."agent_task_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."artifact_kind" AS ENUM('research');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('generic', 'onboarding');--> statement-breakpoint
CREATE TYPE "public"."edited_by" AS ENUM('ai', 'user', 'lint', 'task');--> statement-breakpoint
CREATE TYPE "public"."end_reason" AS ENUM('user_ended', 'silence_timeout', 'network_drop', 'app_backgrounded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."page_type" AS ENUM('person', 'concept', 'project', 'place', 'org', 'source', 'event', 'note', 'profile', 'todo', 'agent');--> statement-breakpoint
CREATE TYPE "public"."usage_event_kind" AS ENUM('call_live', 'ingestion_prefilter', 'ingestion', 'agent_scope_ingestion', 'plugin_research', 'tool_search_wiki', 'tool_fetch_page');--> statement-breakpoint
CREATE TYPE "public"."wiki_log_kind" AS ENUM('ingest', 'agent_scope_ingest', 'query', 'lint', 'task');--> statement-breakpoint
CREATE TYPE "public"."wiki_scope" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"voice" text NOT NULL,
	"persona_prompt" text NOT NULL,
	"user_prompt_notes" text,
	"root_page_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tombstoned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled_plugins" text[] DEFAULT ARRAY['research']::text[] NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "wiki_log_kind" NOT NULL,
	"ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_page_tags" (
	"page_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_page_tags_page_id_tag_id_pk" PRIMARY KEY("page_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "wiki_scope" NOT NULL,
	"type" "page_type" NOT NULL,
	"slug" text NOT NULL,
	"parent_page_id" uuid,
	"title" text NOT NULL,
	"agent_abstract" text NOT NULL,
	"abstract" text,
	"frontmatter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tombstoned_at" timestamp with time zone,
	CONSTRAINT "wiki_pages_scope_agent_check" CHECK ((scope = 'user' AND agent_id IS NULL) OR (scope = 'agent' AND agent_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "wiki_section_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"content" text NOT NULL,
	"edited_by" "edited_by" NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tombstoned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wiki_section_ancestors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"ancestor_page_id" uuid NOT NULL,
	"snippet" text NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_section_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"turn_id" text NOT NULL,
	"snippet" text NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_section_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"url" text NOT NULL,
	"snippet" text NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"call_type" "call_type" DEFAULT 'generic' NOT NULL,
	"title" text,
	"summary" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb,
	"dropped_turn_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"end_reason" "end_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"todo_page_id" uuid NOT NULL,
	"agent_id" uuid,
	"kind" "agent_task_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "agent_task_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"graphile_job_id" text,
	"result_artifact_kind" "artifact_kind",
	"result_artifact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_tasks_priority_check" CHECK (priority BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "research_output_ancestors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_output_id" uuid NOT NULL,
	"ancestor_page_id" uuid NOT NULL,
	"snippet" text NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_output_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_output_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"snippet" text NOT NULL,
	"citation_index" integer NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_tasks_id" uuid NOT NULL,
	"query" text NOT NULL,
	"summary" text NOT NULL,
	"findings" jsonb NOT NULL,
	"follow_up_questions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes_for_user" text,
	"model_used" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tombstoned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"agent_tasks_id" uuid,
	"event_kind" "usage_event_kind" NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"cost_cents" numeric(12, 4) DEFAULT '0' NOT NULL,
	"artifact_kind" "artifact_kind",
	"artifact_id" uuid,
	"call_transcript_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_tokens_check" CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cached_tokens >= 0)
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_log" ADD CONSTRAINT "wiki_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_page_tags" ADD CONSTRAINT "wiki_page_tags_page_id_wiki_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_page_tags" ADD CONSTRAINT "wiki_page_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_parent_page_id_wiki_pages_id_fk" FOREIGN KEY ("parent_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_history" ADD CONSTRAINT "wiki_section_history_section_id_wiki_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wiki_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_sections" ADD CONSTRAINT "wiki_sections_page_id_wiki_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_ancestors" ADD CONSTRAINT "wiki_section_ancestors_section_id_wiki_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wiki_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_ancestors" ADD CONSTRAINT "wiki_section_ancestors_ancestor_page_id_wiki_pages_id_fk" FOREIGN KEY ("ancestor_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_transcripts" ADD CONSTRAINT "wiki_section_transcripts_section_id_wiki_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wiki_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_transcripts" ADD CONSTRAINT "wiki_section_transcripts_transcript_id_call_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."call_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_urls" ADD CONSTRAINT "wiki_section_urls_section_id_wiki_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wiki_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_transcripts" ADD CONSTRAINT "call_transcripts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_transcripts" ADD CONSTRAINT "call_transcripts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_todo_page_id_wiki_pages_id_fk" FOREIGN KEY ("todo_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_output_ancestors" ADD CONSTRAINT "research_output_ancestors_research_output_id_research_outputs_id_fk" FOREIGN KEY ("research_output_id") REFERENCES "public"."research_outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_output_ancestors" ADD CONSTRAINT "research_output_ancestors_ancestor_page_id_wiki_pages_id_fk" FOREIGN KEY ("ancestor_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_output_sources" ADD CONSTRAINT "research_output_sources_research_output_id_research_outputs_id_fk" FOREIGN KEY ("research_output_id") REFERENCES "public"."research_outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_outputs" ADD CONSTRAINT "research_outputs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_outputs" ADD CONSTRAINT "research_outputs_agent_tasks_id_agent_tasks_id_fk" FOREIGN KEY ("agent_tasks_id") REFERENCES "public"."agent_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_agent_tasks_id_agent_tasks_id_fk" FOREIGN KEY ("agent_tasks_id") REFERENCES "public"."agent_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_call_transcript_id_call_transcripts_id_fk" FOREIGN KEY ("call_transcript_id") REFERENCES "public"."call_transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agents_user_slug_idx" ON "agents" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "agents_user_default_idx" ON "agents" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "wiki_log_user_created_idx" ON "wiki_log" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "wiki_page_tags_tag_idx" ON "wiki_page_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_pages_user_scope_slug_idx" ON "wiki_pages" USING btree ("user_id","scope","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_pages_user_scope_parent_title_idx" ON "wiki_pages" USING btree ("user_id","scope","parent_page_id","title");--> statement-breakpoint
CREATE INDEX "wiki_pages_user_scope_type_idx" ON "wiki_pages" USING btree ("user_id","scope","type");--> statement-breakpoint
CREATE INDEX "wiki_pages_user_scope_agent_parent_idx" ON "wiki_pages" USING btree ("user_id","scope","agent_id","parent_page_id");--> statement-breakpoint
CREATE INDEX "wiki_pages_parent_live_idx" ON "wiki_pages" USING btree ("parent_page_id") WHERE tombstoned_at IS NULL;--> statement-breakpoint
CREATE INDEX "wiki_pages_frontmatter_gin" ON "wiki_pages" USING gin (frontmatter jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "wiki_section_history_section_edited_at_idx" ON "wiki_section_history" USING btree ("section_id","edited_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_sections_page_title_idx" ON "wiki_sections" USING btree ("page_id","title") WHERE title IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wiki_sections_page_order_idx" ON "wiki_sections" USING btree ("page_id","sort_order");--> statement-breakpoint
CREATE INDEX "wiki_sections_content_fts" ON "wiki_sections" USING gin (to_tsvector('english', content));--> statement-breakpoint
CREATE INDEX "wiki_section_ancestors_section_idx" ON "wiki_section_ancestors" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "wiki_section_ancestors_ancestor_idx" ON "wiki_section_ancestors" USING btree ("ancestor_page_id");--> statement-breakpoint
CREATE INDEX "wiki_section_transcripts_section_idx" ON "wiki_section_transcripts" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "wiki_section_transcripts_transcript_idx" ON "wiki_section_transcripts" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "wiki_section_urls_section_idx" ON "wiki_section_urls" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "wiki_section_urls_url_idx" ON "wiki_section_urls" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "call_transcripts_session_idx" ON "call_transcripts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "call_transcripts_user_started_idx" ON "call_transcripts" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "call_transcripts_user_agent_started_idx" ON "call_transcripts" USING btree ("user_id","agent_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_tasks_user_status_scheduled_idx" ON "agent_tasks" USING btree ("user_id","status","scheduled_for");--> statement-breakpoint
CREATE INDEX "agent_tasks_graphile_job_idx" ON "agent_tasks" USING btree ("graphile_job_id");--> statement-breakpoint
CREATE INDEX "agent_tasks_todo_page_idx" ON "agent_tasks" USING btree ("todo_page_id");--> statement-breakpoint
CREATE INDEX "research_output_ancestors_research_idx" ON "research_output_ancestors" USING btree ("research_output_id");--> statement-breakpoint
CREATE INDEX "research_output_ancestors_ancestor_idx" ON "research_output_ancestors" USING btree ("ancestor_page_id");--> statement-breakpoint
CREATE INDEX "research_output_sources_research_idx" ON "research_output_sources" USING btree ("research_output_id");--> statement-breakpoint
CREATE INDEX "research_output_sources_url_idx" ON "research_output_sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "research_outputs_user_generated_idx" ON "research_outputs" USING btree ("user_id","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "research_outputs_agent_tasks_idx" ON "research_outputs" USING btree ("agent_tasks_id");--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "usage_events_user_kind_created_idx" ON "usage_events" USING btree ("user_id","event_kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "usage_events_agent_tasks_idx" ON "usage_events" USING btree ("agent_tasks_id");--> statement-breakpoint

-- ============================================================
-- HAND-EDITED ADDITIONS (per specs/db-schema-plan.md)
-- ============================================================

-- Postgres extensions (no-op on Supabase if already present)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint

-- Circular FK: agents.root_page_id → wiki_pages.id
-- Deferrable so the seed transaction can insert both the agent row
-- and its root wiki page in either order and have FKs resolve at commit.
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_root_page_id_wiki_pages_id_fk"
  FOREIGN KEY ("root_page_id") REFERENCES "public"."wiki_pages"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint

-- Make wiki_pages.agent_id FK deferrable too, to permit the same
-- two-row insert in the seed transaction (agent row + root page row
-- with cross-references in either order).
ALTER TABLE "wiki_pages"
  DROP CONSTRAINT "wiki_pages_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "wiki_pages"
  ADD CONSTRAINT "wiki_pages_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint

-- Auto-bump updated_at on row update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER set_updated_at_wiki_pages
  BEFORE UPDATE ON "wiki_pages"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_wiki_sections
  BEFORE UPDATE ON "wiki_sections"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_agent_tasks
  BEFORE UPDATE ON "agent_tasks"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON "user_settings"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

-- Enable Row Level Security on every public table.
-- NO authenticated-role policies yet — Slice 9 wires those up.
-- service_role has bypassrls attribute and is unaffected.
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_section_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_page_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_section_transcripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_section_urls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_section_ancestors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "call_transcripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "research_outputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "research_output_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "research_output_ancestors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
