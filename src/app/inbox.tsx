import { router } from 'expo-router';
import { useEffect } from 'react';

import { Button, Card, EmptyState, Row, Screen, Txt } from '@/components/ui/primitives';
import { UrgencyColors } from '@/constants/theme';
import { formatClock, markNoticesRead, useStore } from '@/state/store';

export default function Inbox() {
  const me = useStore((s) => s.currentUserId);
  const all = useStore((s) => s.notices);
  const notices = all.filter((n) => n.to === me);
  const unreadIds = new Set(notices.filter((n) => !n.read).map((n) => n.id));

  // Mark read on leave so new ones stay highlighted while open.
  useEffect(() => () => {
    if (me) markNoticesRead(me);
  }, [me]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title">Alerts</Txt>
        <Button title="Done" variant="secondary" size="sm" onPress={() => router.back()} />
      </Row>
      {notices.length === 0 && <EmptyState title="No alerts" />}
      {notices.map((n) => (
        <Card
          key={n.id}
          onPress={() => {
            if (n.dispatchId) router.push({ pathname: '/dispatch/[id]', params: { id: n.dispatchId } });
            else if (n.incidentId) router.push({ pathname: '/incident/[id]', params: { id: n.incidentId } });
          }}
          style={unreadIds.has(n.id) ? { borderLeftWidth: 5, borderLeftColor: UrgencyColors.high } : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading" style={{ fontSize: 15, flex: 1 }}>{n.title}</Txt>
            <Txt variant="caption">{formatClock(n.at)}</Txt>
          </Row>
          <Txt variant="caption">{n.body}</Txt>
        </Card>
      ))}
    </Screen>
  );
}
