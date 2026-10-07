/**
 * Single on-device store for the demo. Everything the app shows comes from here.
 *
 * Actions are written as plain commands (submitIncident, approve, resolveLink…)
 * so they can later be moved behind a sync backend without touching screens.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { compassDirection, isOnSite, pointInPolygon } from '@/domain/geo';
import { canApprove, canResolveLinks } from '@/domain/escalation';
import { isAvailableNow, pickCandidates, WALK_SPEED_MPS } from '@/domain/matching';
import { findPath, pointAlong, routeDistance } from '@/domain/pathfinding';
import { gapsAt } from '@/domain/coverage';
import type { PlacementMove } from '@/domain/placement';
import {
  ROLE_LABELS,
  type AuditEntry,
  type Brief,
  type Dispatch,
  type DispatchStatus,
  type Festival,
  type Incident,
  type IncidentType,
  type Notice,
  type RelatedLink,
  type ResponsePlan,
  type Slot,
  type Urgency,
  type Vec,
  type Volunteer,
  type Zone,
} from '@/domain/types';
import { SCENARIOS, type ScenarioId } from '@/sim/scenarios';
import { FESTIVAL_ID, seedFestival } from '@/sim/seed/festival';
import { seedRoster } from '@/sim/seed/roster';
import { notifyDevice } from '@/services/notify';

export type AIChaos = 'off' | 'timeout' | 'junk';

export interface Movement {
  path: Vec[];
  travelled: number;
  total: number;
  dispatchId?: string;
}

export interface ReportDraft {
  reporterId: string;
  transcript: string;
  source: 'voice' | 'text';
  photoUri?: string;
  /** AI-structured fields, or null when falling back to the manual form. */
  structured: {
    type: IncidentType;
    description: string;
    zoneId: string;
    locationNote: string | null;
    suggestedUrgency: Urgency | null;
    urgencyRationale: string | null;
    missingInfo: string[];
  } | null;
  failReason?: string;
}

interface Clock {
  anchorReal: number;
  anchorSim: number;
  speed: number;
}

export type Appearance = 'system' | 'light' | 'dark';

export interface State {
  /** Has this device seen the intro? */
  onboarded: boolean;
  /** Follow the phone's light/dark setting, or force one (demo menu). */
  appearance: Appearance;
  festivalId: string | null;
  currentUserId: string | null;
  festival: Festival;
  volunteers: Record<string, Volunteer>;
  positions: Record<string, Vec>;
  incidents: Incident[];
  links: RelatedLink[];
  dispatches: Dispatch[];
  notices: Notice[];
  audit: AuditEntry[];
  movements: Record<string, Movement>;
  offsiteSince: Record<string, number>;
  offsiteAlerted: Record<string, boolean>;
  escalationNotified: Record<string, boolean>;
  coverageAlerted: Record<string, boolean>;
  mode: 'simulated' | 'live';
  clock: Clock;
  temperatureC: number;
  scenarioId: ScenarioId;
  completedSteps: Record<string, boolean>;
  aiChaos: AIChaos;
  seq: number;
  reportDraft: ReportDraft | null;
  /** Script loaded into the report screen by the demo panel. */
  scriptedTranscript: string | null;
  /** A notice to flash as an in-app banner. */
  banner: Notice | null;
}

export function simNow(clock: Clock = useStore.getState().clock): number {
  return clock.anchorSim + (Date.now() - clock.anchorReal) * clock.speed;
}

