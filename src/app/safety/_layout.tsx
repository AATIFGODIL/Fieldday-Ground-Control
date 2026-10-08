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
        { name: 'index', label: 'Now', sf: 'bolt.shield.fill', md: 'shield', glyph: 'shield', badge: open ? String(open) : undefined },
        { name: 'staff', label: 'Staff', sf: 'person.3.fill', md: 'groups', glyph: 'users' },
        { name: 'report', label: 'Report', sf: 'mic.fill', md: 'mic', glyph: 'mic' },
        { name: 'map', label: 'Map', sf: 'map.fill', md: 'map', glyph: 'map' },
      ]}
    />
  );
}
