import { at } from '@/sim/seed/festival';

import type { Slot } from './types';

/** Bookable blocks for the festival day. */
export const BLOCKS = [
  { id: 'am', label: '10am – 1pm', start: at(9, 30), end: at(13) },
  { id: 'mid', label: '1pm – 4pm', start: at(13), end: at(16) },
  { id: 'pm', label: '4pm – 7pm', start: at(16), end: at(19) },
  { id: 'eve', label: '7pm – 11pm', start: at(19), end: at(23, 30) },
] as const;

export function blocksFromSlots(slots: Slot[]): Set<string> {
  return new Set(BLOCKS.filter((b) => slots.some((s) => s.start <= b.start && s.end >= b.end)).map((b) => b.id));
}

/** Merge chosen blocks into continuous slots. */
export function slotsFromBlocks(ids: Set<string>): Slot[] {
  const slots: Slot[] = [];
  for (const b of BLOCKS) {
    if (!ids.has(b.id)) continue;
    const last = slots[slots.length - 1];
    if (last && last.end === b.start) last.end = b.end;
    else slots.push({ start: b.start, end: b.end });
  }
  return slots;
}
