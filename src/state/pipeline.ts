/**
 * Async glue between the store and the AI backend. Every AI step has a
 * designed fallback so the human workflow never stalls on the model.
 */
import { api } from '@/api/client';
import { templateBrief } from '@/domain/brief';
import { guessIncidentType } from '@/domain/classify';
import { activeRequirements } from '@/domain/coverage';
import { compassDirection, dist, zoneAt } from '@/domain/geo';
import { WALK_SPEED_MPS } from '@/domain/matching';
import { greedyPlacement, validateMoves, type PlacementMove } from '@/domain/placement';
import { countWith, onShiftIn, STAFF_SKILLS, targetFor, type TargetChange } from '@/domain/staffing';
import { RELATED_RADIUS_M, relatedCandidates } from '@/domain/related';
import { SKILL_LABELS, type Dispatch, type Incident, type ResponsePlan, type Urgency } from '@/domain/types';
import type { ScenarioStep } from '@/sim/scenarios';

import {
  addRelatedLinks,
  approve,
  formatClock,
  logIncident,
  setBrief,
  setReportDraft,
  setSuggestion,
  simNow,
  useStore,
  zoneById,
  type ReportDraft,
} from './store';

/** Flag a pair as related when the AI thinks it's at least this likely. */
const RELATED_FLAG_THRESHOLD = 0.35;

function localTime() {
  return `${formatClock(simNow())} Saturday`;
}

/* ------------------------------- report → draft ------------------------------ */

export async function structureReport(args: {
  reporterId: string;
  transcript: string;
  source: 'voice' | 'text';
  photoUri?: string;
}): Promise<ReportDraft> {
  const s = useStore.getState();
  const pos = s.positions[args.reporterId];
  const reporterZone = pos ? zoneAt(pos, s.festival.zones) : undefined;
  const res = await api.structureIncident({
    transcript: args.transcript,
    reporterName: s.volunteers[args.reporterId]?.name ?? 'Volunteer',
    reporterZoneId: reporterZone?.id ?? null,
    zones: s.festival.zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind })),
    localTime: localTime(),
    temperatureC: s.temperatureC,
  });

  const draft: ReportDraft = res.ok
    ? {
        ...args,
        structured: {
          type: res.data.type,
          description: res.data.description,
          zoneId: res.data.zoneId ?? reporterZone?.id ?? s.festival.zones[0].id,
          locationNote: res.data.locationNote,
          suggestedUrgency: res.data.suggestedUrgency,
          urgencyRationale: res.data.urgencyRationale,
          missingInfo: res.data.missingInfo,
        },
      }
    : {
        ...args,
        // Manual form, pre-filled as best we can without AI.
        structured: {
          type: guessIncidentType(args.transcript),
          description: args.transcript,
          zoneId: reporterZone?.id ?? s.festival.zones[0].id,
          locationNote: null,
          suggestedUrgency: null,
          urgencyRationale: null,
          missingInfo: [],
        },
        failReason: res.reason,
      };
  setReportDraft(draft);
  return draft;
}

/* ------------------------------ confirmed report ------------------------------ */

export function submitReport(draft: ReportDraft, fields: {
  type: Incident['type'];
  description: string;
  zoneId: string;
  locationNote?: string;
  urgency: Urgency;
}): Incident {
  const incident = logIncident({
    reporterId: draft.reporterId,
    transcript: draft.transcript,
    source: draft.source,
    photoUri: draft.photoUri,
    ...fields,
    aiSuggestedUrgency: draft.failReason ? undefined : (draft.structured?.suggestedUrgency ?? undefined),
    aiUrgencyRationale: draft.failReason ? undefined : (draft.structured?.urgencyRationale ?? undefined),
    structuredBy: draft.failReason ? 'manual' : 'ai',
  });
  // Both run in parallel; neither blocks the other.
  void runRelatedCheck(incident);
  void runSuggestion(incident.id);
  return incident;
}

/* ---------------------------- suggested response ----------------------------- */

