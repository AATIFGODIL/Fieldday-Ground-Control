import { router } from 'expo-router';
import { View } from 'react-native';

import { DispatchProgress, IncidentRow } from '@/components/incident/parts';
import { Glyph } from '@/components/ui/glyph';
import { Appear, Button, Card, EmptyState, Header, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { gapsAt } from '@/domain/coverage';
import { INCIDENT_TYPE_LABELS, SKILL_LABELS, URGENCY_RANK, type Incident } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, markNoticeRead, markNoticesRead, useStore, zoneById } from '@/state/store';

const needsDecision = (i: Incident) => i.status === 'logged' || i.status === 'suggested' || i.status === 'no_suggestion';

/** Mo's home: only the things that need a decision, most urgent first. */
export default function Now() {
  const t = useTheme();
  const now = useSimNow(1000);
  const incidents = useStore((s) => s.incidents);
  const links = useStore((s) => s.links);
  const volunteers = useStore((s) => s.volunteers);
  const festival = useStore((s) => s.festival);
  const temperature = useStore((s) => s.temperatureC);
  const notices = useStore((s) => s.notices);
  const dispatches = useStore((s) => s.dispatches);
  const me = useStore((s) => s.currentUserId);

  const all = Object.values(volunteers);
  const onShift = all.filter((v) => v.status === 'checked_in').length;
  const noShows = all.filter((v) => v.status === 'no_show');
  const gaps = gapsAt(festival, all, now);
  const offsite = notices.filter((n) => n.to === me && n.kind === 'offsite' && !n.read);
  const steppedIn = notices.filter((n) => n.to === me && n.kind === 'escalated_approval' && !n.read);

  const byPriority = (a: Incident, b: Incident) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] || a.createdAt - b.createdAt;
  const decide = incidents.filter(needsDecision).sort(byPriority);
  const moving = incidents.filter((i) => i.status === 'approved').sort(byPriority);
  const closed = incidents.filter((i) => i.status === 'resolved' || i.status === 'merged');
  const allClear = decide.length === 0 && gaps.length === 0 && offsite.length === 0;

  return (
    <Screen tabs>
      <Header
        eyebrow="Mo · Safety lead"
        title="Now"
        subtitle={`${formatClock(now)} · ${temperature}°C · ${onShift} volunteers on shift`}
      />

      {allClear && (
        <Appear>
        <Card>
          <EmptyState
            title="All clear"
            body="When someone reports something, it shows up here with a suggested response. Nobody is sent until you approve."
          />
        </Card>
        </Appear>
      )}

      {steppedIn.map((n) => (
        <Appear key={n.id}>
          <Card tone="strong">
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph name="users" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, gap: Spacing.one }}>
                <Txt variant="heading">Someone stepped in for you</Txt>
                <Txt variant="body">{n.title}.</Txt>
                <Txt variant="caption">{n.body}</Txt>
              </View>
            </Row>
            <Row>
              {n.incidentId && (
                <Button
                  title="See what was sent"
                  style={{ flex: 1 }}
                  onPress={() => router.push({ pathname: '/incident/[id]', params: { id: n.incidentId! } })}
                />
              )}
              <Button title="Got it" variant="secondary" style={{ flex: 1 }} onPress={() => markNoticeRead(n.id)} />
            </Row>
          </Card>
        </Appear>
      ))}

      {decide.length > 0 && (
        <Section title={decide.length === 1 ? 'Needs you' : `Needs you · ${decide.length}`}>
          {decide.map((i, n) => (
            <Appear key={i.id} index={n}>
              <IncidentRow incident={i} now={now} links={links} />
            </Appear>
          ))}
        </Section>
      )}

      {(gaps.length > 0 || offsite.length > 0) && (
        <Section title="Staffing">
          {gaps.map((g, n) => {
            const missing = noShows.filter((v) => v.zoneId === g.zoneId);
            return (
              <Appear key={`${g.zoneId}-${g.skill}`} index={n}>
              <Card tone="alert">
                <Row style={{ alignItems: 'flex-start' }}>
                  <Glyph name="users" size={26} color={t.critical} />
                  <View style={{ flex: 1, gap: Spacing.one }}>
                    <Txt variant="heading">{g.zoneName} is short</Txt>
                    <Txt variant="body">
                      Has {g.have} of {g.required} {g.skill ? SKILL_LABELS[g.skill].toLowerCase() : 'volunteers'} needed
                      {g.skill === 'first_aid' ? ' in this heat' : ''}.
                    </Txt>
                    {missing.length > 0 && (
                      <Txt variant="caption">
                        {missing.map((v) => v.name.split(' ')[0]).join(' and ')} didn’t check in.
                      </Txt>
                    )}
                  </View>
                </Row>
                <Button title="Find cover" onPress={() => router.push({ pathname: '/safety/staff', params: { zone: g.zoneId, at: String(Date.now()) } })} />
              </Card>
              </Appear>
            );
          })}
          {offsite.map((n) => (
            <Appear key={n.id}>
            <Card tone="alert">
              <Row style={{ alignItems: 'flex-start' }}>
                <Glyph name="alert" size={26} color={t.critical} />
                <View style={{ flex: 1, gap: Spacing.one }}>
                  <Txt variant="heading">{n.title}</Txt>
                  <Txt variant="body">{n.body}</Txt>
                </View>
              </Row>
              <Button
                title="Got it"
                variant="outline"
                onPress={() => {
                  if (me) markNoticesRead(me);
                }}
              />
            </Card>
            </Appear>
          ))}
        </Section>
      )}

      {moving.length > 0 && (
        <Section title="On the way">
          {moving.map((i) => (
            <Appear key={i.id}>
            <Card onPress={() => router.push({ pathname: '/incident/[id]', params: { id: i.id } })}>
              <Txt variant="strong">
                {INCIDENT_TYPE_LABELS[i.type]} · {zoneById(i.zoneId)?.name}
              </Txt>
              {dispatches
                .filter((d) => d.incidentId === i.id)
                .map((d) => (
                  <DispatchProgress key={d.id} d={d} />
                ))}
            </Card>
            </Appear>
          ))}
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Done">
          {closed.map((i) => (
            <IncidentRow key={i.id} incident={i} now={now} links={links} />
          ))}
        </Section>
      )}
    </Screen>
  );
}
