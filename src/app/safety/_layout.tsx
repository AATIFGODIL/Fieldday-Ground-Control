import { Redirect } from 'expo-router';

import { RoleTabs } from '@/components/role-tabs';
import { useStore } from '@/state/store';

export default function SafetyLayout() {
  const open = useStore((s) => s.incidents.filter((i) => i.status === 'suggested' || i.status === 'no_suggestion' || i.status === 'logged').length);
  const allowed = useStore((s) => {
    const v = s.currentUserId ? s.volunteers[s.currentUserId] : undefined;
    return !!v && v.role === 'safety_lead';
  });
  // Signed out or wrong role (e.g. after switching identity): route home.
  if (!allowed) return <Redirect href="/" />;
  return (
    <RoleTabs
      base="/safety"
      tabs={[
        { name: 'index', label: 'Command', sf: 'shield.lefthalf.filled', md: 'shield', badge: open ? String(open) : undefined },
        { name: 'map', label: 'Map', sf: 'map.fill', md: 'map' },
        { name: 'placement', label: 'Placement', sf: 'person.crop.rectangle.stack.fill', md: 'group_add' },
        { name: 'coverage', label: 'Coverage', sf: 'calendar.badge.exclamationmark', md: 'event_busy' },
        { name: 'zones', label: 'Zones', sf: 'square.dashed', md: 'select_all' },
      ]}
    />
  );
}
