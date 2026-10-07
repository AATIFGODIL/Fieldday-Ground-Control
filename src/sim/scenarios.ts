import type { Urgency } from '@/domain/types';

import { at } from './seed/festival';

export type ScenarioId = 'heat' | 'fight';

export type ScenarioStep =
  | { kind: 'no_show'; id: string; label: string; detail: string; volunteerIds: string[] }
  | {
      kind: 'report';
      id: string;
      label: string;
      detail: string;
      reporterId: string;
      transcript: string;
      /** The urgency the scripted volunteer confirms when the step is auto-run. */
      confirmUrgency: Urgency;
    }
  | { kind: 'wander'; id: string; label: string; detail: string; volunteerId: string };

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  startAt: number;
  temperatureC: number;
  /** Volunteers who are rostered but have not checked in at the start. */
  notCheckedIn: string[];
  /** Who the demo operator should be signed in as after reset. */
  startAs: string;
  steps: ScenarioStep[];
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  heat: {
    id: 'heat',
    title: 'Heat collapse',
    subtitle: 'Sat 2:00 pm · 38°C · Water Station',
    startAt: at(14),
    temperatureC: 38,
    notCheckedIn: ['v-jordan', 'v-mei'],
    startAs: 'v-kim',
    steps: [
      {
        kind: 'no_show',
        id: 'heat-noshow',
        label: 'Jordan & Mei no-show',
        detail: 'The two first-aiders rostered at the Water Station never check in.',
        volunteerIds: ['v-jordan', 'v-mei'],
      },
      {
        kind: 'report',
        id: 'heat-report',
        label: 'Priya reports a collapse',
        detail: 'Voice report from the water taps.',
        reporterId: 'v-priya',
        transcript:
          "I need help at the water station, a guy just collapsed right by the taps. He's really red and sweaty and he's confused, not making sense when I talk to him. I think it's the heat. His mate is here with him.",
        confirmUrgency: 'critical',
      },
      {
        kind: 'wander',
        id: 'heat-wander',
        label: 'Ben wanders off-site',
        detail: 'Ben leaves through the North Gate without checking out.',
        volunteerId: 'v-ben',
      },
    ],
  },
  fight: {
    id: 'fight',
    title: 'Possible duplicate',
    subtitle: 'Sat 8:30 pm · 27°C · Lawn Stage',
    startAt: at(20, 30),
    temperatureC: 27,
    notCheckedIn: [],
    startAs: 'v-kim',
    steps: [
      {
        kind: 'report',
        id: 'fight-tom',
        label: 'Tom reports a fight (west)',
        detail: 'From the west side of the Lawn Stage.',
        reporterId: 'v-tom',
        transcript:
          "There's a fight breaking out near the front of the Lawn Stage, two guys throwing punches. People are pushing back to get away from them.",
        confirmUrgency: 'high',
      },
      {
        kind: 'report',
        id: 'fight-aisha',
        label: 'Aisha reports a scuffle (east)',
        detail: 'From the east side, about 130 m away.',
        reporterId: 'v-aisha',
        transcript:
          "Something's going on at the front of the Lawn Stage, looks like a couple of blokes shoving each other and a crowd's forming around them. One of them might be hurt.",
        confirmUrgency: 'high',
      },
    ],
  },
};
