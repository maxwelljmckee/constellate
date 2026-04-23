# Constellate — Pre-Build TODOs & Open Questions

A complete checklist of decisions, questions, and tasks that gate the start of production backend (and supporting client) work. Organized by area. Some items are already settled — marked ✅ — and kept here for traceability so the final spec documents can reference the full decision history.

**Legend**

- ✅ — decided / done
- ✴️ — partially decided; needs refinement
- ⏺️ — open; needs a decision
- ⛔ — blocked on another decision (dependency noted inline)

Items flagged **SPEC** are substantial enough to deserve their own dedicated design doc under `.claude/architecture/specs/` before implementation.

---

## 1. Product vision & principles

- ✅ **Product vision**
  - Voice-first, KG-backed personal assistant ("Muse"). (architecture.md §Vision)
- ✅ **Target capability list**
  - Onboarding, calls, research, podcasts, briefs, calendar, email, scheduled tasks, graph view. (architecture.md §Target capabilities)
- ✅ **Core UX principles**
  - Proactiveness, Transparency, friction proportional to reversal cost. (architecture.md §Core UX principles)
- ✅ **Interaction modes framing**
  - Call (priority), Ask (deferred), Note (deferred).
- ✅ **Feature horizon catalog**
  - Call experience, activity stream, navigation, content delivery, scheduled content, knowledge ingestion. (features.md)
- ✅ **MVP feature cut**
  - **V0 (MVP):** Call mode, transcript ingest + fan-out, wiki browse/edit, background research, onboarding interview, in-app notifications (for research completion).
  - **V1 (next after MVP):** Podcasts (requires Supabase Storage setup), scheduled/recurring tasks, proactive recommendations, activity-stream UI polish, push notifications.
  - **Deferred further:** Email drafting, calendar event creation, daily/evening briefs, contacts import, Ask/Note modes, graph view, event-driven content (RSS/topic monitoring), knowledge ingestion uploads, plugin launcher.

---

## 2. Tech stack

### Client

- ✅ **Framework**
  - React Native + Expo.
- ✅ **Conversational agent**
  - Gemini Live.
- ✅ **Audio**
  - React Native Audio API for mic streaming, playback, processing.
- ✅ **Local wiki mirror**
  - Client maintains a SQLite-backed mirror of the wiki, wrapped by RxDB.
- ✅ **Client-side DB + sync**
  - **RxDB** with the **Supabase replication plugin**, backed by an SQLite storage adapter (via `expo-sqlite` or equivalent). RxDB gives us observable queries (UI auto-updates when fan-out completes) and a turnkey bidirectional sync protocol with built-in conflict resolution — subsumes the custom sync layer we would otherwise build on raw SQLite.
- ✅ **State management**
  - **Zustand.** Lightweight, hooks-native, no Redux boilerplate.
- ✅ **Navigation**
  - **Expo Router** (file-based routing).

### Server

- ✅ **Framework**
  - NestJS.
- ✅ **Data / auth / realtime / storage**
  - Supabase (Postgres + Auth + Realtime + Storage).
- ✅ **Agentic workflows**
  - **Gemini SDK (`@google/genai`) directly — no Langchain.** Langchain's abstractions are a poor fit for our bespoke pipelines (fan-out, preload, call-agent tool use). We build the small amount of orchestration we need ourselves.
- ✅ **Inference provider strategy**
  - **Gemini-only for MVP.** Cost-optimized — Gemini is ~2–3× cheaper than Anthropic tier-for-tier, and Gemini's explicit caching (guaranteed cost savings, cache-object API) matches Anthropic's prompt caching for our main use cases. Single vendor is also operationally simpler given we're already on Gemini Live for calls. The inference layer is abstracted lightly (one internal interface) so a specific pipeline can route to Anthropic if a prompt refuses to stabilize, but we start Gemini-only.
- ✅ **Model tiering**
  - **Flash** (2.5 or 3 Preview): candidate retrieval (stage 1 of fan-out), lightweight classifiers. Abstract regeneration is currently inlined with Pro's fan-out writes rather than a separate Flash pass — see §17 refactor path if this becomes a cost driver.
  - **Pro** (2.5 or 3 Preview): fan-out main call (stages 2–7), research agent.
  - **Gemini Live**: in-call conversational agent (already in use).
- ✅ **Prompt caching strategy (provider-specific)**
  - **Explicit caching** for the fan-out main prompt (static KG parsing system instruction, 5–10k tokens, same across users — one cache per model version, long TTL). Also for call-agent scaffolding and research-task scaffolding.
  - **Implicit caching** handles everything else; helped by putting large common content at the start of the prompt.
  - **Cache lifecycle** is owned by a dedicated LLM-inference service module in NestJS (create, TTL refresh, cleanup on model-version bumps) so it doesn't leak into every call site.
  - Mind the minimum-token thresholds for explicit caching (1024 on Flash, 4096 on Pro for 2.5). Smaller prompts rely on implicit caching.
- ✅ **Background job queue**
  - **Graphile Worker** (Postgres-backed, runs inside NestJS — no Redis, single datastore to operate). Supports cron, retries, priorities, job types. Migrate to BullMQ or Inngest if throughput or durable-execution patterns demand it.
- ✅ **Deployment target**
  - **Render** for NestJS. Simple DX, plays well with Supabase, cheap at MVP scale.
- ✅ **Storage bucket layout** (deferred)
  - Deferred to V1. MVP has no user-visible storage usage — transcripts live in `call_transcripts.content` in Postgres. Podcasts in V1 will force the bucket-layout design.
- ✅ **Realtime channels plan**
  - **No custom channel strategy.** Realtime is consumed via the RxDB Supabase plugin (pull-side incremental updates); app code never touches Realtime APIs directly.

### Dev tooling

- ✅ **Monorepo tooling**
  - **pnpm workspaces.** Zero config. Add Turborepo only if build times demand it.
- ✅ **TypeScript config sharing**
  - Base `tsconfig.json` + per-package extends. Standard pnpm workspace pattern.
