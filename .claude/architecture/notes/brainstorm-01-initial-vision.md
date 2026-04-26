# Audri – Initial Brainstorm
_April 17, 2026_

## The Core Idea

Audri is a voice-first personal knowledge OS. It acts as the glue between apps like Obsidian, NotebookLM, and best-in-class voice AI — taking the best of each and combining them into a single end-to-end workflow:

**Voice in → knowledge captured → content generated autonomously → ready to consume when you return**

The guiding principle: zero friction. By the time you come back to something you were curious about, the work of gathering, synthesizing, and producing content has already been done for you.

---

## The Problem It Solves

When you're reading or listening and come across something worth exploring — a person, idea, or concept — the current workflow is:
1. Make a note
2. Later, go find resources yourself
3. Decide what to read/watch/listen to
4. Consume it
5. Manually make connections back to your existing knowledge

Audri collapses steps 2–5 into a background process. You just make the note.

---

## Input: How You Talk to Audri

- **Not always-on listening** — instead, a Siri / Google Assistant integration that initiates a "call" with your AI
- Hands-free accessible without requiring physical device interaction
- Natural language — no special syntax or tags required
- Example: "Remind me to learn more about David Hume" → triggers a background research + content generation workflow

---

## Output: The Plugin Home Screen

The app's UX is modeled on a familiar home screen grid of icons — but instead of apps, they are **Plugins**.

Two types:
- **Core Plugins** — data lives in Audri (e.g. Podcasts, Knowledge Graph)
- **3rd Party Plugins** — Audri interfaces with external apps via public API or MCP (e.g. Gmail, Obsidian, Calendar)

### Podcasts Core Plugin (primary MVP focus)
On creation, user specifies:
- **Subject** — topic, person, book, or body of works
- **Depth** — Overview / Average / Deep Dive (informs how approachable vs. detailed the content is)
- **Volume** — single episode, limited series, or recurring series

Additional options:
- **Scheduled channels** — set up recurring podcast updates on a topic (daily, weekly, monthly, or triggered by a real-world event e.g. Fed jobs report release)

Feed view:
- Chronological list of generated content
- Unread badges on new episodes

### Knowledge Graph Core Plugin
- Visualizes the user's personal web of knowledge and experience
- Nodes = concepts, people, topics, books, interests
- Edges = relationships and connections between them
- Grows autonomously over time as the user interacts with the app
- Serves as a visible record of how the product improves with use — reinforces user investment
- Powers personalization: e.g. skip basics on Enlightenment philosophy because the graph shows prior depth there

---

## The Personal Knowledge Graph

The graph is the connective tissue of the whole system. It's what makes generated content feel personal rather than generic.

### What it stores
- User interests, occupation, hobbies, geography, life story
- Topics explored and depth of knowledge on each
- Connections between concepts the user has encountered
- Content consumed and what it linked to

### Onboarding
- Conversational "interview" with the on-device AI
- Casual conversation that collects: occupation, hobbies, interests, geography, life story, etc.
- Result: a sparse/wireframed starter knowledge graph
- This is also the user's first experience of the voice interface — a strong first impression

### Evolution over time
- Fully autonomous — the agent maintains and updates the graph, no manual user decisions
- Passively infers from behavior: content generated, notes made, topics explored
- No Obsidian vault ingestion at MVP (Obsidian not widely used enough to prioritize)

---

## Architecture

### Philosophy
- **Local-first** — on-device for privacy and cost
- **Privacy-focused** — raw notes stay on device; only processed/abstracted data leaves
- **Cost-conscious** — maximize on-device work to minimize expensive cloud inference calls

### On-Device (Mobile)
- Lightweight orchestrator LLM: **Gemma 4** (Apple Intelligence is not a programmable inference API — not viable as an orchestrator)
- Receives natural language input
- Classifies intent and routes to the appropriate workflow/skill via a custom lightweight agent loop (not LangChain — too heavy for on-device, wrong environment)
- Does NOT do heavy research or content generation
- **Note:** Gemma 4 on React Native needs an early proof-of-concept spike — the RN on-device inference ecosystem (react-native-executorch) is still maturing and real-world performance on mid-range devices is unverified

### Server-Side
- Handles all heavy background tasks: research, synthesis, summarization, content generation, audio
- Powered by Anthropic (Claude Opus / Sonnet)

### Data Flow
1. User speaks → on-device model classifies intent
2. On-device model dispatches task to server
3. Server agent researches topic, synthesizes content, generates audio
4. Result stored in Supabase, synced back to device
5. Content appears in the relevant plugin feed with unread badge

---

## Tech Stack

### Server
- **NestJS** — backend framework
- **LangChain** — AI orchestration / agentic workflows (monitor complexity — may simplify to direct Anthropic SDK + custom agent loop if abstractions become a liability)
- **Anthropic** (Claude Opus / Sonnet) — inference for heavy tasks

### Mobile
- **React Native** — cross-platform mobile
- **Custom lightweight agent loop** — on-device orchestration (LangChain JS removed: too heavy, not suited to RN environment)
- **Gemma 4** — local LLM for intent routing (⚠️ spike required to validate feasibility on-device via react-native-executorch)
- **ElevenLabs** — TTS / voice synthesis for audio output (Sesame removed: no public API available)
- **PowerSync** — Supabase ↔ on-device SQLite sync

### Database
- **Supabase** — single source of truth
  - Adjacency tables for knowledge graph (nodes + edges)
  - pgvector for semantic search / embeddings
  - Postgres JSON columns for document storage
  - File storage for generated audio
  - Realtime subscriptions
  - Auth

---

## Open Questions / To Explore Later
- Gemma 4 on-device feasibility spike — test via react-native-executorch before committing (highest priority unknown)
- ElevenLabs voice quality / latency evaluation for conversational feel
- Whether LangChain on server stays or gets replaced with direct Anthropic SDK + custom agent loop
- Real-world event triggers for scheduled podcast channels (RSS? webhooks?)
- Knowledge graph visualization library for React Native
- Plugin architecture design — how third-party plugins are structured and added
