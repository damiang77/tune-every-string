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
