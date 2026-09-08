import {
  guitar,
  guitarStandardTuning,
  type Instrument,
  type TuningPreset,
} from './TuningCatalog'

export interface ReferenceToneOutput {
  play(frequencyHz: number): Promise<void>
  stop(): Promise<void>
}

export interface TargetPitch {
  readonly frequencyHz: number
  readonly midiNoteNumber: number
  readonly noteName: string
}

export interface TuningString {
  readonly id: string
  readonly noteName: string
  readonly midiNoteNumber: number
  readonly frequencyHz: number
}

export interface TuningSessionSnapshot {
  readonly instrument: Instrument
  readonly referenceToneError: 'audio-unavailable' | null
  readonly referenceToneStatus: 'stopped' | 'playing'
  readonly selectedString: TuningString
  readonly tuningPreset: TuningPreset
  readonly tuningMethod: 'reference-tone'
  readonly tuningMode: 'guided'
  readonly strings: readonly TuningString[]
}

export type TuningSessionCommand =
  | { readonly type: 'play-reference-tone' }
  | { readonly type: 'select-string'; readonly stringId: string }
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
  readonly tuningPreset?: TuningPreset
}

function frequencyFromMidiNote(midiNoteNumber: number, concertPitchHz: number) {
  return concertPitchHz * 2 ** ((midiNoteNumber - 69) / 12)
}

export function createTuningSession({
  concertPitchHz = 440,
  instrument: instrumentInput = guitar,
  referenceToneOutput,
  tuningPreset: tuningPresetInput = guitarStandardTuning,
}: CreateTuningSessionOptions): TuningSession {
  if (
    !Number.isFinite(concertPitchHz) ||
    concertPitchHz < 430 ||
    concertPitchHz > 450
  ) {
    throw new Error('Concert Pitch must be between 430 and 450 Hz')
  }

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

  const strings = Object.freeze(
    instrument.strings.map(({ id }) => {
      const target = targetsByString.get(id)

      if (!target) {
        throw new Error(
          'A Tuning Preset must assign one Target Pitch per String',
        )
      }

      return Object.freeze({
        id,
        frequencyHz: frequencyFromMidiNote(
          target.midiNoteNumber,
          concertPitchHz,
        ),
        midiNoteNumber: target.midiNoteNumber,
        noteName: target.noteName,
      })
    }),
  )
  const listeners = new Set<() => void>()
  const initialString = strings[0]
  let referenceToneStatus: TuningSessionSnapshot['referenceToneStatus'] =
    'stopped'

  if (!initialString) {
    throw new Error('A Tuning Preset must contain at least one String')
  }

  let selectedString: TuningString = initialString
  let referenceToneError: TuningSessionSnapshot['referenceToneError'] = null

  function createSnapshot(): TuningSessionSnapshot {
    return Object.freeze({
      instrument,
      referenceToneError,
      referenceToneStatus,
      selectedString,
      strings,
      tuningMethod: 'reference-tone',
      tuningMode: 'guided',
      tuningPreset,
    })
  }

  let snapshot = createSnapshot()
  let pendingCommand: Promise<void> | undefined

  function publishSnapshot() {
    snapshot = createSnapshot()
    listeners.forEach((listener) => listener())
  }

  async function executeCommand(command: TuningSessionCommand) {
    if (command.type === 'select-string') {
      const nextString = strings.find(({ id }) => id === command.stringId)

      if (!nextString) {
        throw new Error(`Unknown String: ${command.stringId}`)
      }

      if (nextString === selectedString) return

      if (referenceToneStatus === 'playing') {
        try {
          await referenceToneOutput.play(nextString.frequencyHz)
        } catch {
          referenceToneError = 'audio-unavailable'
          referenceToneStatus = 'stopped'
          publishSnapshot()
          return
        }
      }

      selectedString = nextString
      referenceToneError = null
      publishSnapshot()
      return
    }

    if (command.type === 'play-reference-tone') {
      if (referenceToneStatus === 'playing') return

      try {
        await referenceToneOutput.play(selectedString.frequencyHz)
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