- ✅ **Shared types package**
  - `packages/shared` — DB row types (generated from Drizzle schema) + API contract types shared across client and server.
- ✅ **Server ORM + migrations**
  - **Drizzle ORM** on the server for Postgres access and schema-first migrations. Generates the row types consumed by `packages/shared`.
- ✅ **Linter / formatter**
  - **Biome.** Single tool, faster than ESLint + Prettier.
- ✅ **Local dev environment**
  - **Supabase CLI** for local Postgres + Realtime. NestJS runs via `pnpm dev`.
- ✅ **Mobile build + store submission**
  - **EAS (Expo Application Services)** — EAS Build for iOS/Android builds, EAS Submit for store submission, EAS Update for OTA updates. Free tier sufficient for MVP; migrate to Fastlane + GitHub Actions if cost becomes material.
- ✅ **Error reporting**
  - **Sentry** on client and server.
- ✅ **Analytics + feature flags**
  - **PostHog** — product analytics + feature flags in one. Generous free tier.

---

## 3. Data model

### Core tables

- ✅ **`wiki_pages` draft**
  - id, user_id, scope, type, slug, parent_page_id, title, agent_abstract, abstract, frontmatter, timestamps, tombstoned_at.
  - `agent_abstract` (required): terse machine-consumed abstract, ~1 sentence. Surfaced in the wiki index, preloaded slices, cross-reference resolution. First-class LLM prompt input.
  - `abstract` (nullable): human-readable opening paragraph, rendered between title and first section. More wiggle room than `agent_abstract` but still brief.
  - `content` is NOT on `wiki_pages` — page body lives in `wiki_sections` (see below).
- ✅ **`wiki_sections` draft**
  - id (uuid, no slug), page_id, title (nullable), content (markdown), sort_order, timestamps, tombstoned_at.
  - Sections are the unit of editable content — h2-granularity. h3+ stays inside section markdown.
  - Pro emits targeted section edits (keep/update/create/tombstone) rather than full-page rewrites. Dramatically reduces token cost on updates as pages grow.
  - Pro always *reads* the fully-joined page so it retains contextual understanding; it only *writes* at the section level.
  - `UNIQUE (page_id, title) WHERE title IS NOT NULL` — no duplicate titled sections on a page.
  - Timeline is represented as a section with `title = 'Timeline'`, conventionally pinned first by prompt rule. See §4 Mutability.
- ✅ **`wiki_section_history`**
  - Full-snapshot history at the section level with `edited_by`. Per-version `content` snapshot on edit.
  - Page-level creation/tombstone events tracked in `wiki_log` rather than a dedicated `wiki_page_history` table.
  - Reconstruction of "page as of time T" = join across sections, filter to latest-version-before-T per section.
- ✅ **`tags` + `wiki_page_tags`**
  - User-defined tags and a join table against pages. Covers cross-cutting groupings now that `topics` is dropped.
- ✅ **`call_transcripts`**
  - Immutable transcript storage.
- ✅ **Per-entity source junction tables** (section-level, replacing the earlier page-level + polymorphic designs)
  - `wiki_section_transcripts(section_id, transcript_id, turn_id, snippet, cited_at)` — transcript-sourced writes (primary MVP path).
  - `wiki_section_urls(section_id, url, snippet, cited_at)` — URL-sourced writes with per-passage snippets (used by research-task outputs).
  - `wiki_section_ancestors(section_id, ancestor_page_id, snippet, cited_at)` — for derived sections (e.g., research output sections) that drew from existing wiki pages. Cited unit is a page (coarse ancestor granularity is fine; MVP simplification).
  - `wiki_section_uploads(section_id, upload_id, snippet, cited_at)` — V1, added when Supabase Storage + uploads land.
  - Gains: FK referential integrity, trivial JOINs, type-specific fields per source kind, precise citation granularity (section not page). User edits don't need a source row — `wiki_section_history.edited_by='user'` IS the provenance.
- ✅ **`wiki_log`**
  - Append-only chronological activity log. Also records page-level creation/tombstone events (since we dropped `wiki_page_history`).

### Open table-level questions

- ⏺️ **Full data model review pass** — **SPEC**
  - §4 (profile sub-types, hierarchy semantics) and §3 (polymorphic artifact sources) are now resolved. Pending: audit types, relations, indexes, RLS, history retention.
- ⏺️ **Indexes**
  - Explicit plan for `wiki_pages(user_id, scope, type)`, slug lookups, `parent_page_id` descents, `wiki_sections(page_id, sort_order)` for render-order reads, full-text on `wiki_sections.content`, frontmatter jsonb gin.
- ✅ **Polymorphic artifact-source table**
  - **Resolved: per-entity junction tables, not a polymorphic table.** See core tables above. Gains referential integrity and type-specific fields; loses nothing meaningful (cross-type source listings are a UNION or a VIEW, cheap).
- ✅ **Research-output artifact shape**
  - Stored as a `wiki_page` with `type: 'research'`. Provenance via `wiki_section_urls` (cited URLs per section) and `wiki_section_ancestors` (source wiki pages drawn from, per section). The separate per-artifact-type-table question (research table vs. reuse wiki_pages) remains resolved as "reuse wiki_pages" for MVP; podcasts will force the artifact-shape decision in V1.
- ⛔ **Podcast-output table(s)** (V1)
  - Script + audio file reference + sources. V1 — first artifact that likely needs a dedicated table, which forces the polymorphic-sources decision.
- ⛔ **Brief (daily/weekly) artifact table(s)** (deferred)
  - Dedicated table, or persist only as wiki pages?
- ⛔ **Email-draft table** (deferred)
  - Fields for recipient, subject, body, provider, status (draft/sent/cancelled), source transcript id.
- ⛔ **Calendar-event table** (deferred)
  - Event payload + provider id (Google etc.) + source transcript id.
- ⏺️ **Notification table**
  - id, user_id, kind, artifact_ref, body, read/unread, snoozed_until. Depends on §13 notifications design.
