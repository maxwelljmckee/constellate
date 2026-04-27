// Single-slot plugin overlay state. Whichever plugin tile was last tapped
// determines the overlay's content. Only one overlay open at a time.
//
// Origin-aware spring (overlay opens from the tile's screen position) is a
// V1+ enhancement; MVP uses a slide-up animation.

import { create } from 'zustand';

export type PluginKind = 'wiki' | 'todos' | 'research' | 'profile';

interface PluginOverlayState {
  open: PluginKind | null;
  show: (kind: PluginKind) => void;
  hide: () => void;
}

export const usePluginOverlay = create<PluginOverlayState>((set) => ({
  open: null,
  show: (kind) => set({ open: kind }),
  hide: () => set({ open: null }),
}));
