# Build plan — MVP

Execution roadmap for getting from spec to running app. Each slice is a runnable end-to-end demo; we don't move to the next slice until the current one is genuinely working (not just compiled).

This is a sequencing tool, not a spec. Implementation details get figured out at code time. The point: avoid getting tangled by knowing what the next demoable thing is at every step.

**Legend**

- ✅ — done
- ✴️ — partial / in progress (e.g. account created but not yet wired into env)
- ⏺️ — open / not started
- ⛔ — blocked on something external (dependency noted inline)

---

## Pre-flight (before slice 0)

External accounts + access provisioned. Every item is "needs to exist before we can write code that depends on it":

- ✅ Supabase project — `Audri (dev)`, single instance for MVP. Dev/prod split deferred (see `backlog.md` → Environments)
- ✅ Gemini API key (Studio account; access to Live + Pro + Flash + explicit caching) — in `.env.local`
- ✴️ EAS account — created + project stubbed; not yet wired into env
- ✴️ Render account — created; services not yet provisioned (planned for slice 0b)
- ✴️ Sentry account — created; client + server projects + DSNs pending
- ✴️ PostHog account — stubbed; API key + feature-flag setup pending
- ⛔ Apple Developer Program enrollment — Individual Enrollment blocked on Apple support reply. Workaround: focus on local development; deployments wait on resolution
- ✴️ Google Cloud project + OAuth client — login created + project started; OAuth client not yet configured
- ✅ Domain name — `talktoaudri.com` registered

Roughly half-day of admin work, mostly waiting on confirmation emails.

---

## Slice 0 — Workspace bootstrap

**Goal:** every package has a hello-world that runs.

**2026-04-26 sequencing change** (per `judgement-calls.md`): split into 0a (server+worker locally) → 0b (Render deploy) → 0c (mobile bootstrap). RxDB validation spike deferred to 0c.

### 0a — Server + worker locally (✅ done 2026-04-26)
- ✅ pnpm workspace at repo root
- ✅ `apps/server/` — NestJS init; minimal `GET /health` returning 200; pino structured logging; Sentry stub
- ✅ `apps/worker/` — plain Node + graphile-worker connected to **cloud Supabase** (no local CLI); logs a heartbeat every 30s; Sentry stub
- ✅ `packages/shared/` — TypeScript package compiled to `dist/`; consumed by both apps
- ✅ Biome + base tsconfig at root, extended per-app
- ✅ Drizzle initialized against cloud Postgres
- ✅ **First migration: full data model in one shot.** All 17 MVP tables, 10 enums, ~30 FKs (incl. cross-schema to `auth.users`), ~30 indexes (btree, GIN with `jsonb_path_ops`, tsvector, partial WHERE), 4 triggers, RLS enabled on all (no policies until slice 9). Schema design doc at `specs/db-schema-plan.md`.

### 0b — Render deploy (✅ done 2026-04-26)
- ✅ `render.yaml` Blueprint; both services on `starter` plan ($14/mo total), `oregon` region
- ✅ `audri-server` live at `https://audri-server.onrender.com` — `/health` returns 200
- ✅ `audri-worker` live, processing heartbeats against cloud DB
- ✅ Build pipeline: `pnpm install --frozen-lockfile && pnpm --filter @audri/{name}... build` then `pnpm --filter @audri/{name} start`
- ✅ Auto-deploy on push to default branch
- ✅ `EXPO_PUBLIC_API_URL` set in `.env.local` to live Render URL

### 0c — Mobile bootstrap (✅ done 2026-04-26)
- ✅ `apps/mobile/` — Expo SDK 54 + Expo Router with `(auth)` + `(app)` route groups; hello-world home placeholder rendering Azure theme
- ✅ Metro configured for pnpm monorepo (watchFolders + nodeModulesPaths + disableHierarchicalLookup) + NativeWind v5 wrapper
- ✅ NativeWind v5 preview + Tailwind v4 + PostCSS pipeline live; Azure theme tokens defined in `global.css`
- ✅ Cross-package `@audri/shared` import working from mobile
- ✅ `apps/mobile/.env.local` for `EXPO_PUBLIC_*` (Expo reads from project dir, not monorepo root)
- ✅ **RxDB + Supabase replication validation spike** — RxDB 14.x + rxdb-supabase 1.0.4 + memory storage. Construct against cloud schema succeeds. Real wiring (expo-sqlite + RLS-aware auth + full collection set) lands in slice 5.
- ✅ Verified on iOS via Expo Go

