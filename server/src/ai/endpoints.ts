import {
  BriefResult,
  checkBrief,
  checkRelated,
  checkStructuredIncident,
  checkSuggestedResponse,
  PlacementResult,
  RelatedCheckResult,
  StructuredIncident,
  SuggestedResponse,
  type BriefRequest,
  type PlacementRequest,
  type RelatedCheckRequest,
  type StructureIncidentRequest,
  type SuggestResponseRequest,
} from '../../../src/domain/ai-contracts';

import { callAI, HAIKU, SONNET, type Chaos } from './call-ai';

const CONTEXT = `You support ground control at Fieldday, an outdoor music festival in Sydney, Australia. About 300 volunteers are spread across the site, each zone has a location lead, and a single safety lead oversees everyone. Emergency services in Australia are reached on 000; there are on-site paramedics at the First Aid Tent.`;

/* ----------------------------- structure-incident ---------------------------- */

const STRUCTURE_SYSTEM = `${CONTEXT}

A volunteer has just reported an incident by voice or text. Turn their words into a structured incident record for the safety team.

- type: the single best category.
- description: one or two plain, factual sentences in the third person. Only use facts the volunteer actually said; do not speculate.
- zoneId: the id of the zone where it is happening, chosen from the zone list. If the volunteer does not say, use the reporter's current zone. Use null only if neither is known.
- locationNote: a short landmark detail from the report (for example "by the water taps"), or null.
- suggestedUrgency: your recommendation. The volunteer will confirm or change it before anything is logged.
  - critical: life-threatening or escalating fast (unconscious or unresponsive person, collapse in extreme heat, breathing difficulty, weapon, crowd crush, spreading fire).
  - high: needs a response within minutes (injury, active fight, lost young child, aggressive intoxicated person).
  - medium: needs attention soon but stable.
  - low: minor, no immediate risk.
- urgencyRationale: one short sentence explaining the urgency, phrased for the volunteer.
- missingInfo: up to three short questions a responder would want answered that the report does not cover. Empty if nothing important is missing.`;

export function structureIncident(req: StructureIncidentRequest, chaos: Chaos) {
  const zones = req.zones.map((z) => `${z.id}: ${z.name} (${z.kind})`).join('\n');
  const user = `Reporter: ${req.reporterName}
Reporter's current zone: ${req.reporterZoneId ?? 'unknown'}
Local time: ${req.localTime}
Temperature: ${req.temperatureC}°C

Zones:
${zones}

<report>
${req.transcript}
</report>`;
  return callAI({
    name: 'structure-incident',
    model: HAIKU,
    system: STRUCTURE_SYSTEM,
    user,
    schema: StructuredIncident,
    check: (out) => checkStructuredIncident(out, req),
    timeoutMs: 15000,
    maxTokens: 800,
    chaos,
  });
}

/* ------------------------------ suggest-response ----------------------------- */

const SUGGEST_SYSTEM = `${CONTEXT}

You draft a response plan for the safety lead to approve. Nobody is dispatched until a human approves your plan.

The dispatch system has already chosen the candidates: they are checked in, available, not on another job, skill-matched to this incident type, and ranked by walking distance. "primary" candidates hold the core skill for this incident; "support" candidates can help (for example clearing space or managing the crowd). You may only assign people from this list, by their exact volunteerId.

How to plan:
- Choose the smallest team that can handle it safely, usually one to three people. Prefer the closest people with the right skills. Add a support person when crowd control or space-clearing would help.
- Consider languages only if the report suggests it matters.
Write for someone reading a phone while walking: plain everyday words, short sentences, no jargon, no brackets, no capital-letter shouting.
- For each assignee give a role of two or three words (for example "First aid lead") and a message of ONE sentence, at most 15 words, starting with a verb (for example "Go to the water taps and start cooling him in the shade.").
- whatToExpect: one sentence, at most 15 words, on what they will find.
- whoToFind: at most 10 words, normally the reporting volunteer by first name and where they are.
- summary: at most 12 words for the safety lead's queue, describing the situation, not listing names. If emergency services should be called, end with "Call 000." (for example "Man collapsed from heat at the water taps. Call 000.").
- reasoning: at most two short sentences, under 30 words in total, on why these people (distance and skills).

If none of the candidates can appropriately handle this, set canRespond to false, explain why in reasonIfCannot, and return an empty assignments list. A human will then write the response.`;

export function suggestResponse(req: SuggestResponseRequest, chaos: Chaos) {
  const i = req.incident;
  const candidates = req.candidates
    .map(
      (c) =>
        `- volunteerId=${c.volunteerId} | ${c.name} | ${c.tier} | skills: ${c.skills.join(', ') || 'none'} | matched: ${c.matchedSkills.join(', ') || 'none'} | languages: ${c.languages.join(', ')} | ${c.distanceM} m away (~${c.etaMin} min walk) | currently at ${c.zoneName}`,
    )
    .join('\n');
  const user = `Incident ${i.ref}
Type: ${i.type}
Urgency (confirmed by reporter): ${i.urgency}
Where: ${i.zoneName}${i.locationNote ? `, ${i.locationNote}` : ''}
Reported by: ${i.reporterName}
Description: ${i.description}
Local time: ${req.localTime}, ${req.temperatureC}°C

Candidates:
${candidates}`;
  return callAI({
    name: 'suggest-response',
    model: SONNET,
    effort: 'low',
    system: SUGGEST_SYSTEM,
    user,
    schema: SuggestedResponse,
    check: (out) => checkSuggestedResponse(out, req),
    timeoutMs: 20000,
    maxTokens: 2000,
    chaos,
  });
}

