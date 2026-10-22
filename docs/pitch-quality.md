# Pitch quality validation — issue #13

Run `npm run test:pitch` to compare MPM and YIN on identical synthetic inputs.
The comparison YIN implementation follows the cumulative mean normalized
squared difference, first threshold dip (0.15), and parabolic interpolation
from [de Cheveigné and Kawahara (2002)](https://doi.org/10.1121/1.1458024).
MPM remains the production estimator. YIN and fixtures are imported only by tests.
YIN additionally rejects a threshold dip when its clarity is more than 7% below
the strongest candidate, preventing a strong overtone from winning over a much
clearer fundamental.

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
format check now passes after the vendored skill formatting exclusions. Browser checks
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

- **PARTIAL: real recordings.** Eleven CC0 Guitar/Bass excerpts are now bundled
  with checksums and spectral references. Preset coverage and physical calibration
  remain incomplete; the strict comparison reports failures. See
  [recorded evidence](#recorded-input-evidence--2026-10-20).
- **BLOCKED: device measurements.** Run on representative iPhone/Safari,
  Android/Chrome, macOS/Safari and Chrome, Windows/Edge, and desktop Firefox.
  Record actual hardware, OS/browser versions, audio settings, Instrument,
  preset, Concert Pitch, reference frequency, first confident result latency,
  sustained-note p95 absolute error, false octave/String results and failures.
  Require ≤3 cents p95; investigate Guitar >150 ms or Bass >200 ms.
- **BLOCKED: observed playing conditions.** Synthetic additive noise, clipping
  and harmonics do not establish accuracy in an actual room or with an interface.

After review, #13 was closed at the maintainer's request. Remaining recordings,
sustained-note accuracy and supported-device latency acceptance are tracked in
[issue #27](https://github.com/damiang77/tune-every-string/issues/27) after
#26 was closed at the maintainer's request following review. They remain release
blockers; neither closure certifies real-device pitch quality. Closing #13 does not certify real-device pitch quality. No audio needs to leave a player's device during normal application use.

## Recorded validation tooling — issue #26

The [recorded validation protocol](recorded-pitch-validation.md) documents the
implemented PCM16 WAV/manifest validation and MPM/YIN replay through
`TuningSession`. Reports retain every sustained frame, raw and published error
distributions, clarity, misses and false String/octave selections. Explicit
recorded runs require both Guitar and Bass and fail on quality violations.
The ordinary suite's generated PCM validates the harness only; the bundled real-recording regression suite also runs by default. The external
strict acceptance command requires an explicit manifest and retains its failures. Physical-device
latency is not inferred from replay and remains null in its reports.

The recording, physical-device and observed-playing-condition blockers above
remain open. No recorded-instrument or device approval is claimed by this work.

## Recorded-input evidence — 2026-10-20

Imported eight Guitar and three Bass notes from CC0 FreePats sources.
The table below preserves the before-fix baseline; see the correction report below
for current YIN results. See
[provenance audit](pitch-recording-sources.md), [corpus README](../src/tuning/fixtures/recorded/README.md),
[manifest](../src/tuning/fixtures/recorded/manifest.json) and the
[full frame-level report](evidence/pitch-recorded-2026-10-20.json).
All excerpts retain the original 44.1 kHz rate and first two seconds; no pitch
shifting, looping, gain adjustment or synthetic completion is used.

A separate Hann-windowed DFT peak search measures the fundamental independently
of MPM/YIN in four 0.5-second blocks. The median supplies a **computational
file-clock reference**, not a calibrated physical frequency. The
[block measurements](../src/tuning/fixtures/recorded/references.json) expose
pitch variation. Block spread is a stability observation, not a confidence
interval or calibrated uncertainty. References do not certify device accuracy.
The fixed sustained evaluation interval is 0.4–1.5 seconds for every excerpt.

| Input      | MPM published p95 cents | YIN published p95 cents | Reference max block deviation cents |
| ---------- | ----------------------: | ----------------------: | ----------------------------------: |
| Guitar D2  |                   2.452 |                   2.428 |                               0.324 |
| Guitar D#2 |                   1.779 |                   1.799 |                               0.744 |
| Guitar E2  |                   1.171 |                   1.122 |                               0.559 |
| Guitar A2  |                   4.484 |                1199.892 |                              31.396 |
| Guitar D3  |                   3.675 |                   3.649 |                               0.871 |
| Guitar G3  |                   8.045 |                   8.146 |                               6.643 |
| Guitar B3  |                   7.864 |                   7.936 |                               3.025 |
| Guitar E4  |                   1.646 |                   1.656 |                               1.830 |
| Bass E1    |                   6.588 |                   6.637 |                               2.776 |
| Bass A1    |                   9.493 |                   9.576 |                               7.398 |
| Bass D2    |                   2.135 |                   2.186 |                               0.571 |

There were no sustained missed detections or wrong String selections in these
22 comparisons. MPM had no octave errors. The baseline YIN had two octave-error frames on
Guitar A2, now fixed as described below. No aggregate pass is claimed: six inputs exceed the three-cent
comparison gate for both estimators, and four references vary by more than
three cents between blocks. Scalar-reference drift and estimator bias cannot
be separated by this report alone. Investigate the stable-reference D3 and
Bass E1 differences and YIN's A2 octave errors; obtain calibrated/time-resolved
references before attributing every remaining difference to the estimators.
MPM remains the production estimator; this work changes no tuning behavior.

The ordinary bundled regression tests assert no misses/wrong String selections,
no MPM octave errors, and the three-cent gate on the five currently passing
inputs. They print all eleven inputs, including challenge failures, and do not
approve release. Run the strict all-input comparison with a fresh report path:

```bash
npm run test:pitch:recorded -- src/tuning/fixtures/recorded/manifest.json /tmp/pitch-recorded-report.json
```

This command currently **exits 1**, retaining every report before asserting.
Do not reduce the acceptance gate or omit failures to turn it green. The original
external recording case in the ordinary suite stays skipped without an explicit
manifest; bundled recorded regression tests run independently of that skip.
Physical capture/worker latency, supported device results, original String
identity and complete preset coverage remain unmeasured. These requirements
remain open under #27 after the maintainer requested closure of #26.

Local verification on Node 24.15.0 / npm 11.12.1: 115 ordinary tests passed
(one explicit external-manifest case skipped), and 16 dedicated pitch tests
passed with the same skip. The bundled real-recording tests run in both commands.
Lint, strict type checking, formatting, production build and bundle checks passed.
All emitted JavaScript remains 111,017 gzip bytes; recordings and reference
analysis are absent from production output. The strict recorded command failed
as described above. No physical microphone/device run was performed.

## Recorded-note correction — 2026-10-20

The focused command `npx vitest run src/tuning/RecordedPitchRegression.test.ts`
reproduced two false octave frames on Guitar A2 before the fix and passes after
it. In the failing frames, the normalized difference dip at approximately half
the fundamental period was 0.141/0.148, just under YIN's 0.15 threshold. The
fundamental-period dip was much deeper at 0.0022/0.0026. YIN now chooses the
earliest threshold dip whose clarity is within 7% of the strongest candidate,
using the same relative-clarity rule as MPM. This fixes the octave mistake
without selecting later period multiples on the clean/synthetic cases.

The [after-fix frame-level report](evidence/pitch-recorded-2026-10-20-after-fix.json)
records **zero sustained octave errors, wrong String selections or misses for
both estimators** on all eleven recordings. Guitar A2's YIN published comparison
p95 drops from 1199.892 cents to 4.575 cents. The remaining
three-cent comparison failures persist; they have not been hidden or waived.

A diagnostic spectral probe found non-integer partial relationships. For example,
Guitar D3's fundamental near 146.92 Hz and second partial divided by two near
147.22 Hz differ; Bass E1's equivalent values near 41.05 Hz and 41.22 Hz differ.
Consequently whole-waveform periodicity and a single long-window fundamental
peak can legitimately disagree. Drifting/inharmonic, uncalibrated recordings
cannot establish which result satisfies physical instrument accuracy. No MPM
production change is justified by this comparison alone.

The report now distinguishes numerical `failures` from `referenceWarnings` and
combines both in `acceptanceBlockers`. It labels all bundled computational
references `accuracyQualified: false`. The strict recorded command continues to
exit 1 for missing independent measured references as well as numerical failures.
A green numerical result alone can no longer approve an unqualified reference.
Manifest authors must supply reference kind, measured stability and evidence;
human review must still verify those claims. Actual hardware latency remains null.

Correction verification: 117 ordinary tests and 18 focused pitch tests pass;
one explicit external-manifest case is skipped in each ordinary invocation.
The strict external-manifest run was executed separately and intentionally fails
for unqualified references, saving the after-fix report. Formatting, lint, type
checking, production build and bundle budget pass. All production JavaScript
remains 111,017 gzip bytes; no recorded media or offline comparison code ships.
No physical-device microphone or latency approval is claimed.

## Review and tracking closure — 2026-10-20

Standards review found one path portability defect in the recording-preparation
script: passing a URL pathname to FFmpeg retained percent escapes in checkout
paths with spaces. The script now uses `fileURLToPath`; the same spaced-path
reproduction fails before the fix and passes after it. No other actionable
standards defects were found. The source suite was rerun: 117 tests passed with
one explicit external-manifest case skipped; lint, type checking and formatting
also passed.

Spec review identified three unfinished acceptance areas: qualified reference
measurements, the three-cent accuracy target, and physical-device/latency evidence.
The maintainer requested closure of #26; it is closed without claiming those
requirements passed, and all remaining acceptance is consolidated under #27.
Implementation changes remain local and uncommitted; exact release-candidate CI
and human approval are still required.

## Readable feedback presentation — 2026-10-22

Raw `pitchFeedback`, detected frequencies and meter position remain live. The
separate session snapshot field `displayPitchFeedback` holds each readable
message for at least 1,000 ms and requires a replacement to remain a candidate
for 260 ms. No Signal and Acquiring share the same listening guidance. Target,
lifecycle and explicit reset changes cancel pending messages immediately, so
stopping or changing a target cannot publish an old instruction later. React
renders one status message with a 140 ms entrance transition; reduced motion
removes the movement. This presentation delay is separate from estimator,
capture and first-published-pitch latency measurements.

Local validation: 119 ordinary tests passed (one explicit external-manifest
case skipped), 18 pitch tests passed (one corresponding skip), and 53 production
browser checks passed (three CDP-only performance cases skipped outside Chromium).
Lint, strict types, formatting, bilingual checks, production build and the bundle
budget passed. Desktop and phone layouts were inspected in English and Polish;
synthetic browser audio confirmed single-message updates 1,000 ms apart and
reduced-motion handling. No actual microphone quality or physical-device
approval is inferred from these checks.
