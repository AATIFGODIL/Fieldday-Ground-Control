import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IncidentRow } from '@/components/incident/parts';
import { InboxButton } from '@/components/inbox-button';
import { Card, EmptyState, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, UrgencyColors } from '@/constants/theme';
import { gapsAt } from '@/domain/coverage';
import { URGENCY_RANK, type Incident } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/state/store';

const needsDecision = (i: Incident) => i.status === 'logged' || i.status === 'suggested' || i.status === 'no_suggestion';

export default function Command() {
  const t = useTheme();
  const now = useSimNow(1000);
  const incidents = useStore((s) => s.incidents);
  const links = useStore((s) => s.links);
  const volunteers = useStore((s) => s.volunteers);
  const festival = useStore((s) => s.festival);
  const notices = useStore((s) => s.notices);
  const me = useStore((s) => s.currentUserId);

  const all = Object.values(volunteers);
  const onShift = all.filter((v) => v.status === 'checked_in').length;
  const noShows = all.filter((v) => v.status === 'no_show').length;
  const gapsNow = gapsAt(festival, all, now);
  const alerts = notices.filter((n) => n.to === me && (n.kind === 'offsite' || n.kind === 'coverage') && !n.read).slice(0, 4);

  const byPriority = (a: Incident, b: Incident) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] || a.createdAt - b.createdAt;
  const decide = incidents.filter(needsDecision).sort(byPriority);
  const progress = incidents.filter((i) => i.status === 'approved').sort(byPriority);
  const closed = incidents.filter((i) => i.status === 'resolved' || i.status === 'merged');

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>SAFETY LEAD</Txt>
        <Txt variant="title">Command</Txt>
      </View>

      <View style={styles.kpis}>
        <Kpi label="On shift" value={`${onShift}`} />
        <Kpi label="Decide" value={`${decide.length}`} color={decide.length ? UrgencyColors.high : undefined} />
        <Kpi label="Gaps" value={`${gapsNow.length}`} color={gapsNow.length ? UrgencyColors.medium : undefined} onPress={() => router.push('/safety/coverage')} />
        <Kpi label="No-shows" value={`${noShows}`} color={noShows ? UrgencyColors.critical : undefined} />
      </View>

      {alerts.map((n) => (
        <Card key={n.id} onPress={() => router.push(n.kind === 'coverage' ? '/safety/placement' : '/safety/map')} style={{ borderLeftWidth: 5, borderLeftColor: n.kind === 'offsite' ? UrgencyColors.critical : UrgencyColors.medium }}>
          <Txt variant="heading" style={{ fontSize: 15 }}>{n.title}</Txt>
          <Txt variant="caption">{n.body}</Txt>
        </Card>
      ))}

      <Row style={{ justifyContent: 'space-between' }}>
        <InboxButton />
      </Row>

      <Section title={`Needs a decision (${decide.length})`}>
        {decide.length === 0 ? (
          <EmptyState title="All clear" body="New incidents appear here with an AI-suggested response for you to approve." />
        ) : (
          decide.map((i) => <IncidentRow key={i.id} incident={i} now={now} links={links} />)
        )}
      </Section>

      {progress.length > 0 && (
        <Section title={`Responders dispatched (${progress.length})`}>
          {progress.map((i) => (
            <IncidentRow key={i.id} incident={i} now={now} links={links} />
          ))}
        </Section>
      )}

      {closed.length > 0 && (
        <Section title={`Closed (${closed.length})`}>
          {closed.map((i) => (
            <IncidentRow key={i.id} incident={i} now={now} links={links} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function Kpi({ label, value, color, onPress }: { label: string; value: string; color?: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={onPress} style={[styles.kpi, color ? { borderColor: color, borderWidth: 1.5 } : undefined]}>
      <Txt variant="title" color={color ?? t.text} style={{ fontSize: 26 }}>{value}</Txt>
      <Txt variant="caption" numberOfLines={1}>{label}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: Spacing.two },
  kpi: { flex: 1, padding: 10, gap: 0, borderRadius: Radius.md },
});
