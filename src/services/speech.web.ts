/**
 * On the web, briefs are read in Kokoro's "Heart" voice (the launch film's
 * voice) from /api/voice. The audio is fetched as soon as a brief is written,
 * so it's usually ready before the volunteer's screen opens. If it isn't ready
 * within a few seconds, or anything fails, the browser's own voice reads it.
 */
import * as Speech from 'expo-speech';

import { apiBaseUrl } from '@/api/client';

const WAIT_MS = 6000;

const clips = new Map<string, Promise<AudioBuffer | null>>();
let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let pending: object | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers only let sound start after someone has touched the page, so wake
// the audio on the first touch or key press.
if (typeof window !== 'undefined') {
  const wake = () => void audio()?.resume().catch(() => {});
  window.addEventListener('pointerdown', wake, { capture: true });
  window.addEventListener('keydown', wake, { capture: true });
}

/** Fetch a brief in Kokoro's voice ahead of time (cached by text). */
export function prepareVoice(text: string): Promise<AudioBuffer | null> {
  const key = text.trim();
  if (!key) return Promise.resolve(null);
  const cached = clips.get(key);
  if (cached) return cached;
  const job = (async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: key }),
      });
      if (!res.ok) return null;
      const c = audio();
      return c ? await c.decodeAudioData(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  })();
  clips.set(key, job);
  void job.then((buf) => {
    if (!buf) clips.delete(key); // try again next time
  });
  return job;
}

function systemVoice(text: string, onDone?: () => void) {
  Speech.speak(text, { language: 'en-AU', rate: 1.0, onDone, onStopped: onDone, onError: onDone });
}

/** Read text aloud in Kokoro's voice, or the browser's if that isn't ready in time. */
export function speak(text: string, opts: { onDone?: () => void } = {}) {
  stopSpeaking();
  const token = {};
  pending = token;
  let settled = false;
  const fallback = () => {
    if (settled || pending !== token) return;
    settled = true;
    systemVoice(text, opts.onDone);
  };
  fallbackTimer = setTimeout(fallback, WAIT_MS);
  void prepareVoice(text).then(async (buf) => {
    if (settled || pending !== token) return;
    const c = audio();
    if (!buf || !c) return fallback();
    await c.resume().catch(() => {});
    if (c.state !== 'running' || settled || pending !== token) return fallback();
    settled = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.onended = () => {
      if (playing === src) playing = null;
      opts.onDone?.();
    };
    playing = src;
    src.start();
  });
}

export function stopSpeaking() {
  pending = null;
  if (fallbackTimer) clearTimeout(fallbackTimer);
  fallbackTimer = null;
  Speech.stop();
  if (playing) {
    const p = playing;
    playing = null;
    try {
      p.onended = null;
      p.stop();
    } catch {
      // already stopped
    }
  }
}
