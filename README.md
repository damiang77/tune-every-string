# Tune Every String

Tune Every String is a browser tuner for guitar and bass. It will start in an approachable guided mode, with chromatic tuning available when a preset is not enough. More string instruments can be added without changing the product foundation.

The current implementation includes the bilingual application shell, guided Reference Tones for six-string Guitar Standard tuning, calibrated Chromatic Reference Tones from C1 through B7, and local microphone capture with live signal feedback. Pitch estimation will arrive in a later milestone.

## Product principles

- English at `/` and Polish at `/pl`, selected only from the URL
- Audio processed on the device, never uploaded for tuning
- Automatic guided tuning by default, with chromatic mode available
- Continuous triangle-wave Reference Tones for E2, A2, D3, G3, B3, and E4
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

Manrope is bundled locally through `@fontsource-variable/manrope`; the application does not fetch it from a third-party font service. Its SIL Open Font License is retained in [licenses/Manrope-OFL-1.1.txt](licenses/Manrope-OFL-1.1.txt).

## Source and contributions

Copyright © 2026 Damian Garbera. All rights reserved. The source is public for transparency, but no license is granted to copy, modify, distribute, or create derivative works. See [LICENSE.md](LICENSE.md).

Outside contributions are currently closed. See [CONTRIBUTING.md](CONTRIBUTING.md).
