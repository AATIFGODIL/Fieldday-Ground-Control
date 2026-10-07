import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SiteMap } from '@/components/map/site-map';
import { Glyph } from '@/components/ui/glyph';
import { PulseRings, SoundBars } from '@/components/ui/motion';
import { Button, Card, Row, Screen, Txt } from '@/components/ui/primitives';
import { rise, settle } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { briefLevelForDistance } from '@/domain/brief';
import { centroid, compassDirection, dist } from '@/domain/geo';
import { WALK_SPEED_MPS } from '@/domain/matching';
import { INCIDENT_TYPE_LABELS, type BriefLevel } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { speak, stopSpeaking } from '@/services/speech';
import { setDispatchStatus, useStore, zoneById } from '@/state/store';

const LEVELS: { id: BriefLevel; label: string }[] = [
  { id: 'oneSentence', label: 'Short' },
  { id: 'locationAndExpect', label: 'Medium' },
  { id: 'full', label: 'Full' },
];

const WHY_LEVEL: Record<BriefLevel, string> = {
  oneSentence: 'Short brief — you’re under 100 m away.',
  locationAndExpect: 'Medium brief — you’re a few minutes away.',
  full: 'Full brief — you’ve got a longer walk.',
};

/**
 * "You're needed": where to go, in huge type, and a brief read out loud whose
 * length matches how far you have to walk.
 */
