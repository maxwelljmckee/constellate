import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface MePayload {
  user: { id: string; email?: string };
  agents: Array<{
    id: string;
    slug: string;
    name: string;
    voice: string;
    rootPageId: string | null;
    isDefault: boolean;
    createdAt: string;
    tombstonedAt: string | null;
  }>;
  userSettings: {
    userId: string;
    enabledPlugins: string[];
    onboardingComplete: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export type MeState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: MePayload };

export function useMe(accessToken: string | null): MeState {
  const [state, setState] = useState<MeState>({ status: 'loading' });

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setState({ status: 'error', error: `HTTP ${r.status}` });
          return;
        }
        const data = (await r.json()) as MePayload;
        setState({ status: 'ready', data });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return state;
}
