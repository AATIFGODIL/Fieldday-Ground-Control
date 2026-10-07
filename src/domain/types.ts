/**
 * Core domain types for Fieldday Ground Control.
 *
 * Coordinates are local site metres: x grows east, y grows south, origin is the
 * north-west corner of the site plan. GPS fixes are projected into this space
 * (see geo.ts), so everything downstream is agnostic to where a position came from.
 */

export type Vec = { x: number; y: number };

export type Skill = 'first_aid' | 'wwcc' | 'rsa' | 'crowd_control' | 'security_licence';

export const SKILL_LABELS: Record<Skill, string> = {
  first_aid: 'First aid',
  wwcc: 'Working With Children',
  rsa: 'RSA',
  crowd_control: 'Crowd management',
  security_licence: 'Security licence',
};

export const SKILL_SHORT: Record<Skill, string> = {
  first_aid: 'FA',
  wwcc: 'WWCC',
  rsa: 'RSA',
  crowd_control: 'Crowd',
  security_licence: 'Sec',
};

export type Role = 'volunteer' | 'location_lead' | 'safety_lead';

export const ROLE_LABELS: Record<Role, string> = {
  volunteer: 'Volunteer',
  location_lead: 'Location lead',
  safety_lead: 'Safety lead',
};

/** Epoch-ms interval during which a volunteer is available to work. */
export type Slot = { start: number; end: number };

export type ShiftStatus = 'rostered' | 'checked_in' | 'checked_out' | 'no_show';

export interface Volunteer {
  id: string;
  name: string;
  role: Role;
  phone?: string;
  skills: Skill[];
  languages: string[];
  /** Zone the volunteer is assigned (placed) to. */
  zoneId?: string;
  /** For location leads: the zone they lead. */
  leadsZoneId?: string;
  availability: Slot[];
  status: ShiftStatus;
  checkedInAt?: number;
}

export type ZoneKind =
  | 'stage'
  | 'water'
  | 'bar'
  | 'food'
  | 'washroom'
  | 'games'
  | 'kids'
  | 'medical'
  | 'gate';

export const ZONE_KIND_LABELS: Record<ZoneKind, string> = {
  stage: 'Stage',
  water: 'Water station',
  bar: 'Bar (licensed)',
  food: 'Food',
  washroom: 'Washrooms',
  games: 'Games',
  kids: 'Kids zone',
  medical: 'First aid',
  gate: 'Gate',
};

export interface ZoneRequirement {
  /** null = general headcount. */
  skill: Skill | null;
  min: number;
  /** Only applies when the forecast temperature is at or above this (°C). */
  minTempC?: number;
}

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  /** Polygon in site metres (clockwise). Preset zones are rectangles. */
  polygon: Vec[];
  requirements: ZoneRequirement[];
}

export interface Festival {
  id: string;
  name: string;
  /** Site plan size in metres. */
  width: number;
  height: number;
  boundary: Vec[];
  zones: Zone[];
  /** Solid structures people walk around (stage decks etc.). */
  obstacles: Vec[][];
  walkways: WalkGraph;
  /** Geo anchor for projecting GPS fixes onto the site plan. */
  geoAnchor: { lat: number; lng: number; bearingDeg: number };
  /** Operating window (epoch ms) for coverage checks. */
  opensAt: number;
  closesAt: number;
  /** Hour-of-day (0-23) → forecast °C. */
  forecastC: Record<number, number>;
}

export interface WalkGraph {
  nodes: Record<string, Vec>;
  edges: [string, string][];
}

export type IncidentType =
  | 'heat_illness'
  | 'medical'
  | 'fight'
  | 'crowd_crush'
  | 'lost_child'
  | 'intoxication'
  | 'fire'
  | 'security_threat'
  | 'property'
  | 'other';

