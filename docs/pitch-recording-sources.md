# Recorded pitch source audit

Sources checked on 2026-10-20 for issue #26. These libraries offer recorded
instrument material with redistribution permission. They do not supply independent
reference-frequency measurements or physical-device acceptance evidence.

## Small FreePats sources

| Source                                                                                                     | Provenance                                                                                     | Download                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Spanish classical guitar](https://freepats.zenvoid.org/Guitar/acoustic-guitar.html), version 2019-06-18   | Roberto, recorded in 2008 with an AKG Perception 120 microphone; noise filtering is documented | [SFZ + WAV archive](https://freepats.zenvoid.org/Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ-20190618.7z), 6.9 MiB compressed; [individual FLAC sources](https://github.com/freepats/spanish-classical-guitar/tree/main/samples)                                                                                                                                 |
| [Bass Guitar YR](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html), version 2019-09-30 | Andrea Biasior, Yamaha RBX bass; contributed in September 2019, integration edits by Roberto   | [Finger SFZ + WAV](https://github.com/freepats/electric-bass-YR/releases/download/2019-09-30/FingerBassYR-SFZ%2BWAV-20190930.7z), 5.1 MiB; [Pick SFZ + WAV](https://github.com/freepats/electric-bass-YR/releases/download/2019-09-30/PickedBassYR-SFZ%2BWAV-20190930.7z), 4.5 MiB; [individual FLAC sources](https://github.com/freepats/electric-bass-YR/tree/main/samples) |

Both publishers explicitly identify CC0 1.0. The [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/)
permits copying, modification and redistribution, including commercial use. Keep
the upstream license alongside imported audio and identify it as an asset exception
to this repository's code license. Credit the source without implying endorsement.

The linked source descriptions do not specify sample rates, a calibrated reference
instrument, measured frequencies, uncertainty, or exact recording dates. Read
sample rates from imported file headers; never infer a recording date from a release
date. Nominal sample names identify musical notes, not measured tuning accuracy.

## Coverage caveats

The [guitar mapping](https://raw.githubusercontent.com/freepats/spanish-classical-guitar/main/SpanishClassicalGuitar-20190618.sfz)
names D2, D#2, E2, A2, D3, G3, B3 and E4 sample files. Several intermediate notes
are mapped by transposition. The [Bass YR mapping](https://raw.githubusercontent.com/freepats/electric-bass-YR/main/FingerBassYR%2020190930.sfz)
has roots E1 through D#2 and stretches its extreme roots beyond that range.
Consequently, neither a sampler's playable range nor its rendered output proves
that all required preset notes were physically recorded. Root filenames alone also
do not establish an original open string, string number, or absence of upstream
pitch processing. These facts must remain unknown unless independently documented.

Use original decoded samples for regression comparisons. Do not render SFZ,
transpose notes, synthesize missing notes or loop a short recording and count those
as additional real-instrument coverage. In particular, Bass YR alone cannot prove
recorded D1, D#1 or G2 coverage, and the guitar mapping lacks direct sample files
for G#2 and C#3 used by Half step down.

## Alternative with broader bass range

[Karoryfer Black And Blue Basses](https://shop.karoryfer.com/pages/free-black-and-blue-basses)
records two five-string electric basses, with finger and pick articulations. Its
publisher links the [source repository](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses),
which includes samples and CC0 legal text. Individual original samples can be
selected there without downloading the complete library (over one gigabyte).
Five-string recordings can exercise low frequencies but do not establish acceptance
on a physical four-string bass. Recording dates, calibrated frequency measurements
and their uncertainties remain unavailable from the reviewed source description.

## What these sources can establish

Decoded recordings can add repeatable checks of MPM/YIN agreement, octave errors,
clarity and session feedback on real instrument timbres. An independent offline
analysis may provide a clearly labeled computational reference, with its method and
uncertainty recorded. It must not be described as an independently measured physical
frequency, and comparison against a nominal equal-tempered note does not isolate
estimator error from the recording's actual tuning.

The microphone path, acoustic environment, capture-to-result latency on supported
devices, interruptions and real four-string/open-string behavior still require
physical-device measurements under the existing release approval process.
