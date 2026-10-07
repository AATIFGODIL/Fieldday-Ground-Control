import { router } from 'expo-router';
import { View } from 'react-native';

import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { UrgencyColors } from '@/constants/theme';
import { coverageGaps, gapsAt, groupGaps } from '@/domain/coverage';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, useStore } from '@/state/store';

/** Pre-festival check: is the whole site covered in every 30-minute block? */
export default function Coverage() {
  const t = useTheme();
  const now = useSimNow(5000);
  const volunteers = useStore((s) => s.volunteers);
  const festival = useStore((s) => s.festival);
  const all = Object.values(volunteers);
  const nowGaps = gapsAt(festival, all, now);
  const dayGroups = groupGaps(coverageGaps(festival, all));
  const noShows = all.filter((v) => v.status === 'no_show');

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>{formatClock(festival.opensAt)} – {formatClock(festival.closesAt)}</Txt>
        <Txt variant="title">Coverage</Txt>
        <Txt variant="caption">Checks every zone’s staffing and skill requirements against who is available, in 30-minute blocks. Heat rules apply from 35°C.</Txt>
      </View>

      {nowGaps.length > 0 ? (
        <Banner tone="danger" title={`${nowGaps.length} gap${nowGaps.length === 1 ? '' : 's'} right now`} body={nowGaps.map((g) => g.label).join('\n')}>
          <Button title="Fix with placement" size="sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => router.push('/tools/placement')} />
        </Banner>
      ) : (
        <Banner tone="ok" title="Fully covered right now" />
      )}

      {noShows.length > 0 && (
        <Card>
          <Txt variant="label">NO-SHOWS</Txt>
          {noShows.map((v) => (
            <Txt key={v.id} variant="body">{v.name}</Txt>
          ))}
        </Card>
      )}

      <Section title={`Across the day (${dayGroups.length})`}>
        {dayGroups.length === 0 ? (
          <Txt variant="caption">No gaps in any block. The roster covers the entire premises.</Txt>
        ) : (
          dayGroups.map((g) => (
            <Card key={`${g.key}${g.from}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="body" style={{ fontWeight: '700', flex: 1 }}>{g.first.zoneName}</Txt>
                <Pill label={`${formatClock(g.from)}–${formatClock(g.to)}`} color={UrgencyColors.medium} />
              </Row>
              <Txt variant="caption">
                {g.first.label.split(': ')[1]} (as low as {g.worst})
              </Txt>
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}
