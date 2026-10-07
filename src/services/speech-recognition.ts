/**
 * On-device speech-to-text via expo-speech-recognition.
 *
 * The native module only exists in a development build. In Expo Go the
 * package throws as soon as it's imported (and dev mode reports that even if
 * it's caught), so check the native side first and only import when it's
 * really there. Otherwise the report screen falls back to typing.
 */
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type Module = typeof import('expo-speech-recognition');

let mod: Module | null | undefined;

function load(): Module | null {
  if (mod !== undefined) return mod;
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
    mod = null;
    return mod;
  }
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