**Demo:** server `/health` 200 from public Render URL. Worker logs heartbeat in Render's log viewer. Cloud Postgres has all MVP tables. Mobile boots to home placeholder showing app name + shared-package name + API URL + RxDB spike result.

**Estimated:** 3–5 days. Actual: entire Slice 0 in 1 day.

---

## Slice 1 — Auth → Home reachable (✅ done 2026-04-27)

**Goal:** complete signup flow lands the user on a home screen with their seeded data visible.

- ✅ Mobile: **Google sign-in via Supabase Auth** (PKCE flow, `signInWithOAuth` + `WebBrowser.openAuthSessionAsync` + `exchangeCodeForSession`). Apple sign-in deferred — P0 in `backlog.md`.
- ✅ Server: Supabase **Database Webhook** on `auth.users` INSERT → `POST /webhooks/supabase-signup` (auth via `Authorization` header secret) → SeedService transaction → 1 agent + 20 wiki_pages (5 agent + 10 profile + 5 todo) + 1 user_settings. Idempotent on user_id. Deferrable circular FK between `agents.root_page_id` ↔ `wiki_pages(agent root).agent_id` worked as designed.
- ✅ Mobile: `useSession` hook + reactive route gates in `(auth)/_layout` and `(app)/_layout`.
- ✅ Mobile: Home screen shell — wordmark, time-aware greeting + first name from Supabase Auth `user_metadata.given_name`, sign-out tile (avatar stub), 2x2 plugin grid placeholder, phone FAB. SafeAreaProvider + edge-to-edge bg.
- ✅ Server: `GET /me` (auth-guarded by `SupabaseAuthGuard`, returns `{ user, agents (sanitized — no persona_prompt per Invariant 3), userSettings }`).

**Demo (validated live):** sign in with Google → user row created in `auth.users` → webhook fires → seed runs → mobile lands on home with "Good morning, Max." + "1 agent · 1 plugin".

**Estimated:** 4–6 days. **Actual:** ~4 hours of code + ~2 hours of OAuth-config debugging.

**Punted from this slice (logged elsewhere):**
- iOS `ASWebAuthenticationSession` system dialog ("Audri wants to use ...supabase.co to Sign In") — UX-confusing but unavoidable without paid Supabase Pro custom auth domain or native Google Sign-In SDK. Tracked in `backlog.md` Security section.
- Apple sign-in (Apple Developer enrollment blocked).

---

## Slice 2 — Call screen skeleton (stubbed Gemini) (✅ done 2026-04-27)

**Goal:** the call experience VISUALLY works end-to-end. Audio is fake.

- ✅ Mobile: `(app)/call.tsx` — orb + M:SS elapsed timer + hang-up + Connecting state
- ✅ Mobile: home phone FAB → routes to /call → returns home on hang-up
- ✅ Mobile: simplified orb component (single circle, Reanimated `interpolateColor` cross-fade between blue/indigo on speaker change). Initial design (breathing + glow + amplitude scale) was visually rough; reverted to sandbox-style single-circle. Re-attach amplitude reaction in slice 3 if needed.
- ✅ Mobile: `<CallEndedDropped>` component reachable via 4-tap debug toggle on the orb
- ✅ Mobile: Zustand `useCallStore` at module scope (status, currentSpeaker, amplitude, transition actions)
- ✅ Mobile: hang-up triggers ending → reset → router.back

**Demo (validated live):** tap phone on home → call screen mounts → "Connecting…" → M:SS timer + orb cross-fades on fake speaker cycle → hang-up returns home.

**Estimated:** 3–4 days. **Actual:** ~1 hour code + ~30min orb iteration.

---

## Slice 3 — Real Gemini Live wiring (✅ done 2026-04-27)

