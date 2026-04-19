# 2026-04-18 — Realtime Conversational AI Spike

## 1. Dependencies & Config

1. Install `expo-speech-recognition`, `expo-speech`, `@anthropic-ai/sdk`
2. Add `EXPO_PUBLIC_ANTHROPIC_API_KEY` to `.env.local` (Expo's public env prefix)
3. Add iOS permissions to `app.json`:
   - `NSMicrophoneUsageDescription`
   - `NSSpeechRecognitionUsageDescription`
4. Add Android `RECORD_AUDIO` permission to `app.json`
5. Prebuild / pod install to apply native config

## 2. Sentence-Buffered TTS Hook (`src/hooks/useTTS.ts`)

1. Wrap `expo-speech` `Speech.speak()` in a queue — speak one sentence at a time
2. Export `speak(text: string)` — appends to queue, flushes when idle
3. Export `stop()` — clears queue and cancels current speech
4. Internally buffer streamed chunks; flush complete sentences on `.`, `!`, `?` boundaries

## 3. Anthropic Streaming Hook (`src/hooks/useConversation.ts`)

1. Initialize `Anthropic` client with `EXPO_PUBLIC_ANTHROPIC_API_KEY` and `dangerouslyAllowBrowser: true`
2. Maintain `messages` array (conversation history) in state
3. Export `sendMessage(userText: string)` — appends user turn, streams Haiku 4.5 response
4. On each streamed `text_delta`, pass chunk to `useTTS.speak()` for sentence buffering
5. On stream end, append full assistant response to `messages`

## 4. STT Hook (`src/hooks/useSTT.ts`)

1. Wrap `ExpoSpeechRecognitionModule` — request permissions on mount
2. Export `start()` / `stop()` and reactive `transcript: string`, `isListening: boolean`
3. Use `onend` event to detect when user finishes speaking → auto-submit transcript to `useConversation.sendMessage()`
4. Clear transcript after submission

## 5. Voice Mode Screen (`src/screens/VoiceScreen.tsx`)

1. Static "conversation" UI — dark background, centered status orb/circle
2. Status text cycles: `Listening…` → `Thinking…` → `Speaking…` based on hook state
3. Mic button: tap to start/stop listening manually (fallback beyond auto-detect)
4. "End" button in top corner to exit voice mode

## 6. Home Screen & Navigation (`src/screens/HomeScreen.tsx`, `App.tsx`)

1. Simple home screen — app name, subtitle, large **"Go Live"** button
2. Tapping "Go Live" navigates to `VoiceScreen` and immediately starts STT
3. Use React Native's built-in state-based navigation (no router library needed for a spike)
4. Exiting voice mode returns to home and stops all STT/TTS

## 7. Wire-Up & Polish

1. Pass `isListening`, `isSpeaking`, `isThinking` booleans to `VoiceScreen` for status display
2. Ensure STT pauses while TTS is speaking (prevent feedback loop)
3. Verify mic permission flow on both iOS and Android simulators
4. Smoke-test end-to-end: speak → transcript → Haiku stream → TTS output
