# Constellate — Features

A catalog of target features for the product, grouped by area. These are **not in priority order** and **not all required for MVP** — this is the broader horizon.

---

## Call experience

### Start a call from anywhere
Every screen in the app has a phone FAB. Tapping it starts a call from wherever the user currently is. Crucially, the call is initialized with **context about the page the user is viewing** — e.g. starting a call from a wiki page on Sarah Chen begins the call with Muse primed on that page; starting from a research output begins it primed on that research.

### Different call types
Calls are not a monolith. They have different purposes based on context — or based on explicit user choice at initialization.
- **Generic call** — open-ended conversation, default preload (recent context, index, agent scope).
- **Contextual call** — initiated from a specific page; that page's content is added to the preload.
- **Task-specific call types** — e.g. "daily brief," "brainstorm on X," "thought-partner session." Each may have its own system-prompt variant, preload strategy, and call-end flow.

---

## Activity stream & notifications

### Notifications feed
A persistent list of activities taken on the user's behalf. Combines several streams:
- **Background task completions** (research finished, podcast ready, email drafted, etc.)
- **Unconfirmed action items** — if a user drops a call early or skips the confirmation step, the pending action items surface here for deferred confirmation rather than being silently discarded.
- **Proactive recommendations** (see below)

### Proactive recommendations
Muse identifies behavioral and usage patterns and surfaces recommendations into the notification stream:
- Suggested new scheduled tasks ("you've asked about AI news three mornings in a row — want a daily AI brief?")
- Suggested wiki changes (topic proposals, entity merges, missing connections)
- Suggested follow-ups from recent calls ("you mentioned wanting to reach out to Alex — draft a message?")
- **Suggested page splits** — when a wiki page grows past a token threshold, Muse proposes breaking it into sub-articles (using the hierarchy mechanism). Serves both readability *and* inference-cost control, since smaller pages mean cheaper per-edit rewrites.

---

## Navigation & connectivity

### Deep connectivity between artifacts
From anywhere in the app, it should be easy to navigate to related material. Artifacts form a web, not a tree. Examples:
- From a **call transcript** → associated wiki entries updated by that call, background tasks kicked off, podcasts/research produced.
- From a **wiki page** → calls that touched it, tasks it seeded, sources cited.
- From a **research output** → the call that requested it, source pages it drew on, the wiki pages it updated.
- From a **notification** → the artifact it references, the call or pattern that triggered it.

This is the UX expression of the underlying graph: every artifact knows what it's connected to, and the UI always offers the jump.

---

## Content delivery

### Adaptive delivery channels
Content generation/surfacing adapts to the user's preferences. For any given generated artifact (daily recap, research summary, podcast), the user can choose a delivery channel:
- **In-app message** — filed into the notification stream + wiki
- **Short audio clip** — playable in-app or via headphones
- **Email** — delivered to the user's inbox
- **Push summary** — the notification itself carries the content

Delivery preferences can be set globally, per-task-type, or per-schedule. Preferences evolve (adjustable via conversation or settings).

---

## Scheduled & event-driven content

### Scheduled content generation
Recurring, time-based content production configured by the user (or proposed by Muse):
- Daily news updates (tailored to interests)
- Daily/weekly briefs (calendar, tasks, goals)
- Topic monitoring — periodic deep-dives on a subject the user is tracking

### Event-driven content (long-term)
Subscribing to real-world change rather than a fixed schedule. Generate content when something happens:
- RSS subscriptions
- Topic-change detection across the web
- Release/announcement alerts for specific entities the user tracks

This is a longer-term goal — requires infrastructure for ingestion, polling, deduplication, and change detection that's out of scope for MVP.

---

## Knowledge ingestion

### Upload sources to projects
Users can drop external content into a specific project/topic and have Muse ingest it into that project's wiki pages:
- URLs (web articles, videos, etc.)
- Text files (PDFs, markdown, plain text)
- Images (with OCR + vision understanding)
- Audio / voice memos

Ingestion flow mirrors the transcript flow: raw source stored immutably, AI fans out extracted content across relevant wiki pages within the project, source is indexed and cross-referenced.

---

## Cross-cutting considerations

- **Every new feature adds to the activity stream.** If Muse did something, the user sees it.
- **Every new artifact is a graph citizen.** It knows its provenance and its downstream consumers.
- **Every automation has a manual override.** Schedules can be paused/edited, recommendations can be dismissed/snoozed, preferences can be adjusted.
- **Every generated output is filable into the wiki.** Research, podcasts, briefs, and event-driven content all land as pages so the knowledge compounds.
