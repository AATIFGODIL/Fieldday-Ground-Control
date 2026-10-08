import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { AIWorking, SoundBars } from '@/components/ui/motion';
import { Button, Card, Header, Row, Screen, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { structureReport } from '@/state/pipeline';
import { setScriptedTranscript, useStore } from '@/state/store';
import { speechRecognitionAvailable, startListening, stopListening, useSpeechEvents } from '@/services/speech-recognition';

/**
 * Say it (or type it). AI writes it up; you confirm before anything is sent.
 * Anyone on the crew can report: volunteers, location leads and Mo.
 */
export function ReportScreen() {
  const t = useTheme();
  const userId = useStore((s) => s.currentUserId)!;
  const script = useStore((s) => s.scriptedTranscript);
  const [text, setText] = useState('');
  const [source, setSource] = useState<'voice' | 'text'>('text');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [canVoice] = useState(() => speechRecognitionAvailable());
  const playback = useRef<ReturnType<typeof setInterval> | null>(null);
  const input = useRef<TextInput>(null);
  const [dictateHint, setDictateHint] = useState(false);

  useSpeechEvents({
    onStart: () => setListening(true),
    onEnd: () => setListening(false),
    onTranscript: (tx) => {
      setText(tx);
      setSource('voice');
    },
    onError: (m) => {
      setListening(false);
      if (m && !/no speech|aborted/i.test(m)) setVoiceError(m);
    },
  });

  useEffect(
    () => () => {
      if (playback.current) clearInterval(playback.current);
    },
    [],
  );

  const toggleMic = async () => {
    setVoiceError(null);
    if (listening) {
      stopListening();
      return;
    }
    const err = await startListening();
    if (err) setVoiceError(err);
  };

  /** Demo: play the scripted words in as if they were being transcribed live. */
  const playScript = () => {
    if (!script) return;
    const words = script.split(' ');
    let i = 0;
    setText('');
    setSource('voice');
    setListening(true);
    playback.current = setInterval(() => {
      i += 1;
      setText(words.slice(0, i).join(' '));
      if (i >= words.length) {
        if (playback.current) clearInterval(playback.current);
        setListening(false);
        setScriptedTranscript(null);
      }
    }, 90);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res && !res.canceled) setPhotoUri(res.assets[0]?.uri);
  };

  const submit = async () => {
    if (listening) stopListening();
    setBusy(true);
    await structureReport({ reporterId: userId, transcript: text.trim(), source, photoUri });
    setBusy(false);
    router.push('/report-confirm');
    setText('');
    setPhotoUri(undefined);
    setSource('text');
  };

  // Without on-device speech (Expo Go), the phone keyboard's own dictation mic does the job.
  const useKeyboardMic = () => {
    setDictateHint(true);
    input.current?.focus();
  };
  const micLabel = listening ? 'Listening… tap to stop' : 'Tap and talk';

  return (
    <Screen tabs>
      <Header title="Report something" subtitle="Say what you see. You’ll check it before it’s sent." />

      <View style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two }}>
        <MicButton listening={listening} disabled={false} onPress={canVoice ? toggleMic : useKeyboardMic} />
        <View style={{ height: 28, justifyContent: 'center' }}>
          {listening ? <SoundBars active color={t.critical} bars={9} /> : null}
        </View>
        <Txt variant="strong" center>
          {micLabel}
        </Txt>
        {voiceError && <Txt variant="caption" center>{voiceError}</Txt>}
        {dictateHint && !canVoice && (
          <Txt variant="caption" center>
            Now tap the microphone on your keyboard and speak.
          </Txt>
        )}
        {script && !listening && (
          <Button
            title="Play the example report"
            variant="secondary"
            icon={<Glyph name="play" size={18} color={t.text} />}
            onPress={playScript}
          />
        )}
      </View>

      <TextInput
        ref={input}
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (!listening) setSource((s) => (s === 'voice' && v.length > 0 ? 'voice' : 'text'));
        }}
        multiline
        placeholder="Or type it here. For example: someone’s collapsed by the water taps and looks overheated."
        placeholderTextColor={t.textSecondary}
        style={[styles.input, { color: t.text, backgroundColor: t.backgroundElement, borderColor: listening ? t.critical : t.backgroundElement }]}
      />

      {photoUri ? (
        <View style={{ gap: Spacing.two }}>
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          <Button title="Remove photo" variant="ghost" onPress={() => setPhotoUri(undefined)} />
        </View>
      ) : (
        <Pressable onPress={pickPhoto} hitSlop={8}>
          <Row style={{ justifyContent: 'center' }}>
            <Glyph name="camera" size={22} color={t.accent} />
            <Txt variant="label" color={t.accent}>
              Add a photo (optional)
            </Txt>
          </Row>
        </Pressable>
      )}

      {busy ? (
        <Card tone="ai">
          <AIWorking label="AI is writing up your report…" color={t.ai} />
        </Card>
      ) : (
        <Button title="Continue" size="lg" disabled={!text.trim() || listening} onPress={submit} />
      )}
      <Txt variant="caption" center>
        If someone’s life is at risk, also call 000.
      </Txt>
    </Screen>
  );
}

function MicButton({ listening, disabled, onPress, icon }: { listening: boolean; disabled: boolean; onPress: () => void; icon?: 'play' }) {
  const t = useTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(listening ? withRepeat(withTiming(1.22, { duration: 800 }), -1, true) : withTiming(1));
  }, [listening, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }], opacity: listening ? 0.22 : 0 }));
  const bg = disabled ? t.backgroundSelected : listening ? t.critical : t.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop recording' : 'Start a voice report'}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
      <View style={styles.micWrap}>
        <Animated.View style={[styles.micRing, { backgroundColor: bg }, ring]} />
        <View style={[styles.mic, { backgroundColor: bg, shadowColor: bg }]}>
          <Glyph name={listening ? 'stop' : (icon ?? 'mic')} size={52} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 160, borderWidth: 2, borderRadius: Radius.lg, padding: Spacing.four, ...Type.body, textAlignVertical: 'top' },
  photo: { width: '100%', height: 200, borderRadius: Radius.lg },
  micWrap: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  mic: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
