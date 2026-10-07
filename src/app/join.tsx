import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Screen, Txt } from '@/components/ui/primitives';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FESTIVAL_ID } from '@/sim/seed/festival';
import { joinFestival } from '@/state/store';

/** Each festival has its own code, so the same app works year after year. */
export default function Join() {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (value = code) => {
    if (joinFestival(value)) router.replace('/sign-in');
    else setError('We couldn’t find that festival. Check the code in your volunteer pack.');
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={{ gap: Spacing.three }}>
          <Txt variant="label">Ground Control · Fieldday</Txt>
          <Txt variant="hero">Join your festival</Txt>
          <Txt variant="body" color={t.textSecondary}>
            Type the festival code from your volunteer pack.
          </Txt>
        </View>
        <View style={{ gap: Spacing.three }}>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase());
              setError(null);
            }}
            placeholder="FD-2026"
            placeholderTextColor={t.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => submit()}
            style={[styles.input, { color: t.text, borderColor: error ? t.text : t.border, backgroundColor: t.backgroundElement }]}
          />
          {error ? <Txt variant="strong">{error}</Txt> : null}
          <Button title="Join" size="lg" onPress={() => submit()} disabled={!code.trim()} />
          <Button title={`Use the demo festival (${FESTIVAL_ID})`} variant="ghost" onPress={() => submit(FESTIVAL_ID)} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.five, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  input: { borderWidth: 2, borderRadius: Radius.lg, paddingHorizontal: Spacing.four, height: 72, fontSize: 28, fontWeight: '700', letterSpacing: 3 },
});