- ⏺️ **Recommendation table**
  - Reuse notifications, or own table. Kinds: schedule-proposal, split-proposal, follow-up, merge-proposal. Fields: payload, status (pending/accepted/dismissed/snoozed).
- ⏺️ **Schedule / recurring-task table**
  - Cron spec, task kind, params, delivery preferences, pause state, next-run, owner.
- ⏺️ **Upload / ingested-source table**
  - Raw file ref, mime type, provenance, processing status.
- ⏺️ **Proposed action-item table**
  - User-confirmed vs. pending-confirmation rows emitted from call-end flow, linked to the transcript that produced them.

### History & retention

- ⏺️ **History retention policy**
  - Full snapshots per edit is the current plan; at what scale do we switch to diffs / periodic snapshots? (architecture.md §Open questions / "History storage cost")
- ⏺️ **Tombstone retention**
  - Permanent, or GC after N days?

### Frontmatter

- ✅ **Frontmatter convention draft**
  - type, title, aliases, tags, sources, timestamps.
- ⏺️ **Frontmatter review**
  - What lives in columns vs. jsonb `frontmatter`; interaction with markdown rendering + edit UI. (architecture.md §Open questions / "Frontmatter review")
- ⏺️ **Alias indexing strategy**
  - Trigram index on a concatenated alias field, or separate aliases table for faster voice disambiguation.

### RLS

- ✅ **RLS principle**
  - Agent-scope pages server-only; user-scope rows user-id filtered.
- ⏺️ **RLS policy set**
  - Write the actual policies per table, including write paths (user edits) vs. server-only writes.
- ⏺️ **Agent-scope leak-prevention tests**
  - Explicit test suite + audit trail for any endpoint that could return agent-scope content. (architecture.md §Open questions / "Agent-scope leak prevention")

### Sync model

- ✅ **Source-of-truth model**
  - Server is source of truth; client is a mirror hydrated via Supabase Realtime.
- ⏺️ **Conflict resolution policy**
  - User edits client-side while AI writes server-side. Last-write-wins, server-wins, or merge?
- ⏺️ **Offline behavior**
  - What the user can do disconnected; how edits queue + replay.
- ⏺️ **Initial hydration strategy**
  - Full dump on first login vs. paginated backfill + realtime.

---

## 4. Knowledge graph — structure

### Scopes

- ✅ **Two scopes**
  - `user` and `agent`, with a strict privacy partition.
- ✅ **Cross-scope linking disallowed**
  - Enforced at the data layer; prevents agent-scope leakage via reference chains.

### Page types

- ✅ **User-scope type set**
  - person, concept, project, place, org, source, event, note, profile, research, todo. (`topic` dropped with the topics abstraction; `profile_*` collapsed to a single `profile` type organized via hierarchy; `research` added for background-research outputs; `todo` added so reminders and commitments have a dedicated home rather than bloating `note`.)
- ✅ **High-churn types (flag)**
  - `todo` (and likely `event` later) are flagged as **high-churn ephemeral types** — high volume, repeated titles, frequent reparenting through status buckets. They use a different slug strategy (see Hierarchy § Slug uniqueness). Semantic long-lived types (`person`, `project`, `concept`, `profile`, `research`, `source`) use the standard walk-up rule.
- ✅ **Agent-scope type set**
  - Single type: `agent`. One starter page `agent_wiki` at scope root; all subsequent agent-scope pages descend from it via `parent_page_id`. Lets the agent scope grow organically before we commit to a typology. Split rules can be added later once `agent_wiki` (or any descendant) outgrows its page. Mirrors the hierarchy-based pattern used for `profile`.
- ✅ **Profile sub-type handling**
  - Single `profile` type organized via hierarchy. One top-level `Profile` page per user with child pages (`Goals`, `Values`, `Health`, `Work`, `Interests`, `Relationships`, `Preferences`, `Psychology`) each also of type `profile`. Fan-out routes by parent + canonical child slug. Removes the `profile_*` type proliferation; aligns with the hierarchy-as-nesting-mechanism decision.

### Hierarchy

- ✅ **Mechanism**
  - `parent_page_id` self-reference on `wiki_pages`. Unlimited nesting.
- ✅ **Max depth**
  - No enforced limit. YAGNI. May surface as a linting recommendation later if pages grow pathologically deep.
- ✅ **Cycle prevention**
  - App-level check on reparent (walk ancestor chain from proposed new parent; reject if it hits the page being moved), with a DB trigger as safety net.
- ✅ **Reparenting**
  - Allowed. Slug does not auto-change on reparent — slugs are stable identifiers.
- ✅ **Tombstone cascade behavior**
  - Block tombstone when the page has non-tombstoned children. User must reparent or tombstone children first. Acceptable friction given voice-first, low-volume manual edits.
- ✅ **Filesystem invariant**
  - `UNIQUE (user_id, scope, parent_page_id, title)`. Duplicate titles among siblings are structurally impossible.
- ✅ **Slug uniqueness — two-track strategy**
  - Slugs are globally unique per `user_id + scope`. Generated at creation, persisted, stable across reparents. Strategy depends on page type:
  - **Standard (long-lived semantic types — `person`, `project`, `concept`, `profile`, `research`, `source`, `place`, `org`, `note`):** walk-up rule. Kebab-case of title; if collision, prepend parent slug; if still collision, prepend grandparent, walking up until unique. Numeric suffix (`-2`, `-3`, …) as last-resort fallback when walk-up exhausts.
  - **High-churn types (`todo`, and likely `event` later):** `{kebab-title}-{short-hash}` where the hash is a stable 4-character disambiguator derived from the page's UUID. No walk-up, no collision management. Motivated by systematic reparenting (todos cycling todo → in-progress → done → archived) which otherwise produces silent slug fragmentation as new pages are created in vacated buckets.
- ✅ **`parent_slug` denormalization**
  - Not added to `wiki_pages`. Join via `parent_page_id` is cheap; breadcrumbs use a recursive CTE. Can revisit if a hot path demands it.

