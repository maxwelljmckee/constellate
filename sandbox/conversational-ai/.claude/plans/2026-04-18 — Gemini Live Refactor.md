# 2026-04-18 — Gemini Live Refactor

## 1. Dependencies

1. Install `react-native-audio-api`
2. Uninstall `expo-speech-recognition` and `@anthropic-ai/sdk`
3. Add `react-native-audio-api` plugin to `app.json`
4. Add `NSMicrophoneUsageDescription` remains (already set); confirm `RECORD_AUDIO` Android permission still present
5. Run `npx expo prebuild --clean` + pod install

## 2. Audio Utilities (`src/utils/audio.ts`)

1. Write `float32ToPcm16(input: Float32Array): Int16Array` — clamp to [-1, 1], scale to Int16 range
2. Write `pcm16ToBase64(pcm: Int16Array): string` — convert buffer to base64 string for WebSocket transmission
3. Write `buildWavHeader(dataByteLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array` — 44-byte RIFF/WAVE header
4. Write `assembleWav(pcm16Chunks: Int16Array[], sampleRate: number): Uint8Array` — concatenate chunks and prepend WAV header

## 3. Gemini Live Hook (`src/hooks/useGeminiLive.ts`)

### 3a. WebSocket connection
1. Define WS URL: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`
2. On `connect()`: open WebSocket, send setup message:
   ```json
   {
     "setup": {
       "model": "models/gemini-2.0-flash-live-preview",
       "generationConfig": { "responseModalities": ["AUDIO"] }
     }
   }
   ```
3. Wait for `setupComplete` message before starting mic
4. On `disconnect()`: stop mic, close WebSocket, reset state

### 3b. Microphone streaming
1. Create `AudioRecorder` from `react-native-audio-api`
2. Call `recorder.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, callback)`
3. In callback: `float32ToPcm16` → `pcm16ToBase64` → send `realtimeInput` message over WebSocket
4. Start recorder after `setupComplete`, stop on `disconnect()`

### 3c. Receiving and playing audio response
1. Parse incoming WebSocket messages
2. On `serverContent.modelTurn.parts[].inlineData` (mimeType `audio/pcm;rate=24000`): base64-decode and accumulate `Int16Array` chunks
3. On `serverContent.turnComplete`: call `playAccumulatedAudio()`
4. `playAccumulatedAudio()`: `assembleWav(chunks, 24000)` → write to `new File(Paths.cache, tts_${Date.now()}.wav)` → `createAudioPlayer({ uri }).play()` → on finish, `player.remove()`, delete file
5. Clear accumulated chunks after playback starts

### 3d. State + interruption
1. Expose `isConnected: boolean`, `isModelSpeaking: boolean`
2. When new `modelTurn` audio arrives while `isModelSpeaking`, stop current player and clear queue (barge-in handled server-side by Gemini VAD)
3. Handle WebSocket `onerror` and `onclose` — set `isConnected = false`, clean up mic and player

## 4. Remove Old Hooks

1. Delete `src/hooks/useSTT.ts`
2. Delete `src/hooks/useConversation.ts`
3. Rewrite `src/hooks/useTTS.ts` → move WAV assembly + expo-audio playback logic here as `playPcmChunks(chunks: Int16Array[], sampleRate: number)`, imported by `useGeminiLive`

## 5. Simplify VoiceScreen (`src/screens/VoiceScreen.tsx`)

1. Replace `useConversation` + `useSTT` + `useTTS` with single `useGeminiLive` call
2. On mount: call `connect()`, on unmount: `disconnect()`
3. Status text: `isConnected ? (isModelSpeaking ? 'Speaking…' : 'Listening…') : 'Connecting…'`
4. Orb: active when `isConnected`, pulsing when `isModelSpeaking`
5. Remove mic button — Gemini VAD owns turn-taking, no manual trigger needed
6. Keep "End" button → calls `disconnect()` then `onExit()`

## 6. Clean Up

1. Remove `EXPO_PUBLIC_ANTHROPIC_API_KEY` from `.env.local`
2. Remove `EXPO_PUBLIC_ELEVENLABS_API_KEY` from `.env.local`
3. Verify `EXPO_PUBLIC_GEMINI_API_KEY` is present
4. Run `npx tsc --noEmit` — confirm clean
5. Smoke test: tap Go Live → speak → hear Gemini respond → speak again mid-response (barge-in)
