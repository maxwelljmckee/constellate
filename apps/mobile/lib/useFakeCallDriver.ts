import { useEffect } from 'react';
import { useCallStore } from './useCallStore';

// Slice 2 stub: simulates audio amplitude + speaker cycling so the orb has
// something to react to. Replaced in slice 3 by real Gemini Live audio levels
// and turn-detection.
//
// Amplitude: smoothly fluctuating value in [0, 1] driven by sine + jitter.
// Speaker: cycles user/agent every ~3.5s.
export function useFakeCallDriver(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const setAmplitude = useCallStore.getState().setAmplitude;
    const setSpeaker = useCallStore.getState().setSpeaker;

    let t = 0;
    const ampInterval = setInterval(() => {
      t += 0.16;
      // Slow sine + a small noise term, biased upward so silence is rare-ish.
      const base = 0.35 + 0.4 * Math.abs(Math.sin(t * 1.3));
      const noise = (Math.random() - 0.5) * 0.15;
      setAmplitude(Math.min(1, Math.max(0, base + noise)));
    }, 160);

    // Initial speaker after a beat.
    setSpeaker('agent');
    const speakerInterval = setInterval(() => {
      const cur = useCallStore.getState().currentSpeaker;
      setSpeaker(cur === 'agent' ? 'user' : 'agent');
    }, 3500);

    return () => {
      clearInterval(ampInterval);
      clearInterval(speakerInterval);
      setAmplitude(0);
      setSpeaker(null);
    };
  }, [active]);
}
