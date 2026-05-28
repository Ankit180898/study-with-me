"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Soft ambient sound via the Web Audio API — looping brown noise through a
 * low-pass filter (a calming rain/airflow texture). No audio assets required.
 * Real licensed lo-fi/cafe tracks could replace this later with <audio> sources.
 */
export function useAmbient(initialVolume = 0.35) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const ensure = useCallback(() => {
    if (ctxRef.current) return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    const size = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5; // brown noise
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    ctxRef.current = ctx;
    gainRef.current = gain;
    srcRef.current = src;
  }, [volume]);

  const toggle = useCallback(() => {
    ensure();
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (playing) {
      void ctx.suspend();
      setPlaying(false);
    } else {
      void ctx.resume();
      setPlaying(true);
    }
  }, [ensure, playing]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      try {
        srcRef.current?.stop();
        void ctxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { playing, toggle, volume, setVolume };
}