const uid = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(n++).toString(36)}`;
})();

function initialState(scenarioId: ScenarioId): Omit<State, 'onboarded' | 'appearance' | 'festivalId' | 'currentUserId' | 'mode' | 'aiChaos'> {
  const scenario = SCENARIOS[scenarioId];
  const festival = seedFestival();
  const { volunteers: list, positions } = seedRoster(festival);
  const volunteers: Record<string, Volunteer> = {};
  for (const v of list) {
    const onShift = isAvailableNow(v, scenario.startAt) && !scenario.notCheckedIn.includes(v.id);
    volunteers[v.id] = {
      ...v,
      status: onShift ? 'checked_in' : 'rostered',
      checkedInAt: onShift ? scenario.startAt - 60 * 60 * 1000 : undefined,
    };
  }
  return {
    festival,
    volunteers,
    positions,
    incidents: [],
    links: [],
    dispatches: [],
    notices: [],
    audit: [],
    movements: {},
    offsiteSince: {},
    offsiteAlerted: {},
    escalationNotified: {},
    coverageAlerted: {},
    clock: { anchorReal: Date.now(), anchorSim: scenario.startAt, speed: 1 },
    temperatureC: scenario.temperatureC,
    scenarioId,
    completedSteps: {},
    seq: 0,
    reportDraft: null,
    scriptedTranscript: null,
    banner: null,
  };
}

/** Web keeps the session across reloads; native keeps it for the app's lifetime. */
const memory: Record<string, string> = {};
const sessionStorage: StateStorage =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : { getItem: (k) => memory[k] ?? null, setItem: (k, v) => void (memory[k] = v), removeItem: (k) => void delete memory[k] };

export const useStore = create<State>()(
  persist(
    (): State => ({
      onboarded: false,
      appearance: 'system',
      festivalId: null,
      currentUserId: null,
      mode: 'simulated',
      aiChaos: 'off',
      ...initialState('heat'),
    }),
    {
      name: 'ground-control-session',
      storage: createJSONStorage(() => sessionStorage),
      // Only who you are survives a reload; the simulation itself starts fresh.
      partialize: (s) => ({ onboarded: s.onboarded, appearance: s.appearance, festivalId: s.festivalId, currentUserId: s.currentUserId }),
    },
  ),
);

const get = useStore.getState;
const set = useStore.setState;

/* --------------------------------- selectors -------------------------------- */

export function safetyLeadId(s: State = get()): string {
  return Object.values(s.volunteers).find((v) => v.role === 'safety_lead')?.id ?? 'v-kim';
}

export function zoneLeadId(zoneId: string, s: State = get()): string | undefined {
  return Object.values(s.volunteers).find((v) => v.role === 'location_lead' && v.leadsZoneId === zoneId)?.id;
}

export function zoneById(zoneId: string | undefined, s: State = get()): Zone | undefined {
  return s.festival.zones.find((z) => z.id === zoneId);
}

export function busyVolunteerIds(s: State = get()): Set<string> {
  return new Set(
    s.dispatches
      .filter((d) => d.status === 'notified' || d.status === 'acknowledged' || d.status === 'on_scene')
      .filter((d) => s.incidents.find((i) => i.id === d.incidentId)?.status !== 'resolved')
      .map((d) => d.volunteerId),
  );
}

/** Positions are only shared for volunteers who are checked in (on shift). */
export function sharedPosition(s: State, id: string): Vec | undefined {
  return s.volunteers[id]?.status === 'checked_in' ? s.positions[id] : undefined;
}

export function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

/* ---------------------------------- helpers --------------------------------- */

function audit(action: string, opts: { actorId?: string; incidentId?: string; detail?: string } = {}) {
  const s = get();
  const actorId = opts.actorId ?? s.currentUserId ?? 'system';
  const entry: AuditEntry = {
    id: uid('a'),
    at: simNow(),
    actorId,
    actorName: s.volunteers[actorId]?.name ?? 'System',
    action,
    incidentId: opts.incidentId,
    detail: opts.detail,
  };
  set({ audit: [entry, ...get().audit] });
}

export function notify(n: Omit<Notice, 'id' | 'at' | 'read'>, opts: { device?: boolean } = {}) {
  const notice: Notice = { ...n, id: uid('n'), at: simNow(), read: false };
  const s = get();
  set({ notices: [notice, ...s.notices] });
  if (n.to === s.currentUserId) set({ banner: notice });
  // The device belongs to whoever is signed in; dispatches always buzz (it's "their phone").
  if (n.to === s.currentUserId || opts.device) {
    notifyDevice(notice.title, notice.body, { noticeId: notice.id, dispatchId: n.dispatchId, incidentId: n.incidentId });
  }
}

function patchIncident(id: string, patch: Partial<Incident>) {
  set({ incidents: get().incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
}

function patchDispatch(id: string, patch: Partial<Dispatch>) {
  set({ dispatches: get().dispatches.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
}

/* ---------------------------------- session --------------------------------- */

export function joinFestival(code: string): boolean {
  if (code.trim().toUpperCase() !== FESTIVAL_ID) return false;
  set({ festivalId: FESTIVAL_ID });
  return true;
}

export function setAppearance(appearance: Appearance) {
  set({ appearance });
}

export function finishOnboarding() {
  set({ onboarded: true });
}

export function signInAs(userId: string) {
  set({ currentUserId: userId, banner: null });
}

export function signOut() {
  set({ currentUserId: null, banner: null });
}

export function leaveFestival() {
  set({ currentUserId: null, festivalId: null, banner: null });
}

/* ------------------------------- simulation ops ------------------------------ */

export function resetScenario(id: ScenarioId) {
  const keep = get();
  set({ ...initialState(id), festivalId: keep.festivalId ?? FESTIVAL_ID, currentUserId: SCENARIOS[id].startAs, mode: keep.mode, aiChaos: keep.aiChaos });
  audit(`Demo reset to "${SCENARIOS[id].title}"`, { actorId: 'system' });
}

export function setSpeed(speed: number) {
  const now = simNow();
  set({ clock: { anchorReal: Date.now(), anchorSim: now, speed } });
}

export function setAIChaos(aiChaos: AIChaos) {
  set({ aiChaos });
}

export function setMode(mode: State['mode']) {
  set({ mode });
}

export function markStepDone(stepId: string) {
  set({ completedSteps: { ...get().completedSteps, [stepId]: true } });
}

export function moveDot(id: string, pos: Vec) {
  const { movements } = get();
  if (movements[id]) {
    const { [id]: _, ...rest } = movements;
    set({ movements: rest });
  }
  set({ positions: { ...get().positions, [id]: pos } });
}

/** Dropping a dragged dot inside a different zone reassigns the volunteer there. */
export function dropDot(id: string): string | null {
  const s = get();
  const v = s.volunteers[id];
  const p = s.positions[id];
  if (!v || !p) return null;
  const zone = s.festival.zones.find((z) => pointInPolygon(p, z.polygon));
  if (!zone || zone.id === v.zoneId || v.role !== 'volunteer') return null;
  set({ volunteers: { ...s.volunteers, [id]: { ...v, zoneId: zone.id } } });
  audit(`Reassigned ${v.name} to ${zone.name} (moved on map)`);
  return zone.name;
}

export function setPosition(id: string, pos: Vec) {
  set({ positions: { ...get().positions, [id]: pos } });
}

export function startMovement(id: string, to: Vec, dispatchId?: string) {
  const from = get().positions[id];
  if (!from) return;
  const path = findPath(from, to, get().festival);
  set({ movements: { ...get().movements, [id]: { path, travelled: 0, total: routeDistance(path), dispatchId } } });
}

/** A volunteer walks straight out of the nearest gate and keeps going. */
export function startWander(id: string) {
  const pos = get().positions[id];
  if (!pos) return;
  const path = [pos, { x: pos.x, y: -10 }, { x: pos.x - 20, y: -60 }];
  set({ movements: { ...get().movements, [id]: { path, travelled: 0, total: routeDistance(path) } } });
  audit('Started simulated wander off-site', { actorId: id });
}

export function triggerNoShows(ids: string[]) {
  const vols = { ...get().volunteers };
  for (const id of ids) if (vols[id]) vols[id] = { ...vols[id], status: 'no_show', checkedInAt: undefined };
  set({ volunteers: vols });
  for (const id of ids) audit('Marked as no-show (shift started, never checked in)', { actorId: id });
  checkCoverageNow();
}

/** Raise a coverage alert to the safety lead for any new gap at the current time. */
export function checkCoverageNow() {
  const s = get();
  const gaps = gapsAt(s.festival, Object.values(s.volunteers), simNow());
  const alerted = { ...s.coverageAlerted };
  for (const g of gaps) {
    const key = `${g.zoneId}|${g.skill}`;
    if (alerted[key]) continue;
    alerted[key] = true;
    notify({
      to: safetyLeadId(),
      kind: 'coverage',
      title: `Coverage gap: ${g.zoneName}`,
      body: `${g.label}. Open Placement to reassign.`,
    });
  }
  set({ coverageAlerted: alerted });
}

/* ---------------------------------- shifts ---------------------------------- */

export function checkIn(id: string) {
  const v = get().volunteers[id];
  if (!v) return;
  set({ volunteers: { ...get().volunteers, [id]: { ...v, status: 'checked_in', checkedInAt: simNow() } } });
  audit('Checked in', { actorId: id });
}

export function checkOut(id: string) {
  const s = get();
  const v = s.volunteers[id];
  if (!v) return;
  const { [id]: _a, ...offsiteSince } = s.offsiteSince;
  const { [id]: _b, ...offsiteAlerted } = s.offsiteAlerted;
  set({ volunteers: { ...s.volunteers, [id]: { ...v, status: 'checked_out' } }, offsiteSince, offsiteAlerted });
  audit('Checked out — location sharing stopped', { actorId: id });
}

export function setAvailability(id: string, availability: Slot[]) {
  const v = get().volunteers[id];
  if (!v) return;
  set({ volunteers: { ...get().volunteers, [id]: { ...v, availability } } });
  audit('Updated availability', { actorId: id });
}

export function registerVolunteer(v: Omit<Volunteer, 'id' | 'status' | 'role'>): string {
  const id = uid('v');
  const vol: Volunteer = { ...v, id, role: 'volunteer', status: 'rostered' };
  const zone = zoneById(v.zoneId) ?? get().festival.zones[0];
  const c = zone.polygon[0];
  set({
    volunteers: { ...get().volunteers, [id]: vol },
    positions: { ...get().positions, [id]: { x: c.x + 8, y: c.y + 8 } },
  });
  audit('Registered', { actorId: id });
  return id;
}

export function updateVolunteer(id: string, patch: Partial<Volunteer>) {
  const v = get().volunteers[id];
  if (!v) return;
  set({ volunteers: { ...get().volunteers, [id]: { ...v, ...patch } } });
}

/* ---------------------------------- zones ----------------------------------- */

export function updateZone(id: string, patch: Partial<Zone>) {
  const festival = get().festival;
  set({ festival: { ...festival, zones: festival.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) } });
}

export function applyPlacement(moves: PlacementMove[], source: 'ai' | 'rules' | 'manual') {
  const s = get();
  const vols = { ...s.volunteers };
  for (const m of moves) {
    const v = vols[m.volunteerId];
    if (!v) continue;
    vols[m.volunteerId] = { ...v, zoneId: m.toZoneId };
  }
  set({ volunteers: vols });
  // Walk each moved volunteer to a spot inside their new zone.
  for (const m of moves) {
    const zone = zoneById(m.toZoneId);
    if (!zone || !s.positions[m.volunteerId]) continue;
    const xs = zone.polygon.map((p) => p.x);
    const ys = zone.polygon.map((p) => p.y);
    const target = {
      x: Math.min(...xs) + 6 + Math.random() * (Math.max(...xs) - Math.min(...xs) - 12),
      y: Math.min(...ys) + 6 + Math.random() * (Math.max(...ys) - Math.min(...ys) - 12),
    };
    if (vols[m.volunteerId].status === 'checked_in') startMovement(m.volunteerId, target);
    else set({ positions: { ...get().positions, [m.volunteerId]: target } });
  }
  audit(`Applied placement plan (${moves.length} moves, ${source})`);
  // Gaps may now be closed; allow future alerts for zones that regress.
  set({ coverageAlerted: {} });
}

/* --------------------------------- incidents -------------------------------- */

export function setReportDraft(draft: ReportDraft | null) {
  set({ reportDraft: draft });
}

export function setScriptedTranscript(t: string | null) {
  set({ scriptedTranscript: t });
}

/**
 * Log a confirmed report. Urgency has been explicitly chosen by the reporter.
 * Returns the new incident; the caller kicks off the AI pipeline.
 */
export function logIncident(args: {
  reporterId: string;
  transcript: string;
  source: 'voice' | 'text';
  type: IncidentType;
  description: string;
  zoneId: string;
  locationNote?: string;
  urgency: Urgency;
  aiSuggestedUrgency?: Urgency;
  aiUrgencyRationale?: string;
  structuredBy: 'ai' | 'manual';
  photoUri?: string;
}): Incident {
  const s = get();
  const seq = s.seq + 1;
  const location = s.positions[args.reporterId] ?? { x: 300, y: 200 };
  const incident: Incident = {
    id: uid('inc'),
    ref: `INC-${String(seq).padStart(3, '0')}`,
    createdAt: simNow(),
    reporterId: args.reporterId,
    source: args.source,
    transcript: args.transcript,
    type: args.type,
    description: args.description,
    zoneId: args.zoneId,
    location,
    locationNote: args.locationNote,
    urgency: args.urgency,
    aiSuggestedUrgency: args.aiSuggestedUrgency,
    aiUrgencyRationale: args.aiUrgencyRationale,
    structuredBy: args.structuredBy,
    photoUri: args.photoUri,
    status: 'logged',
    candidates: [],
  };
  incident.candidates = pickCandidates(incident, {
    festival: s.festival,
    volunteers: Object.values(s.volunteers),
    positionOf: (id) => sharedPosition(get(), id),
    busyIds: busyVolunteerIds(),
    now: incident.createdAt,
  });
  set({ incidents: [incident, ...s.incidents], seq, reportDraft: null });

  const reporter = s.volunteers[args.reporterId];
  const zone = zoneById(args.zoneId);
  audit(
    `Logged ${incident.ref} (${args.urgency}${args.aiSuggestedUrgency && args.aiSuggestedUrgency !== args.urgency ? `, AI suggested ${args.aiSuggestedUrgency}` : ''})`,
    { actorId: args.reporterId, incidentId: incident.id, detail: args.description },
  );
  const title = `${args.urgency.toUpperCase()} · ${incident.ref} at ${zone?.name ?? 'unknown'}`;
  const body = `${args.description} — reported by ${reporter?.name ?? 'volunteer'}`;
  notify({ to: safetyLeadId(), kind: 'incident', title, body, incidentId: incident.id });
  const lead = zoneLeadId(args.zoneId);
  if (lead && lead !== args.reporterId) notify({ to: lead, kind: 'incident', title, body, incidentId: incident.id });
  return incident;
}

export function setSuggestion(incidentId: string, result: { plan: ResponsePlan } | { failReason: string }) {
  const inc = get().incidents.find((i) => i.id === incidentId);
  if (!inc || inc.status !== 'logged') return;
  if ('plan' in result) {
    patchIncident(incidentId, { status: 'suggested', suggestion: result.plan });
    audit('AI suggested a response (awaiting human approval)', { actorId: 'system', incidentId, detail: result.plan.summary });
  } else {
    patchIncident(incidentId, { status: 'no_suggestion', suggestionFailReason: result.failReason });
    audit('No AI suggestion — manual response needed', { actorId: 'system', incidentId, detail: result.failReason });
    notify({
      to: safetyLeadId(),
      kind: 'no_suggestion',
      title: `${inc.ref} needs a manual response`,
      body: result.failReason,
      incidentId,
    });
  }
}

export function addRelatedLinks(incidentId: string, links: Omit<RelatedLink, 'id' | 'resolution'>[]) {
  if (links.length === 0) return;
  const created = links.map((l) => ({ ...l, id: uid('l'), resolution: 'pending' as const }));
  set({ links: [...get().links, ...created] });
  const inc = get().incidents.find((i) => i.id === incidentId)!;
  for (const l of created) {
    const other = get().incidents.find((i) => i.id === (l.a === incidentId ? l.b : l.a));
    const body = `${inc.ref} and ${other?.ref} ${l.likelySame ? 'look like the same event' : 'may be related'}${l.source === 'rules' ? ' (rule-based: AI check unavailable)' : ''}. ${l.reason}`;
    notify({ to: safetyLeadId(), kind: 'related', title: 'Possibly related reports', body, incidentId });
    const lead = zoneLeadId(inc.zoneId);
    if (lead) notify({ to: lead, kind: 'related', title: 'Possibly related reports', body, incidentId });
    audit(`Flagged as possibly related to ${other?.ref} (${l.source}, ${Math.round(l.confidence * 100)}%)`, {
      actorId: 'system',
      incidentId,
      detail: l.reason,
    });
  }
}

/**
 * Resolve a "possibly related" link. "same" merges the newer report into the
 * older one so only one response is approved.
 */
export function resolveLink(linkId: string, resolution: 'same' | 'separate'): string | null {
  const s = get();
  const user = s.volunteers[s.currentUserId ?? ''];
  const link = s.links.find((l) => l.id === linkId);
  if (!user || !link || link.resolution !== 'pending') return 'Nothing to resolve.';
  const a = s.incidents.find((i) => i.id === link.a)!;
  const b = s.incidents.find((i) => i.id === link.b)!;
  if (!canResolveLinks(user, a, simNow()) && !canResolveLinks(user, b, simNow())) {
    return 'Only the safety lead can resolve this yet.';
  }
  set({ links: s.links.map((l) => (l.id === linkId ? { ...l, resolution, resolvedById: user.id } : l)) });
  if (resolution === 'same') {
    const [keep, fold] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
    patchIncident(fold.id, { status: 'merged', mergedInto: keep.id });
    // Any other pending links on the folded incident no longer need a decision.
    set({
      links: get().links.map((l) =>
        l.resolution === 'pending' && (l.a === fold.id || l.b === fold.id)
          ? { ...l, resolution: 'same', resolvedById: user.id }
          : l,
      ),
    });
    audit(`Confirmed ${fold.ref} is the same event as ${keep.ref} — merged`, { incidentId: keep.id });
  } else {
    audit(`Confirmed ${a.ref} and ${b.ref} are separate events`, { incidentId: a.id });
  }
  return null;
}

/** Recompute candidates (positions/busy state may have changed). */
export function refreshCandidates(incidentId: string) {
  const s = get();
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  patchIncident(incidentId, {
    candidates: pickCandidates(inc, {
      festival: s.festival,
      volunteers: Object.values(s.volunteers),
      positionOf: (id) => sharedPosition(get(), id),
      busyIds: busyVolunteerIds(),
      now: simNow(),
    }),
  });
}

/**
 * The only path that dispatches anyone. Requires a human with authority
 * (canApprove) — AI output alone can never reach here.
 */
export function approve(incidentId: string, plan: ResponsePlan): { error: string } | { dispatches: Dispatch[] } {
  const s = get();
  const user = s.volunteers[s.currentUserId ?? ''];
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!user || !inc) return { error: 'Not signed in.' };
  const check = canApprove(user, inc, s.links, simNow());
  if (!check.allowed) return { error: check.reason };
  if (plan.assignments.length === 0) return { error: 'Assign at least one volunteer.' };

  const now = simNow();
  const approval = { byId: user.id, byName: user.name, role: user.role, at: now, escalated: check.escalated };
  const zone = zoneById(inc.zoneId);
  const dispatches: Dispatch[] = plan.assignments.map((a) => {
    const from = s.positions[a.volunteerId] ?? inc.location;
    const path = findPath(from, inc.location, s.festival);
    return {
      id: uid('d'),
      incidentId,
      volunteerId: a.volunteerId,
      role: a.role,
      message: a.message,
      path,
      distanceM: Math.round(routeDistance(path)),
      createdAt: now,
      status: 'notified' as DispatchStatus,
      briefPending: true,
    };
  });
  patchIncident(incidentId, { status: 'approved', approvedPlan: plan, approval });
  set({ dispatches: [...get().dispatches, ...dispatches] });

  audit(
    `Approved ${plan.source === 'ai' ? 'AI-suggested' : 'manual'} response${check.escalated ? ' (escalated: safety lead did not respond in time)' : ''}`,
    { incidentId, detail: plan.assignments.map((a) => `${s.volunteers[a.volunteerId]?.name} — ${a.role}`).join('; ') },
  );

  for (const d of dispatches) {
    const v = s.volunteers[d.volunteerId];
    notify(
      {
        to: d.volunteerId,
        kind: 'dispatch',
        title: `${v?.name.split(' ')[0]}, you're needed at ${zone?.name}`,
        body: `${inc.urgency.toUpperCase()} ${inc.ref}: ${d.message}`,
        incidentId,
        dispatchId: d.id,
      },
      { device: true },
    );
    startMovement(d.volunteerId, inc.location, d.id);
  }

  if (check.escalated) {
    notify({
      to: safetyLeadId(),
      kind: 'escalated_approval',
      title: `${user.name} approved ${inc.ref}`,
      body: `${ROLE_LABELS[user.role]} approved after the ${inc.urgency === 'critical' ? '30-second' : '2-minute'} window with no safety-lead response.`,
      incidentId,
    });
  } else {
    const lead = zoneLeadId(inc.zoneId);
    if (lead) {
      notify({ to: lead, kind: 'info', title: `${inc.ref} response approved`, body: `Approved by ${user.name}.`, incidentId });
    }
  }
  return { dispatches };
}

