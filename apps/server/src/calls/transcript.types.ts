// Shape of one turn in a call transcript, mirrored from
// apps/mobile/lib/gemini/transcript.ts. Defined here so server doesn't
// depend on mobile.
export interface TranscriptTurn {
  id: string;
  role: 'user' | 'agent';
  text: string;
  t: number;
}
