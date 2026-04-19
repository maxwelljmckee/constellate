# Voice Pipeline Debugging Report — Gemini Live

**Date:** 2026-04-19
**Scope:** `src/hooks/useGeminiLive.ts` + `src/screens/VoiceScreen.tsx`

## Summary

Three related issues in the Gemini Live WebSocket integration were investigated. One root cause — misinterpreting per-buffer `onEnded` events from `react-native-audio-api`'s `AudioBufferQueueSourceNode` as end-of-source events — was responsible for both the multi-response bug and the choppy/overlapping playback. A separate tradeoff around barge-in was identified as a consequence of the fix.

---

## 1. Multi-response / echo feedback loop

**Symptom:** After a single user utterance, Gemini would generate multiple overlapping audio responses. Logs showed dozens of `[Playback] New queue source (turn start)` events and continuous `[Mic] X chunks sent` counters with no corresponding `chunks gated during playback` messages — meaning the mic gate was not actually gating.

**Root cause:** `AudioBufferQueueSourceNode.onEnded` fires **once per enqueued buffer**, not once when the source finishes. Confirmed in:
- RN audio-api docs (event is documented with an `isLast` boolean payload)
- `common/cpp/audioapi/core/sources/AudioBufferQueueSourceNode.cpp:196` — "ended" is emitted inside the buffer-pop branch of `processWithoutInterpolation`

The prior handler treated every per-buffer event as end-of-playback:
- Cleared `isModelSpeakingRef` → mic gate opened during playback gaps
- Nulled `queueSourceRef` → next audio chunk created a brand-new source

Feedback loop:
1. Gemini emits audio chunk → client plays it → buffer ends → `isModelSpeakingRef = false`
2. Mic gate opens for ~ms until next chunk arrives
3. Mic streams the speaker output (iOS `voiceChat` AEC ≠ perfect) back to Gemini
4. Gemini VAD detects "new speech" → starts a parallel response
5. Multiple `BufferQueueSource` nodes now connect to `ctx.destination` simultaneously → overlapping audio tails

**Fix (`useGeminiLive.ts`):**
- Added `pendingBuffersRef` counter (increments on `enqueueBuffer`, decrements in `onEnded`).
- Added `turnEndingRef` flag set only by `turnComplete`.
- Single queue source held for the entire turn; `onEnded` no longer touches mic-gate state.
- New `finalizeTurn()` helper tears down the source only when `turnEndingRef && pendingBuffersRef === 0`.
- Removed the eager `source.stop()` on `turnComplete` — it was cutting off still-buffered audio. Source now drains naturally.
- `interrupted` and `disconnect` still hard-stop via `stopCurrentPlayback()`, which also resets both new refs.

**Verification:** Post-fix logs show exactly one `New queue source (turn start)` per turn, no `Stale onEnded ignored` spam, and the multi-response behavior is gone.

---

## 2. Playback latency / choppiness

**Symptom:** Same log pattern as above — continuous per-chunk source creation.

**Root cause:** Same as #1. Creating a new `BufferQueueSource` per chunk meant each chunk played in isolation, with brief gaps at source transitions and potential tail-overlap between sources sharing the destination node. This manifested as choppy, slightly-slurred audio rather than a clean continuous stream.

**Fix:** Same single-source-per-turn change above. Audio is now contiguous within a turn.

**Not measured:** end-to-end latency (user speech end → model audio start). That's governed by `silenceDurationMs: 1500` in the VAD config plus network RTT plus model inference; out of scope for this session's debugging.

---

## 3. Barge-in regression

**Symptom:** After the multi-response fix, user can no longer interrupt the model mid-sentence.

**Root cause:** The fix keeps `isModelSpeakingRef` true for the entire model turn, which fully gates the mic during playback. With no mic audio reaching Gemini, its server-side VAD cannot detect a user barge-in and therefore never emits `interrupted`.

**Why the old code "supported" barge-in:** It didn't, really. The gate was flipping open between buffers — the same bug that caused the echo feedback loop. Any "barge-in" that worked was likely the model re-triggering on its own echo, not genuine user interruption.

**Status:** Accepted tradeoff for now. Proper barge-in requires keeping the mic open during playback without the model hearing itself — see recommendations below.

---

## Recommendations for future work

1. **Client-side VAD / amplitude gate (pragmatic barge-in).** Instead of fully gating the mic during playback, forward mic chunks only when input amplitude or RMS energy exceeds a threshold well above the residual echo floor. Cheap, widely used in realtime voice apps, restores barge-in without reintroducing the echo loop.
2. **Playback ducking during mic activity.** Lowering speaker output while mic energy is above threshold gives iOS AEC more headroom and further reduces echo bleed.
3. **Measure actual echo leakage.** Before investing in (1)/(2), confirm how much speaker output is actually leaking through `voiceChat`-mode AEC. May be route-dependent (built-in speaker vs. AirPods vs. external).
4. **Revisit `silenceDurationMs`.** 1500ms end-of-speech silence is conservative and adds perceived latency. Worth experimenting with 800–1000ms once barge-in lands, since shorter silence windows increase false-positive turn ends without barge-in to correct them.

---

## Files changed

- `src/hooks/useGeminiLive.ts` — single-source-per-turn refactor, drain-on-turnComplete semantics.
- `src/screens/VoiceScreen.tsx` — removed duplicate `disconnect()` (unmount cleanup already handles it).