**Goal:** actual conversation with Audri. Transcripts persist. No ingestion yet.

- ✅ Server: `POST /calls/start` mints **ephemeral Gemini Live token** via `ai.authTokens.create({ liveConnectConstraints: ... })`. Persona + voice + system instruction + server-side VAD config locked into token; client never sees raw API key OR persona text. Returns `{ sessionId, ephemeralToken, model, voice }`.
- ✅ Mobile: client decodes ephemeral token → `ai.live.connect({ model })` → direct WebSocket to Google
- ✅ Mobile: real mic audio (PCM16 16kHz mono) streams through; **peak amplitude** drives orb glow + barge-in trigger (peak proved 5x more discriminating than RMS)
- ✅ Mobile: turn-tagged transcript via `inputAudioTranscription` + `outputAudioTranscription` Gemini config
- ✅ Server: `POST /calls/:sessionId/end` updates the pre-existing `call_transcripts` row. Idempotent — re-fire returns `already_ended`. Pre-creation at /start gives transcript a row to attach to even if /end fails.
- ✅ **Barge-in working.** Mic-gate during playback prevents echo loop; peak-amp threshold (0.06, sustained 100ms) detects user voice through both phone speaker echo AND ambient noise (verified live with loud music in background — only voice triggers).
- ✅ Server: stub persona prompt in `seed.constants.ts` (friendly, warm, brief). Real persona text in Slice 6.

**Module split (apps/mobile/lib/gemini/):** `session.ts` (transport), `audio-input.ts` (mic + gate), `audio-output.ts` (PCM playback queue + per-buffer onEnded for finality), `transcript.ts` (turn builder), `useCall.ts` (orchestrator), `audio-utils.ts` (PCM helpers + peakAmplitude).

**Demo (validated live):** sign in → tap phone → conversation with Audri → mid-utterance interruption works at normal speaking volume → hang up → call_transcripts row has full turn-tagged transcript.

**Estimated:** 5–7 days. **Actual:** ~3 hours code + ~1 hour barge-in tuning. Barge-in was the wildcard but converged once we switched RMS → peak amplitude.

---

## Slice 4 — Ingestion pipeline

**Goal:** transcripts auto-fan-out into wiki content. Validate by SQL queries.

- ⏺️ Worker: Graphile Worker properly configured (queues, concurrency, recurring scanner job). Per-user `queue_name` for ingestion (`ingestion-${user_id}`).
- ⏺️ Worker: ingestion job handler — reads transcript by id, runs Flash candidate retrieval (real Gemini call against the locked spec), runs Pro fan-out (real Gemini call against the locked spec), backend transactional commit (sectioned writes + source junctions + wiki_log).
- ⏺️ Worker: Flash + Pro prompts drafted as actual system prompt strings against the locked decision rules in `specs/flash-retrieval-prompt.md` + `specs/fan-out-prompt.md`. Loaded from prompt files at startup.
- ⏺️ Server: `POST /calls/:session_id/end` enqueues ingestion job atomically with transcript commit (single transaction).
- ⏺️ Worker: agent-scope ingestion pass runs in parallel with user-scope (per `specs/agent-scope-ingestion.md`). Single Flash call; observation writes to active agent's subtree.
- ⏺️ Worker: prompts cached via Gemini explicit cache; cache lifecycle managed by a recurring Graphile job (refreshes TTL every N minutes).

**Demo:** real conversation about Sarah and Consensus → check DB → person page for Sarah created with sections; project page for Consensus created; sources cited in `wiki_section_transcripts`. Agent-scope page has Assistant's observations.

**Estimated:** 7–10 days. This is the heaviest slice; the ingestion pipeline is the central machine.

---

## Slice 5 — RxDB sync + Wiki plugin surface

**Goal:** mobile reactively reflects server-side wiki changes. First "real" plugin overlay UX.