### Topics (dropped)

- ✅ **Topics vs. hierarchy decision**
  - **Dropped.** Hierarchy (`parent_page_id`) covers nested grouping; `tags` cover cross-cutting grouping. `topics` / `wiki_page_topics` tables and the `topic` page type are removed from the model. Architecture doc needs a pass to reflect this.

### Todos

- ✅ **Todo lifecycle shape**
  - Each todo is its own `wiki_page` (type=`todo`). Status changes (pending → active → complete → archived) are expressed as reparent operations across seeded bucket pages. Uses the hierarchy mechanism rather than a status column on the page.
- ✅ **Seeded structure**
  - Root page `todos` (type=`todo`) seeded per user. Four child bucket pages seeded beneath it: `todo`, `in-progress`, `done`, `archived` — each also type=`todo`. Individual todos live as children of whichever bucket matches their current status.
- ✅ **Project-scoped todo lists**
  - Child `todo` pages are allowed under `project` pages for project-specific task lists. Hierarchy handles it naturally (e.g., Consensus project can have its own `todos` child page with the same four-bucket structure, or a flatter list — flexible).
- ✅ **Per-todo metadata (frontmatter)**
  - `assignee: user | agent`, `priority: low | medium | high | urgent`, `due_at` (optional), `created_at`. Lives in the `frontmatter` jsonb column on `wiki_pages`. Sub-tasks are just child `todo` pages under their parent todo.
- ✅ **Entry sources**
  - User-added via UI, user-spoken in a call ("remind me to…" fanned out into todos), AI-detected implicit commitments from transcript ("I told Alex I'd send him the paper"), proactive recommendations promoted to todos.
- ✅ **Separation from notifications**
  - Todos = things the user intends to do. Notifications = things the user should be aware of (task completions, pending confirmations, recommendations). A drafted email is a *notification* ("email ready to review"), not a todo.
- ⏺️ **Scheduled-reminder firing** (V1+)
  - "Remind me at 3pm to call Sarah" depends on scheduled-task infra (§12). MVP todos are a plain checkable list surfaced when the user opens the app.

### Mutability

- ✅ **Append-only at fact level**
  - Newest-wins on read.
- ✅ **Personal vs. objective facts**
  - Personal superseded by newest; objective not overwritten by newer contradictions.
- ✅ **User edits tombstoned**
  - Not hard-deleted, to preserve undo.
- ✅ **History snapshots**
  - Full content snapshots in `wiki_section_history` for every edit. Page-level creation / tombstone events captured in `wiki_log` instead.
- ✅ **Chronologically-oriented page format**
  - Simple list of entries ordered newest → oldest. No `current`/`superseded` markers. No separate "Current" + "History" sections. Consumers (AI in preload, user in UI) weight recency but don't discount older entries — attitude and view changes over time are meaningful context.
- ✅ **Timeline section (contradiction handling)**
  - **Uniform rule, all page types:** the default page shape is one or more ordinary `wiki_sections`. A special section — `title = 'Timeline'` — is added *only when a contradiction arrives*. No advance ephemeral/evergreen tagging of claims. Timeline acts as both a page structure element AND the conflict-resolution mechanism. Enabled cleanly by the sectioned data model: Timeline is just another row in `wiki_sections`.
  - **Contradiction definition (for the fan-out prompt):** two claims cannot simultaneously be true about the same subject. *Additive* claims (more goals, more friends, more projects) are not contradictions. Claims about fundamentally 1:1 attributes (current residence, primary job, marital status) are contradictions. Ambiguous cases — especially attitudes, beliefs, self-assessments — default to Timeline, because preserving evolution is more valuable than collapsing it.
  - **Reclassification:** when a contradiction arrives and the superseded claim lived in some other section, fan-out must (a) remove it from that section's content and (b) add it as a Timeline entry with a `Past` (or best-effort-dated) annotation. The new claim enters Timeline as `Current`. If a prior `**Current**` entry for the same attribute already exists in Timeline, it is demoted to `**Past**` (dated if inferable) before the new `**Current**` is inserted. Detailed operation + carveouts for refinement/correction live in `specs/fan-out-prompt.md` §4.4.
  - **Timeline ordering:** entries ordered by **ingest time, newest-first** (consistent with the chronological page-format rule). Each entry carries a temporal annotation — `Current`, `Past`, or a specific date when available. The consuming LLM synthesizes from the list; no need to enforce strict event-chronological order.
  - **Timeline entry format:** flat bullet list within the Timeline section's `content`. Each bullet starts with a bold temporal annotation (`**Current**`, `**Past**`, `**April 2026**`, `**Since March 2025**`, `**2024**`), then an em-dash, then the claim.
  - **No sub-grouping within Timeline.** Flat newest-first, never categorized by attribute. If a Timeline appears to need sub-grouping, that's a signal the page's content belongs on separate pages (resolve via hierarchy, not section structure). This is a design principle, not just a prompt rule.
  - **Section ordering:** Timeline is conventionally the first section on any page where it exists. Enforced by prompt rule for MVP (backend enforcement if the prompt drifts).
  - **Consumer behavior:** when Muse reads a page, non-Timeline sections are weighted as authoritative-by-default; Timeline is interpreted as a recency-weighted history where the newest entry is the current state unless superseded by a specific-dated claim.
- ⏺️ **Notes refactoring policy** (deferred)
  - Does the AI migrate content from freeform `note` pages onto canonical pages over time? Deferred for MVP — fan-out routes claims directly into canonical pages from the start, so free-floating notes should be rare. Revisit if notes accumulate promotion-worthy knowledge.

### The index

- ✅ **Index as materialized view**
  - Not a stored file; API endpoint over `wiki_pages`.
- ✅ **Markdown rendering on demand**
  - For system-prompt injection at call start.
- ✅ **Per-page agent abstract + human abstract**
  - `agent_abstract` (required, terse, machine-consumed) and `abstract` (nullable, human-readable lead) on each page. Both AI-regenerated on page-touching writes. See §3 core tables.
