export interface Instrument {
  readonly id: string
  readonly name: string
  readonly strings: readonly InstrumentString[]
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