export default function DispatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const d = useStore((s) => s.dispatches.find((x) => x.id === id));
  const incident = useStore((s) => s.incidents.find((i) => i.id === d?.incidentId));
  const plan = incident?.approvedPlan;
  const movement = useStore((s) => (d ? s.movements[d.volunteerId] : undefined));
  const pos = useStore((s) => (d ? s.positions[d.volunteerId] : undefined));
  const me = useStore((s) => s.currentUserId);
  const reporter = useStore((s) => (incident ? s.volunteers[incident.reporterId] : undefined));

  const autoLevel: BriefLevel = d ? briefLevelForDistance(d.distanceM) : 'oneSentence';
  const [level, setLevel] = useState<BriefLevel>(autoLevel);
  const [speaking, setSpeaking] = useState(false);
  const autoPlayed = useRef(false);

  const play = (lvl: BriefLevel) => {
    if (!d?.brief) return;
    setLevel(lvl);
    setSpeaking(true);
    speak(d.brief[lvl], { onDone: () => setSpeaking(false) });
  };

  // Read the brief out as soon as it's ready — they're already walking.
  useEffect(() => {
    if (d?.brief && !autoPlayed.current && d.volunteerId === me && d.status !== 'declined') {
      autoPlayed.current = true;
      play(autoLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.brief]);

  useEffect(() => () => stopSpeaking(), []);

  if (!d || !incident || !plan) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Txt variant="heading">This call-out has finished.</Txt>
        <Button title="Close" onPress={() => router.back()} />
      </Screen>
    );
  }

  const zone = zoneById(incident.zoneId);
  const target = incident.location;
  const remaining =
    movement?.dispatchId === d.id ? Math.round(movement.total - movement.travelled) : pos ? Math.round(dist(pos, target)) : d.distanceM;
  const direction = compassDirection(pos ?? d.path[0], target);
  const eta = Math.max(1, Math.round(remaining / WALK_SPEED_MPS / 60));
  const isMine = d.volunteerId === me;
  const there = d.status === 'on_scene';
  const heroBg = there ? t.success : incident.urgency === 'critical' ? t.critical : t.accent;

  return (
    <Screen edges={['top', 'bottom']}>
      <Animated.View entering={settle()} style={[styles.hero, { backgroundColor: heroBg }]}>
        {!there && (
          <View style={styles.radar}>
            <PulseRings size={220} color="#FFFFFF" count={3} duration={2600} />
          </View>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label" color="#FFFFFF">
            {there ? 'You’re there' : 'You’re needed'}
          </Txt>
          <Pressable
            hitSlop={12}
            accessibilityLabel="Close"
            onPress={() => {
              stopSpeaking();
              router.back();
            }}>
            <Glyph name="x" size={28} color="#FFFFFF" />
          </Pressable>
        </Row>
        <Txt variant="hero" color="#FFFFFF">
          {zone?.name}
        </Txt>
        <Txt variant="body" color="#FFFFFF">
          {INCIDENT_TYPE_LABELS[incident.type]}
          {incident.locationNote ? ` · ${incident.locationNote}` : ''}
        </Txt>
        <Row gap={Spacing.five} style={{ marginTop: Spacing.two }}>
          <Stat label="Distance" value={there ? '0 m' : `${remaining} m`} />
          <Stat label="Head" value={direction.charAt(0).toUpperCase() + direction.slice(1)} />
          <Stat label="Time" value={there ? 'Now' : `${eta} min`} />
        </Row>
      </Animated.View>

      <Animated.View entering={rise(160)}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={Spacing.three}>
            <Txt variant="heading">Your brief</Txt>
            <SoundBars active={speaking} color={t.accent} height={24} />
          </Row>
          {d.brief && (
            <Pressable
              onPress={() => {
                if (speaking) {
                  stopSpeaking();
                  setSpeaking(false);
                } else play(level);
              }}
              accessibilityLabel={speaking ? 'Stop reading' : 'Read aloud'}
              style={({ pressed }) => [styles.play, { backgroundColor: t.accent, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
              <Glyph name={speaking ? 'stop' : 'volume'} size={26} color="#FFFFFF" />
            </Pressable>
          )}
        </Row>
        {d.briefPending || !d.brief ? (
          <Row>
            <ActivityIndicator color={t.ai} />
            <Txt variant="body">Getting your brief ready…</Txt>
          </Row>
        ) : (
          <>
            <Txt variant="body" style={{ fontSize: 21, lineHeight: 30 }} selectable>
              {d.brief[level]}
            </Txt>
            <Txt variant="caption">{WHY_LEVEL[autoLevel]}</Txt>
            <View style={[styles.segment, { backgroundColor: t.backgroundSelected }]}>
              {LEVELS.map((l) => {
                const on = l.id === level;
                return (
                  <Pressable key={l.id} onPress={() => play(l.id)} style={[styles.segItem, on && { backgroundColor: t.accent }]}>
                    <Txt variant="label" color={on ? '#FFFFFF' : t.textSecondary} style={{ fontWeight: on ? '800' : '600' }}>
                      {l.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </Card>
      </Animated.View>

      <SiteMap
        focus={{ center: centroid([d.path[0], target]), radius: Math.max(60, d.distanceM * 0.62) }}
        height={220}
        interactive={false}
        pathDispatchIds={[d.id]}
        focusIncidentIds={[incident.id]}
        highlightIds={[d.volunteerId]}
        showLabels
      />

      <Card>
        <Txt variant="label">What to do</Txt>
        <Txt variant="body">{d.message}</Txt>
        <Txt variant="label">Who to find</Txt>
        <Txt variant="body">{plan.whoToFind}</Txt>
        {reporter && (
          <Txt variant="caption">
            Reported by {reporter.name}
            {reporter.phone ? ` · ${reporter.phone}` : ''}
          </Txt>
        )}
      </Card>

      {isMine && d.status !== 'declined' && !there && (
        <View style={{ gap: Spacing.two }}>
          {d.status === 'notified' ? (
            <Button title="I’m on my way" size="lg" onPress={() => setDispatchStatus(d.id, 'acknowledged')} />
          ) : (
            <Button title="I’m there" size="lg" onPress={() => setDispatchStatus(d.id, 'on_scene')} />
          )}
          <Button
            title="I can’t go"
            variant="ghost"
            onPress={() => {
              stopSpeaking();
              setDispatchStatus(d.id, 'declined');
              router.back();
            }}
          />
        </View>
      )}
      {there && (
        <Card tone="strong" style={{ borderColor: t.success }}>
          <Row>
            <Glyph name="check" size={26} color={t.success} strokeWidth={3} />
            <Txt variant="strong" style={{ flex: 1 }}>
              You’ve arrived. Mo has been told.
            </Txt>
          </Row>
        </Card>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt variant="label" color="#FFFFFF" style={{ opacity: 0.8 }}>
        {label}
      </Txt>
      <Txt variant="heading" color="#FFFFFF">
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two, overflow: 'hidden' },
  radar: { position: 'absolute', right: -60, top: -50, width: 220, height: 220 },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: Radius.pill },
});
