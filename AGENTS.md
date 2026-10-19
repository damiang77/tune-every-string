# Working in Tune Every String

## Start with the relevant sources

- Read `CONTEXT.md` before changing tuning behavior or product terminology.
- Use `README.md` for setup, commands, localized routes, and deployment requirements.
- Inspect `git status --short` before editing; preserve existing work and keep changes scoped to the request.
- Use the Node version in `.nvmrc` and npm version in `package.json`, with `npm ci` and `package-lock.json`.

## Architecture and product contracts

This is a client-side React + TypeScript application built with Vite, with React Router and i18next. There is no tuning backend.

- Keep tuning state and transitions in `src/tuning/TuningSession.ts`; React screens consume session snapshots and dispatch actions. Preserve injectable microphone, pitch estimator, preference store, and reference tone interfaces so behavior can be tested without hardware.
- Keep pitch calculations, instrument/preset definitions, and feedback tracking in `src/tuning/`. Browser audio adapters own Web Audio and media resources; production pitch estimation runs through the worker adapter.
- Read `docs/adr/0001-process-audio-on-device.md` for audio/privacy changes. Audio and derived pitch measurements stay on the device. Keep runtime requests same-origin and fonts bundled locally.
- Audio changes must account for stop, navigation, interruption, failure, and permission resolving after cancellation. Release acquired tracks and audio resources, and preserve explicit user control over capture recovery.
- Keep the brand name in `src/config/brand.ts`.
- Preserve URL-selected language: English at `/` and `/privacy`, Polish at `/pl` and `/pl/prywatnosc`. Language switching preserves the page; browser language does not select the route.

## Implementation conventions

- Follow the existing strict TypeScript settings, including `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`; model optional values explicitly rather than weakening compiler settings.
- Use CSS modules for screen styles and `src/styles/global.css` for shared foundations. Follow the repository's Prettier and ESLint configuration.
- Add user-facing copy to both `src/i18n/locales/en/translation.json` and `src/i18n/locales/pl/translation.json`. Run `npm run i18n:generate` after copy changes and verify with `npm run i18n:status`; generate `src/i18n/generated.d.ts` through the script.
- Keep feedback understandable through text, keyboard operation, visible focus, and reduced motion. Reserve layout space for changing pitch/status feedback; keep precise Hz opt-in through Settings.
- For interface work, consult `.agents/skills/impeccable/SKILL.md` when available and follow the existing visual language. Edit existing SVG/CSS assets directly when those formats fit the change.

## Tools and validation

Use `package.json` and `.github/workflows/ci.yml` as the authoritative command/check definitions.

- Use `rg` for source discovery. Consult the relevant module and tests before editing.
- Put domain tests in colocated `src/**/*.test.ts` files and component tests in `src/**/*.test.tsx`, using Vitest and Testing Library. Test observable behavior through the existing injected interfaces.
- For code changes, run the relevant tests plus `npm run lint`, `npm run typecheck`, and formatting checks. Run `npm test` and `npm run build` before handing off substantial changes. For documentation-only changes, check the edited Markdown's formatting and references.
- For pitch estimation, analysis windows, or feedback changes, run `npm run test:pitch` and read `docs/pitch-quality.md` plus `src/tuning/fixtures/README.md`. Synthetic accuracy is distinct from real-instrument/device validation.
- For routes, metadata, CSP, or production output, run `SITE_ORIGIN=https://example.test npm run build:production`. Deployment requires the actual HTTPS origin; consult `README.md` for directory indexes and response headers.
- Run `npm run check:bundle` after building when dependencies, workers, or assets change. The budget covers all emitted JavaScript, including the worker.
- Use `npm run test:e2e` for production browser checks in `e2e/`. Its Playwright configuration builds and serves the app on port 4279 and covers Chromium, Firefox, WebKit, and mobile emulation. Install missing engines using the command in `README.md`.
- When browser tools are available, inspect UI changes at phone and desktop sizes, in both languages and relevant interactive states. Use the configured Playwright suite for repeatable evidence; report unavailable browser/device checks explicitly.
- Keep generated `dist/`, browser reports, traces, and TypeScript build caches out of source edits. Change their source files or generators instead.

## Completion and release evidence

Summarize the behavior changed, checks actually run, and unresolved limitations. Automated browser tests and emulation do not establish real microphone quality or physical-device support.

For release work, read `docs/release-readiness.md`. Preserve its human approval requirements for actual devices, accessibility, pitch quality, Polish copy, and deployed headers/routes. Record evidence before marking a release check complete.
