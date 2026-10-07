import { brief, relatedCheck, structureIncident, suggestResponse } from './endpoints';

const zones = [{ id: 'z-water', name: 'Water Station', kind: 'water' }];

/**
 * Send one tiny request through each time-critical endpoint when the server
 * starts, so connection setup and the first use of each response schema happen
 * before a volunteer is waiting. Results are discarded; failures are only
 * logged by callAI. Set AI_WARMUP=off to skip (for example under `tsx watch`).
 */
export async function warmUp() {
  if (process.env.AI_WARMUP === 'off') return;
  if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) return;
  const started = Date.now();
  await Promise.allSettled([
    structureIncident(
      { transcript: 'Warm-up: person feeling dizzy at the water station.', reporterName: 'Warm-up', reporterZoneId: 'z-water', zones, localTime: '14:00 Saturday', temperatureC: 30 },
      null,
    ),
    suggestResponse(
      {
        incident: { ref: 'WARM-UP', type: 'medical', description: 'Person feeling dizzy.', urgency: 'low', zoneName: 'Water Station', locationNote: null, reporterName: 'Warm-up' },
        candidates: [
          { volunteerId: 'v-warmup', name: 'Warm Up', skills: ['first_aid'], matchedSkills: ['first_aid'], languages: ['English'], distanceM: 50, etaMin: 1, zoneName: 'Water Station', tier: 'primary' },
        ],
        localTime: '14:00 Saturday',
        temperatureC: 30,
      },
      null,
    ),
    relatedCheck(
      {
        incident: { id: 'a', ref: 'WARM-UP-A', type: 'medical', description: 'Person feeling dizzy.', transcript: 'Dizzy person.', zoneName: 'Water Station', reporterName: 'Warm-up' },
        pairs: [{ id: 'b', ref: 'WARM-UP-B', type: 'medical', description: 'Someone dizzy.', transcript: 'Someone dizzy.', zoneName: 'Water Station', reporterName: 'Warm-up', minutesApart: 1, distanceM: 20 }],
      },
      null,
    ),
    brief(
      {
        incident: { type: 'medical', description: 'Person feeling dizzy.', urgency: 'low', zoneName: 'Water Station', locationNote: null },
        volunteerName: 'Warm Up',
        role: 'First aid lead',
        message: 'Check on them.',
        whatToExpect: 'A dizzy person.',
        whoToFind: 'The reporter.',
        distanceM: 50,
        etaMin: 1,
        direction: 'north',
        temperatureC: 30,
      },
      null,
    ),
  ]);
  console.log(`[ai] warm-up finished in ${Date.now() - started}ms`);
}
