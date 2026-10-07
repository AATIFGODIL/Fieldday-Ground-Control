/**
 * Request/response contracts for the AI backend, shared by the app and server.
 *
 * Response schemas are deliberately simple (no optional keys, no numeric
 * bounds) so they translate cleanly to structured-output JSON schema; range
 * and cross-reference checks happen in the semantic validators below.
 */
/* eslint-disable @typescript-eslint/no-redeclare -- each schema and its inferred type deliberately share a name */
import { z } from 'zod';

export const IncidentTypeSchema = z.enum([
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
]);
export const UrgencySchema = z.enum(['low', 'medium', 'high', 'critical']);
const SkillSchema = z.enum(['first_aid', 'wwcc', 'rsa', 'crowd_control', 'security_licence', 'deescalation']);

export type AIResult<T> = { ok: true; data: T } | { ok: false; reason: string };

/* ----------------------------- structure-incident ---------------------------- */

export const StructureIncidentRequest = z.object({
  transcript: z.string().min(1).max(4000),
  reporterName: z.string(),
  reporterZoneId: z.string().nullable(),
  zones: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string() })),
  localTime: z.string(),
  temperatureC: z.number(),
});
export type StructureIncidentRequest = z.infer<typeof StructureIncidentRequest>;

export const StructuredIncident = z.object({
  type: IncidentTypeSchema,
  description: z.string(),
  zoneId: z.string().nullable(),
  locationNote: z.string().nullable(),
  suggestedUrgency: UrgencySchema,
  urgencyRationale: z.string(),
  missingInfo: z.array(z.string()),
});
export type StructuredIncident = z.infer<typeof StructuredIncident>;

export function checkStructuredIncident(
  out: StructuredIncident,
  req: StructureIncidentRequest,
): string | null {
  if (!out.description.trim()) return 'empty description';
  if (out.zoneId && !req.zones.some((z) => z.id === out.zoneId)) return `unknown zone ${out.zoneId}`;
  return null;
}

/* ------------------------------ suggest-response ----------------------------- */

export const CandidateInput = z.object({
  volunteerId: z.string(),
  name: z.string(),
  skills: z.array(SkillSchema),
  matchedSkills: z.array(SkillSchema),
  languages: z.array(z.string()),
  distanceM: z.number(),
  etaMin: z.number(),
  zoneName: z.string(),
  tier: z.enum(['primary', 'support']),
});

export const SuggestResponseRequest = z.object({
  incident: z.object({
    ref: z.string(),
    type: IncidentTypeSchema,
    description: z.string(),
    urgency: UrgencySchema,
    zoneName: z.string(),
    locationNote: z.string().nullable(),
    reporterName: z.string(),
  }),
  candidates: z.array(CandidateInput).min(1).max(5),
  localTime: z.string(),
  temperatureC: z.number(),
});
export type SuggestResponseRequest = z.infer<typeof SuggestResponseRequest>;

export const SuggestedResponse = z.object({
  canRespond: z.boolean(),
  reasonIfCannot: z.string().nullable(),
  summary: z.string(),
  reasoning: z.string(),
  assignments: z.array(
    z.object({
      volunteerId: z.string(),
      role: z.string(),
      message: z.string(),
    }),
  ),
  whatToExpect: z.string(),
  whoToFind: z.string(),
});
export type SuggestedResponse = z.infer<typeof SuggestedResponse>;

/** The AI may only choose among the candidates code picked. */
export function checkSuggestedResponse(out: SuggestedResponse, req: SuggestResponseRequest): string | null {
  if (!out.canRespond) return out.reasonIfCannot?.trim() ? null : 'cannot respond but no reason given';
  if (out.assignments.length === 0) return 'no assignments';
  const allowed = new Set(req.candidates.map((c) => c.volunteerId));
  const seen = new Set<string>();
  for (const a of out.assignments) {
    if (!allowed.has(a.volunteerId)) return `assignee ${a.volunteerId} was not a candidate`;
    if (seen.has(a.volunteerId)) return `assignee ${a.volunteerId} listed twice`;
    if (!a.message.trim() || !a.role.trim()) return `empty message or role for ${a.volunteerId}`;
    seen.add(a.volunteerId);
  }
  if (!out.summary.trim() || !out.whatToExpect.trim() || !out.whoToFind.trim()) return 'missing summary fields';
  return null;
}

/* ------------------------------- related-check ------------------------------- */

const IncidentDigest = z.object({
  id: z.string(),
  ref: z.string(),
  type: IncidentTypeSchema,
  description: z.string(),
  transcript: z.string(),
  zoneName: z.string(),
  reporterName: z.string(),
});

export const RelatedCheckRequest = z.object({
  incident: IncidentDigest,
  pairs: z
    .array(IncidentDigest.extend({ minutesApart: z.number(), distanceM: z.number() }))
    .min(1)
    .max(5),
});
export type RelatedCheckRequest = z.infer<typeof RelatedCheckRequest>;

export const RelatedCheckResult = z.object({
  results: z.array(
    z.object({
      incidentId: z.string(),
      likelySame: z.boolean(),
      confidence: z.number(),
      reason: z.string(),
    }),
  ),
});
export type RelatedCheckResult = z.infer<typeof RelatedCheckResult>;

export function checkRelated(out: RelatedCheckResult, req: RelatedCheckRequest): string | null {
  const ids = new Set(req.pairs.map((p) => p.id));
  for (const r of out.results) {
    if (!ids.has(r.incidentId)) return `unknown incident ${r.incidentId}`;
    if (!(r.confidence >= 0 && r.confidence <= 1)) return 'confidence out of range';
  }
  if (!req.pairs.every((p) => out.results.some((r) => r.incidentId === p.id))) return 'missing a pair';
  return null;
}

/* ----------------------------------- brief ----------------------------------- */

export const BriefRequest = z.object({
  incident: z.object({
    type: IncidentTypeSchema,
    description: z.string(),
    urgency: UrgencySchema,
    zoneName: z.string(),
    locationNote: z.string().nullable(),
  }),
  volunteerName: z.string(),
  role: z.string(),
  message: z.string(),
  whatToExpect: z.string(),
  whoToFind: z.string(),
  distanceM: z.number(),
  etaMin: z.number(),
  direction: z.string(),
  temperatureC: z.number(),
});
export type BriefRequest = z.infer<typeof BriefRequest>;

export const BriefResult = z.object({
  oneSentence: z.string(),
  locationAndExpect: z.string(),
  full: z.string(),
});
export type BriefResult = z.infer<typeof BriefResult>;

export function checkBrief(out: BriefResult): string | null {
  if (!out.oneSentence.trim() || !out.locationAndExpect.trim() || !out.full.trim()) return 'empty brief level';
  if (out.full.length < out.oneSentence.length) return 'full brief shorter than one-sentence brief';
  return null;
}

/* --------------------------------- placement --------------------------------- */

export const PlacementRequest = z.object({
  localTime: z.string(),
  temperatureC: z.number(),
  zones: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      requirements: z.string(),
      currentStaff: z.string(),
    }),
  ),
  /** Compact rows: "id|name|skills|languages|currentZoneId". */
  volunteers: z.array(z.string()).max(400),
  notes: z.string(),
});
export type PlacementRequest = z.infer<typeof PlacementRequest>;

export const PlacementResult = z.object({
  summary: z.string(),
  moves: z.array(z.object({ volunteerId: z.string(), toZoneId: z.string(), reason: z.string() })),
  zoneNotes: z.array(z.object({ zoneId: z.string(), note: z.string() })),
});
export type PlacementResult = z.infer<typeof PlacementResult>;
