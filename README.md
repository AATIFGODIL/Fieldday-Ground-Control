# Fieldday Ground Control

A mobile app (Expo / React Native, iOS + Android) for running ground control at a Fieldday Events festival: ~300 volunteers, a location lead per zone, and one safety lead. The app looks different for each role and includes a full **simulation mode** for demos.

## Quick start

```bash
npm install
npm --prefix server install
cp server/.env.example server/.env   # then add your ANTHROPIC_API_KEY
```

1. **Start the AI server** (the API key lives here only — never on the phone):

   ```bash
   npm run server
   ```

2. **Run the app in a development build.** On-device speech-to-text (`expo-speech-recognition`) is a native module, so Expo Go is not enough:

   ```bash
   npx expo run:ios        # or: npx expo run:android  (needs Xcode / Android Studio)
   ```

   No local toolchain? Build in the cloud: `npx eas-cli@latest build --profile development-simulator --platform ios` (or `--profile development` for a device).

3. The app finds the AI server on port 8787 of the same host as Metro. Override with `EXPO_PUBLIC_API_URL=http://<host>:8787`.

Without a development build the app still opens in Expo Go (`npx expo start --go`) and on the web (`npx expo start --web`). In Expo Go the mic button opens the keyboard so you can use the phone's own dictation; in a browser it uses the browser's speech recognition.

## Design

- **Black and white with a little royal colour.** Royal blue marks actions, violet marks anything the AI wrote, red and amber mark urgency. Light or dark follows the phone; the Demo menu can force either.
- **Nothing smaller than 17 pt.** People read this on foot, in the sun, mid-incident.
- **Calm motion.** Things fade in and settle on a long ease-out; nothing bounces. Entrance animations are off on web, where they start late.
- **Bottom bar.** Apple's own Liquid Glass tab bar on iPhone (shrinks on scroll, press-and-drag between tabs). Web and Android use a floating dock with a sliding highlight you can drag, clamped to the bar.
- **Fewer tabs.** Mo has *Now* and *Map*; volunteers have *Home*, *Report* and *Map*; location leads have *My zone* and *Map*. Placement, coverage, zones, availability and team live one level deeper under `src/app/tools/`.

## Demo script

First launch shows three intro screens, then **Show me how it works** starts the guided demo. A pinned card at the bottom says whose phone you're holding and what to tap; it switches person and screen for you. The **Demo** button (top right) restarts any story, switches person, changes light/dark, sim speed, position source and forces AI failures.

**Story 1: Heat collapse** (Sat 2 pm, 38°C)
1. Mo, the safety lead, sees an empty *Now* screen.
2. Jordan and Mei (the Water Station first-aiders) don't check in, and Mo gets a "Water Station is short" card.
3. As **Priya**, play the example voice report and continue. AI writes it up; Priya confirms the urgency herself.
4. Back as **Mo**: the AI suggests the nearest free first-aiders (Sam, ~70 m, first). Mo can edit what each person is told, then approves.
5. As **Sam**: the "You're needed" screen and a spoken brief sized to the walk (short, under 100 m). Sam's dot walks to the scene.

**Story 2: Possible duplicate** (Sat 8:30 pm, Lawn Stage)
1. Tom and Aisha report what may be the same fight from opposite sides of the stage.
2. Both incidents are flagged; nobody can be sent until Mo compares them side by side and chooses *Same thing · merge* or *Two separate things*.

**Story 3: When Mo is busy**
1. A critical collapse is reported and Mo doesn't respond.
2. As **Grace**, the Water Station lead, a countdown runs (sped up); after 30 seconds Grace can approve.
3. Mo gets a "Someone stepped in for you" card, and the history records who decided.

## How it works

```
Expo app                                       server/ (Hono + Anthropic SDK)
 src/app/        routes per role (volunteer/, lead/, safety/)
 src/domain/     pure, unit-tested logic  ───► /ai/structure-incident  (Haiku 4.5)
 src/positions/  PositionSource: simulated | GPS  /ai/brief            (Haiku 4.5)
 src/sim/        seed festival + 300 roster       /ai/suggest-response (Sonnet 5.5)
 src/state/      zustand store + AI pipeline      /ai/related-check    (Sonnet 5.5)
                                                  /ai/placement        (Sonnet 5.5)
```

- **Code decides who; AI decides how.** `src/domain/matching.ts` picks the 3–5 nearest available, checked-in, skill-matched volunteers by walking distance. The AI only chooses among those and writes the reasoning and messages; the server rejects any plan that names someone else.
- **Nothing is dispatched without a human.** The only path to a dispatch is `approve()`, gated by `canApprove()` in `src/domain/escalation.ts` (safety lead any time; the zone's location lead only after 2 min, or 30 s for critical; never while a possibly-related report is unresolved). Every approval is audit-logged with who made it, and escalated approvals notify the safety lead.
- **Failure is a designed path.** Every AI response is schema-validated (Zod) plus semantically checked, with a timeout. On failure: manual report form, "needs manual response" (with the code-picked candidates), rule-based related flag, template brief, or rule-based placement.
- **Duplicates:** code pre-filters by zone/distance, time and type; only plausible pairs go to the AI.
- **Briefs** are generated once per dispatch at three levels; the device picks by distance (<100 m one sentence, ≤300 m location + what to expect, else full) so replays are instant.
- **Positions** from the simulation or GPS both write into the same store; matching, the map and AI requests read from there, so switching to live tracking needs no matching changes. Location is only tracked and shared while a volunteer is checked in.

## Commands

```bash
npm test               # domain unit tests (matching, escalation, related, briefs, coverage, placement, geo)
npm run typecheck      # app types
npm run lint           # expo lint
npm --prefix server run typecheck
```

## Known limits

- Single-device demo: state lives on the device (role switcher instead of multiple phones). Store actions are commands that can move behind a sync backend later.
- Live GPS is foreground-only; background off-site alerts need `expo-location` background updates + `expo-task-manager`.
- Local notifications only (no remote push yet).