- ⏺️ **Abstract regeneration trigger**
  - Always regenerated inline with fan-out writes that touch the page (no separate pass). Open question: should purely-cosmetic section reorders/metadata edits also trigger regeneration? Relates to §17 cost strategy.

### Log

- ✅ **`wiki_log` shape**
  - Append-only chronological record with kinds (ingest, query, lint, task).
- ⏺️ **`wiki_log` retention / rollup**
  - Policy for log growth — it will grow fast.

---

## 5. Sources & grounding

- ✅ **Grounding principle**
  - Every fact in the KG is grounded; generalizes to every derived artifact.
- ✅ **Source kinds + linking model**
  - Section-level per-entity junction tables (see §3 core tables): `wiki_section_transcripts`, `wiki_section_urls`, `wiki_section_ancestors`, `wiki_section_uploads` (V1). User edits live in `wiki_section_history.edited_by='user'` — no dedicated source row.
- ✅ **Generalized artifact-source linking**
  - **Resolved: per-entity junctions at section granularity.** Replaces both the polymorphic-table and earlier page-level junction proposals. See §3.
- ⏺️ **Sources & grounding conventions** — **SPEC**
  - Inline citation style in rendered markdown (footnote vs. inline link vs. both); retention policy when a superseding fact arrives (keep vs. prune); per-claim vs. per-page UI surfacing.
- ⏺️ **UI surfacing of sources**
  - Dedicated sidebar on every page? Hover citations? Drill-down view?
- ⏺️ **Bidirectional lookup performance**
  - Reverse index from source → pages (e.g., "all pages this transcript sourced") is a two-JOIN lookup against the section-level junctions → `wiki_sections` → `wiki_pages`. Materialized view may be warranted for high-volume users; live query fine at MVP scale.

---

## 6. Knowledge graph — ingest pipeline (server-side)

- ✅ **Rough shape drafted**
  - Classify noteworthiness → fan-out to pages → regen summaries → write `wiki_log`.
- ⏺️ **Fan-out pipeline full design** — **SPEC**
  - Tabled for dedicated conversation. Subcomponents listed below. (architecture.md §Open questions)
- ✅ **Noteworthiness classifier — per-claim, inside Pro**
  - Per-claim noteworthiness lives in Pro's main prompt (stage 3 of the pipeline), not as a separate Flash classifier. Skip-default with explicit per-type bar adjustments (higher for `profile`, lower for `todo`/`note`). Restated facts skipped silently. Fully specified in `specs/fan-out-prompt.md` §4.2; tradeoff entries in `tradeoffs.md`.
- ✅ **Routing + entity disambiguation location — inline in Pro fan-out**
  - Pro fan-out prompt handles both routing (claim → existing page vs. new page) and entity disambiguation (voice surface form → canonical slug) in a single pass, constrained to Flash's candidate set. Flash does coarse retrieval (which pages are candidates); Pro does fine per-claim arbitration. See `tradeoffs.md`.
- ✅ **Preloaded slice shape — Flash's candidate set**
  - Backend preloads full joined content (sections) for every slug in Flash's `touched_pages`. Pro receives: transcript + compact wiki index (all pages, `agent_abstract`-only) + full joined content of Flash's candidates + the `new_pages` plan. Flash candidate emission replaces a deterministic hot-set heuristic. See `tradeoffs.md`.
- ✅ **No `fetch_page` fallback for MVP**
  - Pro is bounded by Flash's candidate set. No tool use, no two-pass retry, no post-hoc miss-recovery. Accepts recall risk as an MVP tradeoff. Refactor paths documented in `notes/ingestion-pipeline.md`. See `tradeoffs.md`.
- ✅ **Routing rules within the Pro prompt**
  - Five-rule routing (multi-target / existing-match / new-match / no-fit-skip / premature-create-guard) + empty-update suppression + multi-target phrasing convention. Fully specified in `specs/fan-out-prompt.md` §4.3. Multi-target writes captured as a tradeoff entry.
- ⏺️ **Conflict resolution**
  - Newest-wins vs. objective-fact protection.
- ⏺️ **Idempotency**
  - What happens if a transcript is reprocessed.
- ⏺️ **Partial-failure recovery**
  - One page write fails out of twenty; retry / rollback semantics.
- ✴️ **KG parsing prompt (CLAUDE.md analogue)** — **SPEC** in progress
  - Draft spec at `specs/fan-out-prompt.md`. All decision rules (claim extraction, noteworthiness, routing, contradiction handling, skip criteria, source attribution) fully specified. Remaining: prompt-text drafting (identity / role / ontology primer / examples), worked examples, evals.
- ⏺️ **Wiki seeding protocol** — **SPEC**
  - Exactly what's pre-populated on account creation (stub profile pages, agent-scope starter pages, Muse's initial self-description). (architecture.md §Open questions)
- ⏺️ **Uploaded-source ingest pipeline**
  - URLs, files, images (OCR + vision), audio. Mirrors transcript flow. (features.md §Knowledge ingestion)
- ⛔ **Email ingest (received email as context)**
  - Depends on §15 integrations.

---

## 7. KG maintenance (linting / healthcheck)

- ⏺️ **Linting / healthcheck background flow** — **SPEC**
  - Cadence, triggers, checks (orphans, contradictions, stale claims, missing cross-refs, split candidates), autonomous-action scope vs. surfaced recommendations. (architecture.md §Open questions)
- ⏺️ **Split-recommendation trigger**
  - Token threshold per page; proposal flow into the activity stream. (features.md §Proactive recommendations)
- ⏺️ **Entity-merge detection**
  - Auto-propose vs. rely on user.
- ⏺️ **Cluster-to-project elevation**
  - Detect when a set of related notes/concepts has grown into an implicit project; propose creating a `project` parent and reparenting the cluster under it. Sibling of split-recommendation and merge-detection.
- ⏺️ **Broken-wikilink repair**
  - Autonomous fix vs. recommendation.

---

## 8. Call mode

### Done

- ✅ **Persists through screen-lock**
  - Background audio session maintained.
