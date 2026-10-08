import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { CandidateLine, DispatchProgress, firstName, IncidentLog, PlanEditor, PlanView, ReportSummary, STATUS_LABEL } from '@/components/incident/parts';
import { SiteMap } from '@/components/map/site-map';
import { Glyph } from '@/components/ui/glyph';
import { Appear, Banner, Button, Card, Pill, Row, Screen, Section, Txt, UrgencyPill } from '@/components/ui/primitives';
import { settle } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { canApprove, canResolveLinks, escalationUnlocksAt, pendingLinksFor } from '@/domain/escalation';
import { INCIDENT_TYPE_LABELS, type ResponsePlan } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { approveAndBrief } from '@/state/pipeline';
import { formatClock, reopenIncident, resolveIncident, useStore, zoneById } from '@/state/store';

/**
 * One incident, top to bottom in the order you need it:
 * what happened → where → who to send → approve.
 */
export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const now = useSimNow(500);
  const incident = useStore((s) => s.incidents.find((i) => i.id === id));
  const incidents = useStore((s) => s.incidents);
  const links = useStore((s) => s.links);
  const dispatches = useStore((s) => s.dispatches);
  const user = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId] : undefined));
  const [editing, setEditing] = useState(false);
  // Mo's edits to the AI's wording, tied to the suggestion they were made on.
  const [draft, setDraft] = useState<{ base: ResponsePlan; plan: ResponsePlan } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!sentTo) return;
    const id = setTimeout(() => setSentTo(null), 1800);
    return () => clearTimeout(id);
  }, [sentTo]);

  if (!incident || !user) {
    return (
      <Screen edges={[]}>
        <Txt variant="heading">This incident isn’t here any more.</Txt>
        <Button title="Go back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const zone = zoneById(incident.zoneId);
  const isLead = user.role !== 'volunteer';
  const check = canApprove(user, incident, links, now);
  const pending = pendingLinksFor(incident.id, links);
  const mine = dispatches.filter((d) => d.incidentId === incident.id);
  const awaiting = incident.status === 'suggested' || incident.status === 'no_suggestion';

  // The AI's plan, or Mo's edited copy of it if they've changed the wording.
  const plan = draft && draft.base === incident.suggestion ? draft.plan : incident.suggestion;
  const edited = !!draft && draft.base === incident.suggestion;

  const doApprove = (plan: Parameters<typeof approveAndBrief>[1]) => {
    const err = approveAndBrief(incident.id, plan);
    if (err) {
      Alert.alert('Can’t send yet', err);
      return;
    }
    setEditing(false);
    const names = plan.assignments.map((a) => firstName(useStore.getState().volunteers[a.volunteerId]?.name));
    setSentTo(names.join(' and '));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const unlocksAt = escalationUnlocksAt(incident);
  const secondsLeft = Math.max(0, Math.ceil((unlocksAt - now) / 1000));
  const leadWaiting = user.role === 'location_lead' && awaiting && secondsLeft > 0;

  // The AI can flag a possible duplicate while you're down here at the Approve button,
  // and that card appears at the top, out of sight. Point to it.
  const dupHint = pending.length > 0 && (
    <Pressable onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })} accessibilityRole="button" hitSlop={6}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Glyph name="link" size={20} color={t.ai} />
        <Txt variant="label" color={t.ai} style={{ flex: 1 }}>
          This might be the same as another report. Tap to see it at the top.
        </Txt>
      </Row>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
    <Screen edges={[]} scrollRef={scroll}>
      <Stack.Screen options={{ title: incident.ref }} />

      <View style={{ gap: Spacing.two }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <UrgencyPill urgency={incident.urgency} />
          <Txt variant="caption">{formatClock(incident.createdAt)}</Txt>
        </Row>
        <Txt variant="title">{INCIDENT_TYPE_LABELS[incident.type]}</Txt>
        <Txt variant="label">{isLead ? STATUS_LABEL[incident.status] : 'Thanks — the safety lead has this.'}</Txt>
      </View>

      {incident.status === 'merged' && incident.mergedInto && (
        <Banner tone="info" title="Merged with another report">
          <Button
            title="Open the main report"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/incident/[id]', params: { id: incident.mergedInto! } })}
          />
        </Banner>
      )}

      {isLead &&
        pending.map((l) => {
          const otherId = l.a === incident.id ? l.b : l.a;
          const other = incidents.find((i) => i.id === otherId);
          const otherReporter = useStore.getState().volunteers[other?.reporterId ?? ''];
          return (
            <Appear key={l.id}>
            <Card tone="ai">
              <Row style={{ alignItems: 'flex-start' }}>
                <Glyph name="link" size={26} color={t.ai} />
                <View style={{ flex: 1, gap: Spacing.one }}>
                  <Txt variant="heading">This might be the same as {firstName(otherReporter?.name)}’s report</Txt>
                  <Txt variant="body">{l.reason}</Txt>
                  {l.source === 'ai' && (
                    <Txt variant="label" color={t.ai}>
                      AI: {Math.round(l.confidence * 100)}% likely the same
                    </Txt>
                  )}
                </View>
              </Row>
              <Button
                title="Compare side by side"
                variant="secondary"
                onPress={() => router.push({ pathname: '/incident/compare', params: { link: l.id } })}
              />
              {!canResolveLinks(user, incident, now) && <Txt variant="caption">The safety lead decides this first.</Txt>}
            </Card>
            </Appear>
          );
        })}

      <Card>
        <Row>
          <Glyph name="sparkle" size={18} color={incident.structuredBy === 'ai' ? t.ai : t.textSecondary} />
          <Txt variant="label" color={incident.structuredBy === 'ai' ? t.ai : undefined}>
            {incident.structuredBy === 'ai' ? 'Written up by AI from the report' : 'Written up by hand'}
          </Txt>
        </Row>
        <ReportSummary incident={incident} />
      </Card>

      {incidents
        .filter((i) => i.mergedInto === incident.id)
        .map((dup) => (
          <Card key={dup.id}>
            <Txt variant="label">Also reported</Txt>
            <ReportSummary incident={dup} compact />
          </Card>
        ))}

      <View style={{ gap: Spacing.two }}>
        <SiteMap
          focus={{
            center: incident.location,
            radius: Math.max(90, ...mine.map((d) => d.distanceM * 0.75), ...incident.candidates.slice(0, 2).map((c) => c.distanceM * 0.8)),
          }}
          height={240}
          interactive={false}
          highlightIds={awaiting ? incident.suggestion?.assignments.map((a) => a.volunteerId) ?? incident.candidates.slice(0, 1).map((c) => c.volunteerId) : mine.map((d) => d.volunteerId)}
          pathDispatchIds={mine.map((d) => d.id)}
          focusIncidentIds={[incident.id]}
        />
        <Txt variant="caption">
          {zone?.name}
          {incident.locationNote ? ` · ${incident.locationNote}` : ''}
        </Txt>
      </View>

      {isLead && incident.status === 'logged' && (
        <Card>
          <Row>
            <ActivityIndicator color={t.ai} />
            <Txt variant="body" style={{ flex: 1 }}>
              Finding the nearest free people with the right skills…
            </Txt>
          </Row>
          {incident.candidates.slice(0, 2).map((c) => (
            <CandidateLine key={c.volunteerId} c={c} />
          ))}
        </Card>
      )}

      {isLead && awaiting && (
        <Section
          title={incident.status === 'suggested' && !editing ? 'Suggested response' : 'Who should go?'}
          right={
            incident.status === 'suggested' ? (
              <Pressable hitSlop={10} onPress={() => setEditing((e) => !e)}>
                <Txt variant="label" color={t.accent}>
                  {editing ? 'Use suggestion' : 'Change'}
                </Txt>
              </Pressable>
            ) : undefined
          }>
          {incident.status === 'no_suggestion' && (
            <Txt variant="caption">The AI couldn’t suggest a response this time, so pick who to send. The nearest match is already ticked.</Txt>
          )}
          {leadWaiting && (
            <Banner
              tone="info"
              title={`Mo has ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} to respond`}
              body={`If the safety lead hasn’t approved within ${incident.urgency === 'critical' ? '30 seconds' : '2 minutes'}, you can. It’s logged and they’re told.`}
            />
          )}
          {incident.status === 'suggested' && !editing && incident.suggestion ? (
            <Appear>
            <Card tone="ai">
              <Row>
                <Glyph name="sparkle" size={18} color={t.ai} />
                <Txt variant="label" color={t.ai} style={{ flex: 1 }}>
                  AI suggestion · you decide
                </Txt>
                {edited && <Pill label="Edited" tone="accent" />}
              </Row>
              <PlanView plan={plan!} candidates={incident.candidates} onChange={(p) => setDraft({ base: incident.suggestion!, plan: p })} />
              {dupHint}
              <Button
                title={
                  check.allowed
                    ? `Approve and send ${plan!.assignments.length === 1 ? '1 person' : `${plan!.assignments.length} people`}`
                    : check.reason
                }
                size="lg"
                icon={check.allowed ? <Glyph name="check" size={22} color="#FFFFFF" strokeWidth={3} /> : undefined}
                disabled={!check.allowed}
                onPress={() =>
                  doApprove(
                    edited
                      ? { ...plan!, source: 'manual', authorId: user.id, reasoning: `${plan!.reasoning} (Wording edited by ${firstName(user.name)} before sending.)` }
                      : plan!,
                  )
                }
              />
              {check.allowed && check.escalated && (
                <Txt variant="caption">You’re approving as location lead. This is logged and Mo is told.</Txt>
              )}
            </Card>
            </Appear>
          ) : (
            <Card tone="strong">
              {dupHint}
              <PlanEditor
                incident={incident}
                initial={editing ? incident.suggestion : undefined}
                authorId={user.id}
                disabled={!check.allowed}
                submitLabel={check.allowed ? 'Approve and send' : check.reason}
                onSubmit={doApprove}
              />
            </Card>
          )}
        </Section>
      )}

      {incident.approval && incident.approvedPlan && (
        <Section title="Response">
          <Card>
            <Txt variant="caption">
              Approved by {incident.approval.byName} at {formatClock(incident.approval.at)}
              {incident.approval.escalated ? ' (stepped in as location lead)' : ''}
            </Txt>
            {mine.map((d) => (
              <DispatchProgress key={d.id} d={d} />
            ))}
          </Card>
          {isLead && incident.status === 'approved' && (
            <View style={{ gap: Spacing.two }}>
              <Button title="Mark as resolved" onPress={() => resolveIncident(incident.id)} />
              {mine.some((d) => d.status === 'declined') && (
                <Button title="Send someone else" variant="secondary" onPress={() => reopenIncident(incident.id)} />
              )}
            </View>
          )}
        </Section>
      )}

      <Pressable onPress={() => setShowLog((v) => !v)} hitSlop={8}>
        <Txt variant="label" color={t.accent}>
          {showLog ? 'Hide history' : 'Show history'}
        </Txt>
      </Pressable>
      {showLog && <IncidentLog incidentId={incident.id} />}
    </Screen>
      {sentTo && (
        <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(320)} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.burstWrap, { backgroundColor: t.scrim }]}>
          <Animated.View entering={settle(60, 520)} style={[styles.burst, { backgroundColor: t.background }]}>
            <View style={[styles.burstCircle, { backgroundColor: t.success }]}>
              <Glyph name="check" size={56} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Txt variant="heading" center>
              Sent to {sentTo}
            </Txt>
            <Txt variant="caption" center>
              Their phone is telling them where to go.
            </Txt>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  burstWrap: { alignItems: 'center', justifyContent: 'center' },
  burst: { width: 280, borderRadius: 32, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  burstCircle: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
});
