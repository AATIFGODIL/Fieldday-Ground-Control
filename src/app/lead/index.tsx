import { IncidentRow } from '@/components/incident/parts';
import { ShiftCard } from '@/components/shift-card';
import { Card, EmptyState, Header, Screen, Section, Txt } from '@/components/ui/primitives';
import { URGENCY_RANK } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useStore, zoneById } from '@/state/store';

/** A location lead sees everything in their zone, and can step in if Mo doesn't. */
export default function LeadIncidents() {
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
    <Screen tabs>
      <Header eyebrow={`${me.name.split(' ')[0]} · Location lead`} title={zone?.name ?? 'My zone'} />
      <Card>
        <Txt variant="body">
          You see every report from your zone. Mo approves responses. If Mo hasn’t within 2 minutes (30 seconds if it’s critical), you can.
        </Txt>
      </Card>
      {open.length === 0 ? (
        <EmptyState title="Quiet for now" body={`Reports from ${zone?.name} will show up here.`} />
      ) : (
        <Section title="Open">
          {open.map((i) => (
            <IncidentRow key={i.id} incident={i} now={now} links={links} />
          ))}
        </Section>
      )}
      {done.length > 0 && (
        <Section title="Done">
          {done.map((i) => (
            <IncidentRow key={i.id} incident={i} now={now} links={links} />
          ))}
        </Section>
      )}
      <ShiftCard volunteerId={me.id} />
    </Screen>
  );
}
