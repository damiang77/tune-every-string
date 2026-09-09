import {
  guitar,
  guitarStandardTuning,
  type Instrument,
  type TuningPreset,
} from './TuningCatalog'
import {
  chromaticOctaveOptions,
  createChromaticNoteOptions,
  createChromaticTarget,
  isChromaticOctave,
  type ChromaticNoteOption,
  type ChromaticOctave,
  type ChromaticPitchClass,
} from './ChromaticPitch'
import { createTargetPitch, type TargetPitch } from './Pitch'
import type {
  AccidentalPreference,
  TuningPreferenceStore,
} from './TuningPreferences'

export interface ReferenceToneOutput {
  play(frequencyHz: number): Promise<void>
  stop(): Promise<void>
}

export interface TuningString extends TargetPitch {
  readonly id: string
}

export interface TuningSessionSnapshot {
  readonly accidentalPreference: AccidentalPreference
  readonly chromaticNoteOptions: readonly ChromaticNoteOption[]
  readonly chromaticOctaveOptions: readonly ChromaticOctave[]
  readonly chromaticSelection: Readonly<{
    octave: ChromaticOctave
    pitchClass: ChromaticPitchClass
  }>
  readonly chromaticTarget: TargetPitch
  readonly concertPitchHz: number
  readonly instrument: Instrument
  readonly referenceToneError: 'audio-unavailable' | null
  readonly referenceToneStatus: 'stopped' | 'playing'
  readonly selectedString: TuningString
  readonly tuningPreset: TuningPreset
  readonly tuningMethod: 'reference-tone'
  readonly tuningMode: 'guided' | 'chromatic'
  readonly strings: readonly TuningString[]
  readonly targetPitch: TargetPitch
}

export type TuningSessionCommand =
  | { readonly type: 'play-reference-tone' }
  | {
      readonly type: 'select-chromatic-note'
      readonly pitchClass: ChromaticPitchClass
    }
  | {
      readonly type: 'select-chromatic-octave'
      readonly octave: ChromaticOctave
    }
  | { readonly type: 'set-concert-pitch'; readonly concertPitchHz: number }
  | { readonly type: 'select-string'; readonly stringId: string }
  | {
      readonly type: 'select-tuning-mode'
      readonly tuningMode: TuningSessionSnapshot['tuningMode']
    }
  | {
      readonly type: 'set-accidental-preference'
      readonly accidentalPreference: AccidentalPreference
    }
  | { readonly type: 'stop' }

export interface TuningSession {
  dispatch(command: TuningSessionCommand): Promise<void>
  getSnapshot(): TuningSessionSnapshot
  subscribe(listener: () => void): () => void
}

interface CreateTuningSessionOptions {
  readonly referenceToneOutput: ReferenceToneOutput
  readonly concertPitchHz?: number
  readonly instrument?: Instrument
  readonly preferenceStore?: TuningPreferenceStore
  readonly tuningPreset?: TuningPreset
}

function assertConcertPitch(concertPitchHz: number) {
  if (
    !Number.isFinite(concertPitchHz) ||
    concertPitchHz < 430 ||
    concertPitchHz > 450
  ) {
    throw new Error('Concert Pitch must be between 430 and 450 Hz')
  }
}

