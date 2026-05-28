"use client";

import { create } from "zustand";

export type AuthMode = "sync" | "signin";

interface UiState {
  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  authOpen: false,
  authMode: "sync",
  openAuth: (mode = "sync") => set({ authOpen: true, authMode: mode }),
  closeAuth: () => set({ authOpen: false }),
}));