- ⏺️ Mobile: RxDB setup with Supabase replication plugin; collections defined for MVP-relevant tables (`wiki_pages`, `wiki_sections`, `agents` (sanitized — no `persona_prompt`), `agent_tasks`, `research_outputs`, `tags`, `wiki_page_tags`, `user_settings`, `call_transcripts`, `wiki_log`).
- ⏺️ Mobile: RxDB hydration — paginated by `updated_at DESC`; recently-touched first
- ⏺️ Mobile: `<PluginOverlay>` + `usePluginOverlay()` cleanly rebuilt (origin-aware spring; not the sandbox version)
- ⏺️ Mobile: Wiki plugin tile → overlay screen browsing user's wiki pages from RxDB
  - Virtual folders by `type`
  - Tap a page → page detail with sections rendered as markdown
  - Edit (basic markdown editor — TipTap or similar choice locked at code time)
- ⏺️ Mobile: realtime updates from server fan-out flow into the UI live (have a call → wiki updates appear in the open Wiki overlay without refresh)

**Demo:** finish a call → tap Wiki tile on home → see the new pages from the call. Edit one in mobile → it persists to Postgres.

**Estimated:** 5–7 days. RxDB + RLS + Supabase replication is the wildcard.

---

## Slice 6 — Onboarding end-to-end

**Goal:** new user signup flows naturally through onboarding into a populated profile.

- ⏺️ Mobile: `(app)/onboarding.tsx` screen — minimal "Tap to start" launcher
- ⏺️ Server: `POST /calls/start` accepts `call_type='onboarding'` → composes onboarding scaffolding (separate prompt cache); minimal preload (profile stubs); no recent-activity layer
- ⏺️ Server: full onboarding system prompt drafted against `specs/onboarding.md` decision rules — opener question, askable/emergent split, capability advertisement discipline, "good enough" heuristic baked in.
- ⏺️ Mobile: post-Slice-1 routing — first-time user lands on Onboarding screen instead of Home (one-shot redirect after signup completes; subsequent loads go to Home regardless of `onboarding_complete`)
- ⏺️ Server: end-of-call handler — when `call_type='onboarding'` AND user signaled completion, set `user_settings.onboarding_complete=true`. Subsequent generic calls check the flag at session start; if false, scaffolding nudges "want to pick up?"
- ⏺️ Mobile: post-onboarding redirect to Home with profile-content visible (via RxDB realtime updates from Slice 5)

**Demo:** new user signs up → lands on onboarding → completes ~10-min interview → profile pages populate live → lands on home.

**Estimated:** 4–6 days. Most of the work is prompt-tuning + the user-experience polish.

---

## Slice 7 — Research plugin end-to-end

**Goal:** first agent_task kind shipped. User can request research and get a result.

- ⏺️ Worker: plugin registry module (`pluginRegistry` server-only + `pluginRegistryLite` derived for client) with `research` entry per `specs/research-task-prompt.md`
- ⏺️ Worker: research handler implementing the `(ctx) => Promise<{output, sources, reingestIntoWiki}>` contract
- ⏺️ Worker: research prompt text drafted from the locked spec
- ⏺️ Worker: `agent_tasks` queue setup (separate from `ingestion-${user_id}` queue); CRON scanner for delayed/retry pickup
- ⏺️ Worker: `research_outputs` write helper + per-kind source junction writes (`research_output_sources`, `research_output_ancestors`)
- ⏺️ Worker: usage_events emission per LLM call
- ⏺️ Server: ingestion's commitment-extraction creates agent_tasks rows when Pro detects research-intent commitments (already part of `specs/fan-out-prompt.md` §4.1)
- ⏺️ Mobile: Research plugin tile → overlay screen showing list of `research_outputs` for this user (synced via RxDB)
- ⏺️ Mobile: research detail view — query, summary, findings, citations
- ⏺️ Mobile: spawn-research affordance from the Research overlay (calls a server endpoint that creates an agent_tasks row directly, bypassing ingestion — for explicit user requests outside of a call)

**Demo:** in a call, "can you research Italian restaurants near me?" → after call, research arrives in Research module 1–3 minutes later → tap to read.

**Estimated:** 6–8 days. Most work is prompt drafting + handler implementation + the spawn-from-call orchestration.

---

## Slice 8 — Todos + Profile plugin surfaces

**Goal:** all 4 MVP plugin tiles functional.

