import { router } from 'expo-router';

import { Button } from '@/components/ui/primitives';
import { useStore } from '@/state/store';

export function InboxButton() {
  const unread = useStore((s) => s.notices.filter((n) => n.to === s.currentUserId && !n.read).length);
  return (
    <Button
      title={unread ? `Alerts (${unread} new)` : 'Alerts'}
      variant={unread ? 'primary' : 'secondary'}
      size="sm"
      onPress={() => router.push('/inbox')}
    />
  );
}
