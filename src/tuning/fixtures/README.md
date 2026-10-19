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

Synthetic signals do not establish real Guitar or Bass performance. Before
closing #13, add rights-cleared recordings for both Instruments. Each recording
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
