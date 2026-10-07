import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { Banner, Button, Card, Row, Screen, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, UrgencyColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { structureReport } from '@/state/pipeline';
import { setScriptedTranscript, useStore } from '@/state/store';
import {
  speechRecognitionAvailable,
  startListening,
  stopListening,
  useSpeechEvents,
} from '@/services/speech-recognition';

export default function Report() {
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

  useEffect(() => () => {
    if (playback.current) clearInterval(playback.current);
  }, []);

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
    }, 110);
  };

  const pickPhoto = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const res = camera
      ? await ImagePicker.requestCameraPermissionsAsync().then((p) =>
          p.granted ? ImagePicker.launchCameraAsync(opts) : null,
        )
      : await ImagePicker.launchImageLibraryAsync(opts);
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

  return (
    <Screen>
      <View style={{ gap: 4, paddingRight: 160 }}>
        <Txt variant="title">Report an incident</Txt>
        <Txt variant="caption">Say or type what’s happening. We’ll structure it — you’ll confirm before it’s logged.</Txt>
      </View>

      {script && !listening && (
        <Banner tone="info" title="Demo script loaded" body="Plays the scripted voice report as live transcription.">
          <Button title="Play scripted voice" size="sm" onPress={playScript} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
        </Banner>
      )}

      <View style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two }}>
        <MicButton listening={listening} disabled={!canVoice} onPress={toggleMic} />
        <Txt variant="caption">
          {!canVoice
            ? 'Voice input needs the development build — type below instead.'
            : listening
              ? 'Listening… tap to stop'
              : 'Tap to speak'}
        </Txt>
        {voiceError && <Txt variant="caption" color={UrgencyColors.critical}>{voiceError}</Txt>}
      </View>

      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (!listening) setSource((s) => (s === 'voice' && v.length > 0 ? 'voice' : 'text'));
        }}
        multiline
        placeholder="e.g. Someone's collapsed by the water taps, they look really overheated…"
        placeholderTextColor={t.textSecondary}
        style={[styles.input, { color: t.text, backgroundColor: t.backgroundElement, borderColor: listening ? UrgencyColors.critical : t.border }]}
      />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading" style={{ fontSize: 16 }}>Photo (optional)</Txt>
          {photoUri && <Button title="Remove" variant="ghost" size="sm" onPress={() => setPhotoUri(undefined)} />}
        </Row>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <Row>
            <Button title="Take photo" variant="secondary" size="sm" onPress={() => pickPhoto(true)} style={{ flex: 1 }} />
            <Button title="From library" variant="secondary" size="sm" onPress={() => pickPhoto(false)} style={{ flex: 1 }} />
          </Row>
        )}
      </Card>

      <Button title={busy ? 'Structuring report…' : 'Continue'} size="lg" loading={busy} disabled={!text.trim() || busy} onPress={submit} />
      <Txt variant="caption" style={{ textAlign: 'center' }}>
        In an emergency where life is at risk, also call 000.
      </Txt>
    </Screen>
  );
}

function MicButton({ listening, disabled, onPress }: { listening: boolean; disabled: boolean; onPress: () => void }) {
  const t = useTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = listening ? withRepeat(withTiming(1.25, { duration: 700 }), -1, true) : withTiming(1);
  }, [listening, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: listening ? 0.35 : 0 }));
  const color = listening ? UrgencyColors.critical : t.tint;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={listening ? 'Stop recording' : 'Start voice report'}>
      <View style={styles.micWrap}>
        <Animated.View style={[styles.micRing, { backgroundColor: color }, ring]} />
        <View style={[styles.mic, { backgroundColor: disabled ? t.backgroundSelected : color }]}>
          {listening ? (
            <Icon ios="stop.fill" android="stop" size={36} color="#fff" />
          ) : (
            <Icon ios="mic.fill" android="mic" size={40} color="#fff" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 130, borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.three, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' },
  photo: { width: '100%', height: 180, borderRadius: Radius.md },
  micWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  mic: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
});
