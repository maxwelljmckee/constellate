// Graphile task: title + 1-paragraph summary for a finished call. Hits Flash,
// updates call_transcripts row. Conservative retry on transient errors.

import { Type } from '@google/genai';
import { callTranscripts, db, eq } from '@audri/shared/db';
import { getGeminiClient } from '@audri/shared/gemini';
import type { Task } from 'graphile-worker';
import { logger } from '../logger.js';

const FLASH_MODEL = 'gemini-2.5-flash';
const MIN_CHARS_FOR_SUMMARY = 80;

export interface GenerateTitleSummaryPayload {
  sessionId: string;
  userFirstName?: string | null;
}

interface TranscriptTurn {
  role: 'user' | 'agent';
  text: string;
}

function buildPrompt(userFirstName: string | null): string {
  const personRule = userFirstName
    ? `When referring to the person Audri spoke with, use their first name ("${userFirstName}") OR first-person plural ("We discussed…", "We talked through…"). Vary between the two so it doesn't feel repetitive. NEVER use "The user" or "the user" or "they" as a generic stand-in.`
    : `When referring to the person Audri spoke with, use first-person plural ("We discussed…", "We talked through…"). NEVER use "The user" or "the user" or "they" as a generic stand-in.`;

  return `You will receive a turn-tagged transcript of a voice conversation between a person and "Audri", their personal assistant. Produce a concise title and one-paragraph summary.

Output ONLY a JSON object matching this shape — no preamble, no explanation, no markdown code fences:
{"title": "...", "summary": "..."}

Rules:
- Title: 4-8 words, no quotes, no trailing punctuation. Capture the gist of the conversation.
- Summary: 1-3 sentences, past tense.
- ${personRule}
- Skip greetings, pleasantries, and meta-conversation.
- If the transcript is too short or content-free, return both fields as empty strings.`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON object in response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

interface TitleSummary {
  title: string;
  summary: string;
}

export const generateTitleSummary: Task = async (payload, helpers) => {
  const p = payload as GenerateTitleSummaryPayload;

  const [row] = await db
    .select({
      id: callTranscripts.id,
      content: callTranscripts.content,
      cancelled: callTranscripts.cancelled,
    })
    .from(callTranscripts)
    .where(eq(callTranscripts.sessionId, p.sessionId))
    .limit(1);

  if (!row) {
    helpers.logger.warn(`title-summary: session ${p.sessionId} not found — skip`);
    return;
  }
  if (row.cancelled) {
    helpers.logger.info(`title-summary: session ${p.sessionId} cancelled — skip`);
    return;
  }

  const transcript = (row.content as TranscriptTurn[]) ?? [];
  const totalChars = transcript.reduce((acc, t) => acc + (t.text?.length ?? 0), 0);
  if (totalChars < MIN_CHARS_FOR_SUMMARY) {
    helpers.logger.info(`title-summary: transcript too short (${totalChars} chars) — skip`);
    return;
  }

  const flat = transcript.map((t) => `[${t.role}] ${t.text}`).join('\n');

  const resp = await getGeminiClient().models.generateContent({
    model: FLASH_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${buildPrompt(p.userFirstName ?? null)}\n\n---\n${flat}` }],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['title', 'summary'],
      },
      temperature: 0.4,
      maxOutputTokens: 300,
    },
  });

  const text = resp.text;
  if (!text) {
    helpers.logger.warn('title-summary: empty response — skip');
    return;
  }

  let parsed: TitleSummary;
  try {
    parsed = extractJson(text) as TitleSummary;
  } catch {
    logger.warn({ text: text.slice(0, 200) }, 'title-summary: JSON parse failed');
    return;
  }

  const title = (parsed.title ?? '').trim();
  const summary = (parsed.summary ?? '').trim();
  if (!title && !summary) {
    helpers.logger.info('title-summary: both empty after gen — skip');
    return;
  }

  await db
    .update(callTranscripts)
    .set({ title: title || null, summary: summary || null })
    .where(eq(callTranscripts.sessionId, p.sessionId));

  logger.info({ sessionId: p.sessionId }, 'title + summary saved (worker)');
};
