# R1 — Widget Config & Session Initialization

## Summary
R1 is complete. The widget configuration contract is now shared and authoritative, session
initialization is consolidated into a single orchestrator, Turnstile gating/consent persistence/
visitor attribution/public-key-scoped tokens are implemented, and verification passes.

## Changes
- `src/lib/validation.ts`: authoritative `WidgetConfigSchema` (all client-required fields,
  `options: string[]` never null), `WidgetPositionSchema`; stricter `SessionBody` validation
  (`PageUrlSchema`, `UtmSchema` with `utm_*` keys, `LocaleSchema`).
- `src/app/api/widget/config/route.ts`: returns complete contract from DB values/defaults;
  normalises locale/timezone; never leaks secrets/internal ids.
- `src/app/api/widget/messages/route.ts`: returns `chatRoomId`, `status`, `consentGiven`,
  `currentStepKey` for restore.
- `src/lib/widget-storage.ts`: public-key-scoped storage helpers.
- `src/hooks/chatbot/use-chatbot.ts`: single session orchestrator (restore -> Turnstile gate
  -> create with attribution); consent only after server success; retry; scoped token;
  Pusher auth receives bearer token.
- `src/components/chatbot/index.tsx`: Turnstile drives orchestrator via token callback;
  consent button disabled until session; retry button.
- `src/components/chatbot/real-time.tsx`: scoped token + Pusher auth header.
- `vitest.postgres.config.ts`: sequential file execution for DB stability.
- Tests: `widget-contract.test.ts`, `widget-storage.test.ts`, `config/route.test.ts`,
  `use-chatbot.test.tsx`, `widget-session.pg.test.ts`.

## Verification
- `npm run typecheck`: exit 0
- `npm run lint`: exit 0 (9 pre-existing warnings)
- `npm run test`: 179 passed
- `npm run test:postgres`: 46 passed
- `npm run build`: exit 0 (compiled successfully)

## Scope
No questionnaire, AI answer pipeline, booking, Pusher rewrite, microservices, Redis, or unrelated refactoring.
Stopped before R2.
