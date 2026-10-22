# Pitch fixtures

`SyntheticPitchFixtures.ts` creates original deterministic mathematical signals.
The synthetic generator contains no recordings or third-party samples.
Its files follow the repository's all-rights-reserved terms. Separately,
`recorded/` contains eleven CC0 real-instrument excerpts with upstream credits,
checksums and computational reference measurements; see its README. Noise uses a seeded generator, so runs receive identical samples.

The suite checks clean signals at A4 = 430, 440 and 450 Hz, at 44.1 and 48 kHz,
for every String in all six launch presets. At 440 Hz / 48 kHz it also checks
harmonics, additive noise, clipping, silence, low amplitude, attacks, decays,
dropouts and a strong second harmonic. Both estimators receive the same frames
through the Tuning Session's microphone adapter. Existing session tests cover
selection boundaries and hysteresis separately.

## Recorded instrument acceptance: BLOCKED

Synthetic signals do not establish real Guitar or Bass performance. Follow-up
[issue #27](https://github.com/damiang77/tune-every-string/issues/27) preserves
the remaining acceptance after #26 was closed by maintainer request and requires
representative recordings and physical-device measurements before release approval.
The initial CC0 corpus covers both Instruments but has incomplete note coverage
and no physical calibration. Each additional recording
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
provided. This skip is not instrument acceptance. Eleven bundled CC0 recordings now run in the ordinary pitch suite as regression
inputs. The external case remains the strict all-input acceptance command; its
current failures are retained in the evidence report. Actual device latency
remains unmeasured.
