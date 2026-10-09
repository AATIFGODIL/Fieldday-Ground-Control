import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { apiBaseUrl, api } from '@/api/client';
import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { Radius, RoleColors, Spacing } from '@/constants/theme';
import { ROLE_LABELS } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { SCENARIOS, type ScenarioId, type ScenarioStep } from '@/sim/scenarios';
import { DEMO_IDENTITIES } from '@/sim/seed/roster';
import { runScriptedReport } from '@/state/pipeline';
import { startTour } from '@/state/tour';
import {
  setAppearance,
  type Appearance,
  formatClock,
  declineLatestDispatch,
  markStepDone,
  resetScenario,
  safetyLeadId,
  setAIChaos,
  setMode,
  setScriptedTranscript,
  setSpeed,
  signInAs,
  startWander,
  triggerNoShows,
  useStore,
  type AIChaos,
} from '@/state/store';

function goHome(href: Href = '/') {
  router.dismissAll();
  router.replace(href);
}

export default function Demo() {
  const t = useTheme();
  const s = {
    scenarioId: useStore((x) => x.scenarioId),
    completedSteps: useStore((x) => x.completedSteps),
    volunteers: useStore((x) => x.volunteers),
    currentUserId: useStore((x) => x.currentUserId),
    clock: useStore((x) => x.clock),
    temperatureC: useStore((x) => x.temperatureC),
    mode: useStore((x) => x.mode),
    aiChaos: useStore((x) => x.aiChaos),
  };
  const appearance = useStore((x) => x.appearance);
  const now = useSimNow(1000);
  const scenario = SCENARIOS[s.scenarioId];
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; hasKey?: boolean } | null>(null);

  useEffect(() => {
    void api.health().then(setHealth);
  }, []);

  const switchTo = (id: string, href: Href = '/') => {
    signInAs(id);
    goHome(href);
  };

  const runStep = async (step: ScenarioStep, auto: boolean) => {
    if (step.kind === 'no_show') {
      triggerNoShows(step.volunteerIds);
      markStepDone(step.id);
    } else if (step.kind === 'wander') {
      startWander(step.volunteerId);
      markStepDone(step.id);
    } else if (step.kind === 'decline') {
      if (declineLatestDispatch()) markStepDone(step.id);
    } else if (step.kind === 'report') {
      if (auto) {
        setBusy(step.id);
        await runScriptedReport(step);
        setBusy(null);
        markStepDone(step.id);
      } else {
        setScriptedTranscript(step.transcript);
        markStepDone(step.id);
        switchTo(step.reporterId, '/volunteer/report');
      }
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title">Demo</Txt>
        <Button title="Done" variant="secondary" size="sm" onPress={() => router.back()} />
      </Row>

      <Section title="Guided stories">
        <Card onPress={() => startTour('heat')}>
          <Txt variant="heading">Heat collapse</Txt>
          <Txt variant="caption">Two first-aiders don’t show. Someone collapses at the water station. Follow it from report to rescue.</Txt>
        </Card>
        <Card onPress={() => startTour('fight')}>
          <Txt variant="heading">Same fight, reported twice</Txt>
          <Txt variant="caption">Two volunteers report what might be one fight. See how Ground Control stops a double response.</Txt>
        </Card>
        <Card onPress={() => startTour('busy')}>
          <Txt variant="heading">When Mo is busy</Txt>
          <Txt variant="caption">A critical report and no answer from Mo. After 30 seconds the location lead can step in, and it’s logged.</Txt>
        </Card>
        <Card onPress={() => startTour('decline')}>
          <Txt variant="heading">When a volunteer can’t go</Txt>
          <Txt variant="caption">The person sent says no. Ground Control lines up the next nearest first-aider and Mo approves them in one tap.</Txt>
        </Card>
      </Section>

      {health && !health.ok && (
        <Banner tone="warn" title="AI server unreachable" body={`Tried ${apiBaseUrl()}. AI steps will use their fallbacks (manual form, rule-based flags, template briefs). Start it with "npm run server".`} />
      )}
      {health?.ok && !health.hasKey && (
        <Banner tone="warn" title="AI server has no API key" body="Add ANTHROPIC_API_KEY to server/.env. Until then every AI step uses its fallback." />
      )}

      <Section title="Appearance">
        <Segmented
          value={appearance}
          options={[
            ['system', 'Phone'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ]}
          onChange={(v) => setAppearance(v as Appearance)}
        />
        <Txt variant="caption">“Phone” follows your phone’s light or dark setting.</Txt>
      </Section>

      <Section title="Free play">
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
          const sc = SCENARIOS[id];
          const active = id === s.scenarioId;
          return (
            <Card key={id} style={active ? { borderColor: t.tint, borderWidth: 2 } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{sc.title}</Txt>
                  <Txt variant="caption">{sc.subtitle}</Txt>
                </View>
                <Button
                  title={active ? 'Restart' : 'Load'}
                  size="sm"
                  variant={active ? 'secondary' : 'primary'}
                  onPress={() => {
                    resetScenario(id);
                    goHome();
                  }}
                />
              </Row>
            </Card>
          );
        })}
      </Section>

      <Section title={`Events · ${scenario.title}`}>
        {scenario.steps.map((step, i) => {
          const done = s.completedSteps[step.id];
          return (
            <Card key={step.id}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="heading" style={{ fontSize: 16 }}>
                    {i + 1}. {step.label}
                  </Txt>
                  <Txt variant="caption">{step.detail}</Txt>
                </View>
                {done && <Pill label="DONE" color={t.tint} />}
              </Row>
              <Row style={{ flexWrap: 'wrap' }}>
                {step.kind === 'report' ? (
                  <>
                    <Button
                      size="sm"
                      title={`Report as ${s.volunteers[step.reporterId]?.name.split(' ')[0]}`}
                      onPress={() => runStep(step, false)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      title="Auto-submit"
                      loading={busy === step.id}
                      onPress={() => runStep(step, true)}
                    />
                  </>
                ) : (
                  <Button size="sm" title="Trigger" onPress={() => runStep(step, false)} />
                )}
              </Row>
            </Card>
          );
        })}
      </Section>

      <Section title="Be someone else">
        <View style={styles.grid}>
          {DEMO_IDENTITIES.map((id) => {
            const v = s.volunteers[id];
            if (!v) return null;
            const me = id === s.currentUserId;
            return (
              <Pressable
                key={id}
                onPress={() => switchTo(id)}
                style={[styles.person, { borderColor: me ? RoleColors[v.role] : t.border, backgroundColor: t.backgroundElement }]}>
                <View style={[styles.dot, { backgroundColor: RoleColors[v.role] }]} />
                <View style={{ flex: 1 }}>
                  <Txt variant="body" style={{ fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                    {v.name.split(' ')[0]}
                  </Txt>
                  <Txt variant="caption" numberOfLines={1} style={{ fontSize: 11 }}>
                    {ROLE_LABELS[v.role]}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button title="Someone else…" variant="ghost" onPress={() => goHome('/sign-in')} />
      </Section>

      <Section title={`Clock · ${formatClock(now)} · ${s.temperatureC}°C`}>
        <Segmented
          value={String(s.clock.speed)}
          options={[
            ['1', '×1'],
            ['5', '×5'],
            ['10', '×10'],
            ['30', '×30'],
          ]}
          onChange={(v) => setSpeed(Number(v))}
        />
        <Txt variant="caption">Speeds up walking dots, escalation windows and the off-site timer.</Txt>
      </Section>

      <Section title="Position source">
        <Segmented
          value={s.mode}
          options={[
            ['simulated', 'Simulated'],
            ['live', 'Live GPS'],
          ]}
          onChange={(v) => setMode(v as 'simulated' | 'live')}
        />
        <Txt variant="caption">
          Both feed the same position store, so matching and AI behave identically. Live GPS only tracks the signed-in
          person while they’re checked in.
        </Txt>
        <Button
          title="Drag volunteer dots on the map"
          variant="secondary"
          onPress={() => switchTo(safetyLeadId(), '/safety/map?operator=1')}
        />
      </Section>

      <Section title="AI behaviour">
        <Segmented
          value={s.aiChaos}
          options={[
            ['off', 'Normal'],
            ['timeout', 'Force timeout'],
            ['junk', 'Force bad output'],
          ]}
          onChange={(v) => setAIChaos(v as AIChaos)}
        />
        <Txt variant="caption">Shows the designed fallbacks: manual form, “needs manual response”, rule-based related flags and template briefs.</Txt>
      </Section>

      <Button title="Audit log" variant="secondary" onPress={() => router.push('/audit')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  person: { width: '31.5%', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: Radius.md, borderWidth: 1.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