- ⏺️ Mobile: Todos plugin overlay
  - Projection over `wiki_pages WHERE type='todo'` joined with `agent_tasks`
  - Status tabs (todo / in-progress / done / archived)
  - Check-off → reparent to `done` bucket (write to `wiki_pages.parent_page_id`)
  - Show agent-task status for agent-assigned todos (running / succeeded / failed)
  - Sub-tasks via hierarchy
  - Manual create-todo affordance
- ⏺️ Mobile: Profile plugin overlay
  - Browse profile root + 9 children
  - Render section content as markdown
  - Edit affordance on user-scope pages
- ⏺️ Mobile: greeting subtext updated to reflect actual user activity if appropriate (or omitted, per design decision)

**Demo:** finish a call with commitments → see todos appear in Todos overlay → check one off, persists. View profile pages and edit.

**Estimated:** 4–6 days. Todos UX has surprising complexity (status transitions, agent-task display); Profile is simpler.

---

## Slice 9 — Pre-launch hardening

**Goal:** the thing is shippable.

- ⏺️ Server + worker: real RLS policies per `todos.md` §3 RLS draft
- ⏺️ Server: cross-agent leakage tests passing (per `todos.md` §3)
- ⏺️ Server: rate limiting per user (call starts, task triggers, signup attempts)
- ⏺️ Server: account-deletion flow (basic — tombstone user_id; full hard-delete + export V1+)
- ⏺️ Sentry integration validated (real errors firing on both client and server)
- ⏺️ PostHog feature flags wired (at minimum, a kill-switch flag for ingestion + a kill-switch for research-task spawning)
- ⏺️ EAS Build configured; first TestFlight build pushed
- ⏺️ Render deploys for `apps/server` + `apps/worker` working from CI; staging environment alive
- ⏺️ CI pipeline (GitHub Actions): typecheck + lint + test + DB-migration check
- ⏺️ Cost monitoring — ad-hoc SQL queries against `usage_events` confirm per-user spend looks reasonable
- ⏺️ PII redaction at pino transport layer validated (sample logs reviewed; no obvious leaks)

**Demo:** install via TestFlight → end-to-end onboarding → first call → research arrives → wiki populates over multiple calls → tier-cap interactions present and accounted for. Ready for closed-beta users.

**Estimated:** 7–10 days. Mostly operational + hardening; no new product surface area.

---

## Total estimate

50–75 days of focused work. Roughly 2–3 months at sustainable pace.

This assumes solo (the user) coding with Claude assist + no rabbit holes. Real-world numbers will fluctuate. Anchors to renegotiate against rather than commitments.

---

## What we DON'T build at MVP (explicitly punted to V1+)

Cross-referenced in `backlog.md`:

- Connectors (Gmail / Calendar / Contacts) — no MVP plugin needs them
- Push notifications
- Custom agents beyond the default Assistant
- Skills (context-aware capability suggestions)
- Trial artifacts during onboarding
- Theme switcher + light-mode toggle (tokens defined, switcher V1+)
- Avatar account/settings menu (stub at MVP)
- Mic-mute UI on call screen
- In-call transcript feed
- Podcast / Email / Calendar / Brief plugins (artifact tables exist but plugins don't ship)
- Re-ingestion of artifacts back into wiki
- Embedding pipeline (pgvector)
- Distributed tracing
- Aggregate failure-rate alerts
- Pricing model + tier gating enforcement
- Activity stream UI polish (basic version exists; rich V1+)
- Most KG-maintenance background flows (auto-split, entity merge, broken-wikilink repair)
- Graph view UI

---

## How to use this plan

1. Don't move to slice N+1 until slice N has a working demo. The demo is the truth.
2. If a slice eats more than 1.5x its estimate, stop and reflect: is there a hidden complexity we should descope or punt?
3. Each slice's first commit on a feature branch should be a runnable skeleton (even if stubbed) before depth fills in. Iterate breadth-first within a slice to keep demos shippable.
4. When a slice surfaces a decision not covered in spec, log it in `judgement-calls.md` with the rationale.
5. The pre-flight account list is a one-pass gate — don't try to start slice 0 without those done; you'll get blocked mid-slice.
