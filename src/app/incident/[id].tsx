import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import {
  CandidateLine,
  DispatchProgress,
  IncidentLog,
  PlanEditor,
  PlanView,
  ReportSummary,
  STATUS_LABEL,
  statusColor,
} from '@/components/incident/parts';
import { SiteMap } from '@/components/map/site-map';
import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { UrgencyColors } from '@/constants/theme';
import { canApprove, canResolveLinks, escalationUnlocksAt, pendingLinksFor } from '@/domain/escalation';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { approveAndBrief } from '@/state/pipeline';
import { formatClock, reopenIncident, resolveIncident, useStore, zoneById } from '@/state/store';

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

  if (!incident || !user) {
    return (
      <Screen edges={[]}>
        <Txt variant="heading">Incident not found.</Txt>
      </Screen>
    );
  }

  const zone = zoneById(incident.zoneId);
  const isLead = user.role !== 'volunteer';
  const check = canApprove(user, incident, links, now);
  const pending = pendingLinksFor(incident.id, links);
  const myDispatches = dispatches.filter((d) => d.incidentId === incident.id);
  const awaiting = incident.status === 'suggested' || incident.status === 'no_suggestion';

  const doApprove = (plan: Parameters<typeof approveAndBrief>[1]) => {
    const err = approveAndBrief(incident.id, plan);
    if (err) Alert.alert("Can't approve", err);
    else setEditing(false);
  };

  // Location lead countdown before they may step in.
  const unlocksAt = escalationUnlocksAt(incident);
  const secondsLeft = Math.max(0, Math.ceil((unlocksAt - now) / 1000));
  const leadWaiting = user.role === 'location_lead' && awaiting && secondsLeft > 0;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: incident.ref }} />

      <Row style={{ justifyContent: 'space-between' }}>
        <Pill label={STATUS_LABEL[incident.status].toUpperCase()} color={statusColor(incident.status)} solid />
        <Txt variant="caption">{zone?.name} · logged {formatClock(incident.createdAt)}</Txt>
      </Row>

      {incident.status === 'merged' && incident.mergedInto && (
        <Banner tone="info" title="Merged as a duplicate">
          <Button
            title={`Open ${incidents.find((i) => i.id === incident.mergedInto)?.ref}`}
            size="sm"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/incident/[id]', params: { id: incident.mergedInto! } })}
          />
        </Banner>
      )}

      {pending.map((l) => {
        const otherId = l.a === incident.id ? l.b : l.a;
        const other = incidents.find((i) => i.id === otherId);
        return (
          <Banner
            key={l.id}
            tone="danger"
            title={`Possibly the same event as ${other?.ref}`}
            body={`${l.source === 'ai' ? `AI · ${Math.round(l.confidence * 100)}% likely same` : 'Rule-based (AI check unavailable)'} — ${l.reason}`}>
            <Row style={{ marginTop: 6 }}>
              <Button
                title="Compare side by side"
                size="sm"
                onPress={() => router.push({ pathname: '/incident/compare', params: { link: l.id } })}
              />
            </Row>
            {isLead && !canResolveLinks(user, incident, now) && (
              <Txt variant="caption">The safety lead must review this before any response is approved.</Txt>
            )}
          </Banner>
        );
      })}

      <Card>
        <ReportSummary incident={incident} />
      </Card>

      {incidents
        .filter((i) => i.mergedInto === incident.id)
        .map((dup) => (
          <Card key={dup.id} onPress={() => router.push({ pathname: '/incident/[id]', params: { id: dup.id } })}>
            <Txt variant="label">ALSO REPORTED · {dup.ref} (MERGED)</Txt>
            <ReportSummary incident={dup} compact />
          </Card>
        ))}

      <SiteMap
        focus={{ center: incident.location, radius: Math.max(90, ...myDispatches.map((d) => d.distanceM * 0.75), ...incident.candidates.slice(0, 2).map((c) => c.distanceM * 0.8)) }}
        height={220}
        interactive={false}
        highlightIds={awaiting ? incident.candidates.map((c) => c.volunteerId) : myDispatches.map((d) => d.volunteerId)}
        pathDispatchIds={myDispatches.map((d) => d.id)}
        focusIncidentIds={[incident.id]}
      />

      {isLead && incident.status === 'logged' && (
        <Card>
          <Row>
            <ActivityIndicator />
            <Txt variant="body">Drafting a suggested response from the nearest skill-matched volunteers…</Txt>
          </Row>
          {incident.candidates.map((c) => (
            <CandidateLine key={c.volunteerId} c={c} />
          ))}
        </Card>
      )}

      {isLead && awaiting && (
        <Section
          title={incident.status === 'suggested' && !editing ? 'AI-suggested response · needs human approval' : 'Write the response'}
          right={
            incident.status === 'suggested' ? (
              <Button title={editing ? 'Use AI plan' : 'Edit'} variant="ghost" size="sm" onPress={() => setEditing((e) => !e)} />
            ) : undefined
          }>
          {incident.status === 'no_suggestion' && (
            <Banner tone="warn" title="No AI suggestion — a human must write this response" body={incident.suggestionFailReason} />
          )}
          {leadWaiting && (
            <Banner
              tone="info"
              title={`Waiting for the safety lead · you can approve in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
              body={`Location leads can step in if there's no safety-lead response within ${incident.urgency === 'critical' ? '30 seconds (critical)' : '2 minutes'}. Your approval is logged and the safety lead is notified.`}
            />
          )}
          {incident.status === 'suggested' && !editing && incident.suggestion ? (
            <Card style={{ borderColor: t.tint, borderWidth: 1.5 }}>
              <PlanView plan={incident.suggestion} candidates={incident.candidates} />
              <Button
                title={check.allowed ? `Approve & dispatch ${incident.suggestion.assignments.length}` : check.reason}
                size="lg"
                variant={incident.urgency === 'critical' ? 'danger' : 'primary'}
                disabled={!check.allowed}
                onPress={() => doApprove(incident.suggestion!)}
              />
              {check.allowed && check.escalated && (
                <Txt variant="caption" color={UrgencyColors.high}>You are approving as location lead; this is logged and the safety lead will be notified.</Txt>
              )}
            </Card>
          ) : (
            <Card>
              <PlanEditor
                incident={incident}
                initial={editing ? incident.suggestion : undefined}
                authorId={user.id}
                disabled={!check.allowed}
                submitLabel={check.allowed ? 'Approve & dispatch' : check.reason}
                onSubmit={doApprove}
              />
            </Card>
          )}
        </Section>
      )}

      {incident.approval && incident.approvedPlan && (
        <Section title="Response">
          <Card>
            <Row style={{ flexWrap: 'wrap' }}>
              <Pill label={incident.approvedPlan.source === 'ai' ? 'AI PLAN' : 'HUMAN PLAN'} />
              <Txt variant="caption">
                Approved by {incident.approval.byName} at {formatClock(incident.approval.at)}
                {incident.approval.escalated ? ' (location lead, escalated)' : ''}
              </Txt>
            </Row>
            {myDispatches.map((d) => (
              <DispatchProgress key={d.id} d={d} />
            ))}
            <Txt variant="caption">
              <Txt variant="caption" style={{ fontWeight: '800' }}>Expect: </Txt>
              {incident.approvedPlan.whatToExpect}
            </Txt>
          </Card>
          {isLead && incident.status === 'approved' && (
            <Row>
              <Button title="Mark resolved" style={{ flex: 1 }} onPress={() => resolveIncident(incident.id)} />
              {myDispatches.some((d) => d.status === 'declined') && (
                <Button title="Choose new responder" variant="secondary" style={{ flex: 1 }} onPress={() => reopenIncident(incident.id)} />
              )}
            </Row>
          )}
        </Section>
      )}

      {!isLead && (
        <Card>
          <Txt variant="caption">
            Thanks for reporting. The safety lead has been notified
            {incident.status === 'approved' ? ' and responders are on their way.' : '.'}
          </Txt>
        </Card>
      )}

      <Section title="Activity">
        <IncidentLog incidentId={incident.id} />
      </Section>
    </Screen>
  );
}
