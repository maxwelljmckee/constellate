# Constellate — Tradeoffs Log

Architectural decisions where we weighed real alternatives, recorded for traceability. Each entry names what we chose, what we passed on, the reasoning, and the trigger that would push us to revisit. Ordered by area.

This is a companion to `todos.md` (decision checklist) and `architecture.md` (current system design). Use this doc when a design choice starts feeling wrong — to see what else we considered and under what assumptions we picked this.

---

## Tech stack

### Gemini-only inference for MVP
- **Chose:** Gemini for everything (Flash + Pro + Live).
- **Passed on:** Anthropic for fan-out/research; multi-provider routing from day one.
- **Why:** ~2–3× cheaper tier-for-tier; explicit caching matches Anthropic prompt caching for our main use cases; already on Gemini Live for calls; single-vendor ops.
- **Gives up:** Anthropic's edge on hard reasoning; provider redundancy.
- **Revisit if:** A specific prompt refuses to stabilize on Gemini. The inference layer is abstracted (one internal interface) so a single pipeline can route to Anthropic without a full migration.

### EAS for mobile builds (vs. Fastlane on GitHub Actions)
- **Chose:** EAS Build + Submit + Update.
- **Passed on:** Fastlane on GitHub Actions (free to run).
- **Why:** Integrated Expo toolchain; OTA updates via EAS Update; free tier covers MVP; less YAML + signing-cert wrangling.
- **Gives up:** Per-build cost once the free tier is exceeded; vendor lock-in to EAS.
- **Revisit if:** EAS bills meaningfully exceed a comparable Fastlane-on-GHA setup.

### Graphile Worker for background jobs
- **Chose:** Graphile Worker — Postgres-backed, runs inside the NestJS process.
- **Passed on:** pg-boss (stagnant, last meaningful release ~2 years ago), BullMQ (requires Redis), Inngest (SaaS dependency + cost).
- **Why:** Actively maintained; single datastore with Supabase; TypeScript-native; cron + retries + priorities built in.
- **Gives up:** Inngest's durable-execution sophistication for complex sagas / long branching workflows.
- **Revisit if:** Throughput exceeds what a single Postgres can handle, or we hit real durable-execution needs (multi-step workflows with branching + compensation).

### Direct Gemini SDK (vs. Langchain)
- **Chose:** `@google/genai` directly. No Langchain.
- **Why:** Our pipelines (fan-out, preload, call-agent) are bespoke; Langchain abstractions fit them poorly and add indirection.
- **Gives up:** Prebuilt chains, retrievers, tools — we rebuild the ones we want.
- **Revisit if:** We find ourselves reimplementing large chunks of Langchain for multi-step tool use anyway.

### RxDB + Supabase replication (vs. raw SQLite + custom sync)
- **Chose:** RxDB wrapping SQLite (via `expo-sqlite`), using the Supabase replication plugin.
- **Why:** Observable queries (UI auto-updates when fan-out completes); turnkey bidirectional sync with built-in conflict resolution; subsumes the custom sync layer we'd otherwise build.
- **Gives up:** An extra abstraction on top of SQLite; some bundle-size cost; RxDB learning curve.
- **Revisit if:** RxDB blocks us on a performance or schema problem that raw SQLite would solve directly.

---

## Data model

### Sectioned pages — `wiki_pages` + `wiki_sections` (vs. monolithic `wiki_pages.content`)
- **Chose:** Page body lives in `wiki_sections` (h2-granularity rows with uuid, title, content, sort_order). `wiki_pages` holds metadata + `agent_abstract` + `abstract`. Pro reads the full joined page but writes at the section level.
- **Passed on:** Single `content` column on `wiki_pages` with full-page rewrites on every edit; line/paragraph-granularity diff-based edits (too fine).
- **Why:** Turns update cost from O(page size) to O(changed section size) — the load-bearing answer to the §17 cost-control problem. Unchanged sections cost ~36 chars (uuid only) in Pro's output. Contextual understanding preserved because Pro reads the fully-joined page. Timeline becomes "just a section with `title='Timeline'`" — Evergreen/Timeline dichotomy dissolves cleanly.
- **Gives up:** Higher schema complexity (two-table reads; history at section level; source junctions at section level; client sync covers two collections); section ordering management (sort_order); harder rollback ("page as of time T" = joined query across section histories).
- **Revisit if:** Section granularity proves wrong in practice — too coarse (we wanted paragraph-level diffs) or too fine (most edits span multiple sections anyway, negating the savings).