export async function runSuggestion(incidentId: string) {
  const s = useStore.getState();
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  if (inc.candidates.length === 0) {
    setSuggestion(incidentId, { failReason: 'No checked-in volunteers with matching skills are available.' });
    return;
  }
  const res = await api.suggestResponse({
    incident: {
      ref: inc.ref,
      type: inc.type,
      description: inc.description,
      urgency: inc.urgency,
      zoneName: zoneById(inc.zoneId)?.name ?? 'Unknown',
      locationNote: inc.locationNote ?? null,
      reporterName: s.volunteers[inc.reporterId]?.name ?? 'the reporter',
    },
    candidates: inc.candidates.map((c) => ({
      volunteerId: c.volunteerId,
      name: c.name,
      skills: c.skills,
      matchedSkills: c.matchedSkills,
      languages: c.languages,
      distanceM: c.distanceM,
      etaMin: c.etaMin,
      zoneName: c.zoneName,
      tier: c.tier,
    })),
    localTime: localTime(),
    temperatureC: s.temperatureC,
  });

  if (!res.ok) {
    setSuggestion(incidentId, { failReason: `AI suggestion unavailable (${res.reason}).` });
    return;
  }
  if (!res.data.canRespond) {
    setSuggestion(incidentId, { failReason: `AI could not suggest a response: ${res.data.reasonIfCannot}` });
    return;
  }
  const plan: ResponsePlan = {
    summary: res.data.summary,
    reasoning: res.data.reasoning,
    assignments: res.data.assignments,
    whatToExpect: res.data.whatToExpect,
    whoToFind: res.data.whoToFind,
    source: 'ai',
  };
  setSuggestion(incidentId, { plan });
}

/* ------------------------------- related check ------------------------------- */

export async function runRelatedCheck(incident: Incident) {
  const s = useStore.getState();
  const plausible = relatedCandidates(incident, s.incidents, s.festival.zones).slice(0, 5);
  if (plausible.length === 0) return; // Nothing close in place, time and type: no AI call.

  const digest = (i: Incident) => ({
    id: i.id,
    ref: i.ref,
    type: i.type,
    description: i.description,
    transcript: i.transcript,
    zoneName: zoneById(i.zoneId)?.name ?? 'Unknown',
    reporterName: s.volunteers[i.reporterId]?.name ?? 'Volunteer',
  });
  const res = await api.relatedCheck({
    incident: digest(incident),
    pairs: plausible.map((o) => ({
      ...digest(o),
      minutesApart: Math.round(Math.abs(incident.createdAt - o.createdAt) / 60000),
      distanceM: Math.round(dist(incident.location, o.location)),
    })),
  });

  if (res.ok) {
    const flagged = res.data.results.filter((r) => r.likelySame || r.confidence >= RELATED_FLAG_THRESHOLD);
    addRelatedLinks(
      incident.id,
      flagged.map((r) => ({
        a: r.incidentId,
        b: incident.id,
        source: 'ai' as const,
        likelySame: r.likelySame,
        confidence: r.confidence,
        reason: r.reason,
      })),
    );
  } else {
    // Never silently miss a duplicate: fall back to the rule-based match.
    addRelatedLinks(
      incident.id,
      plausible.map((o) => ({
        a: o.id,
        b: incident.id,
        source: 'rules' as const,
        likelySame: false,
        confidence: 0.5,
        reason: `Similar ${incident.type.replace('_', ' ')} reports ${minutesApartText(incident.createdAt, o.createdAt)} and ${Math.round(dist(incident.location, o.location))} m apart (within ${RELATED_RADIUS_M} m).`,
      })),
    );
  }
}

function minutesApartText(a: number, b: number) {
  const m = Math.round(Math.abs(a - b) / 60000);
  return m === 0 ? 'less than a minute apart' : `${m} min apart`;
}

/* ----------------------------------- brief ----------------------------------- */

export async function runBriefs(dispatches: Dispatch[]) {
  await Promise.all(dispatches.map(runBrief));
}

async function runBrief(d: Dispatch) {
  const s = useStore.getState();
  const inc = s.incidents.find((i) => i.id === d.incidentId);
  const plan = inc?.approvedPlan;
  if (!inc || !plan) return;
  const zoneName = zoneById(inc.zoneId)?.name ?? 'the incident';
  const from = d.path[0] ?? inc.location;
  const direction = compassDirection(from, inc.location);
  const res = await api.brief({
    incident: {
      type: inc.type,
      description: inc.description,
      urgency: inc.urgency,
      zoneName,
      locationNote: inc.locationNote ?? null,
    },
    volunteerName: s.volunteers[d.volunteerId]?.name ?? 'Volunteer',
    role: d.role,
    message: d.message,
    whatToExpect: plan.whatToExpect,
    whoToFind: plan.whoToFind,
    distanceM: d.distanceM,
    etaMin: Math.max(1, Math.round(d.distanceM / WALK_SPEED_MPS / 60)),
    direction,
    temperatureC: s.temperatureC,
  });
  setBrief(
    d.id,
    res.ok
      ? { ...res.data, source: 'ai' }
      : templateBrief({ incident: inc, zoneName, plan, message: d.message, role: d.role, from, to: inc.location, distanceM: d.distanceM }),
  );
}

/* --------------------------------- placement --------------------------------- */

