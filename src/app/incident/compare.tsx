import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { firstName, ReportSummary } from '@/components/incident/parts';
import { SiteMap } from '@/components/map/site-map';
import { Glyph } from '@/components/ui/glyph';
import { Banner, Button, Card, Row, Screen, Txt, UrgencyPill } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { canResolveLinks } from '@/domain/escalation';
import { centroid, dist } from '@/domain/geo';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, resolveLink, useStore } from '@/state/store';

/** Two reports that might be one event. A person decides before anyone is sent. */
export default function Compare() {
  const { link: linkId } = useLocalSearchParams<{ link: string }>();
  const t = useTheme();
  const now = useSimNow(1000);
  const link = useStore((s) => s.links.find((l) => l.id === linkId));
  const a = useStore((s) => s.incidents.find((i) => i.id === link?.a));
  const b = useStore((s) => s.incidents.find((i) => i.id === link?.b));
  const volunteers = useStore((s) => s.volunteers);
  const user = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId] : undefined));
  if (!link || !a || !b || !user) return null;

  const allowed = canResolveLinks(user, a, now) || canResolveLinks(user, b, now);
  const resolve = (r: 'same' | 'separate') => {
    const err = resolveLink(link.id, r);
    if (err) Alert.alert('Can’t decide yet', err);
    else router.back();
  };

  const minutes = Math.round(Math.abs(a.createdAt - b.createdAt) / 60000);
  const metres = Math.round(dist(a.location, b.location));

  return (
    <Screen edges={[]}>
      <View style={{ gap: Spacing.two }}>
        <Txt variant="title">Same thing, or two?</Txt>
        <Txt variant="body">
          Two people reported something {minutes === 0 ? 'within a minute' : `${minutes} min apart`}, {metres} m from each other.
        </Txt>
      </View>

      <Card tone="ai">
        <Row>
          <Glyph name="sparkle" size={18} color={t.ai} />
          <Txt variant="label" color={t.ai}>
            {link.source === 'ai' ? `AI thinks ${Math.round(link.confidence * 100)}% likely the same` : 'Flagged because they’re close in time and place'}
          </Txt>
        </Row>
        <Txt variant="body">{link.reason}</Txt>
      </Card>

      <SiteMap
        focus={{ center: centroid([a.location, b.location]), radius: Math.max(80, metres * 0.75) }}
        height={220}
        interactive={false}
        focusIncidentIds={[a.id, b.id]}
        highlightIds={[a.reporterId, b.reporterId]}
      />

      {[a, b].map((inc) => (
        <Card key={inc.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading">{firstName(volunteers[inc.reporterId]?.name)} said</Txt>
            <UrgencyPill urgency={inc.urgency} />
          </Row>
          <Txt variant="caption">{formatClock(inc.createdAt)}</Txt>
          <ReportSummary incident={inc} compact />
        </Card>
      ))}

      {!allowed && <Banner tone="info" title="Waiting for Mo" body="Only the safety lead can decide this until the time window runs out." />}
      <View style={{ gap: Spacing.two }}>
        <Button title="Same thing · merge them" size="lg" disabled={!allowed} onPress={() => resolve('same')} />
        <Button title="Two separate things" size="lg" variant="secondary" disabled={!allowed} onPress={() => resolve('separate')} />
      </View>
      <Txt variant="caption" center>
        Merging keeps both reports but sends one response.
      </Txt>
    </Screen>
  );
}
