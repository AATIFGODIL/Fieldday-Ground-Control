import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { IncidentRow } from '@/components/incident/parts';
import { InboxButton } from '@/components/inbox-button';
import { ShiftCard } from '@/components/shift-card';
import { Banner, Button, Card, Pill, Row, Screen, Section, Txt, UrgencyPill } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { INCIDENT_TYPE_LABELS } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { useStore, zoneById } from '@/state/store';

export default function VolunteerHome() {
  const t = useTheme();
  const { reported } = useLocalSearchParams<{ reported?: string }>();
  const now = useSimNow(5000);
  const me = useStore((s) => s.volunteers[s.currentUserId!]);
  const dispatches = useStore((s) => s.dispatches);
  const incidents = useStore((s) => s.incidents);
  const links = useStore((s) => s.links);
  if (!me) return null;

  const active = dispatches.filter((d) => d.volunteerId === me.id && (d.status === 'notified' || d.status === 'acknowledged'));
  const mine = incidents.filter((i) => i.reporterId === me.id);

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>VOLUNTEER · {zoneById(me.zoneId)?.name?.toUpperCase()}</Txt>
        <Txt variant="title">Hi {me.name.split(' ')[0]}</Txt>
      </View>

      {reported && mine.some((i) => i.ref === reported) && (
        <Banner tone="ok" title={`${reported} logged`} body="The safety lead and your location lead have been notified." />
      )}

      {active.map((d) => {
        const inc = incidents.find((i) => i.id === d.incidentId);
        if (!inc) return null;
        return (
          <Card key={d.id} onPress={() => router.push({ pathname: '/dispatch/[id]', params: { id: d.id } })} style={{ borderWidth: 2, borderColor: '#E5484D' }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="label" color="#E5484D">YOU’RE NEEDED</Txt>
              <UrgencyPill urgency={inc.urgency} />
            </Row>
            <Txt variant="heading">{INCIDENT_TYPE_LABELS[inc.type]} · {zoneById(inc.zoneId)?.name}</Txt>
            <Txt variant="caption">{d.message}</Txt>
            <Pill label={d.status === 'acknowledged' ? 'ON THE WAY' : 'TAP TO OPEN BRIEF'} color="#E5484D" />
          </Card>
        );
      })}

      <ShiftCard volunteerId={me.id} />

      <Button title="Report an incident" size="lg" variant="danger" onPress={() => router.push('/volunteer/report')} />

      <Row style={{ justifyContent: 'space-between' }}>
        <InboxButton />
      </Row>

      <Section title="Your reports">
        {mine.length === 0 ? (
          <Txt variant="caption">Nothing reported yet.</Txt>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {mine.map((i) => (
              <IncidentRow key={i.id} incident={i} now={now} links={links} />
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}
