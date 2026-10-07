import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShiftCard } from '@/components/shift-card';
import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Radius, SkillColors, Spacing } from '@/constants/theme';
import { BLOCKS, blocksFromSlots, slotsFromBlocks } from '@/domain/availability';
import { SKILL_SHORT } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { setAvailability, signOut, useStore, zoneById } from '@/state/store';

export default function Shift() {
  const t = useTheme();
  const me = useStore((s) => s.volunteers[s.currentUserId!]);
  const [picked, setPicked] = useState(() => blocksFromSlots(me?.availability ?? []));
  const [saved, setSaved] = useState(false);
  if (!me) return null;
  const dirty = [...picked].sort().join() !== [...blocksFromSlots(me.availability)].sort().join();

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>SATURDAY 16 JANUARY</Txt>
        <Txt variant="title">My shift</Txt>
      </View>
      <ShiftCard volunteerId={me.id} />

      <Section title="When I'm available">
        <View style={styles.grid}>
          {BLOCKS.map((b) => {
            const on = picked.has(b.id);
            return (
              <Pressable
                key={b.id}
                onPress={() => {
                  setSaved(false);
                  setPicked((p) => {
                    const n = new Set(p);
                    if (n.has(b.id)) n.delete(b.id);
                    else n.add(b.id);
                    return n;
                  });
                }}
                style={[styles.block, { borderColor: on ? t.tint : t.border, backgroundColor: on ? `${t.tint}22` : t.backgroundElement }]}>
                <Txt variant="body" style={{ fontWeight: on ? '800' : '500' }} color={on ? t.tint : t.text}>{b.label}</Txt>
                <Txt variant="caption">{on ? 'Available' : 'Not available'}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Button
          title={saved ? 'Saved' : 'Save availability'}
          disabled={!dirty}
          onPress={() => {
            setAvailability(me.id, slotsFromBlocks(picked));
            setSaved(true);
          }}
        />
        {saved && <Banner tone="ok" title="Availability updated" body="The safety lead's coverage check now uses your new times." />}
      </Section>

      <Section title="My details">
        <Card>
          <Txt variant="body" style={{ fontWeight: '700' }}>{me.name}</Txt>
          <Txt variant="caption">Assigned to {zoneById(me.zoneId)?.name ?? '—'}</Txt>
          <Row gap={4} style={{ flexWrap: 'wrap' }}>
            {me.skills.map((s) => (
              <Pill key={s} label={SKILL_SHORT[s]} color={SkillColors[s]} />
            ))}
            <Txt variant="caption">{me.languages.join(', ')}</Txt>
          </Row>
          <Button title="Edit skills" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/register', params: { edit: '1' } })} />
        </Card>
        <Button
          title="Sign out"
          variant="ghost"
          onPress={() => {
            signOut();
            router.replace('/sign-in');
          }}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  block: { width: '48.5%', borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.three },
});
