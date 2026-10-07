import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { dotColor, SiteMap } from '@/components/map/site-map';
import { Button, Card, Pill, Row, Screen, Txt } from '@/components/ui/primitives';
import { RoleColors, SkillColors, Spacing } from '@/constants/theme';
import { ROLE_LABELS, SKILL_LABELS, SKILL_SHORT, type Skill } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { dropDot, useStore, zoneById } from '@/state/store';

const LEGEND: (Skill | 'none')[] = ['first_aid', 'security_licence', 'crowd_control', 'wwcc', 'rsa', 'none'];

/** Shared live map for all roles. Operators can drag dots in simulation mode. */
export function MapScreen({ canOperate }: { canOperate: boolean }) {
  const t = useTheme();
  const params = useLocalSearchParams<{ operator?: string }>();
  const mode = useStore((s) => s.mode);
  const volunteers = useStore((s) => s.volunteers);
  const dispatches = useStore((s) => s.dispatches);
  const onShift = Object.values(volunteers).filter((v) => v.status === 'checked_in').length;
  const [operator, setOperator] = useState(params.operator === '1');
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const v = selected ? volunteers[selected] : undefined;
  const activeDispatchIds = dispatches.filter((d) => d.status === 'notified' || d.status === 'acknowledged').map((d) => d.id);
  const operating = operator && mode === 'simulated' && (canOperate || params.operator === '1');

  return (
    <Screen scroll={false}>
      <View style={{ padding: Spacing.three, paddingBottom: Spacing.two, gap: 2, paddingRight: 160 }}>
        <Txt variant="title">Site map</Txt>
        <Txt variant="caption">
          {onShift} on shift · positions shared only while checked in · {mode === 'simulated' ? 'simulated' : 'live GPS'}
        </Txt>
      </View>
      <View style={{ paddingHorizontal: Spacing.two }}>
        <SiteMap
          mode={operating ? 'operator' : 'view'}
          pathDispatchIds={activeDispatchIds}
          highlightIds={selected ? [selected] : undefined}
          onDotPress={(id) => setSelected(id)}
          onIncidentPress={(id) => router.push({ pathname: '/incident/[id]', params: { id } })}
          onDotDropped={(id) => {
            setSelected(id);
            const zone = dropDot(id);
            setNote(zone ? `${volunteers[id]?.name} reassigned to ${zone}` : null);
          }}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 }}>
        {(canOperate || params.operator === '1') && mode === 'simulated' && (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="heading" style={{ fontSize: 15 }}>Drag dots (demo operator)</Txt>
                <Txt variant="caption">Move people around; drop someone in another zone to reassign them.</Txt>
              </View>
              <Switch value={operator} onValueChange={setOperator} trackColor={{ true: t.tint }} />
            </Row>
            {note && <Txt variant="caption" color={t.tint}>{note}</Txt>}
          </Card>
        )}

        {v && (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <View style={[styles.swatch, { backgroundColor: dotColor(v) }]} />
                <Txt variant="heading">{v.name}</Txt>
              </Row>
              <Button title="Close" variant="ghost" size="sm" onPress={() => setSelected(null)} />
            </Row>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Pill label={ROLE_LABELS[v.role]} color={RoleColors[v.role]} />
              <Txt variant="caption">{zoneById(v.leadsZoneId ?? v.zoneId)?.name}</Txt>
            </Row>
            <Row gap={4} style={{ flexWrap: 'wrap' }}>
              {v.skills.length ? v.skills.map((s) => <Pill key={s} label={SKILL_SHORT[s]} color={SkillColors[s]} />) : <Txt variant="caption">No certifications</Txt>}
              <Txt variant="caption">· {v.languages.join(', ')}</Txt>
            </Row>
          </Card>
        )}

        <View style={styles.legend}>
          {LEGEND.map((k) => (
            <Row key={k} gap={6}>
              <View style={[styles.swatch, { backgroundColor: SkillColors[k] }]} />
              <Txt variant="caption">{k === 'none' ? 'Other' : SKILL_LABELS[k]}</Txt>
            </Row>
          ))}
          <Row gap={6}>
            <View style={[styles.swatch, styles.lead, { backgroundColor: RoleColors.location_lead }]} />
            <Txt variant="caption">Location lead</Txt>
          </Row>
          <Row gap={6}>
            <View style={[styles.diamond, { backgroundColor: '#E5484D' }]} />
            <Txt variant="caption">Incident</Txt>
          </Row>
        </View>
        <Txt variant="caption">Pinch to zoom, double-tap to zoom in or out, tap a dot or incident for details.</Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  lead: { borderWidth: 2, borderColor: '#fff', width: 14, height: 14, borderRadius: 7 },
  diamond: { width: 10, height: 10, transform: [{ rotate: '45deg' }] },
});
