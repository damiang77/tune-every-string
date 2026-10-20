# Pitch fixtures

`SyntheticPitchFixtures.ts` creates original deterministic mathematical signals.
No microphone recordings, sampled instruments, third-party audio, or neural
models are included. These files follow the repository's all-rights-reserved
terms. Noise uses a seeded generator, so runs receive identical samples.

The suite checks clean signals at A4 = 430, 440 and 450 Hz, at 44.1 and 48 kHz,
for every String in all six launch presets. At 440 Hz / 48 kHz it also checks
harmonics, additive noise, clipping, silence, low amplitude, attacks, decays,
dropouts and a strong second harmonic. Both estimators receive the same frames
through the Tuning Session's microphone adapter. Existing session tests cover
selection boundaries and hysteresis separately.

## Recorded instrument fixtures: BLOCKED

Synthetic signals do not establish real Guitar or Bass performance. Follow-up
[issue #26](https://github.com/damiang77/tune-every-string/issues/26) requires
rights-cleared recordings for both Instruments before release approval. Each recording
must have a manifest containing:

- File path and SHA-256 checksum; uncompressed mono PCM WAV recommended.
- Recorder or source URL, recording date, license text, and explicit permission
  to redistribute the audio in this public, all-rights-reserved repository.
- Instrument, String, preset, independently measured reference frequency,
  Concert Pitch, sample rate, pluck onset and steady-note interval.
- Device/interface, browser (if captured there), applied audio settings, and
  room/amplification notes. No incidental speech or identifying audio.

Do not label a synthesized pluck as a real-instrument recording. Do not add
third-party recordings based only on an attribution or a downloadable URL.

## Offline recorded replay

The parser accepts mono PCM16 RIFF WAVs with verified SHA-256 checksums and a
required rights/reference manifest. See the [recorded validation protocol](../../../docs/recorded-pitch-validation.md)
for the exact manifest, command, report definitions and device worksheet.
Run `npm run test:pitch:recorded -- /absolute/manifest.json /tmp/pitch-report.json`.
The ordinary pitch suite checks the replay harness using clearly labeled
synthetic test data; its external-recording case is skipped until a manifest is
provided. This skip is not instrument acceptance. No real recordings are
currently included, and actual device latency remains unmeasured.
