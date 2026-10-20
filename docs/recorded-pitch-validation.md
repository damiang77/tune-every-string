# Recorded pitch and physical-device validation — issue #26

Status: **BLOCKED pending rights-cleared recordings and actual device runs.**
The replay harness is implemented; its generated test signals validate the
harness, not instrument accuracy. Nothing in this document approves release.
Normal application use still stores and uploads no audio or pitch history.
The offline tooling is imported by tests only.

## Supply recordings

Keep a manifest and mono PCM16 RIFF WAV files in a local directory, outside
`public/` and outside production assets. Files must stay inside the manifest's
directory, including after resolving symbolic links. No conversion, resampling
or downmixing occurs in the runner. Preserve original recordings separately if
you convert them to the supported format, and document the conversion.

Provide real Guitar and Bass recordings. Start with every String of Standard,
Drop D and Half Step Down; expand to representative room noise, attack/decay,
input levels and interfaces. Use a calibrated independent reference, not MPM,
YIN or a frequency inferred solely from the intended Note Name. Record the
method, uncertainty and stability of the measured reference. A scalar reference
is valid only over an independently verified stable sustained interval; split
unstable material into separately referenced intervals or reject it.

The manifest is a nonempty JSON array. Each entry has these fields (the values
below are a format example, **not recording evidence**):

```json
[
  {
    "id": "guitar-standard-e2-take-01",
    "file": "guitar-standard-e2-take-01.wav",
    "sha256": "REPLACE_WITH_64_LOWERCASE_HEX_DIGITS",
    "source": "Recorder name or original source URL",
    "recordedAt": "YYYY-MM-DD",
    "redistributionTerms": "Full applicable license/redistribution text",
    "redistributionPermission": "Explicit permission to redistribute in this public all-rights-reserved repository; evidence reference",
    "referenceMethod": "Independent calibrated measurement method, reference frequency uncertainty and interval stability",
    "conditions": "Hardware/interface, OS/browser if used, applied audio settings, room/amplification and conversion details",
    "instrumentId": "guitar",
    "presetId": "standard",
    "stringId": "guitar-6",
    "referenceFrequencyHz": 82.406889,
    "concertPitchHz": 440,
    "sampleRateHz": 48000,
    "pluckOnsetSeconds": 0.1,
    "sustainedStartSeconds": 0.5,
    "sustainedEndSeconds": 2.0
  }
]
```

Use `shasum -a 256 recording.wav` to obtain each checksum. Metadata validation
checks presence and shape; a human must verify rights and reference evidence.
Do not submit confidential permission documents or identifying incidental audio.

## Replay and review failures

```bash
npm run test:pitch:recorded -- /absolute/recordings/manifest.json /tmp/pitch-report.json
```

The command fails without both paths, without recordings of both Instruments,
or when an acceptance assertion fails. It writes frame-level JSON before
quality assertions so failed results remain available. Choose a new report path
for each run; existing files are never overwritten. Both estimators receive
identical PCM windows, replayed in order through independent `TuningSession`
instances. Sessions use their production analysis requirements and a 40 ms hop.
The runner awaits each estimation and session publication, so it does **not**
model browser dropped frames, real-time scheduling or the worker adapter.

Only windows wholly within the supplied sustained interval contribute to the
sustained distributions. Read raw and published/smoothed absolute cents p50,
p95 and maximum together with raw/published misses, minimum/median published
clarity, and false published String/octave counts. Octave errors use the existing

> 600-cent definition. Every sustained window contributes to either a detected
> reading or a miss; a final good frame cannot conceal earlier failures. The
> conservative replay gate rejects any sustained miss or wrong String/octave,
> as well as raw or published p95 >3 cents. Do not reduce the gate to make a
> recording pass; document the failure for correction.

`firstPublishedSignalMs` and `firstInTuneSignalMs` are frame-end signal times
relative to the supplied pluck onset. They include the analysis window but
exclude capture hardware, browser/worker scheduling, transfer and computation.
`actualDeviceLatencyMs` is deliberately null. These fields cannot approve the
150 ms Guitar / 200 ms Bass targets. Keep the manifest, report, source revision,
command and rights/reference evidence together when reviewing a run.

## Physical-device evidence

Run on actual iPhone/Safari, Android/Chrome, macOS/Safari, macOS/Chrome,
Windows/Edge and desktop Firefox. Emulation and synthetic browser streams do
not substitute for these runs. Follow [release readiness](release-readiness.md)
for supported-version coverage and human approval.

For every configuration, copy and fill this worksheet. Leave missing evidence
as **NOT MEASURED**, never as zero or an inferred pass.

| Field                                                                          | Evidence     |
| ------------------------------------------------------------------------------ | ------------ |
| Date, operator, release commit and URL                                         | NOT MEASURED |
| Hardware, input/interface, OS and browser versions                             | NOT MEASURED |
| Instrument, String, preset and Concert Pitch                                   | NOT MEASURED |
| Room, distance, amplification and independently measured reference             | NOT MEASURED |
| Applied sample rate, echo cancellation, noise suppression, auto gain, channels | NOT MEASURED |
| Onset/reference method, synchronization and measurement uncertainty            | NOT MEASURED |
| Individual onset-to-first-confident-result latencies, repeat count and p95     | NOT MEASURED |
| Sustained interval, sample count and absolute error p50/p95/max                | NOT MEASURED |
| Minimum/median clarity, misses, false octave/String counts                     | NOT MEASURED |
| Stop, navigation, permission cancellation and interruption recovery            | NOT MEASURED |
| Failures, raw evidence location and reviewer approval                          | NOT MEASURED |

Measure from the physical pluck/input onset to the first published non-null
Detected Pitch, with microphone capture already running. Include capture,
window acquisition, browser/worker scheduling, transfer and computation. Keep
permission/startup delay and time to stable In Tune as separate measurements.
An offline WAV timestamp or a `performance.now()` timer around the estimator
alone is insufficient. Use a synchronized external onset reference and browser
trace, documenting clock alignment and uncertainty. If using high-frame-rate
video of the physical onset and updated diagnostic readout, label the result
as an upper bound including display latency; do not claim sub-frame precision.
The note displayed while idle is a Target Pitch, not proof of detection.

Require sustained absolute error ≤3 cents p95; investigate and document Guitar
latency >150 ms or Bass latency >200 ms. Retain every failed take, including
misses, rather than reporting only successes. Obtain the human approvals in
[release readiness](release-readiness.md) before marking #26 or #14 complete.