export function setBrief(dispatchId: string, brief: Brief) {
  patchDispatch(dispatchId, { brief, briefPending: false });
}

export function setDispatchStatus(dispatchId: string, status: DispatchStatus, actorId?: string) {
  const d = get().dispatches.find((x) => x.id === dispatchId);
  if (!d || d.status === status) return;
  patchDispatch(dispatchId, { status });
  const inc = get().incidents.find((i) => i.id === d.incidentId);
  const v = get().volunteers[d.volunteerId];
  const labels: Record<DispatchStatus, string> = {
    notified: 'Notified',
    acknowledged: 'Acknowledged dispatch',
    on_scene: 'Arrived on scene',
    declined: "Can't attend",
  };
  audit(`${labels[status]} (${inc?.ref})`, { actorId: actorId ?? d.volunteerId, incidentId: d.incidentId });
  if (status === 'declined') {
    const { [d.volunteerId]: _, ...movements } = get().movements;
    set({ movements });
    notify({
      to: inc?.approval?.byId ?? safetyLeadId(),
      kind: 'info',
      title: `${v?.name} can't attend ${inc?.ref}`,
      body: 'Choose another responder from the incident screen.',
      incidentId: d.incidentId,
    });
  }
  if (status === 'on_scene' && inc) {
    notify({ to: safetyLeadId(), kind: 'info', title: `${v?.name} on scene`, body: `${inc.ref} at ${zoneById(inc.zoneId)?.name}`, incidentId: inc.id });
  }
}