### Naming: `agent_abstract` + `abstract` (vs. `summary` + `overview`, `summary` + `lead`, `abstract` + `summary`)
- **Chose:** `agent_abstract` (required, terse, machine-consumed, ~1 sentence, surfaced in index + preloads) + `abstract` (nullable, human-readable opening paragraph).
- **Passed on:** `summary`/`overview` (easily confused); `summary`/`lead` (good but asymmetric); `abstract`/`summary` (inverts academic-paper convention).
- **Why:** `agent_` prefix makes the purpose explicit — "this is a first-class LLM prompt input." Scales if other fields acquire the same agent/user duality. Symmetric pair at different fidelity levels.
- **Gives up:** `abstract` as the *longer* field mildly inverts the academic connotation of "abstract" (terse). The `agent_` prefix anchors the distinction clearly; the inversion is documented here and otherwise ignored.
- **Revisit if:** Confusion emerges in practice; `summary`/`lead` is the clean fallback.

### Per-entity section-level source junctions (vs. page-level junctions or polymorphic `wiki_page_sources`)
- **Chose:** `wiki_section_transcripts`, `wiki_section_urls`, `wiki_section_ancestors`, `wiki_section_uploads` (V1). All keyed on `section_id`.
- **Passed on:** Page-level junctions (earlier decision, superseded by the sectioned page model); polymorphic `wiki_page_sources` (original proposal).
- **Why:** FK referential integrity; trivial JOINs; type-specific columns; precise citation granularity — snippet attaches to the specific section it grounded, not the whole page. Aligns with section-level writes.
- **Gives up:** One extra table per new source kind; reverse lookup (transcript → touched pages) is now two JOINs (`wiki_section_transcripts` → `wiki_sections` → `wiki_pages`).
- **Revisit if:** A long tail of source kinds all share the same columns — a polymorphic base with per-kind extension tables might be cleaner.

### Hierarchy + tags (vs. a `topics` page type)
- **Chose:** `parent_page_id` self-reference for nesting; `tags` for cross-cutting grouping. Dropped `topics` entirely.
- **Passed on:** A `topic` page type + `wiki_page_topics` join table.
- **Why:** One mechanism per axis, no overlap; smaller schema; less for the AI to reason about when routing claims.
- **Gives up:** A first-class "topic" noun in the UI/model.
- **Revisit if:** Users want a distinct concept of "topic" that neither hierarchy nor tags expresses naturally.

### Single `profile` type + hierarchy (vs. `profile_*` sub-types)
- **Chose:** One `profile` type. Sub-areas (Goals, Values, Health, Work, …) are child pages of a root `Profile` page.
- **Passed on:** Dedicated page types per sub-area (`profile_goals`, `profile_values`, etc.).
- **Why:** Fewer types for the AI to pattern-match on; aligns with hierarchy-as-nesting; sub-areas can be added or renamed without schema churn.
- **Gives up:** Type-level distinction between profile sub-areas (now expressed via parent only).
- **Revisit if:** We need per-sub-area schema (e.g., goal-specific frontmatter) that's awkward to keep in a shared type.

### Two-track slug strategy
- **Chose:** Walk-up for long-lived semantic types (`person`, `project`, `concept`, `profile`, `research`, `source`, `place`, `org`, `note`). `{kebab-title}-{short-hash}` for high-churn types (`todo`, likely `event` later).
- **Passed on:** Uniform walk-up for everything; uniform hash-suffix for everything.
- **Why:** Readable, stable slugs for semantic pages where humans will see URLs; collision-free slugs for pages that get systematically reparented (todos cycling through status buckets fragment walk-up slugs silently).
- **Gives up:** Two rules to hold in mind; ugly todo URLs (`buy-milk-a3f2`).
- **Revisit if:** Walk-up fragments silently in a long-lived type we didn't flag, or the hash-suffix ugliness becomes user-visible in a todo UI.

### Block tombstone on non-tombstoned children (vs. cascade)
- **Chose:** Block — user must reparent or tombstone children first.
- **Passed on:** Cascade tombstone of the whole subtree.
- **Why:** Explicit user intent; no silent mass-deletion from a careless action; safer given voice-first fuzzy targeting ("tombstone my project page" could ambiguously target multiple).
- **Gives up:** One more step when the user really does want to nuke a subtree.
- **Revisit if:** Users hit the friction repeatedly — could add an explicit "delete subtree" action separate from the tombstone flow.

