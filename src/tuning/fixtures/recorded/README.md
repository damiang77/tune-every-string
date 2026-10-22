# Recorded instrument regression corpus

Eleven real-instrument excerpts, licensed CC0 1.0 Universal. The full upstream
legal text is in [CC0-1.0.txt](CC0-1.0.txt). These assets are an exception to the
repository's all-rights-reserved code/documentation terms. The upstream authors
do not endorse this application. No recordings enter the production bundle.

- Guitar: Roberto / FreePats, Spanish classical guitar, recorded in 2008 using
  an AKG Perception 120. The publisher documents noise filtering; exact date,
  interface, physical String and sample-clock calibration are unknown.
- Bass: Andrea Biasior, Yamaha RBX, finger articulation, with FreePats integration
  edits by Roberto. Contributed September 2019; exact recording date, interface,
  room, physical String and sample-clock calibration are unknown.

See [source audit](../../../../docs/pitch-recording-sources.md) for publisher links.
[sources.json](sources.json) pins original FLAC URLs, revisions, authors and
SHA-256 hashes. [manifest.json](manifest.json) identifies expected catalog String
selection, not proof of which physical String was recorded. WAVs retain the first
two seconds at 44.1 kHz, converted to mono PCM16 without resampling, gain change,
looping or pitch shifting. The Bass source is PCM24 and is quantized to PCM16.

## Reproduction

Requires Node/npm from the repository pins and FFmpeg on PATH. Run:

```bash
npm run pitch:prepare-recordings -- /tmp/tune-every-string-recording-sources
npm run test:pitch
npm run test:pitch:recorded -- src/tuning/fixtures/recorded/manifest.json /tmp/pitch-recorded-report.json
```

The preparation command downloads only pinned files missing from the cache,
verifies original hashes, decodes/crops them and measures references. It overwrites
this generated corpus/manifest; review all resulting changes. FFmpeg container
metadata can vary by version, so rebuilt WAV checksums may differ. The initial
import used FFmpeg 7.1.1. Original downloads remain in the supplied cache.
Default tests read only bundled files and never download audio. The strict last
command currently fails; see [results and failures](../../../../docs/pitch-quality.md#recorded-input-evidence--2026-10-20).

## Reference limitations

[references.json](references.json) records an independent mathematical DFT search
near the nominal fundamental, in four fixed Hann-windowed 0.5-second blocks.
It never calls MPM or YIN. The median is a computational file-clock reference;
it is **not a calibrated physical measurement**. Variation between blocks is
reported explicitly; it is not a calibrated error bar. Several notes drift,
which makes a scalar reference insufficient for attributing estimator error.
The onset is a fixed 1%-of-peak amplitude threshold in the edited file, not a
physical pluck timestamp. Real capture/worker latency remains unmeasured.

Guitar covers Standard plus the low D2/D#2 notes. Bass covers E1/A1/D2 only;
there is no recorded G2, D1 or D#1 in this corpus. Missing notes are not filled
by sampler transposition. These files do not complete all presets, physical
four-string behavior, original playing-room conditions or supported-device
acceptance now tracked under #27. Issue #26 was closed by maintainer request
after review, without physical-device approval.

The correction report in `docs/evidence/pitch-recorded-2026-10-20-after-fix.json`
records the fixed YIN octave selection. The manifest explicitly marks these
references `offline-spectral` and includes their observed block deviation and
evidence file. The strict command rejects these unqualified references even if
a numerical comparison happens to be below three cents.
