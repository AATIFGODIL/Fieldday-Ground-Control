/**
 * Guided demo. Each beat puts you in someone's shoes, on the right screen,
 * and says in one or two plain sentences what you're looking at. Some beats
 * wait for you to do the real thing (send a report, approve a response).
 */
import { router, type Href } from 'expo-router';
import { create } from 'zustand';

import { SCENARIOS, type ScenarioId } from '@/sim/scenarios';

import { runScriptedReport } from './pipeline';
import { resetScenario, setScriptedTranscript, setSpeed, signInAs, triggerNoShows, useStore, type State } from './store';

export interface Beat {
  /** Whose phone you're holding for this beat ('' = whoever was sent last). */
  as: string;
  /** Pick whose phone it is once the beat starts (overrides `as`). */
  who?: (s: State) => string | undefined;
  /** Where to take you. A function so it can point at things that exist by then. */
  route?: (s: State) => Href | null;
  title: string;
  body: string;
  /** Runs once when the beat starts. */
  enter?: () => void | Promise<void>;
  /** Button that moves on. Omit when the beat waits for you to act. */
  next?: string;
  /** Moves on by itself when this becomes true. */
  waitFor?: (s: State) => boolean;
  /** Shown instead of a button while waiting. */
  hint?: string;
}

const latest = (s: State) => s.incidents[0];
const MO = 'v-kim';

const HEAT = SCENARIOS.heat;
const report = (id: string) => HEAT.steps.find((x) => x.id === id) as Extract<(typeof HEAT.steps)[number], { kind: 'report' }>;

export type TourId = 'heat' | 'fight' | 'busy' | 'decline';

/** The first person sent to the latest incident (the nearest match), and whether anyone has said they can't go. */
const firstDispatch = (s: State) => s.dispatches.find((d) => d.incidentId === latest(s)?.id);
const latestDeclined = (s: State) => !!latest(s)?.declinedBy?.length;
const incidentRoute = (s: State): Href => (latest(s) ? { pathname: '/incident/[id]', params: { id: latest(s).id } } : '/safety');

