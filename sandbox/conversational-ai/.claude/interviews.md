## 2026-04-18 — Gemini Live Refactor

**What we're building:** Full replacement of the STT→LLM→TTS pipeline with a single Gemini Live audio-to-audio WebSocket connection, using `react-native-audio-api` for raw mic streaming and `expo-audio` for PCM playback.

**Problem being solved:** The three-service pipeline (expo-speech-recognition + Anthropic + ElevenLabs) required complex state coordination (listening/thinking/speaking), manual silence detection, barge-in hacks, and audio session conflicts. Gemini Live handles VAD and turn-taking server-side, collapsing the whole thing into one hook.

**Scope:**
- In: `react-native-audio-api` mic streaming, Gemini Live WebSocket, WAV assembly + `expo-audio` playback, simplified VoiceScreen
- Out: chat transcript UI, animations, word-level streaming playback (full-turn playback only for now), Android testing (iOS first)

**Migration context:** Migration of the existing spike — replaces `useSTT`, `useConversation`, `useTTS` with a single `useGeminiLive` hook.

**Tech decisions:**
- `react-native-audio-api` (Software Mansion) for mic → PCM16 @ 16kHz streaming
- Gemini Live WebSocket: `gemini-2.0-flash-live-preview`, responseModality = AUDIO
- `EXPO_PUBLIC_GEMINI_API_KEY` already in `.env.local`
- Float32 → Int16 conversion in JS before base64-encoding for WebSocket
- Full-turn WAV assembly on `turnComplete` signal, played via `expo-audio`
- Barge-in handled server-side by Gemini VAD — no client state machine needed

**Open questions / risks:**
- `react-native-audio-api` buffer format needs verification (Float32Array assumed — confirm at runtime)
- Gemini Live WebSocket protocol message shape should be verified against live API before assuming field names
- Playback latency of full-turn WAV assembly vs streaming PCM — may need chunked playback if turns are long

**Next steps:**
- Install `react-native-audio-api`, uninstall `expo-speech-recognition` + `@anthropic-ai/sdk`, prebuild
- Write audio utilities (float32→pcm16, WAV header assembly)
- Build `useGeminiLive` hook
- Simplify VoiceScreen

**Plan:** [View implementation plan](.claude/plans/2026-04-18 — Gemini Live Refactor.md)

---

## 2026-04-18 — Realtime Conversational AI Spike

**What we're building:** A voice-first conversational AI interface in Expo — tap "Go Live", speak freely, get Haiku 4.5 responses spoken back in real time.

**Problem being solved:** Spike to validate the STT → LLM → TTS pipeline end-to-end as a foundation for Constellate's voice interaction layer.

**Scope:**
- In: STT via `expo-speech-recognition`, streaming Haiku 4.5 via Anthropic SDK, TTS via `expo-speech` with sentence buffering, static voice mode UI, iOS + Android
- Out: chat transcript UI, animations, auth, persistence, error recovery

**Migration context:** New feature — greenfield spike on a bare Expo app.

**Tech decisions:**
- `expo-speech-recognition` for STT (both platforms)
- `@anthropic-ai/sdk` streaming with `claude-haiku-4-5` model
- `expo-speech` for TTS, sentence-buffered (flush on `.`, `!`, `?`)
- STT pauses while TTS is speaking to prevent feedback loop
- State-based navigation (no router library) — spike simplicity
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` in `.env.local` for client-side API access

**Open questions / risks:**
- `expo-speech-recognition` silence detection reliability — may need to tune or add a manual stop button (included as fallback)
- Haiku streaming over mobile network latency — sentence buffering should mask this
- `dangerouslyAllowBrowser: true` on Anthropic client is fine for a spike; not for production

**Next steps:**
- Install deps and configure native permissions
- Build `useTTS` → `useConversation` → `useSTT` hooks in that order
- Wire into `VoiceScreen` + `HomeScreen`
- Smoke-test on iOS and Android simulators

**Plan:** [View implementation plan](.claude/plans/2026-04-18 — Realtime Conversational AI Spike.md)

---
