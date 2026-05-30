"use client";

import { create } from "zustand";
import type { YTPlayer } from "@/lib/youtube";

interface JukeboxState {
  /** Which room the user is currently "tuned in" to (audio session). */
  joinedRoomId: string | null;
  /** True after the user has clicked Tune In once (unlocks autoplay audio). */
  tunedIn: boolean;
  /** Latest known YouTube video title for the joined room. */
  title: string;
  /** True while an inline music panel (RoomMusic) is mounted on screen.
   *  When false the floating pill takes over (covers video-mode etc.). */
  inlineMounted: boolean;
  /** Live YouTube player ref (set by GlobalJukebox on ready). Exposed so
   *  click handlers in pill/panel can call play/pause SYNCHRONOUSLY inside
   *  the user gesture — required to satisfy browser autoplay policy. */
  player: YTPlayer | null;

  join: (roomId: string) => void;
  leave: () => void;
  setTunedIn: (v: boolean) => void;
  setTitle: (t: string) => void;
  setInlineMounted: (v: boolean) => void;
  setPlayer: (p: YTPlayer | null) => void;
}

export const useJukeboxStore = create<JukeboxState>((set) => ({
  joinedRoomId: null,
  tunedIn: false,
  title: "",
  inlineMounted: false,
  player: null,

  join: (roomId) =>
    set((s) => (s.joinedRoomId === roomId ? s : { joinedRoomId: roomId, title: "" })),
  leave: () => set({ joinedRoomId: null, title: "", player: null }),
  setTunedIn: (v) => set({ tunedIn: v }),
  setTitle: (t) => set({ title: t }),
  setInlineMounted: (v) => set({ inlineMounted: v }),
  setPlayer: (p) => set({ player: p }),
}));
