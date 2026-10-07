import { View } from 'react-native';

import { Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { SkillColors, UrgencyColors } from '@/constants/theme';
import { activeRequirements } from '@/domain/coverage';
import { SKILL_LABELS, SKILL_SHORT, type ShiftStatus } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useStore, zoneById } from '@/state/store';

const STATUS: Record<ShiftStatus, { label: string; color?: string }> = {
  checked_in: { label: 'ON SHIFT', color: UrgencyColors.low },
  rostered: { label: 'NOT CHECKED IN' },
  checked_out: { label: 'CHECKED OUT' },
  no_show: { label: 'NO-SHOW', color: UrgencyColors.critical },
};

export default function Team() {
  const t = useTheme();
  const me = useStore((s) => s.volunteers[s.currentUserId!]);
  const volunteers = useStore((s) => s.volunteers);
  const temperatureC = useStore((s) => s.temperatureC);
  if (!me) return null;
  const zone = zoneById(me.leadsZoneId);
  const team = Object.values(volunteers).filter((v) => v.zoneId === me.leadsZoneId && v.role === 'volunteer');
  const present = team.filter((v) => v.status === 'checked_in');

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>{zone?.name.toUpperCase()}</Txt>
        <Txt variant="title">Team</Txt>
      </View>
      {zone && (
        <Card>
          <Txt variant="label">REQUIREMENTS AT {temperatureC}°C</Txt>
          {activeRequirements(zone, temperatureC).map((r, i) => {
            const have = r.skill ? present.filter((v) => v.skills.includes(r.skill!)).length : present.length;
            const ok = have >= r.min;
            return (
              <Row key={i} style={{ justifyContent: 'space-between' }}>
                <Txt variant="body">{r.skill ? SKILL_LABELS[r.skill] : 'Volunteers'}</Txt>
                <Pill label={`${have}/${r.min}`} color={ok ? UrgencyColors.low : UrgencyColors.critical} solid />
              </Row>
            );
          })}
        </Card>
      )}
      <Section title={`${present.length} of ${team.length} on shift`}>
        {team.map((v) => (
          <Card key={v.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="body" style={{ fontWeight: '700' }}>{v.name}</Txt>
              <Pill label={STATUS[v.status].label} color={STATUS[v.status].color} solid={!!STATUS[v.status].color} />
            </Row>
            <Row gap={4} style={{ flexWrap: 'wrap' }}>
              {v.skills.map((s) => (
                <Pill key={s} label={SKILL_SHORT[s]} color={SkillColors[s]} />
              ))}
              <Txt variant="caption">{v.languages.join(', ')}</Txt>
            </Row>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
