import { createTargetPitch } from './Pitch'
import type { TargetPitch } from './Pitch'
import type { AccidentalPreference } from './TuningPreferences'

export type ChromaticPitchClass =
  0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export type ChromaticOctave = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface ChromaticNoteOption {
  readonly noteName: string
  readonly pitchClass: ChromaticPitchClass
}

const sharpNoteNames = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const
const flatNoteNames = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
] as const

export const chromaticOctaveOptions: readonly ChromaticOctave[] = Object.freeze(
  [1, 2, 3, 4, 5, 6, 7],
)

export function isChromaticOctave(value: number): value is ChromaticOctave {
  return chromaticOctaveOptions.includes(value as ChromaticOctave)
}

export function createChromaticNoteOptions(
  accidentalPreference: AccidentalPreference,
) {
  const noteNames =
    accidentalPreference === 'sharps' ? sharpNoteNames : flatNoteNames

  return Object.freeze(
    noteNames.map((noteName, pitchClass) =>
      Object.freeze({
        noteName,
        pitchClass: pitchClass as ChromaticPitchClass,
      }),
    ),
  )
}

export function createChromaticTarget(
  pitchClass: ChromaticPitchClass,
  octave: ChromaticOctave,
  accidentalPreference: AccidentalPreference,
  concertPitchHz: number,
): TargetPitch {
  const noteNames =
    accidentalPreference === 'sharps' ? sharpNoteNames : flatNoteNames

  return createTargetPitch(
    (octave + 1) * 12 + pitchClass,
    `${noteNames[pitchClass]}${octave}`,
    concertPitchHz,
  )
}

export function selectNearestChromaticTarget(
  frequencyHz: number,
  accidentalPreference: AccidentalPreference,
  concertPitchHz: number,
) {
  const midiNoteNumber = Math.max(
    24,
    Math.min(
      107,
      Math.round(69 + 12 * Math.log2(frequencyHz / concertPitchHz)),
    ),
  )
  const pitchClass = (midiNoteNumber % 12) as ChromaticPitchClass
  const octave = (Math.floor(midiNoteNumber / 12) - 1) as ChromaticOctave

  return Object.freeze({
    octave,
    pitchClass,
    targetPitch: createChromaticTarget(
      pitchClass,
      octave,
      accidentalPreference,
      concertPitchHz,
    ),
  })
}

export function createChromaticAnalysisRange(concertPitchHz: number) {
  return Object.freeze({
    maximumFrequencyHz: createTargetPitch(107, 'B7', concertPitchHz)
      .frequencyHz,
    minimumFrequencyHz: createTargetPitch(24, 'C1', concertPitchHz).frequencyHz,
  })
}
