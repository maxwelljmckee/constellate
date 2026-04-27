// Audio sample-format conversion helpers. Pure functions — no RN deps.

export function float32ToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

// PEAK amplitude — absolute max sample magnitude in the window. Better
// discriminator for "is user speaking" than RMS: voice plosives spike to
// 0.3+ while continuous echo (post-AEC) and ambient music typically stay
// under 0.05. Used for both barge-in triggers and orb glow level.
export function peakAmplitude(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i] ?? 0);
    if (a > max) max = a;
  }
  return Math.min(1, max);
}
