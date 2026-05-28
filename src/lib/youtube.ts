/**
 * Minimal YouTube IFrame API helpers.
 * - parseYouTubeId: pull a video id out of common YouTube URL shapes.
 * - loadYouTubeApi: singleton script loader returning the YT namespace.
 */

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// minimal types we use (the YT global is otherwise untyped without external defs)
export interface YTPlayer {
  loadVideoById: (id: string, startSeconds?: number) => void;
  cueVideoById: (id: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getVideoData: () => { title?: string; video_id?: string };
  getCurrentTime: () => number;
  setVolume: (v: number) => void;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    elementId: HTMLElement | string,
    opts: {
      videoId?: string;
      width?: number | string;
      height?: number | string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: 1; PAUSED: 2; ENDED: 0; BUFFERING: 3; CUED: 5 };
}

declare const YT: YTNamespace;

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("YT API needs window"));
  if (window.YT?.Player) return Promise.resolve(window.YT as unknown as YTNamespace);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT as unknown as YTNamespace);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

const ID_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|v\/|shorts\/|live\/))([\w-]{11})/;

export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s; // raw 11-char id
  const m = s.match(ID_RE);
  return m ? m[1] : null;
}