- ✅ **Call-end summary + action-item confirmation**
  - Baseline end-of-call UX shape.
- ✅ **In-call read-only KG access**
  - Preloaded slice + `search_graph` tool; writes disallowed.
- ✅ **Post-call transcript upload**
  - Stored immutably; listed in Call History.
- ✅ **Voice prototype validated**
  - Sandbox proven: Gemini Live plumbing, mic gating, per-buffer onEnded, proactive greeting, system prompt.

### Open

- ⏺️ **Preloaded slice contents** — **SPEC**
  - Full index always; which agent-scope pages; which recent user-scope pages; token budget. Cost-sensitive. (architecture.md §Open questions)
- ⏺️ **Active-project prioritization in preload**
  - "Hot" projects (user-pinned, recent activity, high call frequency) deserve full content in the preload, not just an index entry. Decide the signal set and the storage mechanism (pin flag on `wiki_pages`? derived from `wiki_log`?).
- ⏺️ **Call agent system prompt** — **SPEC**
  - Muse's in-call voice, behavior, boundaries, tool-use policy. (architecture.md §Open questions / "Prompts to write")
- ⏺️ **`search_graph` tool spec**
  - Inputs (slug vs. query vs. both), return shape, pagination, ranking. Relates to §18 search.
- ⏺️ **Call-end flow** — **SPEC**
  - Action-item surfacing, amend flow, cancellation flow, early-drop handling (unconfirmed items → notifications feed per features.md).
- ⏺️ **Call-type variants**
  - Generic / contextual / task-specific. Prompt variants, preload strategies, post-call flows per type. (features.md §Different call types)
- ⏺️ **Contextual-call preload**
  - When starting from a wiki page or other artifact, how that context is injected.
- ⏺️ **Transcript format spec**
  - Turn-by-turn JSON vs. plain text; speaker tags; timestamps.
- ⏺️ **Mid-call tool set beyond `search_graph`**
  - Web search? Fetch URL? Calendar peek? Decide MVP tool set.
- ⏺️ **Call resumption**
  - If the network drops mid-call, what's the resume behavior?
- ⏺️ **Audio retention**
  - Keep raw audio, or transcript only?

---

## 9. Interaction modes — Ask / Note (deferred)

- ⏺️ **Ask mode**
  - Triggering UX; routes through Gemini Live or a lighter request-response path.
  - Contextually aware. Can be kicked off from anywhere in the app and use the user's current context to start the conversation.
- ⏺️ **Note mode**
  - Bypasses dialogue; voice-to-transcript-to-KG. Shares the ingest pipeline with calls.
- ⏺️ **Triggering UX for all three modes**
  - Button layout, long-press menu, wake word. Deferred until Call mode is solid.

---

## 10. Onboarding

- ✅ **High-level flow drafted**
  - Signup → seed defaults → onboarding interview → home.
- ⏺️ **Seed set**
  - Known-to-seed: `profile` root + profile child pages (Goals, Values, Health, Work, Interests, Relationships, Preferences, Psychology); `agent_wiki` starter page in agent scope; `todos` root + four bucket children (`todo`, `in-progress`, `done`, `archived`). Exact initial content (blank vs. stub vs. instructional) still needs to be specified per page.
- ⏺️ **Onboarding interview script/prompt** — **SPEC**
  - Scripted vs. freeform, handling incompletes, resumption. (architecture.md §Open questions / "Prompts to write")
- ⏺️ **Interview progress tracking**
  - Per-profile-page completion state.
- ⏺️ **"Good enough to leave interview" heuristic**
  - When Muse declares the interview done.

---

## 11. Background tasks

- ⏺️ **Background loop architecture** — **SPEC**
  - Job queue choice, retry semantics, observability, how jobs read/write KG, how lint/healthcheck coexists with task execution. Blocks most task-specific work. (architecture.md §Open questions)
- ⏺️ **Task kinds for MVP**
  - Pick from: research, podcast, email drafting, calendar event creation, daily brief, evening summary. Defer the rest.
- ⏺️ **Per-task prompt design** — **SPEC** (one per kind)
  - Research, podcast, email, calendar, brief. (architecture.md §Open questions / "Prompts to write")
- ⏺️ **Task output format**
  - How outputs are filed back into the wiki — page types, naming, hierarchy placement. (architecture.md §Open questions)
- ⏺️ **Task failure surfacing**
  - How errors appear to the user (notifications? call-history entry?).
- ⏺️ **Cancellation / amendment mid-run**
  - Can a user stop a running research task?
- ⏺️ **Cost observability per task**
  - See §17.

---

## 12. Scheduled & event-driven content

- ⏺️ **Scheduled / recurring tasks** — **SPEC**
  - Configuration surface (conversational vs. settings), schedule storage, timezone handling. (architecture.md §Open questions)
- ⏺️ **Cron / next-run evaluation engine**
  - Lean on pg_cron, run inside NestJS, or use a dedicated scheduler?
- ⏺️ **Pause/resume/edit UX**
  - How users manage their schedules.
- ⏺️ **Event-driven content (deferred long-term)**
  - RSS, topic-change detection, release alerts. Explicitly out of MVP. (features.md)

---

## 13. Activity stream, notifications, recommendations

- ⏺️ **Notifications feed data model**
  - See §3.
- ⏺️ **Push infrastructure**
  - Expo Push vs. native APNs/FCM.
- ⏺️ **Notifications design** — **SPEC**
  - Grouping, snooze, dismiss, deferred-confirm (for dropped calls). (architecture.md §Open questions)
- ⏺️ **Proactive-recommendation detection**
  - Scheduling proposals, split proposals, follow-up proposals, merge proposals. Each needs a trigger + prompt. (features.md §Proactive recommendations)
- ⏺️ **Delivery-channel preferences**
  - Global vs. per-task-type vs. per-schedule. Storage + editing UX. (features.md §Adaptive delivery channels)

---

## 14. Deep connectivity (cross-artifact navigation)

