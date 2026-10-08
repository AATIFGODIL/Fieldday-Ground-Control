import * as Speech from 'expo-speech';

/** Read text aloud. Any current utterance is stopped first. */
export function speak(text: string, opts: { onDone?: () => void } = {}) {
  Speech.stop();
  Speech.speak(text, {
    language: 'en-AU',
    rate: 1.0,
    onDone: opts.onDone,
    onStopped: opts.onDone,
    onError: opts.onDone,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

/** The web version fetches the brief in Kokoro's voice ahead of time; phones use the system voice. */
export function prepareVoice(_text: string) {}
