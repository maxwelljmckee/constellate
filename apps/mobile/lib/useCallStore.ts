import { create } from 'zustand';

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'ending' | 'dropped';
export type Speaker = 'user' | 'agent' | null;

interface CallStore {
  status: CallStatus;
  currentSpeaker: Speaker;
  amplitude: number; // 0..1, normalized; orb uses this directly

  startCall: () => void;
  markConnected: () => void;
  endCall: () => void; // hang-up flow: ending → idle
  markDropped: () => void; // network drop / forced disconnect
  reset: () => void; // back to idle from any state

  setSpeaker: (s: Speaker) => void;
  setAmplitude: (a: number) => void;
}

// Held at module scope so navigating away from /call doesn't tear down state.
export const useCallStore = create<CallStore>((set) => ({
  status: 'idle',
  currentSpeaker: null,
  amplitude: 0,

  startCall: () => set({ status: 'connecting', currentSpeaker: null, amplitude: 0 }),
  markConnected: () => set({ status: 'connected' }),
  endCall: () => set({ status: 'ending' }),
  markDropped: () => set({ status: 'dropped' }),
  reset: () => set({ status: 'idle', currentSpeaker: null, amplitude: 0 }),

  setSpeaker: (currentSpeaker) => set({ currentSpeaker }),
  setAmplitude: (amplitude) => set({ amplitude }),
}));
