# Constellate — Architecture

## Vision

Constellate is a voice-first, general-purpose AI assistant ("Muse") that builds and maintains a persistent, compounding knowledge base about its user — their interests, work, relationships, goals, and evolving understanding of the world.

The interaction model is conversational: the user talks with Muse via voice calls. Each call enriches a personal knowledge graph, which in turn informs every future conversation. Over time the assistant becomes progressively more useful because it progressively knows more.

## Target capabilities

- Onboarding interview that seeds the knowledge graph
- Ongoing voice conversations that both draw from and contribute to the KG
- Agent-executed background tasks:
  - Research & reading-material preparation on a topic
  - Podcast-style audio generation on a topic
  - Thought-partnership — surfacing cross-domain connections, patterns, open threads
  - Email drafting (via connected accounts)
  - Morning briefs / evening summaries from calendar, tasks, goals
  - Calendar event creation
  - Recurring scheduled tasks (daily brief M–F, weekly podcast, etc.)
- A browsable graph view of the user's personal knowledge

---

## Core UX principles

### Proactiveness
Muse does things without always asking permission. It absorbs information from conversation, files it into the right place, proposes follow-ups, schedules itself, and surfaces relevant context unprompted.

### Transparency
Everything the AI does is visible to the user. What it knows, where it knows it from, what it wrote to the KG, what it inferred. The KG is a first-class surface the user can browse, read, and edit.

### Friction proportional to the cost of reversal
- Cheap-to-reverse actions (KG edits) happen silently, with undo always available.
- Expensive actions (launching research, sending email, creating calendar events) require explicit confirmation.

This principle resolves most UX design questions about confirmation flows.

---

## System flow

1. **Client-side voice call.** User starts a Gemini Live session. Call persists through screen-lock. Muse draws on a preloaded slice of the user's KG and can query deeper via a `search_graph` tool. Call ends with a summary + action-item confirmation step.
2. **Transcript upload.** Full transcript is sent to the server. Raw transcript is stored immutably and surfaced to the user via "Call History."
3. **Server-side KG integration.** A server-side AI pipeline reads the transcript, classifies utterances for "noteworthiness," and fans out updates across wiki pages. KG writes happen silently; the user can undo via CRUD UI.
4. **Background task execution.** Confirmed action items kick off background jobs (research, podcast, email drafts). Outputs are filed back into the wiki.
5. **Notification & review.** User receives a push notification when a task completes, reviews the output in-app, and can redirect or refine.

---

## Interaction modes

Initial build focuses on **Call mode** (full voice dialogue). Two lighter modes are planned but deferred:

- **Ask** — short question, short answer.
- **Note** — voice-captured note that goes straight to transcript → KG processing, no dialogue.

All modes are voice-first. Triggering UI (button layout, long-press menu, wake words) is deferred until after Call mode is solid.

---

## Client architecture

- **Framework**: React Native + Expo
- **Voice**: Gemini Live for the conversational agent
- **Audio**: React Native Audio API for mic streaming, playback, and processing
- **Local cache**: SQLite mirror of the user's wiki, hydrated via Supabase Realtime
- **Call session**: persists through screen-lock

### In-call graph access

