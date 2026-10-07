import type { IncidentType } from './types';

const KEYWORDS: [IncidentType, RegExp][] = [
  ['heat_illness', /\b(heat|hot|dehydrat|faint|collaps|dizzy|sunstroke)/i],
  ['fight', /\b(fight|punch|brawl|scuffle|shov|hitting|swing)/i],
  ['crowd_crush', /\b(crush|crowd surge|squash|trampl)/i],
  ['lost_child', /\b(lost (kid|child|boy|girl)|missing (kid|child)|can'?t find (my|their) (kid|child|son|daughter))/i],
  ['fire', /\b(fire|smoke|flame|burning)/i],
  ['security_threat', /\b(knife|weapon|gun|threat|suspicious)/i],
  ['intoxication', /\b(drunk|intoxicat|wasted|vomit|overdose|pills)/i],
  ['medical', /\b(injur|bleed|hurt|unconscious|seizure|breath|allerg|broken)/i],
  ['property', /\b(stolen|theft|damage|vandal|broke into)/i],
];

/**
 * Keyword guess used to pre-fill the manual form when AI structuring is
 * unavailable. The volunteer still reviews every field.
 */
export function guessIncidentType(text: string): IncidentType {
  for (const [type, re] of KEYWORDS) if (re.test(text)) return type;
  return 'other';
}
