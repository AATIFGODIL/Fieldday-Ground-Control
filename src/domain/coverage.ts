import { isAvailableNow } from './matching';
import { SKILL_LABELS, type Festival, type Skill, type Volunteer, type Zone } from './types';

export const BLOCK_MS = 30 * 60 * 1000;

export interface CoverageGap {
  zoneId: string;
  zoneName: string;
  blockStart: number;
  skill: Skill | null;
  required: number;
  have: number;
  label: string;
}

function forecastAt(festival: Festival, t: number): number {
  const hour = new Date(t).getHours();
  return festival.forecastC[hour] ?? 25;
}

export function activeRequirements(zone: Zone, tempC: number) {
  return zone.requirements.filter((r) => r.minTempC === undefined || tempC >= r.minTempC);
}

/** Volunteers who will actually be there: rostered or on shift, not no-shows. */
function staffFor(zone: Zone, volunteers: Volunteer[], t: number) {
  return volunteers.filter(
    (v) =>
      v.zoneId === zone.id &&
      v.role === 'volunteer' &&
      v.status !== 'no_show' &&
      v.status !== 'checked_out' &&
      isAvailableNow(v, t),
  );
}

export function gapsAt(festival: Festival, volunteers: Volunteer[], t: number): CoverageGap[] {
  const tempC = forecastAt(festival, t);
  const gaps: CoverageGap[] = [];
  for (const zone of festival.zones) {
    const staff = staffFor(zone, volunteers, t);
    for (const req of activeRequirements(zone, tempC)) {
      const have = req.skill ? staff.filter((v) => v.skills.includes(req.skill!)).length : staff.length;
      if (have < req.min) {
        const what = req.skill ? SKILL_LABELS[req.skill] : 'volunteers';
        const heat = req.minTempC !== undefined ? ` (heat ≥${req.minTempC}°C)` : '';
        gaps.push({
          zoneId: zone.id,
          zoneName: zone.name,
          blockStart: t,
          skill: req.skill,
          required: req.min,
          have,
          label: `${zone.name}: ${have}/${req.min} ${what}${heat}`,
        });
      }
    }
  }
  return gaps;
}

/** Check every 30-minute block across the festival's operating hours. */
export function coverageGaps(festival: Festival, volunteers: Volunteer[], from = festival.opensAt): CoverageGap[] {
  const out: CoverageGap[] = [];
  for (let t = from; t < festival.closesAt; t += BLOCK_MS) {
    out.push(...gapsAt(festival, volunteers, t));
  }
  return out;
}

/** Collapse consecutive blocks with the same gap into ranges for display. */
export function groupGaps(gaps: CoverageGap[]) {
  const groups: { key: string; first: CoverageGap; from: number; to: number; worst: number }[] = [];
  for (const g of gaps) {
    const key = `${g.zoneId}|${g.skill}`;
    const last = groups.findLast((x) => x.key === key);
    if (last && last.to === g.blockStart) {
      last.to = g.blockStart + BLOCK_MS;
      last.worst = Math.min(last.worst, g.have);
    } else {
      groups.push({ key, first: g, from: g.blockStart, to: g.blockStart + BLOCK_MS, worst: g.have });
    }
  }
  return groups;
}