- **Preload**: at call start, the system prompt is populated with a relevant slice:
  - The wiki index (title + summary for every active page)
  - Full content of agent-scope pages (Muse's private notes on the user)
  - Full content of recently-updated or topically-relevant user-scope pages
- **Live tool use**: a `search_graph` tool lets the agent retrieve any additional page by slug or via search mid-conversation.
- **Writes are disallowed during the call.** All writes happen server-side, post-call, from the transcript.

---

## Server architecture

- **Framework**: NestJS
- **Storage**: Supabase (Postgres + Auth + Realtime + Storage)
- **AI**: Langchain + Anthropic SDK for agentic workflows
- **Background jobs**: TBD — see Open Questions

---

## Knowledge graph design

### Inspiration

Based on Andrej Karpathy's "LLM Wiki" pattern: the knowledge base is a collection of interlinked markdown pages, incrementally written and maintained by the AI. Markdown is natively readable to both the user and to LLMs. The AI handles all the bookkeeping (cross-references, summaries, supersession) so the graph stays healthy at near-zero maintenance cost.

### Adaptations for Constellate

Karpathy's pattern is document-centric (drop in an article, LLM integrates it). Constellate is conversation-centric. A 30-minute call is not one coherent "source" — it's a stream of dozens of micro-facts that fan out across many pages. The server-side pipeline owns that fan-out.

### Scopes (the hard partition)

Two scopes enforce a privacy guarantee:

- **`scope: 'user'`** — the user's knowledge graph. Information they've shared, requested, or produced. Fully visible, fully CRUDable by the user. Examples: profile, goals, values, health, work, relationships, people, projects, concepts, sources, notes.
- **`scope: 'agent'`** — Muse's private notes *about* the user: behavioral observations, inferred traits, interaction preferences, working theories. Readable by the user (for transparency), but not writable. Not included in the default "my wiki" view.

**Cross-scope linking is not allowed.** The partition is strict — a page in one scope cannot link to a page in the other. This keeps the privacy boundary clean and makes it structurally impossible for agent-scope content to leak into user-scope artifacts via reference chains.

### Page typing (typed + freeform body)

Each page has a `type` that drives the AI's expectations for its structure. The body is free-form markdown. `type` also determines the default UI folder.

**User-scope types:**
- `person`, `concept`, `project`, `place`, `org`, `source`, `event`, `note`
- `profile_goals`, `profile_values`, `profile_health`, `profile_work`, `profile_interests`, `profile_relationships`, `profile_preferences`, `profile_psychology`
- `topic` — the root page of a user- or AI-curated grouping

**Agent-scope types (starter set):**
- `agent_psychology` — observed thinking/motivation patterns
- `agent_interaction` — learned interaction preferences
- `agent_theories` — working hypotheses

> ⚠️ **Under review** — the `profile_*` prefix, and the existence of `topic` as a type, are both open design decisions. See Open Questions: "Profile sub-type handling" and "Topics vs. hierarchy." Either may change substantially (or be removed entirely) pending a dedicated pass.

### Page hierarchy (proposed)

`wiki_pages` includes a nullable `parent_page_id` self-reference. Any page can be a child of any other page in the same scope, enabling unlimited nesting. A `health` page can have children `sleep`, `exercise`, `nutrition`; a `constellate` project page can have children `backend`, `mobile`, `kg-design`.

Hierarchy gives a natural navigation tree, a clean home for sub-articles created by split recommendations (see features.md), and a replacement candidate for the `topics` abstraction (see next section).

### Topics (cross-cutting groupings) — UNDER REVIEW

> ⚠️ **Open decision**: the topics concept may be replaced entirely by page hierarchy, or retained as an orthogonal many-to-many grouping overlay. See Open Questions.

A topic is an explicit grouping mechanism beyond the type hierarchy. "My Constellate project" might group a `project` page, several `person` pages (collaborators), several `concept` pages (techniques), plus `note` and `source` pages. No single folder captures that.

Each topic optionally has a `root_page` — a `wiki_page` of type `topic` that serves as a Karpathy-style index.md for that topic. The root page is AI-maintained: overview, user's engagement, links to member pages.

Topics originate from two places:
- **Default** — seeded on signup (Health, Work, Relationships, Interests, Goals), each with a root-page stub filled in during onboarding.
- **Custom** — created by the user directly, or proposed by the AI when it detects a cluster of related pages.

A page belongs to exactly one `type`, and zero-to-many `topics`.

### Mutability model

- **Append-only at the fact level**, newest-wins on read.
- Personal facts (where the user works, what their goals are) are superseded by the newest statement.
- Objective/general-knowledge facts are not overwritten by newer contradicting statements.
- User edits are tombstoned (`tombstoned_at`) rather than hard-deleted, preserving undo.
- All edits — by AI, user, lint pass, or background task — are recorded in `wiki_page_history` with full content snapshots.

### The index

The wiki index is the authoritative catalog of active pages. It is:

- A **materialized view / API endpoint** over `wiki_pages`, not a stored file.
- Rendered as markdown on demand for injection into the Gemini Live system prompt at call start.
- Kept idempotent by storing a `summary` field on each page (AI-regenerated on edit).
- Cheap to rebuild from scratch if any cache is evicted.

### The log

`wiki_log` is an append-only chronological record of what happened and when — ingests, queries, lint passes, task outputs. Provides a timeline of the KG's evolution and context for the AI about recent activity.

### Sources & grounding

**Every fact in the KG is grounded.** No wiki content is written without an attributable source. Sources can be:

- A call transcript (most common — facts extracted from conversation)
- A web search result or URL (from a `search_web` tool during research tasks)
- A user-uploaded document, image, or audio file
- A user-authored edit (the user themselves is the source)
- An upstream wiki page or derived artifact (for content generated from existing KG material)

This grounding surfaces in the UI: every wiki page shows its sources, and sources link back to the artifacts that produced them. The principle holds end-to-end — research outputs cite the pages they drew on; podcasts cite the research that fed them; briefs cite the calendar, wiki, and notes they synthesize. The user can always answer "why does Muse think this?" by following the trail.

Grounding is also the bidirectional link that powers the "deep connectivity" feature (features.md): following it forward gives you a page's provenance; following it backward from a transcript or source tells you everything downstream it produced.

---

## Data model

```sql
wiki_pages
  id              uuid pk
  user_id         uuid fk
  scope           text  ('user' | 'agent')
  type            text  (see page types above)
  slug            text  (unique per user_id + scope; used for [[wikilinks]])
  parent_page_id  uuid fk nullable   -- self-reference; enables hierarchy
  title           text
  summary         text  (AI-generated, 1–2 sentences)
  content         text  (markdown body)
  frontmatter     jsonb (aliases, custom fields)
  created_at      timestamptz
  updated_at      timestamptz
  tombstoned_at   timestamptz nullable

wiki_page_history
  id             uuid pk
  page_id        uuid fk
  content        text  (full snapshot)
  edited_by      text  ('ai' | 'user' | 'lint' | 'task')
  edited_at      timestamptz

tags
  id             uuid pk
  user_id        uuid fk
  name           text
  color          text nullable

wiki_page_tags
  page_id        uuid fk
  tag_id         uuid fk

topics
  id             uuid pk
  user_id        uuid fk
  slug           text
  name           text
  kind           text ('default' | 'custom')
  root_page_id   uuid fk nullable

wiki_page_topics
  page_id        uuid fk
  topic_id       uuid fk

call_transcripts
  id             uuid pk
  user_id        uuid fk
  title          text  (AI-generated, used in Call History UI)
  summary        text  (AI-generated, 1–2 sentences)
  started_at     timestamptz
  ended_at       timestamptz
  content        text  (immutable)

wiki_page_sources
  id             uuid pk
  page_id        uuid fk
  source_kind    text  ('transcript' | 'web' | 'upload' | 'user_edit' | 'task_output' | 'wiki_page')
  source_ref     text  (transcript_id, url, upload_id, task_id, page_id — interpreted per kind)
  snippet        text nullable   (the specific passage or claim this source grounds)
  cited_at       timestamptz

wiki_log
  id             uuid pk
  user_id        uuid fk
  kind           text ('ingest' | 'query' | 'lint' | 'task')
  ref            text  (transcript_id, task_id, etc.)
  summary        text
  created_at     timestamptz
```

### Row Level Security

- `wiki_pages` with `scope='agent'` are accessible only to the server role, never to the client. The privacy guarantee is enforced at the DB layer.
- All other user-owned rows are scoped by `user_id` via RLS.

### Sync model

- Server is the source of truth.
- Client maintains a local SQLite mirror of the user's wiki, hydrated via Supabase Realtime.
- Two-way sync: client writes (user edits) propagate to Postgres; server writes (AI fan-out) propagate to the client over realtime.

### Frontmatter conventions

```yaml
---
type: person
title: Sarah Chen
aliases: [Sarah, Sis]
tags: [family]
sources: [transcript:2026-04-21-1432]
created_at: 2026-04-21
updated_at: 2026-04-21
---
```

Aliases are critical for voice disambiguation (spoken name → canonical slug).

---

## UI rendering

The wiki UI composes virtual folders from the data:

```
My Wiki
├── Profile        (auto: type = 'profile_*')
├── People         (auto: type = 'person')
├── Concepts       (auto: type = 'concept')
├── Projects       (auto: type = 'project')
├── Sources        (auto: type = 'source')
├── Notes          (auto: type = 'note')
└── Topics
    ├── Health         (default topic)
    ├── Work           (default topic)
    ├── Relationships  (default topic)
    ├── Interests      (default topic)
    ├── Goals          (default topic)
    └── ... custom topics
```

### Page interaction

- **Read**: rendered markdown, with a graph view available.
- **Edit**: WYSIWYG editor with basics — bold, italic, bullets, headers. Raw markdown edit as an escape hatch.
- **CRUD**: create, tombstone, edit; plus merge (for entity disambiguation).

---

## Onboarding

1. New user creates an account.
2. Default `profile_*` pages and default `topics` (Health, Work, Relationships, Interests, Goals) are seeded as empty stubs.
3. **Onboarding interview** — a scripted Call-mode session with Muse that fills in the profile and topic root pages.
4. User arrives at the Home screen with a partially populated wiki ready to grow.

---

## Server-side transcript processing (to be designed in depth)

Current rough shape:

1. Client uploads transcript.
2. Server pipeline classifies transcript utterances for "noteworthiness" — signal vs. noise.
3. Fan-out: noteworthy items are routed to the correct pages — creating new pages where needed, appending to existing pages otherwise, using newest-wins supersession for personal facts.
4. Summaries on touched pages are regenerated.
5. A `wiki_log` entry is written.

Full design of the fan-out / classification pipeline is **deferred for a dedicated conversation**.

---

## Open questions & design decisions

### Knowledge graph — structure & typing

- **Profile sub-type handling**: the `profile_*` prefix (e.g. `profile_goals`, `profile_values`) is under review. Options include: (a) drop the prefix and treat them as a single `profile` type with a sub-topic field; (b) replace with child pages under a `profile` parent via the new hierarchy mechanism; (c) keep as-is with better justification. Needs a decision.
- **Topics vs. hierarchy**: with `parent_page_id` introduced, topics (as a separate many-to-many grouping) may be redundant. Decision needed: (a) drop topics entirely, use hierarchy for grouping; (b) keep topics as an orthogonal overlay for cross-cutting groupings that aren't a tree; (c) retain topics but demote to tag-like behavior.
- **Newest-wins representation on an append-only page**: flat chronological list with `status: current | superseded` markers, vs. a visible **Current** section with an archived **History** section.
- **Notes refactoring**: when a freeform `note` page accumulates content that belongs on canonical pages, does the AI refactor it out over time? Keep a link trail back to the origin note?
- **Schema document (CLAUDE.md / KG parsing prompt)**: needs to be drafted in full — it's the system-prompt config that turns the server AI into a disciplined wiki maintainer. Deserves its own pass.

### Knowledge graph — process

- **Fan-out pipeline (tabled for dedicated conversation)**: classification of noteworthiness; routing claims to specific pages; entity disambiguation from voice input (aliases lookup + fuzzy match?); conflict resolution between the newest-wins rule and "objective fact" claims.
- **Sources & grounding conventions**: how sources are cited inline in page content (footnote-style, inline links, both?); retention rules for sources when a superseding fact arrives; how the UI surfaces provenance per-claim vs per-page.
- **Generalized artifact-source linking**: `wiki_page_sources` covers wiki pages today, but the grounding principle applies to *every* derived artifact — research outputs, podcasts, email drafts, briefs, calendar events. As each of those materializes into its own table, it will need the same source-linking pattern. Decision needed: (a) duplicate a `<artifact>_sources` table per artifact type; (b) introduce a single polymorphic `artifact_sources` table with `artifact_kind` + `artifact_id`; (c) a cleaner abstraction. Relates directly to the "deep connectivity" feature (features.md), which relies on the reverse lookup working across all artifact kinds.
- **Wiki seeding protocol**: what exactly is pre-populated on account creation vs. what emerges from onboarding. Stub pages, default topics/parents, agent-scope starter pages, Muse's initial self-description. Needs finalization.
- **Linting / healthcheck background flow**: when it runs (cadence, triggers), what it checks (orphans, contradictions, stale claims, missing cross-refs, split candidates), what it's allowed to do autonomously vs. what it surfaces as recommendations.
- **Inference-cost control for page edits**: if every KG edit requires a full-article rewrite, costs explode for long articles. Strategies to consider: diff-based edits, section-scoped edits, AI-driven page-splitting recommendations when pages exceed a token threshold (see features.md "Proactive split recommendation"), caching page summaries so the rewrite pipeline doesn't need to re-read unchanged sections.

### Call mode

- **Preloaded slice contents**: exactly which pages, and how much content, to inject into the Gemini Live system prompt at call start. The full index is obvious; beyond that — which agent-scope pages, which recent user-scope pages?
- **Call-end flow details**: how Muse surfaces action items for confirmation, what happens if the user wants to amend, cancellation flow.
- **Onboarding interview script design**: scripted prompts vs. fully freeform, handling incomplete interviews, resumption.

### Interaction modes

- **Ask / Note modes**: triggering UX, whether they go through Gemini Live or a simpler request-response path, whether Note bypasses dialogue entirely.

### Background tasks

- **Background loop architecture**: needs refinement. Includes job queue choice (pg_cron + edge functions, BullMQ, dedicated worker?), retry semantics, observability, how background jobs read from and write to the KG, and how the lint/healthcheck loop fits alongside task execution.
- **Task output format**: how research outputs, podcast scripts, morning briefs are filed back into the wiki — page types, naming, hierarchy placement.
- **Scheduled / recurring tasks**: configuration surface (conversational vs. settings screen?), where schedules are stored.

### Integrations

- **Calendar, email, contacts**: which providers (Google first?), OAuth flow, how connected resources surface in the KG (as pages? as external references?).
- **Notifications**: push infrastructure, notification grouping.

### Data + infra

- **Finalize tech stack**:
  - Client-side data solution: plain SQLite vs. RxDB (or another reactive local DB). RxDB offers observable queries and replication primitives that may simplify the 2-way sync story.
  - Inference provider(s): Anthropic SDK as the default, or support multiple providers/models (OpenAI, Google, local). Affects abstraction layer, cost management, and prompt portability.
- **Data model review**: full audit pass once the outstanding decisions above resolve — types, relations, indexes, RLS policies, history retention.
- **Frontmatter review**: purpose, utility, and convention. What lives in columns vs. jsonb frontmatter? How does it interact with markdown rendering and the edit UI?
- **Search for `search_graph` tool**: start with Postgres full-text search; upgrade to pgvector if semantic search becomes necessary. When?
- **History storage cost**: full snapshots per edit is simple but grows. At what scale do we reconsider (diffs, periodic snapshots)?
- **Agent-scope leak prevention**: RLS enforcement tests, audit trail for any server endpoint that could return agent-scope content.
- **Export**: offering users a "download as git repo / zip of markdown" export path for portability.

### Prompts to write

These are the core AI configurations the app depends on. Each needs its own dedicated design pass.

- **Call agent system prompt** — Muse's in-call behavior, voice, boundaries, tool use.
- **Onboarding interview script/prompt** — the structured-but-conversational flow that seeds the KG.
- **KG parsing prompt** (the Karpathy CLAUDE.md analogue) — instructs the server AI on how to classify, route, and file transcript content into the wiki.
- **Background task prompts** — one per task type: research, podcast, email drafting, calendar event creation, daily/evening brief, etc.

### UX surfaces

- **Graph view**: visualization library/approach, default filters, interactions.
- **Wiki browse UI**: folder organization, search, filtering by tag/topic/type.
- **CRUD UI**: merge-entities flow (for disambiguation), bulk operations, undo stack.
