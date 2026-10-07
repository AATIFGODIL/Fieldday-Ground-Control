import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Screen, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, UrgencyColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FESTIVAL_ID } from '@/sim/seed/festival';
import { joinFestival } from '@/state/store';

export default function Join() {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (joinFestival(code)) router.replace('/sign-in');
    else setError("That festival ID wasn't found. Check with your coordinator.");
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={{ gap: Spacing.two }}>
          <Txt variant="label" color={t.tint}>FIELDDAY EVENTS</Txt>
          <Txt variant="title" style={{ fontSize: 36 }}>Ground Control</Txt>
          <Txt variant="body" color={t.textSecondary}>
            Enter the festival ID from your volunteer pack to join this event.
          </Txt>
        </View>
        <View style={{ gap: Spacing.two }}>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. FD-2026"
            placeholderTextColor={t.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={submit}
            style={[styles.input, { color: t.text, borderColor: error ? UrgencyColors.critical : t.border, backgroundColor: t.backgroundElement }]}
          />
          {error ? <Txt variant="caption" color={UrgencyColors.critical}>{error}</Txt> : null}
          <Button title="Join festival" size="lg" onPress={submit} disabled={!code.trim()} />
          <Button title={`Use demo festival (${FESTIVAL_ID})`} variant="ghost" onPress={() => setCode(FESTIVAL_ID)} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.five },
  input: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.three, fontSize: 22, fontWeight: '700', letterSpacing: 2 },
});