export const TOURS: Record<TourId, { title: string; scenario: ScenarioId; beats: Beat[] }> = {
  heat: {
    title: 'Heat collapse',
    scenario: 'heat',
    beats: [
      {
        as: MO,
        route: () => '/safety',
        title: 'This is Mo, the safety lead',
        body: 'Saturday, 2pm, 38°C. Mo’s phone only shows what needs a decision. Right now, nothing does.',
        next: 'Next',
      },
      {
        as: MO,
        route: () => '/safety',
        enter: () => triggerNoShows(['v-jordan', 'v-mei']),
        title: 'Two first-aiders didn’t turn up',
        body: 'Jordan and Mei never checked in at the Water Station. Ground Control spotted the gap and told Mo straight away.',
        next: 'Next',
      },
      {
        as: 'v-priya',
        route: () => '/volunteer/report',
        enter: () => setScriptedTranscript(report('heat-report').transcript),
        title: 'Now you’re Priya, a volunteer',
        body: 'A man has just collapsed by the water taps. Tap “Play the example report” to hear what Priya says, then tap Continue.',
        waitFor: (s) => !!s.reportDraft || s.incidents.length > 0,
        hint: 'Play the example, then Continue',
      },
      {
        as: 'v-priya',
        title: 'AI wrote the report for her',
        body: 'Priya’s words became a tidy report. She only has to confirm how urgent it is, then send it.',
        waitFor: (s) => s.incidents.length > 0,
        hint: 'Pick an urgency, then Send',
      },
      {
        as: MO,
        route: (s) => (latest(s) ? { pathname: '/incident/[id]', params: { id: latest(s).id } } : '/safety'),
        title: 'Back to Mo',
        body: 'Ground Control suggests the nearest free first-aider. Nobody is sent anywhere until Mo approves.',
        waitFor: (s) => latest(s)?.status === 'approved',
        hint: 'Tap Approve and send',
      },
      {
        as: '',
        route: () => '/volunteer',
        title: 'The responder’s phone takes over',
        body: 'It shows where to go and reads the brief aloud. Short, because they’re under 100 m away. Watch their dot walk there.',
        next: 'Finish',
      },
      {
        as: MO,
        route: () => '/safety',
        title: 'That’s the whole loop',
        body: 'Someone reports it. AI writes it up and suggests who to send. Mo decides. Help arrives already briefed.',
        next: 'Try the second story',
      },
    ],
  },
  fight: {
    title: 'Possible duplicate',
    scenario: 'fight',
    beats: [
      {
        as: MO,
        route: () => '/safety',
        title: 'Saturday, 8:30pm, Lawn Stage',
        body: 'Two volunteers on opposite sides of the stage are about to report what might be the same fight.',
        next: 'Send both reports',
      },
      {
        as: MO,
        route: () => '/safety',
        enter: async () => {
          for (const step of SCENARIOS.fight.steps) {
            if (step.kind === 'report') await runScriptedReport(step);
          }
        },
        title: 'Same fight, or two?',
        body: 'Ground Control linked the two reports. Mo can’t send anyone until they decide. Open an incident and compare them.',
        waitFor: (s) => s.links.length > 0 && s.links.every((l) => l.resolution !== 'pending'),
        hint: 'Open an incident → Compare',
      },
      {
        as: MO,
        route: (s) => {
          const open = s.incidents.find((i) => i.status === 'suggested' || i.status === 'no_suggestion' || i.status === 'logged');
          return open ? { pathname: '/incident/[id]', params: { id: open.id } } : '/safety';
        },
        title: 'Now one response, not two',
        body: 'Merged reports mean one team goes, not two teams to the same fight.',
        waitFor: (s) => s.incidents.some((i) => i.status === 'approved'),
        hint: 'Tap Approve and send',
      },
      {
        as: MO,
        route: () => '/safety',
        title: 'Nothing got lost, nothing got doubled',
        body: 'Both reports are kept and linked, and every decision is logged with who made it.',
        next: 'One more story',
      },
    ],
  },
  busy: {
    title: 'When Mo is busy',
    scenario: 'heat',
    beats: [
      {
        as: MO,
        route: () => '/safety',
        enter: async () => {
          triggerNoShows(['v-jordan', 'v-mei']);
          await runScriptedReport(report('heat-report'));
        },
        title: 'A critical report, and Mo is busy',
        body: 'Priya has just reported a collapse. Mo is handling something else and hasn’t looked at their phone.',
        next: 'Next',
      },
      {
        as: 'v-grace',
        route: (s) => (latest(s) ? { pathname: '/incident/[id]', params: { id: latest(s).id } } : '/lead'),
        // Speed the clock up so the 30 seconds pass in a few.
        enter: () => setSpeed(10),
        title: 'Grace leads the Water Station',
        body: 'She sees the report straight away, but only Mo can approve at first. On a critical report, Grace can step in after 30 seconds.',
        waitFor: (s) => !!latest(s) && !!s.escalationNotified[latest(s).id],
        hint: 'Waiting out the 30 seconds (sped up)…',
      },
      {
        as: 'v-grace',
        enter: () => setSpeed(1),
        title: 'Grace steps in',
        body: 'Thirty seconds with no answer from Mo, so Grace can approve now. It’s recorded as Grace’s decision.',
        waitFor: (s) => latest(s)?.status === 'approved',
        hint: 'Tap Approve and send',
      },
      {
        as: MO,
        route: () => '/safety',
        title: 'Mo is told',
        body: 'Mo sees that Grace approved it. The history shows who decided and when, so nothing happens without a name on it.',
        next: 'One more story',
      },
    ],
  },
  decline: {
    title: 'When a volunteer can’t go',
    scenario: 'heat',
    beats: [
      {
        as: MO,
        route: () => '/safety',
        enter: async () => {
          triggerNoShows(['v-jordan', 'v-mei']);
          await runScriptedReport(report('heat-report'));
        },
        title: 'A collapse at the Water Station',
        body: 'Priya has just reported it. Ground Control has already found the nearest free first-aider for Mo.',
        next: 'Next',
      },
      {
        as: MO,
        route: incidentRoute,
        title: 'Mo sends them',
        body: 'Nobody is sent anywhere until Mo approves. Send the suggested responder.',
        waitFor: (s) => latest(s)?.status === 'approved',
        hint: 'Tap Approve and send',
      },
      {
        as: '',
        who: (s) => firstDispatch(s)?.volunteerId,
        route: (s) => (firstDispatch(s) ? { pathname: '/dispatch/[id]', params: { id: firstDispatch(s)!.id } } : '/volunteer'),
        title: 'But they can’t go',
        body: 'Maybe they’re already helping someone, or they’re on the other side of a crowd. Saying no takes one tap.',
        waitFor: latestDeclined,
        hint: 'Tap “I can’t go”',
      },
      {
        as: MO,
        route: incidentRoute,
        title: 'Mo already has the next person',
        body: 'Ground Control told Mo who can’t go and lined up the next nearest person with the same skills. Nobody is sent until Mo says yes.',
        waitFor: (s) => latestDeclined(s) && latest(s)?.status === 'approved',
        hint: 'Tap Approve and send',
      },
      {
        as: MO,
        route: incidentRoute,
        title: 'A no never leaves anyone waiting',
        body: 'The next person is on their way, and the history shows who said no and who went instead. If Mo hadn’t answered, the zone lead could have stepped in.',
        next: 'Done',
      },
    ],
  },
};

