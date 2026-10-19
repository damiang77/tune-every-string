# Pitch quality validation — issue #13

Run `npm run test:pitch` to compare MPM and YIN on identical synthetic inputs.
The comparison YIN implementation follows the cumulative mean normalized
squared difference, first threshold dip (0.15), and parabolic interpolation
from [de Cheveigné and Kawahara (2002)](https://doi.org/10.1121/1.1458024).
MPM remains the production estimator. YIN and fixtures are imported only by tests.

The report includes final-frame absolute cents error at the 95th percentile, earliest
published pitch in simulated signal time, minimum published clarity, missed
signals, final incorrect String selections and octave errors (>600 cents).
Silence and below-gate signals must publish no pitch. Every clean target must
finish In Tune, select the intended String and remain within three cents.
Adversarial misses/errors are reported for correction, rather than hidden by
excluding failed detections from a pass claim. Error percentiles apply only to
detected signals; always read them alongside missed counts.

Signal time includes a complete analysis window and 40 ms frame intervals.
It excludes permission, audio hardware, browser scheduling, worker transfer and
estimator computation. First published pitch is not the same as stable In Tune.
Consequently these measurements do not certify the 150 ms Guitar / 200 ms Bass
real-device targets. Bass uses 8,192 samples; Guitar uses 4,096 samples.

## Local synthetic results — 2026-10-19

Node 24.15.0, npm 11.12.1; these are synthetic results, not device approval.
The full suite passed 103 tests. The focused comparison passed four tests.

| Estimator | Instrument | Detected cases | Final-frame p95 cents | First published signal time p95 | Minimum clarity | Final String / octave errors | Dropout rejections |
| --------- | ---------- | -------------: | --------------------: | ------------------------------: | --------------: | ---------------------------- | -----------------: |
| MPM       | Guitar     |            231 |                 0.384 |                        92.88 ms |           0.868 | 0 / 0                        |                  3 |
| MPM       | Bass       |            146 |                 0.204 |                       185.76 ms |           0.854 | 0 / 0                        |                 10 |
| YIN       | Guitar     |            231 |                 0.172 |                        92.88 ms |           0.876 | 0 / 0                        |                  3 |
| YIN       | Bass       |            147 |                 0.261 |                       185.76 ms |           0.854 | 0 / 0                        |                  9 |

All clean cases passed. All rejected pitched cases were dropout windows;
rejections during a missing/partial signal are not automatically defects.
Separate assertions verify full dropout clears feedback, recovery restores In
Tune, and both estimators select correctly on either side of a String boundary.
Silence, weak input, and pure noise rejection are asserted separately and are
excluded from detected-case counts. This report samples final frames, rather
than establishing a real instrument's sustained-note error distribution.

Validation also passed lint, type checking, bilingual checks and the production
build with a test HTTPS origin. Changed files pass Prettier; the repository-wide
format check remains blocked by 73 existing skill/plugin files. Browser checks
confirmed pointer and keyboard access to diagnostics at desktop and 390px widths,
with no mobile horizontal overflow. The production JavaScript excludes the
diagnostic display and comparison estimator.

## Development diagnostics

Run `npm run dev`, open the Tuner Screen and expand **Development pitch
diagnostics**. While Listen runs it shows frequency, cents, clarity, signal
level, frame interval, sample rate, selected String, target frequency,
calibration and applied device settings. It reads the current immutable
snapshot, stores no history and is removed from production builds. Diagnostic
labels are developer identifiers, rather than translated product copy.

## Approval blockers

- **BLOCKED: real recordings.** No rights-cleared Guitar or Bass recordings
  were supplied. See [fixture requirements](../src/tuning/fixtures/README.md).
- **BLOCKED: device measurements.** Run on representative iPhone/Safari,
  Android/Chrome, macOS/Safari and Chrome, Windows/Edge, and desktop Firefox.
  Record actual hardware, OS/browser versions, audio settings, Instrument,
  preset, Concert Pitch, reference frequency, first confident result latency,
  sustained-note p95 absolute error, false octave/String results and failures.
  Require ≤3 cents p95; investigate Guitar >150 ms or Bass >200 ms.
- **BLOCKED: observed playing conditions.** Synthetic additive noise, clipping
  and harmonics do not establish accuracy in an actual room or with an interface.

Issue #13 must remain open until recordings and supported-device results are
reviewed. No audio needs to leave a player's device during normal application use.