- ✅ **Principle**
  - Every artifact is a graph citizen with provenance + downstream consumers.
- ✅ **Reverse-lookup implementation**
  - Two-JOIN query via section-level junction tables (§3, §5). Materialized view optional for high-volume users; live query fine at MVP scale.
- ⏺️ **UI affordances**
  - Per-artifact "related" panel shape.

---

## 15. Integrations

- ⏺️ **Provider priorities**
  - Google first for calendar/email/contacts — confirm?
- ⏺️ **OAuth flow**
  - NestJS-side token storage, refresh, revocation.
- ⏺️ **Calendar integration**
  - How events surface in the KG (pages? external refs? both?). Scope read vs. write.
- ⏺️ **Email integration**
  - Scope: draft-only for MVP, or read inbox too?
- ⏺️ **Contacts integration**
  - How imported contacts map onto `person` pages + aliases.
- ⏺️ **Token / secret storage**
  - Supabase Vault vs. server env vs. per-user encrypted.

---

## 16. Prompts to write (SPEC set)

Centralized list — each prompt gets its own spec doc.

- ⏺️ **Call-agent system prompt**
  - See §8.
- ⏺️ **Onboarding interview prompt**
  - See §10.
- ⏺️ **KG parsing / fan-out prompt**
  - See §6.
- ⏺️ **Noteworthiness classifier prompt**
  - See §6. May be inline with parsing prompt or standalone.
- ⏺️ **Entity-disambiguation prompt**
  - See §6.
- ⏺️ **Page-abstract regeneration prompt** (inlined with fan-out for MVP)
  - Pro regenerates `agent_abstract` + `abstract` alongside section writes — no separate pass in MVP. A dedicated prompt + dedicated Flash pass becomes relevant only if abstract quality drifts or fan-out cost demands offloading. See §4, §17.
- ⏺️ **Research task prompt**
  - See §11.
- ⏺️ **Podcast-script task prompt**
  - See §11.
- ⏺️ **Email-drafting task prompt**
  - See §11.
- ⏺️ **Calendar-event task prompt**
  - See §11.
- ⏺️ **Daily/evening brief task prompt**
  - See §11.
- ⏺️ **Linting / healthcheck prompts**
  - See §7.
- ⏺️ **Proactive-recommendation prompts**
  - One per recommendation kind. See §13.

---

## 17. Cost & inference strategy

- ✅ **Inference-cost control for page edits — section-scoped writes**
  - **Resolved via the sectioned data model (§3).** Pro emits targeted section keep/update/create/tombstone operations rather than full-page rewrites. Unchanged sections cost ~36 chars (uuid only) in the output; only the changed section content is re-emitted. Turns update cost from O(page size) to O(changed section size). Page-splitting at a token threshold (proactive recommendation, see features.md) remains open but is a UX-level nudge rather than a cost-control requirement now.
- ✅ **Prompt-caching strategy**
  - Gemini explicit caching for fan-out main prompt, call-agent scaffolding, research-task scaffolding. Implicit caching handles smaller/variable prompts. See §2 Server for details.
- ✅ **Model tiering**
  - Gemini Flash for candidate retrieval (stage 1 of fan-out) and other lightweight classifiers. Gemini Pro for fan-out main (stages 2–7) + research. Gemini Live for in-call agent. Abstract regeneration inlined with Pro for MVP. See §2 Server.
- ⏺️ **Token budgets per pipeline**
  - Call preload, fan-out per transcript, research task, brief task. Instrumented + alertable.
- ⏺️ **Per-user cost tracking**
  - Persisted per call / per task so we can surface or gate.
- ⏺️ **Batch API usage**
  - For non-latency-critical tasks (overnight briefs, bulk reprocessing).
- ⏺️ **Regeneration debouncing**
  - Summary + index regen triggered on write but coalesced.
- ⏺️ **Embeddings / search-result caching**
  - If §18 adopts semantic search.
- ⏺️ **Cost alarms**
  - Per-user and per-system thresholds.

---

## 18. Search

- ⏺️ **`search_graph` implementation**
  - Postgres full-text first; upgrade to pgvector when. (architecture.md §Open questions)
- ⏺️ **Embedding pipeline**
  - If/when pgvector lands: model choice, when embeddings are computed, how they stay fresh on edit.
- ⏺️ **Ranking**
  - Blend of FTS + recency + relevance.

---

## 19. UX surfaces

- ⏺️ **Wiki browse UI**
  - Virtual folders by `type` (People, Concepts, Projects, Sources, Notes, Research, Profile). Hierarchy tree view within each. Search, filter by tag/type.
- ⏺️ **CRUD UI**
  - Create, tombstone, edit, merge (entity disambiguation), bulk ops, undo stack. Includes an explicit "New Project" affordance (top-level `project` page) and a "Move under…" action for reparenting.
- ⏺️ **Project pinning**
  - User can pin a `project` page as "active"; feeds the preload-prioritization signal (§8). Storage mechanism TBD — boolean column vs. derived from user activity vs. dedicated pins table.
- ⏺️ **WYSIWYG editor choice**
  - Lexical, TipTap, ProseMirror, or custom markdown editor.
- ⏺️ **Graph view**
  - Visualization library, default filters, interactions. (architecture.md §Open questions)
- ⏺️ **Call-history UI**
  - Listing, filtering, linking back to spawned artifacts.
- ⏺️ **Activity-stream UI**
  - Mixed-type feed with grouping + snooze.
- ⏺️ **Notifications UI**
  - In-app screen + push payload shape.
- ⏺️ **Phone FAB ubiquity**
  - Across every screen. (features.md §Start a call from anywhere)
- ⏺️ **Contextual-call initialization**
  - Passing the current page context into call start.
- ⏺️ **Plugin launcher UI**
  - Already prototyped — confirm MVP role.

---

## 20. Auth, security, privacy

- ✅ **Auth provider**
  - Supabase Auth for user accounts (implied by stack).
- ⏺️ **Auth methods for MVP**
  - Email+password, Apple, Google — confirm which.
