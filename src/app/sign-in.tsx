import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Pill, Row, Txt } from '@/components/ui/primitives';
import { RoleColors, Radius, Spacing } from '@/constants/theme';
import { ROLE_LABELS, SKILL_SHORT, type Volunteer } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_IDENTITIES } from '@/sim/seed/roster';
import { leaveFestival, signInAs, useStore, zoneById } from '@/state/store';

/**
 * Demo sign-in: pick a person from the seeded roster. A production build would
 * verify identity (e.g. SMS code) — the role still comes from the roster.
 */
export default function SignIn() {
  const t = useTheme();
  const volunteers = useStore((s) => s.volunteers);
  const festivalName = useStore((s) => s.festival.name);
  const [query, setQuery] = useState('');

  const demo = DEMO_IDENTITIES.map((id) => volunteers[id]).filter(Boolean);
  const q = query.trim().toLowerCase();
  const results = q
    ? Object.values(volunteers).filter((v) => v.name.toLowerCase().includes(q)).slice(0, 40)
    : demo;

  const choose = (id: string) => {
    signInAs(id);
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <FlatList
        data={results}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, marginBottom: Spacing.two }}>
            <View style={{ gap: Spacing.one }}>
              <Txt variant="label" color={t.tint}>{festivalName.toUpperCase()}</Txt>
              <Txt variant="title">Who’s signing in?</Txt>
              <Txt variant="caption">Your role (volunteer, location lead or safety lead) comes from the roster.</Txt>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search all 300 people…"
              placeholderTextColor={t.textSecondary}
              style={[styles.search, { color: t.text, backgroundColor: t.backgroundElement, borderColor: t.border }]}
            />
            {!q && <Txt variant="label">DEMO CAST</Txt>}
          </View>
        }
        renderItem={({ item }) => <PersonRow v={item} onPress={() => choose(item.id)} />}
        ListFooterComponent={
          <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
            <Button title="New volunteer? Register" variant="secondary" onPress={() => router.push('/register')} />
            <Button
              title="Change festival"
              variant="ghost"
              onPress={() => {
                leaveFestival();
                router.replace('/join');
              }}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}

function PersonRow({ v, onPress }: { v: Volunteer; onPress: () => void }) {
  const t = useTheme();
  const zone = zoneById(v.leadsZoneId ?? v.zoneId);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: t.backgroundElement, borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.avatar, { backgroundColor: RoleColors[v.role] }]}>
        <Txt variant="heading" color="#fff">{v.name.charAt(0)}</Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" style={{ fontSize: 16 }}>{v.name}</Txt>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Pill label={ROLE_LABELS[v.role]} color={RoleColors[v.role]} />
          {zone && <Txt variant="caption">{zone.name}</Txt>}
          {v.skills.slice(0, 3).map((s) => (
            <Txt key={s} variant="caption">· {SKILL_SHORT[s]}</Txt>
          ))}
        </Row>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderRadius: Radius.md, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
