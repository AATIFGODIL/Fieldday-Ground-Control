/**
 * On-device speech-to-text via expo-speech-recognition.
 *
 * The native module only exists in a development build. In Expo Go
 * `requireNativeModule` throws at import time, so load it lazily and let the
 * report screen fall back to typing.
 */
import { useEffect, useRef } from 'react';

type Module = typeof import('expo-speech-recognition');

let mod: Module | null | undefined;

function load(): Module | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-speech-recognition') as Module;
  } catch {
    mod = null;
  }
  return mod;
}

export function speechRecognitionAvailable(): boolean {
  const m = load();
  if (!m) return false;
  try {
    return m.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function startListening(): Promise<string | null> {
  const m = load();
  if (!m) return 'Voice input needs the development build.';
  const perm = await m.ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) return 'Microphone or speech permission was denied.';
  m.ExpoSpeechRecognitionModule.start({
    lang: 'en-AU',
    interimResults: true,
    continuous: false,
    addsPunctuation: true,
  });
  return null;
}

export function stopListening() {
  load()?.ExpoSpeechRecognitionModule.stop();
}

/**
 * Subscribe to recognition events. Safe to call when the module is missing.
 * `onTranscript` receives the full best transcript so far.
 */
export function useSpeechEvents(handlers: {
  onStart?: () => void;
  onEnd?: () => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const m = load();
    if (!m) return;
    const M = m.ExpoSpeechRecognitionModule;
    const subs = [
      M.addListener('start', () => ref.current.onStart?.()),
      M.addListener('end', () => ref.current.onEnd?.()),
      M.addListener('result', (e) => ref.current.onTranscript?.(e.results[0]?.transcript ?? '', e.isFinal)),
      M.addListener('error', (e) => ref.current.onError?.(e.message || e.error)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
}