- ⏺️ **Account deletion flow**
  - Tombstone vs. hard-delete of all user data.
- ⏺️ **Export**
  - "Download as git repo / zip of markdown" portability path. (architecture.md §Open questions)
- ⏺️ **Agent-scope access audit**
  - Endpoint review + test suite. Already listed in §3.
- ⏺️ **Secret management**
  - Server env vars, Supabase Vault for per-user tokens.
- ⏺️ **Rate limiting**
  - Per-user call starts, per-user task triggers.
- ⏺️ **Abuse / quota ceilings**
  - To prevent runaway inference costs.

---

## 21. Observability, testing, DevEx

- ⏺️ **Logging**
  - Structured logs on both client and server; correlation IDs across call → transcript → fan-out → task.
- ⏺️ **Tracing / metrics**
  - OpenTelemetry or Supabase-native. Prompt-cost metrics, fan-out latency, queue depth.
- ✅ **Error reporting**
  - **Sentry** on client and server. (See §2 Dev tooling.)
- ⏺️ **Unit tests**
  - For fan-out classification & routing.
- ⏺️ **Integration tests**
  - Against a real Postgres — no DB mocks.
- ⏺️ **LLM output evals**
  - For each prompt (noteworthiness, routing, task prompts).
- ⏺️ **RLS / agent-scope leakage tests**
  - Part of the security suite.
- ⏺️ **E2E tests for Call mode**
  - Once the stack is wired.
- ⏺️ **CI/CD**
  - GitHub Actions pipeline for typecheck, lint, test, DB-migration check.
- ✅ **DB migrations**
  - **drizzle-kit**. (See §2 Dev tooling.)
- ⏺️ **Seed data for local dev**
  - Deterministic fixtures to boot against.
- ✅ **Feature-flag / kill-switch mechanism**
  - **PostHog** feature flags. (See §2 Dev tooling.)

---

## 22. Cross-cutting principles to enforce in code

- ✅ **Activity-stream coverage**
  - Every feature that produces work adds to the activity stream.
- ✅ **Graph citizenship**
  - Every new artifact knows its provenance + downstream consumers.
- ✅ **Manual override**
  - Every automation has a manual override.
- ✅ **Filable outputs**
  - Every generated output is filable into the wiki.
- ⏺️ **Structural enforcement**
  - Lint/check these principles — code-review checklist item or architectural fitness test.

---

## 23. Sequencing — what unblocks what

Use this to order the spec-writing passes. Items listed here are the critical path; everything else can be worked in parallel.

1. ✅ **§1 MVP feature cut**
   - V0: Call mode, transcript ingest, wiki browse/edit, research. V1: podcasts + scheduling. Rest deferred.
2. ✅ **§4 profile sub-type handling**
   - Single `profile` type, hierarchy-organized.
3. ✅ **§4 hierarchy semantics**
   - No max depth, app-level cycle check, block tombstone on non-tombstoned children, walk-up slug rule with numeric fallback, filesystem invariant at DB layer.
4. ✅ **§4 Ephemeral vs evergreen content on a page**
   - Timeline / Evergreen heuristic: pages start Evergreen, split only on contradiction, Timeline newest-first with Current/Past annotations. Uniform across page types.
5. ⏺️ **§6 fan-out pipeline SPEC**
   - Gates KG parsing prompt, noteworthiness classifier prompt, §7 lint design.
6. ⏺️ **§11 background-loop architecture SPEC**
   - Gates research-task implementation and §12 scheduler (V1).
7. ⏺️ **§17 cost strategy**
   - Interleave with §6 and §11 since it dictates model tiering and caching design.
8. ⏺️ **§16 prompt specs**
   - Written after their owning systems land.
9. ⏺️ **§8 preloaded-slice SPEC + call-agent prompt**
   - Can proceed in parallel with §6 since call-mode writes are still disallowed; only reads the KG.
10. ✅ **§3 artifact-source decision**
    - Resolved: per-entity junction tables, keyed at section granularity (`wiki_section_transcripts`, `wiki_section_urls`, `wiki_section_ancestors`, `wiki_section_uploads` V1).
11. ✅ **§3 / §17 sectioned pages**
    - Resolved: `wiki_pages` split into `wiki_pages` (metadata + `agent_abstract` + `abstract`) + `wiki_sections` (editable content, h2-granularity). Pro writes at section granularity; unchanged sections cost ~36 chars in output. Resolves §17 inference-cost problem. Timeline becomes a named section (`title='Timeline'`), not a page-level split.
12. ⏺️ **Sync `architecture.md` and `features.md` with all resolved decisions**
    - Final step before production coding. Reflect the dropped topics abstraction, the `profile` type collapse, the `research` type, the sectioned-pages data model, the `agent_abstract` / `abstract` naming, the section-level source junctions, the project-elevation recommendation, and any other decisions captured in this doc. Architecture docs become the authoritative reference once production build begins.

---

## 24. Definition of "ready to start production coding"

All of the following are true:

- ✅ **MVP feature cut**
  - Written and agreed.
- ⏺️ **Full data model**
  - Reviewed and migrations drafted.
- ⏺️ **Scopes, types, hierarchy**
  - Decided. (Topics dropped; only profile sub-types + hierarchy semantics remain open.)
- ⏺️ **Fan-out pipeline SPEC**
  - Complete with an eval-harness plan.
- ⏺️ **Call-agent prompt + KG parsing prompt**
  - Written at v0 with a test call / test transcript demonstrating acceptable behavior.
- ⏺️ **Background-loop architecture**
  - Picked queue + a minimal end-to-end demo job.
- ⏺️ **RLS policies + agent-scope leak tests**
  - Drafted.
- ⏺️ **Cost strategy**
  - Names model tiers per pipeline and a token budget per call/task.
- ⏺️ **Dev tooling**
  - Monorepo, local Supabase, migrations, CI wired.
- ⏺️ **Architecture & features docs synced**
  - `architecture.md` and `features.md` updated to reflect every resolved decision in this todo doc.