/* ------------------------------- related-check ------------------------------- */

const RELATED_SYSTEM = `${CONTEXT}

Several volunteers can report the same real-world event from different vantage points, describing it differently. The dispatch system has already filtered to reports that are close in place, time and type. For each earlier report, judge whether it is likely the same event as the new report.

- likelySame: true if they probably describe the same event.
- confidence: your probability, from 0 to 1, that they are the same event. Be calibrated: similar wording alone is not proof, and different wording does not rule it out.
- reason: one sentence the safety lead will read, pointing to the specific details that match or differ.

Return exactly one result for every earlier report, using its id.`;

export function relatedCheck(req: RelatedCheckRequest, chaos: Chaos) {
  const fmt = (x: RelatedCheckRequest['incident']) =>
    `${x.ref} (${x.type}) at ${x.zoneName}, reported by ${x.reporterName}: ${x.description}\nVerbatim: "${x.transcript}"`;
  const user = `New report:
${fmt(req.incident)}

Earlier reports:
${req.pairs.map((p) => `id=${p.id}\n${fmt(p)}\n${p.minutesApart} min apart, ${p.distanceM} m apart`).join('\n\n')}`;
  return callAI({
    name: 'related-check',
    model: SONNET,
    effort: 'low',
    system: RELATED_SYSTEM,
    user,
    schema: RelatedCheckResult,
    check: (out) => checkRelated(out, req),
    timeoutMs: 10000,
    maxTokens: 1000,
    chaos,
  });
}

/* ----------------------------------- brief ----------------------------------- */

const BRIEF_SYSTEM = `${CONTEXT}

Write a brief that text-to-speech will read aloud to a volunteer while they walk to an incident. Write three versions at different levels of detail; the app picks one based on how far they have to walk, and they can replay any of them.

- oneSentence: at most 20 words. What is happening and where.
- locationAndExpect: two or three sentences. Where to go (direction, distance, landmark) and what to expect when they arrive.
- full: five to seven sentences. Route, the situation, what to expect, who to find, their specific instructions, and one safety reminder suited to the conditions.

Write natural spoken English addressed to the volunteer as "you". No markdown, lists or symbols. Write units in full ("metres", "degrees"). Use only the facts provided.`;

export function brief(req: BriefRequest, chaos: Chaos) {
  const i = req.incident;
  const user = `Volunteer: ${req.volunteerName}, dispatched as ${req.role}
Incident: ${i.urgency} ${i.type} at ${i.zoneName}${i.locationNote ? `, ${i.locationNote}` : ''}
What happened: ${i.description}
Their instructions: ${req.message}
What to expect: ${req.whatToExpect}
Who to find: ${req.whoToFind}
Route: head ${req.direction}, ${req.distanceM} metres, about ${req.etaMin} minutes on foot
Conditions: ${req.temperatureC} degrees`;
  return callAI({
    name: 'brief',
    model: HAIKU,
    system: BRIEF_SYSTEM,
    user,
    schema: BriefResult,
    check: checkBrief,
    timeoutMs: 15000,
    maxTokens: 900,
    chaos,
  });
}

/* --------------------------------- placement --------------------------------- */

const PLACEMENT_SYSTEM = `${CONTEXT}

Before gates open, the safety lead wants suggestions for where volunteers should be positioned so the right skills are near the likely emergencies for today's conditions. Heat raises the risk of heat illness around water stations, stages and queues; licensed bars need Responsible Service of Alcohol holders; the kids zone needs Working With Children Check holders; stages and gates need crowd management and security.

Propose moves of volunteers between zones:
- Fix every unmet requirement you can, then strengthen the highest-risk zones for the conditions.
- Keep it minimal: at most 25 moves, and prefer moving people out of zones with surplus.
- Never move someone out of a zone if that would leave it below one of its own requirements.
- Use volunteer ids and zone ids exactly as given. Each volunteer may appear at most once.
- Give each move a short reason the safety lead will read.
- summary: two or three sentences on the overall plan. zoneNotes: one note per zone you changed.`;

export function placement(req: PlacementRequest, chaos: Chaos) {
  const user = `Local time: ${req.localTime}, forecast ${req.temperatureC}°C
Notes: ${req.notes}

Zones (id | name | kind | requirements | current staff):
${req.zones.map((z) => `${z.id} | ${z.name} | ${z.kind} | ${z.requirements} | ${z.currentStaff}`).join('\n')}

Volunteers (id|name|skills|languages|currentZoneId):
${req.volunteers.join('\n')}`;
  return callAI({
    name: 'placement',
    model: SONNET,
    effort: 'medium',
    system: PLACEMENT_SYSTEM,
    user,
    schema: PlacementResult,
    check: (out) => {
      const vids = new Set(req.volunteers.map((r) => r.split('|')[0]));
      const zids = new Set(req.zones.map((z) => z.id));
      const seen = new Set<string>();
      for (const m of out.moves) {
        if (!vids.has(m.volunteerId)) return `unknown volunteer ${m.volunteerId}`;
        if (!zids.has(m.toZoneId)) return `unknown zone ${m.toZoneId}`;
        if (seen.has(m.volunteerId)) return `${m.volunteerId} moved twice`;
        seen.add(m.volunteerId);
      }
      return out.moves.length > 25 ? 'too many moves' : null;
    },
    timeoutMs: 30000,
    maxTokens: 6000,
    chaos,
  });
}
