import { DockTabs } from './dock-tabs';
import type { TabSpec } from './role-tabs';

/** Android uses the same floating dock as web, so both look like one product. */
export function RoleTabs(props: { tabs: TabSpec[]; base: string }) {
  return <DockTabs {...props} />;
}