### Todo status via reparent (vs. `status` field)
- **Chose:** Each todo is a page; status is expressed by which seeded bucket (`todo` / `in-progress` / `done` / `archived`) it lives under.
- **Passed on:** A `status` field in frontmatter; the four buckets become UI filters rather than pages.
- **Why:** One mechanism (hierarchy) for all structure; bucket pages make listings trivial; graph citizenship applies uniformly.
- **Gives up:** Reparenting on every status change introduces slug-collision risk (mitigated by the hash-suffix slug for `todo`).
- **Revisit if:** Systematic reparents cause perf issues, or hash-suffix ugliness becomes user-facing.

### Chronological pages = simple newest-first list (vs. current/superseded markers)
- **Chose:** Flat list, newest-first. No `current`/`superseded` markers, no separate "Current" / "History" sections.
- **Passed on:** Explicit current/archive split with maintenance invariants on write.
- **Why:** Attitude and view changes over time are preserved as meaningful context; cheaper prompt + UI; no invariants to maintain on write.
- **Gives up:** A one-line "what's currently true" readout — the LLM must synthesize it on demand.
- **Revisit if:** LLM consistently misreads older entries as current, or the UI needs a clearer "current state" summary.

### Organic Evergreen/Timeline split (vs. upfront ephemeral/evergreen tagging)
- **Chose:** Pages start as a single unqualified body; split into Evergreen + Timeline sections *only when a contradiction arrives*. Uniform across page types.
- **Passed on:** Tagging each claim as ephemeral or evergreen at ingest time.
- **Why:** No per-claim classification work; the split doubles as both page structure AND the conflict-resolution mechanism; simpler prompt.
- **Gives up:** Parsing prompt must handle *reclassification* (moving existing Evergreen content into Timeline when a contradiction arrives) — not just append.
- **Revisit if:** Reclassification proves too fragile in the prompt, or pages accumulate unsplit contradictions.

---

## Ingestion pipeline

### Entity resolution inline in Pro fan-out (vs. upstream Flash pass)
- **Chose:** Pro fan-out prompt resolves entities itself from the preloaded KG slice (which includes aliases). Flash does coarse candidate *retrieval* (which pages might be involved?), Pro does fine per-claim arbitration.
- **Passed on:** Separate Flash call producing a normalized mentions-to-slugs map consumed by Pro.
- **Why:** Simpler pipeline; lower latency; fewer moving parts for MVP.
- **Gives up:** Pro tokens spent on alias matching that could go to reasoning about claims; can't independently eval entity resolution accuracy.
- **Revisit if:** Routing accuracy is poor in practice or fan-out cost / latency balloons. A Flash pre-pass emitting resolved mentions is the clean next move.