export const INCIDENT_TYPES: IncidentType[] = [
  'heat_illness',
  'medical',
  'fight',
  'crowd_crush',
  'lost_child',
  'intoxication',
  'fire',
  'security_threat',
  'property',
  'other',
];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  heat_illness: 'Heat illness',
  medical: 'Medical',
  fight: 'Fight / altercation',
  crowd_crush: 'Crowd crush',
  lost_child: 'Lost child',
  intoxication: 'Intoxication',
  fire: 'Fire / smoke',
  security_threat: 'Security threat',
  property: 'Property / damage',
  other: 'Other',
};

export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export const URGENCIES: Urgency[] = ['low', 'medium', 'high', 'critical'];
export const URGENCY_RANK: Record<Urgency, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export type IncidentStatus =
  | 'logged' // urgency confirmed, waiting on AI suggestion
  | 'suggested' // AI plan ready for human approval
  | 'no_suggestion' // AI could not (or failed to) suggest — human must write plan
  | 'approved' // a human approved a plan; dispatches created
  | 'resolved'
  | 'merged'; // folded into another incident (duplicate)

export interface Candidate {
  volunteerId: string;
  name: string;
  skills: Skill[];
  matchedSkills: Skill[];
  languages: string[];
  distanceM: number;
  etaMin: number;
  zoneName: string;
  tier: 'primary' | 'support';
}

export interface Assignment {
  volunteerId: string;
  role: string;
  message: string;
}

export interface ResponsePlan {
  summary: string;
  reasoning: string;
  assignments: Assignment[];
  whatToExpect: string;
  whoToFind: string;
  source: 'ai' | 'manual';
  authorId?: string;
}

export interface Approval {
  byId: string;
  byName: string;
  role: Role;
  at: number;
  /** True when a location lead approved after the safety-lead window lapsed. */
  escalated: boolean;
}

export interface Incident {
  id: string;
  /** Human-friendly reference, e.g. INC-004. */
  ref: string;
  createdAt: number;
  reporterId: string;
  source: 'voice' | 'text';
  transcript: string;
  type: IncidentType;
  description: string;
  zoneId: string;
  location: Vec;
  locationNote?: string;
  urgency: Urgency;
  aiSuggestedUrgency?: Urgency;
  aiUrgencyRationale?: string;
  /** Whether the structured fields came from AI or the manual fallback form. */
  structuredBy: 'ai' | 'manual';
  photoUri?: string;
  status: IncidentStatus;
  candidates: Candidate[];
  suggestion?: ResponsePlan;
  suggestionFailReason?: string;
  approvedPlan?: ResponsePlan;
  approval?: Approval;
  mergedInto?: string;
}

export interface RelatedLink {
  id: string;
  a: string;
  b: string;
  source: 'ai' | 'rules';
  likelySame: boolean;
  confidence: number;
  reason: string;
  resolution: 'pending' | 'same' | 'separate';
  resolvedById?: string;
}

export type BriefLevel = 'oneSentence' | 'locationAndExpect' | 'full';

export interface Brief {
  oneSentence: string;
  locationAndExpect: string;
  full: string;
  source: 'ai' | 'template';
}

export type DispatchStatus = 'notified' | 'acknowledged' | 'on_scene' | 'declined';

export interface Dispatch {
  id: string;
  incidentId: string;
  volunteerId: string;
  role: string;
  message: string;
  path: Vec[];
  distanceM: number;
  createdAt: number;
  status: DispatchStatus;
  brief?: Brief;
  /** True while the brief is being generated. */
  briefPending: boolean;
}

export type NoticeKind =
  | 'dispatch'
  | 'incident'
  | 'related'
  | 'no_suggestion'
  | 'escalated_approval'
  | 'coverage'
  | 'offsite'
  | 'info';

export interface Notice {
  id: string;
  at: number;
  /** Recipient user id, or 'safety' for whoever holds the safety-lead role. */
  to: string;
  kind: NoticeKind;
  title: string;
  body: string;
  incidentId?: string;
  dispatchId?: string;
  read: boolean;
}

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  incidentId?: string;
  detail?: string;
}
