import { compassDirection } from './geo';
import { WALK_SPEED_MPS } from './matching';
import {
  INCIDENT_TYPE_LABELS,
  type Brief,
  type BriefLevel,
  type Incident,
  type ResponsePlan,
  type Vec,
} from './types';

export const SHORT_BRIEF_MAX_M = 100;
export const STANDARD_BRIEF_MAX_M = 300;

/** Pick how much detail to read out based on how far the volunteer has to walk. */
export function briefLevelForDistance(distanceM: number): BriefLevel {
  if (distanceM < SHORT_BRIEF_MAX_M) return 'oneSentence';
  if (distanceM <= STANDARD_BRIEF_MAX_M) return 'locationAndExpect';
  return 'full';
}

export const BRIEF_LEVEL_LABELS: Record<BriefLevel, string> = {
  oneSentence: 'Short',
  locationAndExpect: 'Standard',
  full: 'Full',
};

/**
 * Deterministic brief used when the AI brief call fails, so a dispatched
 * volunteer is never left without instructions.
 */
export function templateBrief(args: {
  incident: Pick<Incident, 'type' | 'description' | 'urgency' | 'locationNote'>;
  zoneName: string;
  plan: Pick<ResponsePlan, 'whatToExpect' | 'whoToFind'>;
  message: string;
  role: string;
  from: Vec;
  to: Vec;
  distanceM: number;
}): Brief {
  const { incident, zoneName, plan, message, role, from, to, distanceM } = args;
  const type = INCIDENT_TYPE_LABELS[incident.type].toLowerCase();
  const where = incident.locationNote ? `${zoneName}, ${incident.locationNote}` : zoneName;
  const dir = compassDirection(from, to);
  const mins = Math.max(1, Math.round(distanceM / WALK_SPEED_MPS / 60));
  const oneSentence = `${capitalise(incident.urgency)} ${type} at ${where} — head ${dir} now as ${role}.`;
  const locationAndExpect = `Head ${dir} to ${where}, about ${distanceM} metres, ${mins} minute${mins === 1 ? '' : 's'} on foot. ${plan.whatToExpect}`;
  const full = [
    `You've been dispatched as ${role} to a ${incident.urgency} ${type}.`,
    `Head ${dir} to ${where}, about ${distanceM} metres away, roughly ${mins} minute${mins === 1 ? '' : 's'} walking.`,
    `What's happening: ${incident.description}`,
    `What to expect: ${plan.whatToExpect}`,
    `Who to find: ${plan.whoToFind}`,
    `Your instructions: ${message}`,
  ].join(' ');
  return { oneSentence, locationAndExpect, full, source: 'template' };
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
