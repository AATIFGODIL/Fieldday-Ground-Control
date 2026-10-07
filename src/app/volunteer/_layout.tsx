import { Redirect } from 'expo-router';

import { RoleTabs } from '@/components/role-tabs';
import { useStore } from '@/state/store';

export default function VolunteerLayout() {
  const pending = useStore((s) =>
    s.dispatches.filter((d) => d.volunteerId === s.currentUserId && (d.status === 'notified' || d.status === 'acknowledged')).length,
  );
  const allowed = useStore((s) => {
    const v = s.currentUserId ? s.volunteers[s.currentUserId] : undefined;
    return !!v && v.role === 'volunteer';
  });
  // Signed out or wrong role (e.g. after switching identity): route home.
  if (!allowed) return <Redirect href="/" />;
  return (
    <RoleTabs
      base="/volunteer"
      tabs={[
        { name: 'index', label: 'Home', sf: 'house.fill', md: 'home', badge: pending ? String(pending) : undefined },
        { name: 'report', label: 'Report', sf: 'exclamationmark.bubble.fill', md: 'campaign' },
        { name: 'map', label: 'Map', sf: 'map.fill', md: 'map' },
        { name: 'shift', label: 'Shift', sf: 'clock.fill', md: 'schedule' },
      ]}
    />
  );
}
