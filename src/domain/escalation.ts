import type { Incident, RelatedLink, Volunteer } from './types';

/** How long the safety lead has before a location lead may approve instead. */
export const SAFETY_LEAD_WINDOW_MS = 2 * 60 * 1000;
export const SAFETY_LEAD_WINDOW_CRITICAL_MS = 30 * 1000;

export function escalationWindowMs(incident: Pick<Incident, 'urgency'>): number {
  return incident.urgency === 'critical' ? SAFETY_LEAD_WINDOW_CRITICAL_MS : SAFETY_LEAD_WINDOW_MS;
}

export function escalationUnlocksAt(incident: Pick<Incident, 'urgency' | 'createdAt'>): number {
  return incident.createdAt + escalationWindowMs(incident);
}

export type ApprovalCheck =
  | { allowed: true; escalated: boolean }
  | { allowed: false; reason: string; unlocksAt?: number };

export function pendingLinksFor(incidentId: string, links: RelatedLink[]): RelatedLink[] {
  return links.filter((l) => l.resolution === 'pending' && (l.a === incidentId || l.b === incidentId));
}

/**
 * Who may approve a response plan, and when.
 *
 * - Volunteers never approve.
 * - The safety lead may approve as soon as the incident is awaiting a decision.
 * - A location lead may approve incidents in their own zone only once the
 *   safety lead has had their window (2 min, or 30 s for critical) without acting.
 * - Nobody may approve while a "possibly related" link is unresolved, so the
 *   reports are always compared side by side first.
 */
export function canApprove(
  user: Pick<Volunteer, 'id' | 'role' | 'leadsZoneId'>,
  incident: Pick<Incident, 'id' | 'status' | 'urgency' | 'createdAt' | 'zoneId'>,
  links: RelatedLink[],
  now: number,
): ApprovalCheck {
  if (incident.status !== 'suggested' && incident.status !== 'no_suggestion') {
    return { allowed: false, reason: 'This incident is not awaiting approval.' };
  }
  if (user.role === 'volunteer') {
    return { allowed: false, reason: 'Only leads can approve a response.' };
  }

  const pending = pendingLinksFor(incident.id, links);
  const linkCheck = (): ApprovalCheck | null =>
    pending.length > 0
      ? { allowed: false, reason: 'Review the possibly related report first.' }
      : null;

  if (user.role === 'safety_lead') {
    return linkCheck() ?? { allowed: true, escalated: false };
  }

  // Location lead
  if (user.leadsZoneId !== incident.zoneId) {
    return { allowed: false, reason: 'Outside your zone.' };
  }
  const unlocksAt = escalationUnlocksAt(incident);
  if (now < unlocksAt) {
    return { allowed: false, reason: 'Waiting for the safety lead.', unlocksAt };
  }
  return linkCheck() ?? { allowed: true, escalated: true };
}

/** Related-link resolution follows the same authority as approval. */
export function canResolveLinks(
  user: Pick<Volunteer, 'role' | 'leadsZoneId'>,
  incident: Pick<Incident, 'urgency' | 'createdAt' | 'zoneId'>,
  now: number,
): boolean {
  if (user.role === 'safety_lead') return true;
  if (user.role !== 'location_lead' || user.leadsZoneId !== incident.zoneId) return false;
  return now >= escalationUnlocksAt(incident);
}
