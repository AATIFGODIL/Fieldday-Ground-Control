import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SiteMap } from '@/components/map/site-map';
import { Button, Card, Row, Screen, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, ZoneColors } from '@/constants/theme';
import { SKILL_LABELS, ZONE_KIND_LABELS, type Skill, type ZoneKind, type ZoneRequirement } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { seedFestival } from '@/sim/seed/festival';
import { updateZone, useStore } from '@/state/store';

const KINDS = Object.keys(ZONE_KIND_LABELS) as ZoneKind[];
const REQ_ROWS: (Skill | null)[] = [null, 'first_aid', 'security_licence', 'crowd_control', 'rsa', 'wwcc'];

/** Preset zones the safety lead can move, reshape, rename and re-type. */
export default function Zones() {
  const t = useTheme();
  const zones = useStore((s) => s.festival.zones);
  const [selected, setSelected] = useState<string | null>(null);
  const zone = zones.find((z) => z.id === selected);

  const setReq = (skill: Skill | null, min: number) => {
    if (!zone) return;
    const others = zone.requirements.filter((r) => r.skill !== skill || r.minTempC !== undefined);
    const next: ZoneRequirement[] = min > 0 ? [...others, { skill, min }] : others;
    updateZone(zone.id, { requirements: next });
  };

  return (
    <Screen scroll={false}>
      <View style={{ padding: Spacing.three, paddingBottom: Spacing.two, gap: 2, paddingRight: 160 }}>
        <Txt variant="title">Zones</Txt>
        <Txt variant="caption">Tap a zone to select it. Drag it to move, or drag a corner handle to reshape.</Txt>
      </View>
      <View style={{ paddingHorizontal: Spacing.two }}>
        <SiteMap mode="zones" selectedZoneId={selected} onSelectZone={setSelected} />
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {!zone ? (
          <Txt variant="caption">No zone selected.</Txt>
        ) : (
          <Card>
            <TextInput
              value={zone.name}
              onChangeText={(name) => updateZone(zone.id, { name })}
              style={[styles.name, { color: t.text, borderColor: t.border }]}
            />
            <Txt variant="label">TYPE</Txt>
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => updateZone(zone.id, { kind: k })}
                  style={[styles.chip, { borderColor: ZoneColors[k], backgroundColor: zone.kind === k ? `${ZoneColors[k]}33` : 'transparent' }]}>
                  <Txt variant="caption" style={{ fontWeight: zone.kind === k ? '800' : '500' }}>{ZONE_KIND_LABELS[k]}</Txt>
                </Pressable>
              ))}
            </View>
            <Txt variant="label">MINIMUM STAFFING</Txt>
            {REQ_ROWS.map((skill) => {
              const min = zone.requirements.find((r) => r.skill === skill && r.minTempC === undefined)?.min ?? 0;
              return (
                <Row key={skill ?? 'any'} style={{ justifyContent: 'space-between' }}>
                  <Txt variant="body">{skill ? SKILL_LABELS[skill] : 'Volunteers (any)'}</Txt>
                  <Row>
                    <Button title="−" size="sm" variant="secondary" onPress={() => setReq(skill, Math.max(0, min - 1))} />
                    <Txt variant="heading" style={{ width: 28, textAlign: 'center' }}>{min}</Txt>
                    <Button title="+" size="sm" variant="secondary" onPress={() => setReq(skill, min + 1)} />
                  </Row>
                </Row>
              );
            })}
            {zone.requirements.some((r) => r.minTempC !== undefined) && (
              <Txt variant="caption">
                Heat rule: {zone.requirements.filter((r) => r.minTempC !== undefined).map((r) => `${r.min}× ${r.skill ? SKILL_LABELS[r.skill] : 'any'} from ${r.minTempC}°C`).join(', ')}
              </Txt>
            )}
            <Button
              title="Reset this zone"
              variant="ghost"
              onPress={() => {
                const preset = seedFestival().zones.find((z) => z.id === zone.id);
                if (preset) updateZone(zone.id, preset);
              }}
            />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
