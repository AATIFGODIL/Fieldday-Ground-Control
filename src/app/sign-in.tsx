import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/incident/parts';
import { Glyph } from '@/components/ui/glyph';
import { Button, Tappable, Txt } from '@/components/ui/primitives';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { SKILL_LABELS, type Volunteer } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_IDENTITIES } from '@/sim/seed/roster';
import { leaveFestival, signInAs, useStore, zoneById } from '@/state/store';

const ROLE_LINE: Record<Volunteer['role'], string> = {
  safety_lead: 'Approves every response',
  location_lead: 'Looks after one zone',
  volunteer: 'Reports and responds',
};

/**
 * Demo sign-in: pick a person. A real build would verify identity (e.g. an SMS
 * code); the role still comes from the roster.
 */
export default function SignIn() {
  const t = useTheme();
  const volunteers = useStore((s) => s.volunteers);
  const festivalName = useStore((s) => s.festival.name);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const demo = DEMO_IDENTITIES.map((id) => volunteers[id]).filter(Boolean);
  const sections = q
    ? [{ title: 'Results', data: Object.values(volunteers).filter((v) => v.name.toLowerCase().includes(q)).slice(0, 40) }]
    : [
        { title: 'Safety lead', data: demo.filter((v) => v.role === 'safety_lead') },
        { title: 'Location leads', data: demo.filter((v) => v.role === 'location_lead') },
        { title: 'Volunteers', data: demo.filter((v) => v.role === 'volunteer') },
      ];

  const choose = (id: string) => {
    signInAs(id);
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(v) => v.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, marginBottom: Spacing.three }}>
            <Txt variant="label">{festivalName}</Txt>
            <Txt variant="hero">Who are you?</Txt>
            <View style={[styles.search, { backgroundColor: t.backgroundElement }]}>
              <Glyph name="person" size={22} color={t.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search all 300 people"
                placeholderTextColor={t.textSecondary}
                style={[Type.body, { flex: 1, color: t.text, height: 56 }]}
              />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Txt variant="heading" style={{ marginTop: Spacing.four, marginBottom: Spacing.two }}>
            {section.title}
          </Txt>
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        renderItem={({ item }) => <PersonRow v={item} onPress={() => choose(item.id)} />}
        ListFooterComponent={
          <View style={{ gap: Spacing.two, marginTop: Spacing.five }}>
            <Button title="New volunteer? Sign up" variant="secondary" onPress={() => router.push('/register')} />
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
  const where = v.role === 'safety_lead' ? 'Whole site' : zone?.name;
  const skill = v.skills[0] ? SKILL_LABELS[v.skills[0]] : null;
  return (
    <Tappable onPress={onPress} style={[styles.row, { backgroundColor: t.backgroundElement }]}>
      <Avatar name={v.name} size={52} inverted={v.role !== 'volunteer'} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="strong">{v.name}</Txt>
        <Txt variant="caption">
          {where} · {v.role === 'volunteer' && skill ? skill : ROLE_LINE[v.role]}
        </Txt>
      </View>
      <Glyph name="chevron" size={22} color={t.textSecondary} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.pill, paddingHorizontal: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
});
