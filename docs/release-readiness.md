# Release readiness — issue #14

Issue #14 was reviewed and closed at the maintainer's request. Remaining release
approvals are tracked in [issue #27](https://github.com/damiang77/tune-every-string/issues/27).
Release approval is **BLOCKED** until the human checks below have recorded results.
Passing synthetic or automated checks does not approve microphone hardware,
real-instrument accuracy, physical touch targets, or assistive technology behavior.

## Repeatable checks

Use Node/npm pinned by `.nvmrc` and `package.json`:

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run format
npm run lint
npm run typecheck
npm run i18n:status
npm test
SITE_ORIGIN=https://example.test npm run build:production
npm run check:bundle
npm run test:e2e -- --workers=1
```

The browser suite builds production output and serves it with gzip and generated security headers on port 4279. It covers
Chromium, Firefox, WebKit and an emulated iPhone viewport. Emulation is not a
physical iPhone/Safari result. HTML reports and failed traces are retained in CI.
Vitest runs only source unit tests; the TypeScript check includes browser tests.

Checks cover direct localized routes and refresh, privacy language switching,
persisted settings, responsive overflow, keyboard order and visible focus,
reduced motion, axe WCAG A/AA checks (including contrast and target-size rules),
Reference Tone UI start/stop after injected capture failures (audio resume is
stubbed in those failure cases), injected 110 Hz analyser samples
through the microphone adapter and real pitch worker (no hardware capture), textual live In Tune feedback and track teardown
on privacy navigation. Axe cannot approve every accessibility criterion.

The compressed JavaScript check counts **all** emitted JS, including the worker,
against a 200,000-byte gzip ceiling. It rejects recorded audio/model assets in
build assets. Review all new dependencies and public assets for models or large
recordings as part of release review.

A Chromium-only cold-navigation test uses 1.6 Mbps download, 750 Kbps upload,
150 ms latency and 4× CPU slowdown at 390 × 844. It requires first contentful
paint and visible, enabled Start tuning content below two seconds. Font responses
are held until the initial meter measurement, then released; central-meter
position and size changes must remain within two pixels as fonts settle. This is a repeatable proxy; complete the sustained meter checks below.
Its timing is attached to the Playwright report.

## Browser and device sign-off — BLOCKED

At test time, record the actual current and previous major version numbers;
do not infer support from the Playwright engine version. Run the entire checklist
on both versions where installation is possible. Record unavailable combinations
as blockers with an owner, rather than marking them passed.

| Device / OS                  | Browser coverage                                        | Result / evidence / reviewer |
| ---------------------------- | ------------------------------------------------------- | ---------------------------- |
| macOS                        | Chrome, Edge, Firefox, Safari; current + previous major | BLOCKED: human run required  |
| Windows                      | Chrome, Edge, Firefox; current + previous major         | BLOCKED: human run required  |
| Representative Android phone | Chrome; current + previous major                        | BLOCKED: human run required  |
| Representative iPhone        | Safari; current + previous supported iOS major          | BLOCKED: human run required  |

For each run record: release commit, URL, date, reviewer, device model, OS,
browser/version, built-in/external microphone model, sample rate and actual
applied echo cancellation/noise suppression/gain/channel settings. Development
diagnostics expose applied settings; repeat core behavior on the production build.
Record Instrument, Tuning Preset, String, Concert Pitch, reference frequency,
room/input conditions, first confident pitch latency, sustained p95 absolute cents
error, wrong String/octave results, interruptions and failure notes.

1. Open and refresh `/`, `/pl`, `/privacy`, `/pl/prywatnosc` directly over HTTPS.
   Verify language switching, translated metadata and privacy copy.
2. Start Listen; allow permission. Verify each Guitar and Bass String in Standard,
   Drop D and Half Step Down. Check automatic String selection and String Lock;
   repeat in Chromatic Mode and at Concert Pitch limits (430 and 450 Hz).
3. Measure against known references using rights-cleared recordings and real
   playing. Follow [pitch quality requirements](pitch-quality.md) and
   [issue #27](https://github.com/damiang77/tune-every-string/issues/27), which
   preserves the remaining acceptance after #26 was closed by maintainer request.
   Require sustained p95 error ≤3 cents; investigate Guitar latency >150 ms and
   Bass >200 ms. Record misses separately from detected-note error statistics.
4. Deny permission, remove/busy the input, mute/disconnect it, change input,
   hide the page and lock the phone. Confirm clear recovery messaging, safe
   Resume behavior and no unexpected automatic capture restart.
5. Stop Listen and navigate to privacy while capturing and while permission is
   pending. Confirm the physical browser microphone indicator clears and any
   late permission success releases its tracks. Verify silence inactivity teardown.
6. Use Reference Tone for both Instruments/presets and Chromatic C1–B7. Verify
   start/stop, pitch changes, calibration, mode changes, interruptions and teardown.
   Keep speaker volume comfortable; confirm reference output does not feed capture.
7. Operate all controls by keyboard. Check logical focus order, visible focus,
   settings close/open, zoom at 200%/400%, 320px layout and landscape. Use actual
   touch to verify targets and scrolling. With VoiceOver and NVDA, check names,
   selected states, errors, live feedback and announcements during held notes.
   Verify Too Low / In Tune / Too High are understandable without color.
8. Enable reduced motion. Confirm no unnecessary motion. While estimating a
   sustained note, record a performance trace: inspect frame pacing, worker
   activity, main-thread long tasks and central-meter shifts. Record dropped
   frames and perceived delay; do not approve based only on average FPS.
9. In a fresh profile inspect Network through both methods/modes and privacy.
   Confirm only same-origin requests, no audio/pitch uploads, no CSP errors,
   and no service worker. Reload to verify remembered settings in both languages.

## Final approval — BLOCKED

- [ ] Qualified recorded-instrument accuracy and actual device measurements approved
      under #27; closing #26 did not approve these checks.
- [ ] Every supported browser/device row has evidence and named approval.
- [ ] Manual accessibility and sustained-meter performance evidence accepted.
- [ ] Fluent reviewer records approval of the complete interface and privacy copy
      in [Polish copy review](polish-copy-review.md).
- [ ] All required GitHub checks pass for the exact release commit.
- [ ] Production origin, headers, direct routes and runtime network behavior are
      verified on the deployed candidate under #15.

Record approval date, release commit, reviewer and evidence links here before
approving production under #27. Closing #14 does not certify release readiness.
Local automation is evidence for the tested build only.

## Local automation evidence — 2026-10-19

On macOS with Node 24.15.0 / npm 11.12.1, the production browser run passed
45 checks across Chromium, Firefox, WebKit and mobile WebKit emulation. Three
CDP performance cases are intentionally skipped outside Chromium. The Chromium
mobile paint and two-pixel meter stability budgets passed with gzip serving.
All axe scans returned no violations for the covered pages and settings state.
The source suite passed 103 tests; formatting, lint, strict type checking,
bilingual checks and the production build passed. All emitted JS including the
worker measured 111,549 gzip bytes against the 200,000-byte budget.

These are local results, not a GitHub release-candidate check run or physical
device approval. The human and deployment blockers above remain open in #27 after #26
was closed by maintainer request.
