# Tune Every String

Tune Every String is a browser tuner for guitar and bass. It will start in an approachable guided mode, with chromatic tuning available when a preset is not enough. More string instruments can be added without changing the product foundation.

The current implementation includes a bilingual Tuner Screen, automatic Guided tuning for six-string Guitar and four-string Bass, calibrated Chromatic Reference Tones from C1 through B7, and local microphone capture with MPM pitch feedback.

## Product principles

- English at `/` and Polish at `/pl`, selected only from the URL
- Audio processed on the device, never uploaded for tuning
- Automatic guided tuning by default, with chromatic mode available
- Continuous triangle-wave Reference Tones for every Guitar and Bass String in Standard, Drop D, and Half Step Down
- Chromatic Reference Tones from C1 through B7 with adjustable Concert Pitch and remembered sharps-or-flats spelling
- A calm, responsive interface that works well on phones and desktops
- A brand name kept in one configuration file so it can be changed cleanly

The privacy architecture is recorded in [ADR 0001](docs/adr/0001-process-audio-on-device.md). Project terms are defined in [CONTEXT.md](CONTEXT.md).

## Local development

Requirements:

- Node.js 24.15.0, pinned in `.nvmrc`
- npm 11.12.1, pinned in `package.json`

```bash
nvm use
npm ci
npm run dev
```

Vite prints the local URL. Open `/` for English or `/pl` for Polish.

## Checks

```bash
npm run format
npm run lint
npm run typecheck
npm run i18n:status
npm test
npm run build
```

GitHub Actions runs these checks for pushes and pull requests. Dependabot checks npm dependencies weekly and groups both version and security updates.

## Localization

English is the source language. Translation files live in `src/i18n/locales`. Add user-facing copy through i18next, keep the English and Polish keys aligned, and run `npm run i18n:status` before committing.

## Fonts

DM Sans is bundled locally through `@fontsource-variable/dm-sans`; the application does not fetch it from a third-party font service. Its SIL Open Font License is retained in [licenses/DM-Sans-OFL-1.1.txt](licenses/DM-Sans-OFL-1.1.txt).

## Source and contributions

Copyright © 2026 Damian Garbera. All rights reserved. The source is public for transparency, but no license is granted to copy, modify, distribute, or create derivative works. See [LICENSE.md](LICENSE.md).

Outside contributions are currently closed. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy, localization review and production metadata

Privacy is available at `/privacy` and `/pl/prywatnosc`. The language switch
preserves the current page. Browser language preferences do not change routes.

Run `npm run i18n:generate` after changing copy. `npm run i18n:status` checks
key parity, non-empty translations, interpolation parity and syntax, and stale
generated key types. Resource-derived i18next types remain the source for typed
translation calls. Review every Polish string in [the review sheet](docs/polish-copy-review.md)
and record a fluent reviewer's approval before production.

For deployment, run `SITE_ORIGIN=https://your-production-host npm run build:production`
with the real HTTPS origin, without a trailing slash. Deploy `dist` including
its localized route directories and `_headers`. Configure directory index serving
for all four routes; do not rewrite them all to the English root HTML. Hosts that
do not support `_headers` must apply those headers in their own configuration.
The production HTML also carries the CSP; `frame-ancestors` requires the HTTP header.
The CSP permits same-origin assets, workers and connections, and inline style
attributes for the moving tuner meter. It disallows external services and inline
scripts. The development server uses its normal development policy.

Production verification: inspect all four direct route responses and their title,
description, canonical and alternate links. In a clean browser profile, inspect
Network while loading both languages, using Listen and Reference Tone, opening
settings and switching to privacy. All requests must be same-origin; check the
console for CSP violations and confirm microphone capture stops on privacy navigation.
Actual microphone behavior still requires a device and browser permission.