interface TourState {
  /** Which guided story is running (named `scenario` for history). */
  scenario: TourId | null;
  index: number;
  busy: boolean;
  minimised: boolean;
  /** Height of the pinned guide card, so pages can leave room to scroll past it. */
  cardHeight: number;
}

export const useTour = create<TourState>()(() => ({ scenario: null, index: 0, busy: false, minimised: false, cardHeight: 0 }));

function go(beat: Beat) {
  const s = useStore.getState();
  // The responder beat follows whoever was actually dispatched.
  const who = beat.who?.(s) || beat.as || s.dispatches[s.dispatches.length - 1]?.volunteerId || MO;
  if (s.currentUserId !== who) signInAs(who);
  const href = beat.route?.(useStore.getState());
  if (href) {
    if (router.canDismiss()) router.dismissAll();
    router.replace(href);
  }
}

async function enterBeat(scenario: TourId, index: number) {
  const beat = TOURS[scenario].beats[index];
  useTour.setState({ scenario, index, busy: !!beat.enter, minimised: false });
  go(beat);
  if (beat.enter) {
    await beat.enter();
    useTour.setState({ busy: false });
  }
}

export function startTour(tour: TourId) {
  resetScenario(TOURS[tour].scenario);
  void enterBeat(tour, 0);
}

export function nextBeat() {
  const { scenario, index } = useTour.getState();
  if (!scenario) return;
  const beats = TOURS[scenario].beats;
  if (index + 1 < beats.length) {
    void enterBeat(scenario, index + 1);
    return;
  }
  // Each story leads into the next: heat → duplicate → Mo is busy → can't go.
  if (scenario === 'heat') startTour('fight');
  else if (scenario === 'fight') startTour('busy');
  else if (scenario === 'busy') startTour('decline');
  else endTour();
}

export function endTour() {
  setSpeed(1);
  useTour.setState({ scenario: null, index: 0, busy: false, minimised: false });
}

export function setTourMinimised(minimised: boolean) {
  useTour.setState({ minimised });
}

/** Advance waiting beats when the thing they wait for happens. */
useStore.subscribe((s) => {
  const { scenario, index, busy } = useTour.getState();
  if (!scenario || busy) return;
  const beat = TOURS[scenario].beats[index];
  if (beat.waitFor?.(s)) {
    // Let the screen the user just acted on settle before moving them on.
    setTimeout(() => {
      const now = useTour.getState();
      if (now.scenario === scenario && now.index === index) nextBeat();
    }, 900);
  }
});