### Preloaded slice = Flash's candidate set (vs. deterministic hot-set heuristic)
- **Chose:** Flash emits `touched_pages` + `new_pages` as part of its retrieval call; backend preloads full content of those pages for Pro.
- **Passed on:** Deterministic backend heuristic (string-match over aliases + recency + pinned projects) producing the hot set without an LLM.
- **Why:** Flash is already reading the transcript for the gate decision — marginal cost of also flagging candidate pages is small. Flash has judgment the heuristic doesn't: pronouns, implicit references, synonyms, contextual inference. One fewer piece to tune.
- **Gives up:** Flash's retrieval accuracy is now pipeline-critical; harder to independently reason about "is this noteworthy" vs "what does it touch"; Flash cost grows slightly.
- **Revisit if:** Flash recall becomes a measurable quality drag (claims routed to wrong pages because the right page wasn't preloaded) or if Flash cost starts dominating.

### No `fetch_page` fallback for MVP (Pro bounded by Flash candidates)
- **Chose:** Pro can only write to pages Flash preloaded. No tool to fetch additional pages; no two-pass structured retry; no second-pass "did we miss anything?" check.
- **Passed on:** `fetch_page` tool; two-pass structured ("pages_i_also_need"); post-hoc Flash miss-recovery pass.
- **Why:** Tool use + structured JSON output is awkward to make reliable in Gemini; two-pass doubles Pro calls; MVP prioritizes shipping over recall guarantees.
- **Gives up:** Recall. If Flash misses a touched page, the claim is silently dropped (or routed to an imperfect candidate).
- **Revisit if:** Evals show meaningful claim loss from Flash misses. Refactor paths in `notes/ingestion-pipeline.md` lay out the options (post-hoc recovery → two-pass structured → tool-use → embedding-union), in rising complexity.

### Flash pre-filter + Pro fan-out + mechanical SQL commit (vs. single call or multi-step LLM)
- **Chose:** Two LLM calls (Flash noteworthiness pre-filter, Pro fan-out main) then a deterministic SQL commit.
- **Passed on:** Single Pro call doing everything; multi-step LLM pipeline (noteworthiness → routing → per-page edit).
- **Why:** Flash is cheap and skips low-value transcripts before the expensive Pro call; structured JSON from Pro makes the commit pure SQL — idempotent, transactional, testable.
- **Gives up:** A second LLM call per processed transcript; Flash/Pro coordination.
- **Revisit if:** Flash is too conservative (drops noteworthy transcripts), too permissive (wasted Pro calls), or Pro alone proves accurate enough that Flash stops justifying its cost.

### Semantic-only LLM output contract (vs. full row-like JSON)
- **Chose:** LLM emits `title`, `slug`, `type`, `parent_slug`, `agent_abstract`, `abstract`, `sections` (with per-section `id` / `title` / `content` / `snippets`). Backend adds `user_id`, `page_id`, `section_id`, timestamps, `scope`, `tombstoned_at`, `sort_order`.
- **Passed on:** LLM emitting full row-like JSON including infrastructure fields.
- **Why:** Token budget stays on semantic content; LLM physically cannot fake a `user_id` or cross-write into another user's data; clean layer separation.
- **Gives up:** A small integration step marrying LLM output to infrastructure fields at commit time (already planned).
- **Revisit if:** N/A — this is a security invariant, not a cost tradeoff.

### Timeline stays flat — sub-grouping resolved by hierarchy, not section structure
- **Chose:** Timeline section is a flat newest-first bullet list. If Timeline appears to need sub-grouping (by attribute, by topic, by year), that is a signal the page's content belongs on separate pages — escalate by splitting via hierarchy, not by adding sub-structure within the section.
- **Passed on:** Grouped Timeline (e.g., `### Residence` / `### Career` sub-headers within the Timeline section).
- **Why:** Load-bearing, not just ergonomic. Sub-grouping collides with the sectioned data model (one `title` + one `content` per section row) and conflates temporal ordering (which lives inside Timeline) with structural hierarchy (which lives at the page level). Keeps Pro's output contract simple; uses a mechanism the system already has (pages + `parent_page_id`) to resolve growth.
- **Gives up:** Readability when Timeline gets long and covers multiple attributes. Hierarchy split is a manual-ish escalation (proactive recommendation via §7 lint, not automatic).
- **Revisit if:** Hierarchy-splitting doesn't trigger naturally and users end up with long, mixed-attribute Timelines that are hard to read.

### Implicit commitment extraction → multi-target write (vs. surface-only)
- **Chose:** When a surface claim matches a commitment pattern ("I told Alex I'd…", "I should…", "remind me to…"), Pro extracts both the surface fact (routed to the entity-relevant page) AND an implicit todo claim (routed to `todos/todo`).
- **Passed on:** Surface-only extraction; implicit todo only when user explicitly says "remind me."
- **Why:** Forgetting verbal commitments is a real user pain point. Voice-first calls naturally surface commitments without users translating them into "remind me" formulations. Pro has the context to distinguish commitment patterns from speculation/hypotheticals.
- **Gives up:** Recall risk inherited from the §4.3 MVP scope — if Flash doesn't flag `todos/todo` as a candidate for a transcript containing commitments, the implicit todo is silently dropped. Mitigation: Flash prompt should treat commitment-pattern presence as a signal to always flag `todos/todo`.
- **Revisit if:** Implicit todo capture proves too aggressive (users buried in todos they didn't intend) or too conservative (real commitments dropped). Either failure shifts the commitment-pattern list rather than the architecture.

### Muse's speech is not a source for claims (invariant, not tradeoff)
- **Chose:** Pro extracts claims only from the user's speech in the transcript. Muse's utterances are excluded from claim extraction, even when Muse restates facts back to the user.
- **Why:** Without this invariant, ingestion becomes a closed loop — Muse's inferences during a call could be written into the user's KG as if the user authored them. Hallucination amplification.
- **Gives up:** Nothing meaningful. Muse restating something is not new information.
- **Revisit if:** N/A — this is a security invariant, not a tradeoff.

### Skip-default for per-claim noteworthiness (vs. write-default)
- **Chose:** When in doubt about whether a claim is noteworthy, Pro skips it. Threshold framing in the prompt: "would a thoughtful reader six months from now gain anything from this claim?" If no clear yes — skip.
- **Passed on:** Write-default with aggressive Timeline use to soften over-writes.
- **Why:** The wiki suffers more from noise than from missed claims. A missed claim usually returns in another conversation; a noisy claim pollutes search and inflates inference cost permanently. Aligns with the §17 cost-control posture and the sectioned-pages design (sections optimize for *fewer, denser* writes).
- **Gives up:** Survivorship bias. Noise is visible (we see polluted pages); missed signal is invisible (we never see what we didn't write). The wiki may *feel* clean precisely because we silently lose information.
- **Revisit if:** Eval transcripts reveal Pro consistently dropping signal that users later expect to see in the wiki. Mitigation if it gets bad: a "second-pass" Flash review of the `skipped` array against the transcript to catch obvious misses.

### Restated facts → silent skip (vs. recency-bump or "still true" Timeline entry)
- **Chose:** When a claim restates a fact already captured in a candidate page, Pro skips silently. No Timeline entry, no field update, no recency marker.
- **Passed on:** (a) Adding `**Current** — (still true)` to Timeline; (b) bumping a `last_confirmed_at` column.
- **Why:** Timeline pollution from "still true" entries would balloon over time. A `last_confirmed_at` column adds schema and query complexity for an unclear UX win. The wiki already says the fact; nothing changes.
- **Gives up:** Recency signal — if a fact has been restated 12 times, we have no record of that frequency. Detection of "still-true vs. new-nuance-on-old-fact" depends entirely on Pro's judgment; misclassification loses the nuance.
- **Revisit if:** Recency surfaces as a real consumer signal (e.g., proactive recommendations need "facts the user keeps mentioning") — at that point, design a dedicated mechanism rather than retrofitting Timeline.

### Multi-target claim writes (vs. single-home + wikilinks)
- **Chose:** A single claim may write to multiple candidate pages — phrased from each target's perspective. "Sarah and I are starting Consensus" writes to both `sarah-chen` and `consensus`, with target-appropriate phrasing. Snippets on each write attach the same `turn_id`.
- **Passed on:** Single-home rule (claim lands on one canonical page; other involved pages get a wikilink reference).
- **Why:** Preserves searchability + context from any of the involved pages without requiring graph traversal. Aligns with the original "fan-out" framing of the pipeline. The user (or Pro in preload) reading `sarah-chen` sees the new project mentioned in-context, not as a link they have to follow.
- **Gives up:** Some duplication — the same underlying fact appears in slightly different phrasings on multiple pages. Source attribution prevents drift (both writes cite the same `turn_id`), but reading the wiki sequentially can feel repetitive.
- **Revisit if:** Duplication noise becomes a real readability problem, or if updates to one perspective cause stale phrasing on the other (deduplication is harder than just emitting both).

### Refinement & correction carveouts (vs. treating every attribute change as a contradiction)
- **Chose:** Pro distinguishes three patterns that look similar: **contradiction** (attribute actually changed over time → Timeline), **refinement** (new claim narrows/specifies an earlier broader one → in-place update), **correction** (user flags prior claim as wrong → wholesale overwrite, no Timeline).
- **Passed on:** Single rule treating any attribute-change-looking claim as a contradiction.
- **Why:** Without carveouts, refinements ("works at a startup" → "works at Consensus") and corrections ("I misspoke, it's Denver") would pollute Timeline with entries that either lose information (refinement → old broader claim appears as Past) or preserve history that shouldn't exist (correction → wrong claim preserved as Past). Explicit three-way distinction prevents both failure modes.
- **Gives up:** Added prompt complexity; Pro must reliably distinguish the three patterns. Correction detection in particular relies on user signaling ("I misspoke", "correction") and may fail silently otherwise.
- **Revisit if:** Timeline accumulates noise from refinements Pro misclassified as contradictions, or preserves wrong claims from corrections that weren't explicit enough.

### Top-level `creates` / `updates` / `skipped` arrays (vs. polymorphic `operations` array)
- **Chose:** Three top-level arrays in the JSON output, each with its own field shape.
- **Passed on:** A single `operations` array with `type: 'create' | 'update' | 'skip'` discriminator.
- **Why:** Resilient to LLM schema drift (a malformed `create` doesn't poison parsing of `updates`); matches backend write paths which differ per operation.
- **Gives up:** Slight redundancy when a page might appear in both arrays (shouldn't, but possible).
- **Revisit if:** N/A unless a concrete parsing issue appears in practice.

### LLM field names match DB column names
- **Chose:** LLM emits `agent_abstract`, `abstract`, `content`, `title`, `slug`, etc. — the same names as the `wiki_pages` / `wiki_sections` columns they populate.
- **Passed on:** LLM emits `new_*` or similar prefixed variants with backend renaming at write time.
- **Why:** Eliminates a pointless rename step; prompt reads like a data contract; easier to grep LLM output against the DB schema.
- **Gives up:** Nothing meaningful.
- **Revisit if:** N/A.
