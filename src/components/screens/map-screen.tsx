import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/incident/parts';
import { SiteMap } from '@/components/map/site-map';
import { Glyph } from '@/components/ui/glyph';
import { Card, Header, Row, Txt } from '@/components/ui/primitives';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ROLE_LABELS, SKILL_LABELS } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { dropDot, useStore, zoneById } from '@/state/store';
import { useTour } from '@/state/tour';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Shared live map for every role. In the demo, the safety lead can drag people around. */
export function MapScreen({ canOperate }: { canOperate: boolean }) {
  const t = useTheme();
  const { height: winH } = useWindowDimensions();
  const params = useLocalSearchParams<{ operator?: string }>();
  const mode = useStore((s) => s.mode);
  const volunteers = useStore((s) => s.volunteers);
  const dispatches = useStore((s) => s.dispatches);
  const guide = useTour((s) => (s.scenario ? s.cardHeight + 16 : 0));
  const onShift = Object.values(volunteers).filter((v) => v.status === 'checked_in').length;
  const [operator, setOperator] = useState(params.operator === '1');
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const v = selected ? volunteers[selected] : undefined;
  const activeDispatchIds = dispatches.filter((d) => d.status === 'notified' || d.status === 'acknowledged').map((d) => d.id);
  const canDrag = (canOperate || params.operator === '1') && mode === 'simulated';
  const operating = operator && canDrag;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + guide }]}
        scrollEnabled={!operating}>
        <Header title="Map" subtitle={`${onShift} people on shift. You only appear here while you’re checked in.`} />

        <SiteMap
          tall
          height={Math.max(360, Math.min(600, winH * 0.58))}
          mode={operating ? 'operator' : 'view'}
          pathDispatchIds={activeDispatchIds}
          highlightIds={selected ? [selected] : undefined}
          onDotPress={(id) => setSelected(id)}
          onIncidentPress={(id) => router.push({ pathname: '/incident/[id]', params: { id } })}
          onDotDropped={(id) => {
            setSelected(id);
            const zone = dropDot(id);
            setNote(zone ? `${volunteers[id]?.name} moved to ${zone}` : null);
          }}
        />

        <View style={styles.legend}>
          <Legend swatch={<View style={[styles.dot, { backgroundColor: t.accent, opacity: 0.8 }]} />} label="Volunteer" />
          <Legend swatch={<View style={[styles.dot, styles.big, { backgroundColor: t.text }]} />} label="Lead" />
          <Legend swatch={<View style={[styles.dot, styles.big, { backgroundColor: t.accent, borderWidth: 2, borderColor: t.background }]} />} label="On the way" />
          <Legend swatch={<View style={[styles.dot, styles.big, { backgroundColor: t.critical }]} />} label="Incident" />
        </View>

        {v && (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Avatar name={v.name} />
                <View>
                  <Txt variant="strong">{v.name}</Txt>
                  <Txt variant="caption">
                    {ROLE_LABELS[v.role]} · {zoneById(v.leadsZoneId ?? v.zoneId)?.name}
                  </Txt>
                </View>
              </Row>
              <Pressable hitSlop={12} onPress={() => setSelected(null)} accessibilityLabel="Close">
                <Glyph name="x" size={24} color={t.textSecondary} />
              </Pressable>
            </Row>
            <Txt variant="body">{v.skills.length ? v.skills.map((s) => SKILL_LABELS[s]).join(', ') : 'No certificates'}</Txt>
            <Txt variant="caption">Speaks {v.languages.join(', ')}</Txt>
          </Card>
        )}

        {canDrag && (
          <Card onPress={() => setOperator((o) => !o)} tone={operator ? 'strong' : 'plain'}>
            <Row>
              <View style={[styles.toggle, { borderColor: t.accent, backgroundColor: operator ? t.accent : 'transparent' }]}>
                {operator && <Glyph name="check" size={18} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="strong">Move people by dragging</Txt>
                <Txt variant="caption">Demo only. Drop someone in another zone to reassign them.</Txt>
              </View>
            </Row>
            {note && <Txt variant="label" color={t.text}>{note}</Txt>}
          </Card>
        )}

        <Txt variant="caption" center>
          Pinch or double-tap to zoom. Tap a dot or an incident for details.
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <Row gap={Spacing.two}>
      <View style={{ width: 18, alignItems: 'center' }}>{swatch}</View>
      <Txt variant="caption">{label}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingTop: Spacing.three, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.four, rowGap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  big: { width: 16, height: 16, borderRadius: 8 },
  toggle: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