export function createTuningSession({
  concertPitchHz: initialConcertPitchHz = 440,
  instrument: instrumentInput = guitar,
  preferenceStore,
  referenceToneOutput,
  tuningPreset: tuningPresetInput = guitarStandardTuning,
}: CreateTuningSessionOptions): TuningSession {
  assertConcertPitch(initialConcertPitchHz)
  let concertPitchHz = initialConcertPitchHz

  const instrument: Instrument = Object.freeze({
    ...instrumentInput,
    strings: Object.freeze(
      instrumentInput.strings.map((string) => Object.freeze({ ...string })),
    ),
  })
  const tuningPreset: TuningPreset = Object.freeze({
    ...tuningPresetInput,
    targets: Object.freeze(
      tuningPresetInput.targets.map((target) => Object.freeze({ ...target })),
    ),
  })

  if (tuningPreset.instrumentId !== instrument.id) {
    throw new Error('The Tuning Preset does not belong to the Instrument')
  }

  const targetsByString = new Map(
    tuningPreset.targets.map((target) => [target.stringId, target]),
  )

  if (
    targetsByString.size !== tuningPreset.targets.length ||
    tuningPreset.targets.length !== instrument.strings.length
  ) {
    throw new Error('A Tuning Preset must assign one Target Pitch per String')
  }

  function createTuningStrings(nextConcertPitchHz: number) {
    return Object.freeze(
      instrument.strings.map(({ id }) => {
        const target = targetsByString.get(id)

        if (!target) {
          throw new Error(
            'A Tuning Preset must assign one Target Pitch per String',
          )
        }

        return Object.freeze({
          id,
          ...createTargetPitch(
            target.midiNoteNumber,
            target.noteName,
            nextConcertPitchHz,
          ),
        })
      }),
    )
  }

  let strings = createTuningStrings(concertPitchHz)
  const listeners = new Set<() => void>()
  const initialString = strings[0]
  let referenceToneStatus: TuningSessionSnapshot['referenceToneStatus'] =
    'stopped'

  if (!initialString) {
    throw new Error('A Tuning Preset must contain at least one String')
  }

  let selectedString: TuningString = initialString
  let accidentalPreference =
    preferenceStore?.loadAccidentalPreference() ?? 'sharps'
  let chromaticPitchClass: ChromaticPitchClass = 9
  let chromaticOctave: ChromaticOctave = 4
  let chromaticNoteOptions = createChromaticNoteOptions(accidentalPreference)
  let chromaticTarget = createChromaticTarget(
    chromaticPitchClass,
    chromaticOctave,
    accidentalPreference,
    concertPitchHz,
  )
  let referenceToneError: TuningSessionSnapshot['referenceToneError'] = null
  let tuningMode: TuningSessionSnapshot['tuningMode'] = 'guided'

  function getSelectedTarget(): TargetPitch {
    return tuningMode === 'guided' ? selectedString : chromaticTarget
  }

  function createSnapshot(): TuningSessionSnapshot {
    return Object.freeze({
      accidentalPreference,
      chromaticNoteOptions,
      chromaticOctaveOptions,
      chromaticSelection: Object.freeze({
        octave: chromaticOctave,
        pitchClass: chromaticPitchClass,
      }),
      chromaticTarget,
      concertPitchHz,
      instrument,
      referenceToneError,
      referenceToneStatus,
      selectedString,
      strings,
      targetPitch: getSelectedTarget(),
      tuningMethod: 'reference-tone',
      tuningMode,
      tuningPreset,
    })
  }

  let snapshot = createSnapshot()
  let pendingCommand: Promise<void> | undefined

  function publishSnapshot() {
    snapshot = createSnapshot()
    listeners.forEach((listener) => listener())
  }

  async function retunePlayingReferenceTone(targetPitch: TargetPitch) {
    if (referenceToneStatus !== 'playing') return

    try {
      await referenceToneOutput.play(targetPitch.frequencyHz)
    } catch {
      referenceToneError = 'audio-unavailable'
      referenceToneStatus = 'stopped'
    }
  }

  async function executeCommand(command: TuningSessionCommand) {
    if (command.type === 'set-accidental-preference') {
      if (command.accidentalPreference === accidentalPreference) return

      accidentalPreference = command.accidentalPreference
      chromaticNoteOptions = createChromaticNoteOptions(accidentalPreference)
      chromaticTarget = createChromaticTarget(
        chromaticPitchClass,
        chromaticOctave,
        accidentalPreference,
        concertPitchHz,
      )
      preferenceStore?.saveAccidentalPreference(accidentalPreference)
      publishSnapshot()
      return
    }

    if (
      command.type === 'select-chromatic-note' ||
      command.type === 'select-chromatic-octave'
    ) {
      const nextPitchClass =
        command.type === 'select-chromatic-note'
          ? command.pitchClass
          : chromaticPitchClass
      const nextOctave =
        command.type === 'select-chromatic-octave'
          ? command.octave
          : chromaticOctave

      if (!isChromaticOctave(nextOctave)) {
        throw new Error('Chromatic octave must be between 1 and 7')
      }

      const nextTarget = createChromaticTarget(
        nextPitchClass,
        nextOctave,
        accidentalPreference,
        concertPitchHz,
      )

      chromaticPitchClass = nextPitchClass
      chromaticOctave = nextOctave
      chromaticTarget = nextTarget
      referenceToneError = null

      if (tuningMode === 'chromatic') {
        await retunePlayingReferenceTone(chromaticTarget)
      }

      publishSnapshot()
      return
    }

    if (command.type === 'set-concert-pitch') {
      assertConcertPitch(command.concertPitchHz)
      if (command.concertPitchHz === concertPitchHz) return

      concertPitchHz = command.concertPitchHz
      strings = createTuningStrings(concertPitchHz)
      selectedString =
        strings.find(({ id }) => id === selectedString.id) ?? strings[0]!
      chromaticTarget = createTargetPitch(
        chromaticTarget.midiNoteNumber,
        chromaticTarget.noteName,
        concertPitchHz,
      )
      referenceToneError = null
      await retunePlayingReferenceTone(getSelectedTarget())

      publishSnapshot()
      return
    }

    if (command.type === 'select-tuning-mode') {
      if (command.tuningMode === tuningMode) return

      tuningMode = command.tuningMode
      referenceToneError = null
      await retunePlayingReferenceTone(getSelectedTarget())
      publishSnapshot()
      return
    }

    if (command.type === 'select-string') {
      const nextString = strings.find(({ id }) => id === command.stringId)

      if (!nextString) {
        throw new Error(`Unknown String: ${command.stringId}`)
      }

      if (nextString === selectedString) return

      selectedString = nextString
      referenceToneError = null

      if (tuningMode === 'guided') {
        await retunePlayingReferenceTone(selectedString)
      }

      publishSnapshot()
      return
    }

    if (command.type === 'play-reference-tone') {
      if (referenceToneStatus === 'playing') return

      try {
        await referenceToneOutput.play(getSelectedTarget().frequencyHz)
        referenceToneError = null
        referenceToneStatus = 'playing'
      } catch {
        referenceToneError = 'audio-unavailable'
        referenceToneStatus = 'stopped'
      }
      publishSnapshot()
      return
    }

    if (referenceToneStatus === 'stopped') return

    try {
      await referenceToneOutput.stop()
      referenceToneError = null
    } catch {
      referenceToneError = 'audio-unavailable'
    }
    referenceToneStatus = 'stopped'
    publishSnapshot()
  }

  function dispatch(command: TuningSessionCommand) {
    const previousCommand = pendingCommand
    const result = previousCommand
      ? previousCommand
          .catch(() => undefined)
          .then(() => executeCommand(command))
      : executeCommand(command)

    pendingCommand = result
    const clearCompletedCommand = () => {
      if (pendingCommand === result) pendingCommand = undefined
    }
    void result.then(clearCompletedCommand, clearCompletedCommand)

    return result
  }

  return {
    dispatch,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