export interface PlacementProposal {
  source: 'ai' | 'rules';
  summary: string;
  moves: PlacementMove[];
  zoneNotes: Record<string, string>;
  failReason?: string;
}

export async function proposePlacement(): Promise<PlacementProposal> {
  const s = useStore.getState();
  const volunteers = Object.values(s.volunteers);
  const staff = volunteers.filter((v) => v.role === 'volunteer' && v.status !== 'no_show' && v.status !== 'checked_out');
  const res = await api.placement({
    localTime: localTime(),
    temperatureC: s.temperatureC,
    zones: s.festival.zones.map((z) => {
      const here = staff.filter((v) => v.zoneId === z.id);
      const counts = Object.entries(SKILL_LABELS)
        .map(([k, label]) => `${label} ${here.filter((v) => v.skills.includes(k as never)).length}`)
        .join(', ');
      return {
        id: z.id,
        name: z.name,
        kind: z.kind,
        requirements:
          activeRequirements(z, s.temperatureC)
            .map((r) => `${r.min}× ${r.skill ? SKILL_LABELS[r.skill] : 'any'}`)
            .join(', ') || 'none',
        currentStaff: `${here.length} total; ${counts}`,
      };
    }),
    volunteers: staff.map((v) => `${v.id}|${v.name}|${v.skills.join(',') || '-'}|${v.languages.join(',')}|${v.zoneId ?? '-'}`),
    notes: `${s.temperatureC}°C. No-shows today: ${volunteers.filter((v) => v.status === 'no_show').map((v) => v.name).join(', ') || 'none'}.`,
  });

  if (res.ok) {
    const check = validateMoves(res.data.moves, volunteers, s.festival.zones.map((z) => z.id));
    if (check.ok) {
      return {
        source: 'ai',
        summary: res.data.summary,
        moves: res.data.moves,
        zoneNotes: Object.fromEntries(res.data.zoneNotes.map((n) => [n.zoneId, n.note])),
      };
    }
    return rulesPlacement(`AI plan rejected: ${check.reason}`);
  }
  return rulesPlacement(res.reason);
}

function rulesPlacement(failReason: string): PlacementProposal {
  const s = useStore.getState();
  const moves = greedyPlacement(s.festival, Object.values(s.volunteers), s.temperatureC, (id) => s.positions[id]);
  return {
    source: 'rules',
    summary: moves.length
      ? 'Rule-based plan: fills each unmet skill requirement with the nearest suitable volunteer.'
      : 'Every zone already meets its requirements.',
    moves,
    zoneNotes: {},
    failReason,
  };
}

/* ------------------------------ scripted reports ------------------------------ */

/**
 * Run a scripted report end to end without the UI: AI structuring (or the
 * manual fallback), then the scripted volunteer confirms urgency and submits.
 */
export async function runScriptedReport(step: Extract<ScenarioStep, { kind: 'report' }>) {
  const draft = await structureReport({ reporterId: step.reporterId, transcript: step.transcript, source: 'voice' });
  const st = draft.structured!;
  return submitReport(draft, {
    type: st.type,
    description: st.description,
    zoneId: st.zoneId,
    locationNote: st.locationNote ?? undefined,
    urgency: step.confirmUrgency,
  });
}

/* ---------------------------------- approval ---------------------------------- */

/** Human approval, then generate each dispatched volunteer's brief once. */
export function approveAndBrief(incidentId: string, plan: ResponsePlan): string | null {
  const res = approve(incidentId, plan);
  if ('error' in res) return res.error;
  void runBriefs(res.dispatches);
  return null;
}

/* ------------------------------ spoken staffing ------------------------------ */

/**
 * "More de-escalation at the Lawn Stage for the headliner" → new minimums.
 * The AI only proposes numbers; code picks who moves; Mo approves.
 */
export async function askStaffing(
  instruction: string,
): Promise<{ ok: true; title: string; note: string; changes: TargetChange[] } | { ok: false; reason: string }> {
  const s = useStore.getState();
  const res = await api.staffing({
    instruction,
    localTime: localTime(),
    temperatureC: s.temperatureC,
    zones: s.festival.zones.map((z) => ({
      id: z.id,
      name: z.name,
      kind: z.kind,
      targets: [null, ...STAFF_SKILLS]
        .map((k) => `${k ?? 'people'} ${countWith(onShiftIn(z.id, Object.values(s.volunteers)), k)} here / min ${targetFor(z, k, s.temperatureC)}`)
        .join(', '),
    })),
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  if (!res.data.understood) return { ok: false, reason: res.data.reasonIfNot ?? 'That doesn’t sound like a staffing change.' };
  return { ok: true, title: res.data.summary, note: res.data.note, changes: res.data.changes };
}