/** Reopen an approved incident so another responder can be chosen. */
export function reopenIncident(incidentId: string) {
  const inc = get().incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  patchIncident(incidentId, { status: inc.suggestion ? 'suggested' : 'no_suggestion', approval: undefined, approvedPlan: undefined });
  refreshCandidates(incidentId);
  audit('Reopened for a new response', { incidentId });
}

export function resolveIncident(incidentId: string) {
  patchIncident(incidentId, { status: 'resolved' });
  audit('Marked resolved', { incidentId });
}

export function markNoticeRead(id: string) {
  set({ notices: get().notices.map((n) => (n.id === id ? { ...n, read: true } : n)) });
}

export function markNoticesRead(userId: string) {
  set({ notices: get().notices.map((n) => (n.to === userId && !n.read ? { ...n, read: true } : n)) });
}

export function dismissBanner() {
  set({ banner: null });
}

/* ----------------------------------- tick ----------------------------------- */

export const OFFSITE_GRACE_MS = 60 * 1000;
/** Dispatched responders walk briskly. */
const RESPONDER_HURRY = 1.5;

/**
 * Advance the simulation: walk moving dots, watch the site boundary, and open
 * escalation windows. Called on an interval by the sim engine.
 */
export function tick(dtRealMs: number) {
  const s = get();
  const dtSim = dtRealMs * s.clock.speed;
  const now = simNow();

  // 1. Movement (simulation mode only; in live mode GPS writes positions).
  if (s.mode === 'simulated' && Object.keys(s.movements).length) {
    const positions = { ...s.positions };
    const movements: Record<string, Movement> = {};
    const arrived: Movement[] = [];
    for (const [id, m] of Object.entries(s.movements)) {
      const travelled = Math.min(m.total, m.travelled + (WALK_SPEED_MPS * RESPONDER_HURRY * dtSim) / 1000);
      positions[id] = pointAlong(m.path, travelled);
      if (travelled >= m.total) arrived.push(m);
      else movements[id] = { ...m, travelled };
    }
    set({ positions, movements });
    for (const m of arrived) {
      const d = m.dispatchId && get().dispatches.find((x) => x.id === m.dispatchId);
      if (d && (d.status === 'notified' || d.status === 'acknowledged')) setDispatchStatus(d.id, 'on_scene');
    }
  }

  // 2. Off-site watch for everyone on shift.
  const after = get();
  const offsiteSince = { ...after.offsiteSince };
  const offsiteAlerted = { ...after.offsiteAlerted };
  let changed = false;
  for (const v of Object.values(after.volunteers)) {
    if (v.status !== 'checked_in') continue;
    const p = after.positions[v.id];
    if (!p) continue;
    if (!isOnSite(p, after.festival)) {
      if (offsiteSince[v.id] === undefined) {
        offsiteSince[v.id] = now;
        changed = true;
      } else if (!offsiteAlerted[v.id] && now - offsiteSince[v.id] >= OFFSITE_GRACE_MS) {
        offsiteAlerted[v.id] = true;
        changed = true;
        const exit = compassDirection({ x: after.festival.width / 2, y: after.festival.height / 2 }, p);
        notify(
          {
            to: v.id,
            kind: 'offsite',
            title: "You've left the festival grounds",
            body: "You're still checked in. Head back or check out so we know you're off shift.",
          },
          { device: v.id === after.currentUserId },
        );
        notify({
          to: safetyLeadId(),
          kind: 'offsite',
          title: `${v.name} is off-site while checked in`,
          body: `Left the ${exit} side over a minute ago and hasn't checked out. Last zone: ${zoneById(v.zoneId)?.name ?? 'unknown'}.`,
        });
        audit('Off-site for over a minute while checked in — alerted safety lead', { actorId: v.id });
      }
    } else if (offsiteSince[v.id] !== undefined) {
      delete offsiteSince[v.id];
      delete offsiteAlerted[v.id];
      changed = true;
    }
  }
  if (changed) set({ offsiteSince, offsiteAlerted });

  // 3. Escalation windows opening for location leads.
  for (const inc of after.incidents) {
    if ((inc.status !== 'suggested' && inc.status !== 'no_suggestion') || after.escalationNotified[inc.id]) continue;
    const window = inc.urgency === 'critical' ? 30_000 : 120_000;
    if (now - inc.createdAt >= window) {
      set({ escalationNotified: { ...get().escalationNotified, [inc.id]: true } });
      const lead = zoneLeadId(inc.zoneId);
      if (lead) {
        notify({
          to: lead,
          kind: 'incident',
          title: `You can now approve ${inc.ref}`,
          body: `No safety-lead response after ${inc.urgency === 'critical' ? '30 seconds' : '2 minutes'}.`,
          incidentId: inc.id,
        });
      }
      audit(`Safety-lead window lapsed — ${after.volunteers[lead ?? '']?.name ?? 'location lead'} may now approve`, {
        actorId: 'system',
        incidentId: inc.id,
      });
    }
  }
}
