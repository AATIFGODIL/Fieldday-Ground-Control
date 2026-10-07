import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { IncidentRow } from '@/components/incident/parts';
import { ShiftCard } from '@/components/shift-card';
import { Glyph } from '@/components/ui/glyph';
import { Breathe, PulseRings } from '@/components/ui/motion';
import { Appear, Banner, Button, Card, Header, Row, Screen, Section, Tappable, Txt } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { INCIDENT_TYPE_LABELS } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { markNoticeRead, useStore, zoneById } from '@/state/store';

/** A volunteer's home: am I needed, how do I report, am I on shift. */
export default function VolunteerHome() {
  const t = useTheme();
  const { reported } = useLocalSearchParams<{ reported?: string }>();
  const now = useSimNow(5000);
  const me = useStore((s) => s.volunteers[s.currentUserId!]);
  const dispatches = useStore((s) => s.dispatches);
  const incidents = useStore((s) => s.incidents);
  const links = useStore((s) => s.links);
  // Read the raw list and filter here: a selector that builds a new array makes the store look changed on every render.
  const notices = useStore((s) => s.notices);
  if (!me) return null;
  const moved = notices.filter((n) => n.to === me.id && n.kind === 'moved' && !n.read).slice(0, 1);

  const active = dispatches.filter((d) => d.volunteerId === me.id && (d.status === 'notified' || d.status === 'acknowledged'));
  const mine = incidents.filter((i) => i.reporterId === me.id);

  return (
    <Screen tabs>
      <Header eyebrow={`Volunteer · ${zoneById(me.zoneId)?.name ?? 'Unassigned'}`} title={`Hi ${me.name.split(' ')[0]}`} />

      {reported && mine.some((i) => i.ref === reported) && (
        <Banner tone="ok" title="Report sent" body="Mo, the safety lead, has it. You’ll see here when help is on the way." />
      )}

      {active.map((d) => {
        const inc = incidents.find((i) => i.id === d.incidentId);
        if (!inc) return null;
        return (
          <Appear key={d.id}>
          <Card
            style={{ backgroundColor: inc.urgency === 'critical' ? t.critical : t.accent, borderColor: 'transparent', overflow: 'hidden' }}
            onPress={() => router.push({ pathname: '/dispatch/[id]', params: { id: d.id } })}>
            <View style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160 }}>
              <PulseRings size={160} color="#FFFFFF" count={2} />
            </View>
            <Txt variant="label" color="#FFFFFF">
              You’re needed
            </Txt>
            <Txt variant="title" color="#FFFFFF">
              {zoneById(inc.zoneId)?.name}
            </Txt>
            <Txt variant="body" color="#FFFFFF">
              {INCIDENT_TYPE_LABELS[inc.type]}. {d.status === 'acknowledged' ? 'You’re on your way.' : 'Tap to see where to go.'}
            </Txt>
          </Card>
          </Appear>
        );
      })}

      {moved.map((n) => (
        <Appear key={n.id}>
          <Card tone="strong">
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph name="pin" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, gap: Spacing.one }}>
                <Txt variant="heading">{n.title}</Txt>
                <Txt variant="body">{n.body}</Txt>
              </View>
            </Row>
            <Row>
              <Button title="Show me on the map" style={{ flex: 1 }} onPress={() => router.push('/volunteer/map')} />
              <Button title="Got it" variant="secondary" style={{ flex: 1 }} onPress={() => markNoticeRead(n.id)} />
            </Row>
          </Card>
        </Appear>
      ))}

      <Tappable onPress={() => router.push('/volunteer/report')} accessibilityLabel="Report something">
        <View style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four, borderRadius: 28, backgroundColor: t.backgroundElement }}>
          <Breathe>
            <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Glyph name="mic" size={48} color="#FFFFFF" />
            </View>
          </Breathe>
          <View style={{ alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.four }}>
            <Txt variant="heading" center>
              Report something
            </Txt>
            <Txt variant="caption" center>
              Just say what you see. We’ll write it up for you.
            </Txt>
          </View>
        </View>
      </Tappable>

      <ShiftCard volunteerId={me.id} />

      {mine.length > 0 && (
        <Section title="Your reports">
          {mine.map((i, n) => (
            <Appear key={i.id} index={n}>
              <IncidentRow incident={i} now={now} links={links} />
            </Appear>
          ))}
        </Section>
      )}

      <Row style={{ justifyContent: 'center' }}>
        <Button title="Change my availability" variant="ghost" onPress={() => router.push('/tools/shift')} />
      </Row>
    </Screen>
  );
}
