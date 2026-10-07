import { View } from 'react-native';

import { IncidentRow } from '@/components/incident/parts';
import { InboxButton } from '@/components/inbox-button';
import { ShiftCard } from '@/components/shift-card';
import { Banner, EmptyState, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { URGENCY_RANK } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { useStore, zoneById } from '@/state/store';

export default function LeadIncidents() {
  const t = useTheme();
  const now = useSimNow(1000);
  const me = useStore((s) => s.volunteers[s.currentUserId!]);
  const incidents = useStore((s) => s.incidents);
  const links = useStore((s) => s.links);
  if (!me) return null;
  const zone = zoneById(me.leadsZoneId);
  const mine = incidents
    .filter((i) => i.zoneId === me.leadsZoneId)
    .sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] || b.createdAt - a.createdAt);
  const open = mine.filter((i) => i.status !== 'resolved' && i.status !== 'merged');
  const done = mine.filter((i) => i.status === 'resolved' || i.status === 'merged');

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>LOCATION LEAD</Txt>
        <Txt variant="title">{zone?.name}</Txt>
      </View>
      <Banner
        tone="info"
        title="You see every incident in your zone"
        body="The safety lead approves responses. If they haven't within 2 minutes (30 seconds for critical), you can approve — it's logged and they're notified."
      />
      <Row>
        <InboxButton />
      </Row>
      <Section title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <EmptyState title="Quiet for now" body={`Incidents reported in ${zone?.name} will appear here.`} />
        ) : (
          open.map((i) => <IncidentRow key={i.id} incident={i} now={now} links={links} />)
        )}
      </Section>
      {done.length > 0 && (
        <Section title={`Closed (${done.length})`}>
          {done.map((i) => (
            <IncidentRow key={i.id} incident={i} now={now} links={links} />
          ))}
        </Section>
      )}
      <ShiftCard volunteerId={me.id} />
    </Screen>
  );
}
