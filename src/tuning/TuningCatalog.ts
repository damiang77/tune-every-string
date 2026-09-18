export interface Instrument {
  readonly id: string
  readonly name: string
  readonly pitchAnalysis?: PitchAnalysisRequirements
  readonly strings: readonly InstrumentString[]
}

export interface PitchAnalysisRequirements {
  readonly maximumFrequencyHz: number
  readonly minimumFrequencyHz: number
  readonly minimumPeriods: number
}

export interface InstrumentString {
  readonly id: string
  readonly position: number
}

export interface TuningPreset {
  readonly id: string
  readonly instrumentId: string
  readonly name: string
  readonly targets: readonly TuningPresetTarget[]
}

export interface TuningPresetTarget {
  readonly midiNoteNumber: number
  readonly noteName: string
  readonly stringId: string
}

const guitarStrings: readonly InstrumentString[] = Object.freeze([
  Object.freeze({ id: 'guitar-6', position: 6 }),
  Object.freeze({ id: 'guitar-5', position: 5 }),
  Object.freeze({ id: 'guitar-4', position: 4 }),
  Object.freeze({ id: 'guitar-3', position: 3 }),
  Object.freeze({ id: 'guitar-2', position: 2 }),
  Object.freeze({ id: 'guitar-1', position: 1 }),
])

export const guitar: Instrument = Object.freeze({
  id: 'guitar',
  name: 'Guitar',
  pitchAnalysis: Object.freeze({
    maximumFrequencyHz: 420,
    minimumFrequencyHz: 60,
    minimumPeriods: 3,
  }),
  strings: guitarStrings,
})

export const guitarStandardTuning: TuningPreset = Object.freeze({
  id: 'standard',
  instrumentId: guitar.id,
  name: 'Standard',
  targets: Object.freeze([
    Object.freeze({ stringId: 'guitar-6', noteName: 'E2', midiNoteNumber: 40 }),
    Object.freeze({ stringId: 'guitar-5', noteName: 'A2', midiNoteNumber: 45 }),
    Object.freeze({ stringId: 'guitar-4', noteName: 'D3', midiNoteNumber: 50 }),
    Object.freeze({ stringId: 'guitar-3', noteName: 'G3', midiNoteNumber: 55 }),
    Object.freeze({ stringId: 'guitar-2', noteName: 'B3', midiNoteNumber: 59 }),
    Object.freeze({ stringId: 'guitar-1', noteName: 'E4', midiNoteNumber: 64 }),
  ]),
})

export const guitarDropDTuning: TuningPreset = Object.freeze({
  id: 'drop-d',
  instrumentId: guitar.id,
  name: 'Drop D',
  targets: Object.freeze([
    Object.freeze({ stringId: 'guitar-6', noteName: 'D2', midiNoteNumber: 38 }),
    ...guitarStandardTuning.targets.slice(1),
  ]),
})

export const guitarHalfStepDownTuning: TuningPreset = Object.freeze({
  id: 'half-step-down',
  instrumentId: guitar.id,
  name: 'Half Step Down',
  targets: Object.freeze([
    Object.freeze({
      stringId: 'guitar-6',
      noteName: 'E♭2',
      midiNoteNumber: 39,
    }),
    Object.freeze({
      stringId: 'guitar-5',
      noteName: 'A♭2',
      midiNoteNumber: 44,
    }),
    Object.freeze({
      stringId: 'guitar-4',
      noteName: 'D♭3',
      midiNoteNumber: 49,
    }),
    Object.freeze({
      stringId: 'guitar-3',
      noteName: 'G♭3',
      midiNoteNumber: 54,
    }),
    Object.freeze({
      stringId: 'guitar-2',
      noteName: 'B♭3',
      midiNoteNumber: 58,
    }),
    Object.freeze({
      stringId: 'guitar-1',
      noteName: 'E♭4',
      midiNoteNumber: 63,
    }),
  ]),
})

export const guitarTuningPresets: readonly TuningPreset[] = Object.freeze([
  guitarStandardTuning,
  guitarDropDTuning,
  guitarHalfStepDownTuning,
])

const bassStrings: readonly InstrumentString[] = Object.freeze([
  Object.freeze({ id: 'bass-4', position: 4 }),
  Object.freeze({ id: 'bass-3', position: 3 }),
  Object.freeze({ id: 'bass-2', position: 2 }),
  Object.freeze({ id: 'bass-1', position: 1 }),
])

export const bass: Instrument = Object.freeze({
  id: 'bass',
  name: 'Bass',
  pitchAnalysis: Object.freeze({
    maximumFrequencyHz: 220,
    minimumFrequencyHz: 30,
    minimumPeriods: 4,
  }),
  strings: bassStrings,
})

export const bassStandardTuning: TuningPreset = Object.freeze({
  id: 'standard',
  instrumentId: bass.id,
  name: 'Standard',
  targets: Object.freeze([
    Object.freeze({ stringId: 'bass-4', noteName: 'E1', midiNoteNumber: 28 }),
    Object.freeze({ stringId: 'bass-3', noteName: 'A1', midiNoteNumber: 33 }),
    Object.freeze({ stringId: 'bass-2', noteName: 'D2', midiNoteNumber: 38 }),
    Object.freeze({ stringId: 'bass-1', noteName: 'G2', midiNoteNumber: 43 }),
  ]),
})

export const bassDropDTuning: TuningPreset = Object.freeze({
  id: 'drop-d',
  instrumentId: bass.id,
  name: 'Drop D',
  targets: Object.freeze([
    Object.freeze({ stringId: 'bass-4', noteName: 'D1', midiNoteNumber: 26 }),
    ...bassStandardTuning.targets.slice(1),
  ]),
})

export const bassHalfStepDownTuning: TuningPreset = Object.freeze({
  id: 'half-step-down',
  instrumentId: bass.id,
  name: 'Half Step Down',
  targets: Object.freeze([
    Object.freeze({ stringId: 'bass-4', noteName: 'E♭1', midiNoteNumber: 27 }),
    Object.freeze({ stringId: 'bass-3', noteName: 'A♭1', midiNoteNumber: 32 }),
    Object.freeze({ stringId: 'bass-2', noteName: 'D♭2', midiNoteNumber: 37 }),
    Object.freeze({ stringId: 'bass-1', noteName: 'G♭2', midiNoteNumber: 42 }),
  ]),
})

export const bassTuningPresets: readonly TuningPreset[] = Object.freeze([
  bassStandardTuning,
  bassDropDTuning,
  bassHalfStepDownTuning,
])

export const instruments: readonly Instrument[] = Object.freeze([guitar, bass])

export function getTuningPresets(instrumentId: string) {
  if (instrumentId === guitar.id) return guitarTuningPresets
  if (instrumentId === bass.id) return bassTuningPresets
  return Object.freeze([]) as readonly TuningPreset[]
}
