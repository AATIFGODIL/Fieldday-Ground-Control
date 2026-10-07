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

Without a development build the app still opens (including on web via `npx expo start --web`), but voice input falls back to typing and OS notifications become in-app banners.

## Demo script

Sign in with festival ID **FD-2026**, choose **Kim Nguyen (safety lead)**, then tap the **DEMO** chip (top right) to open the demo panel. From there you can switch roles, reset scenarios, trigger scripted events, change sim speed (×1–×30), flip between simulated and live GPS, and force AI failures.

**Scenario 1 — Heat collapse** (Sat 2 pm, 38°C)
1. *Jordan & Mei no-show* → Kim gets a coverage alert: Water Station 0/2 first aid.
2. *Report as Priya* → **Play scripted voice** (or tap the mic and speak) → Continue. AI structures the report; Priya must **confirm the urgency** (Critical) before it's logged.
3. Switch to **Kim** → open INC-001 → AI-suggested response using the nearest available first-aiders (Sam ~70 m, then others) → **Approve & dispatch**.
4. Switch to **Sam** → "You're needed" takeover, notification, and the spoken brief (short version because he's <100 m away; replay Standard/Full anytime) while his dot walks to the incident.

**Scenario 2 — Possible duplicate** (Sat 8:30 pm, Lawn Stage)
1. *Auto-submit* Tom's and Aisha's reports (opposite sides of the Lawn Stage).
2. As **Kim**, both incidents show **POSSIBLY RELATED**; approval is blocked until you open **Compare side by side** and choose *Same incident — merge* or *Separate*.

Other things to show: location-lead escalation (sign in as **Grace** or **Raj**, wait out the 30 s / 2 min window — use ×10), *Ben wanders off-site* (off-site alert after 60 s), Placement suggestions, Coverage, Zones editor, dragging dots on the Map, and the Audit log.

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
