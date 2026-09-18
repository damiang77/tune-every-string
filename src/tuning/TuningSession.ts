import {
  bass,
  bassStandardTuning,
  guitar,
  guitarStandardTuning,
  getTuningPresets,
  instruments,
  type Instrument,
  type PitchAnalysisRequirements,
  type TuningPreset,
} from './TuningCatalog'
import {
  chromaticOctaveOptions,
  createChromaticAnalysisRange,
  createChromaticNoteOptions,
  createChromaticTarget,
  isChromaticOctave,
  selectNearestChromaticTarget,
  type ChromaticNoteOption,
  type ChromaticOctave,
  type ChromaticPitchClass,
} from './ChromaticPitch'
import { createTargetPitch, type TargetPitch } from './Pitch'
import type {
  AccidentalPreference,
  TuningPreferenceStore,
} from './TuningPreferences'
import type { PitchEstimator } from './McleodPitchEstimator'
import {
  createPitchFeedbackTracker,
  type DetectedPitch,
  type PitchFeedback,
} from './PitchFeedbackTracker'

export type { DetectedPitch, PitchFeedback } from './PitchFeedbackTracker'

export interface ReferenceToneOutput {
  play(frequencyHz: number): Promise<void>
  stop(): Promise<void>
}

export type MicrophoneError =
  | 'permission-denied'
  | 'microphone-unavailable'
  | 'microphone-unsupported'
  | 'microphone-unreadable'

export type TuningMethod = 'listen' | 'reference-tone'

export interface AudioDeviceSettings {
  readonly autoGainControl?: boolean
  readonly channelCount?: number
  readonly deviceId?: string
  readonly echoCancellation?: boolean
  readonly noiseSuppression?: boolean
}

export interface MicrophoneFrame {
  readonly capturedAtMs: number
  readonly samples: Float32Array
}

export interface MicrophoneStartOptions {
  readonly minimumAnalysisWindowSeconds: number
  readonly onFrame: (frame: MicrophoneFrame) => void
  readonly signal: AbortSignal
}

export interface MicrophoneCapture {
  readonly appliedSettings: AudioDeviceSettings
  readonly sampleRateHz: number
}

export interface MicrophoneInput {
  start(options: MicrophoneStartOptions): Promise<MicrophoneCapture>
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
  readonly instruments: readonly Instrument[]
  readonly lifecycleStatus: 'inactive' | 'starting' | 'listening' | 'failed'
  readonly microphoneError: MicrophoneError | null
  readonly pitchFeedback: PitchFeedback
  readonly diagnostics: Readonly<{
    appliedAudioSettings: AudioDeviceSettings | null
    frameIntervalMs: number | null
    sampleRateHz: number | null
    signalLevel: number
  }>
  readonly detectedPitch: DetectedPitch | null
  readonly referenceToneError: 'audio-unavailable' | null
  readonly referenceToneStatus: 'stopped' | 'playing'
  readonly selectedString: TuningString
  readonly stringLock: boolean
  readonly tuningPresets: readonly TuningPreset[]
  readonly tuningPreset: TuningPreset
  readonly tuningMethod: TuningMethod
  readonly tuningMode: 'guided' | 'chromatic'
  readonly strings: readonly TuningString[]
  readonly targetPitch: TargetPitch
}

export type TuningSessionCommand =
  | { readonly type: 'play-reference-tone' }
  | { readonly type: 'start-listening' }
  | {
      readonly type: 'select-tuning-method'
      readonly tuningMethod: TuningSessionSnapshot['tuningMethod']
    }
  | {
      readonly type: 'select-chromatic-note'
      readonly pitchClass: ChromaticPitchClass
    }
  | {
      readonly type: 'select-chromatic-octave'
      readonly octave: ChromaticOctave
    }
  | { readonly type: 'set-concert-pitch'; readonly concertPitchHz: number }
  | { readonly type: 'select-instrument'; readonly instrumentId: string }
  | { readonly type: 'select-string'; readonly stringId: string }
  | { readonly type: 'set-string-lock'; readonly locked: boolean }
  | { readonly type: 'select-tuning-preset'; readonly tuningPresetId: string }
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
  readonly initialTuningMethod?: TuningSessionSnapshot['tuningMethod']
  readonly microphoneInput?: MicrophoneInput
  readonly pitchEstimator?: PitchEstimator
  readonly referenceToneOutput: ReferenceToneOutput
  readonly concertPitchHz?: number
  readonly instrument?: Instrument
  readonly preferenceStore?: TuningPreferenceStore
  readonly tuningPreset?: TuningPreset
}

function isMicrophoneError(value: unknown): value is MicrophoneError {
  return (
    value === 'permission-denied' ||
    value === 'microphone-unavailable' ||
    value === 'microphone-unsupported' ||
    value === 'microphone-unreadable'
  )
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
  initialTuningMethod = 'reference-tone',
  instrument: instrumentInput = guitar,
  microphoneInput,
  pitchEstimator,
  preferenceStore,
  referenceToneOutput,
  tuningPreset: tuningPresetInput = guitarStandardTuning,
}: CreateTuningSessionOptions): TuningSession {
  assertConcertPitch(initialConcertPitchHz)
  let concertPitchHz = initialConcertPitchHz

  const defaultPitchAnalysis: PitchAnalysisRequirements = Object.freeze({
    maximumFrequencyHz: 420,
    minimumFrequencyHz: 30,
    minimumPeriods: 3,
  })

  function freezeInstrument(input: Instrument): Instrument {
    return Object.freeze({
      ...input,
      pitchAnalysis: Object.freeze({
        ...(input.pitchAnalysis ?? defaultPitchAnalysis),
      }),
      strings: Object.freeze(
        input.strings.map((string) => Object.freeze({ ...string })),
      ),
    })
  }

  function freezePresets(inputs: readonly TuningPreset[]) {
    return Object.freeze(
      inputs.map((preset) =>
        Object.freeze({
          ...preset,
          targets: Object.freeze(
            preset.targets.map((target) => Object.freeze({ ...target })),
          ),
        }),
      ),
    )
  }

  const availableInstruments = Object.freeze(
    (instruments.some(({ id }) => id === instrumentInput.id)
      ? instruments
      : [instrumentInput]
    ).map(freezeInstrument),
  )
  let instrument =
    availableInstruments.find(({ id }) => id === instrumentInput.id) ??
    freezeInstrument(instrumentInput)
  let tuningPresets = freezePresets(
    getTuningPresets(instrument.id).length
      ? getTuningPresets(instrument.id).map((preset) =>
          preset.id === tuningPresetInput.id ? tuningPresetInput : preset,
        )
      : [tuningPresetInput],
  )
  const savedTuningPresetId = preferenceStore?.loadGuitarTuningPresetId?.()
  let tuningPreset =
    tuningPresets.find(({ id }) => id === savedTuningPresetId) ??
    tuningPresets.find(({ id }) => id === tuningPresetInput.id) ??
    tuningPresets[0]!
  const selectedPresetIds = new Map([[instrument.id, tuningPreset.id]])

  if (tuningPreset.instrumentId !== instrument.id) {
    throw new Error('The Tuning Preset does not belong to the Instrument')
  }

  function createTuningStrings(nextConcertPitchHz: number) {
    const targetsByString = new Map(
      tuningPreset.targets.map((target) => [target.stringId, target]),
    )

    if (
      tuningPreset.instrumentId !== instrument.id ||
      targetsByString.size !== tuningPreset.targets.length ||
      tuningPreset.targets.length !== instrument.strings.length
    ) {
      throw new Error('A Tuning Preset must assign one Target Pitch per String')
    }

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
  let tuningMode: TuningSessionSnapshot['tuningMode'] =
    preferenceStore?.loadTuningMode?.() ?? 'guided'
  let tuningMethod: TuningSessionSnapshot['tuningMethod'] = initialTuningMethod
  let stringLock = false
  let competingCandidate: {
    readonly stringId: string
    readings: number
  } | null = null
  let lifecycleStatus: TuningSessionSnapshot['lifecycleStatus'] = 'inactive'
  let microphoneError: MicrophoneError | null = null
  let pitchFeedback: TuningSessionSnapshot['pitchFeedback'] = 'no-signal'
  let appliedAudioSettings: AudioDeviceSettings | null = null
  let sampleRateHz: number | null = null
  let signalLevel = 0
  let frameIntervalMs: number | null = null
  let lastFrameAtMs: number | null = null
  let detectedPitch: TuningSessionSnapshot['detectedPitch'] = null
  let estimationInFlight = false
  const pitchFeedbackTracker = createPitchFeedbackTracker()
  let microphoneAbortController: AbortController | undefined

  function resetPitchTracking(nextPitchFeedback: PitchFeedback) {
    detectedPitch = null
    pitchFeedbackTracker.reset()
    pitchFeedback = nextPitchFeedback
    competingCandidate = null
  }

  function getSelectedTarget(): TargetPitch {
    return tuningMode === 'guided' ? selectedString : chromaticTarget
  }

  function getPitchAnalysisRequirements(): PitchAnalysisRequirements {
    if (tuningMode === 'chromatic') {
      return {
        ...createChromaticAnalysisRange(concertPitchHz),
        minimumPeriods: 3,
      }
    }

    return instrument.pitchAnalysis ?? defaultPitchAnalysis
  }

  function findClosestString(frequencyHz: number) {
    let closestString = selectedString
    let smallestDistanceInCents = Number.POSITIVE_INFINITY

    for (const string of strings) {
      const distanceInCents = Math.abs(
        1_200 * Math.log2(frequencyHz / string.frequencyHz),
      )

      if (distanceInCents < smallestDistanceInCents) {
        closestString = string
        smallestDistanceInCents = distanceInCents
      }
    }

    return closestString
  }

  function updateAutomaticStringSelection(
    frequencyHz: number | null,
    clarity: number | null,
  ) {
    if (stringLock) return
    if (frequencyHz === null || clarity === null || clarity < 0.9) {
      competingCandidate = null
      return
    }

    const candidate = findClosestString(frequencyHz)
    const currentDistance = Math.abs(
      1_200 * Math.log2(frequencyHz / selectedString.frequencyHz),
    )
    const candidateDistance = Math.abs(
      1_200 * Math.log2(frequencyHz / candidate.frequencyHz),
    )

    if (
      candidate === selectedString ||
      currentDistance - candidateDistance < 20
    ) {
      competingCandidate = null
      return
    }

    if (competingCandidate?.stringId === candidate.id) {
      competingCandidate.readings += 1
    } else {
      competingCandidate = { stringId: candidate.id, readings: 1 }
    }

    if (competingCandidate.readings < 3) return
    selectedString = candidate
    pitchFeedbackTracker.reset()
    competingCandidate = null
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
      instruments: availableInstruments,
      lifecycleStatus,
      microphoneError,
      pitchFeedback,
      diagnostics: Object.freeze({
        appliedAudioSettings,
        frameIntervalMs,
        sampleRateHz,
        signalLevel,
      }),
      detectedPitch,
      referenceToneError,
      referenceToneStatus,
      selectedString,
      stringLock,
      strings,
      targetPitch: getSelectedTarget(),
      tuningMethod,
      tuningMode,
      tuningPreset,
      tuningPresets,
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

  async function stopListeningCapture() {
    microphoneAbortController?.abort()
    await microphoneInput?.stop()
    lifecycleStatus = 'inactive'
  }

  async function executeCommand(command: TuningSessionCommand) {
    if (command.type === 'start-listening') {
      if (lifecycleStatus === 'starting' || lifecycleStatus === 'listening') {
        return
      }

      tuningMethod = 'listen'
      lifecycleStatus = 'starting'
      microphoneError = null
      resetPitchTracking('no-signal')
      appliedAudioSettings = null
      sampleRateHz = null
      signalLevel = 0
      frameIntervalMs = null
      lastFrameAtMs = null
      microphoneAbortController = new AbortController()
      const controller = microphoneAbortController
      const stoppingReferenceTone =
        referenceToneStatus === 'playing'
          ? referenceToneOutput.stop()
          : undefined
      referenceToneStatus = 'stopped'
      publishSnapshot()

      if (stoppingReferenceTone) {
        try {
          await stoppingReferenceTone
        } catch {
          referenceToneError = 'audio-unavailable'
          lifecycleStatus = 'inactive'
          publishSnapshot()
          return
        }
      }

      if (!microphoneInput) {
        lifecycleStatus = 'failed'
        microphoneError = 'microphone-unsupported'
        publishSnapshot()
        return
      }

      try {
        const initialPitchAnalysis = getPitchAnalysisRequirements()
        const capture = await microphoneInput.start({
          minimumAnalysisWindowSeconds:
            initialPitchAnalysis.minimumPeriods /
            initialPitchAnalysis.minimumFrequencyHz,
          signal: controller.signal,
          onFrame(frame) {
            if (controller.signal.aborted || lifecycleStatus !== 'listening') {
              return
            }

            let sumOfSquares = 0
            for (const sample of frame.samples) sumOfSquares += sample * sample
            signalLevel = frame.samples.length
              ? Math.sqrt(sumOfSquares / frame.samples.length)
              : 0
            frameIntervalMs =
              lastFrameAtMs === null ? null : frame.capturedAtMs - lastFrameAtMs
            lastFrameAtMs = frame.capturedAtMs
            if (!pitchEstimator) {
              pitchFeedback = signalLevel >= 0.01 ? 'acquiring' : 'no-signal'
            }
            publishSnapshot()

            if (!pitchEstimator || estimationInFlight) return
            estimationInFlight = true
            const estimatedTuningMode = tuningMode
            const estimatedTargetFrequencyHz = getSelectedTarget().frequencyHz
            const pitchAnalysis = getPitchAnalysisRequirements()
            void pitchEstimator
              .estimate(frame.samples, sampleRateHz ?? captureSampleRateHz, {
                maximumFrequencyHz: pitchAnalysis.maximumFrequencyHz,
                minimumFrequencyHz: pitchAnalysis.minimumFrequencyHz,
              })
              .then((estimation) => {
                if (
                  controller.signal.aborted ||
                  lifecycleStatus !== 'listening' ||
                  tuningMode !== estimatedTuningMode ||
                  getSelectedTarget().frequencyHz !== estimatedTargetFrequencyHz
                ) {
                  return
                }

                signalLevel = estimation.signalLevel
                if (tuningMode === 'guided') {
                  updateAutomaticStringSelection(
                    estimation.frequencyHz,
                    estimation.clarity,
                  )
                } else if (
                  estimation.frequencyHz !== null &&
                  estimation.clarity !== null
                ) {
                  const selection = selectNearestChromaticTarget(
                    estimation.frequencyHz,
                    accidentalPreference,
                    concertPitchHz,
                  )
                  if (
                    selection.targetPitch.midiNoteNumber !==
                    chromaticTarget.midiNoteNumber
                  ) {
                    pitchFeedbackTracker.reset()
                  }
                  chromaticTarget = selection.targetPitch
                  chromaticPitchClass = selection.pitchClass
                  chromaticOctave = selection.octave
                }

                const trackingResult = pitchFeedbackTracker.update(
                  estimation,
                  getSelectedTarget().frequencyHz,
                )
                detectedPitch = trackingResult.detectedPitch
                pitchFeedback = trackingResult.pitchFeedback
                publishSnapshot()
              })
              .catch(() => {
                if (
                  controller.signal.aborted ||
                  lifecycleStatus !== 'listening'
                ) {
                  return
                }
                resetPitchTracking('acquiring')
                publishSnapshot()
              })
              .finally(() => {
                estimationInFlight = false
              })
          },
        })

        const captureSampleRateHz = capture.sampleRateHz

        if (controller.signal.aborted) {
          await microphoneInput.stop()
          return
        }

        appliedAudioSettings = Object.freeze({ ...capture.appliedSettings })
        sampleRateHz = capture.sampleRateHz
        lifecycleStatus = 'listening'
      } catch (error) {
        if (controller.signal.aborted) return
        const reason =
          typeof error === 'object' && error && 'reason' in error
            ? error.reason
            : undefined
        microphoneError = isMicrophoneError(reason)
          ? reason
          : 'microphone-unreadable'
        lifecycleStatus = 'failed'
      }
      publishSnapshot()
      return
    }

    if (command.type === 'select-tuning-method') {
      if (command.tuningMethod === tuningMethod) return

      if (command.tuningMethod === 'reference-tone') {
        microphoneAbortController?.abort()
        if (lifecycleStatus === 'listening') {
          await stopListeningCapture()
        } else {
          lifecycleStatus = 'inactive'
        }
        microphoneError = null
        resetPitchTracking('no-signal')
      } else if (referenceToneStatus === 'playing') {
        await referenceToneOutput.stop()
        referenceToneStatus = 'stopped'
      }
      tuningMethod = command.tuningMethod
      publishSnapshot()
      return
    }

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

    if (command.type === 'select-instrument') {
      const nextInstrument = availableInstruments.find(
        ({ id }) => id === command.instrumentId,
      )
      if (!nextInstrument) {
        throw new Error(`Unknown Instrument: ${command.instrumentId}`)
      }
      if (nextInstrument === instrument) return

      if (lifecycleStatus === 'starting' || lifecycleStatus === 'listening') {
        microphoneAbortController?.abort()
        await microphoneInput?.stop()
        lifecycleStatus = 'inactive'
      }

      instrument = nextInstrument
      const catalogPresets = getTuningPresets(instrument.id)
      tuningPresets = freezePresets(catalogPresets)
      tuningPreset =
        tuningPresets.find(
          ({ id }) => id === selectedPresetIds.get(instrument.id),
        ) ??
        tuningPresets.find(({ id }) => id === 'standard') ??
        (instrument.id === bass.id ? bassStandardTuning : guitarStandardTuning)
      selectedPresetIds.set(instrument.id, tuningPreset.id)
      strings = createTuningStrings(concertPitchHz)
      selectedString = strings[0]!
      stringLock = false
      referenceToneError = null
      resetPitchTracking('no-signal')
      await retunePlayingReferenceTone(selectedString)
      publishSnapshot()
      return
    }

    if (command.type === 'select-tuning-mode') {
      if (command.tuningMode === tuningMode) return

      const restartListen = lifecycleStatus === 'listening'
      if (restartListen) {
        await stopListeningCapture()
      }
      tuningMode = command.tuningMode
      preferenceStore?.saveTuningMode?.(tuningMode)
      resetPitchTracking(restartListen ? 'acquiring' : 'no-signal')
      referenceToneError = null

      if (restartListen) {
        await executeCommand({ type: 'start-listening' })
        return
      }

      await retunePlayingReferenceTone(getSelectedTarget())
      publishSnapshot()
      return
    }

    if (command.type === 'select-tuning-preset') {
      const nextPreset = tuningPresets.find(
        ({ id }) => id === command.tuningPresetId,
      )
      if (!nextPreset) {
        throw new Error(`Unknown Tuning Preset: ${command.tuningPresetId}`)
      }
      if (nextPreset === tuningPreset) return

      const selectedStringId = selectedString.id
      tuningPreset = nextPreset
      selectedPresetIds.set(instrument.id, tuningPreset.id)
      strings = createTuningStrings(concertPitchHz)
      selectedString =
        strings.find(({ id }) => id === selectedStringId) ?? strings[0]!
      if (instrument.id === guitar.id) {
        preferenceStore?.saveGuitarTuningPresetId?.(tuningPreset.id)
      }
      referenceToneError = null
      resetPitchTracking(
        lifecycleStatus === 'listening' ? 'acquiring' : 'no-signal',
      )
      await retunePlayingReferenceTone(getSelectedTarget())
      publishSnapshot()
      return
    }

    if (command.type === 'set-string-lock') {
      if (stringLock === command.locked) return
      stringLock = command.locked
      resetPitchTracking(
        lifecycleStatus === 'listening' ? 'acquiring' : 'no-signal',
      )
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
      resetPitchTracking(
        lifecycleStatus === 'listening' ? 'acquiring' : 'no-signal',
      )

      if (tuningMode === 'guided') {
        await retunePlayingReferenceTone(selectedString)
      }

      publishSnapshot()
      return
    }

    if (command.type === 'play-reference-tone') {
      if (referenceToneStatus === 'playing') return

      if (lifecycleStatus === 'listening') {
        await stopListeningCapture()
        resetPitchTracking('no-signal')
      }
      tuningMethod = 'reference-tone'
      microphoneError = null

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

    if (lifecycleStatus === 'starting' || lifecycleStatus === 'listening') {
      microphoneAbortController?.abort()
      await microphoneInput?.stop()
      lifecycleStatus = 'inactive'
      resetPitchTracking('no-signal')
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
    if (
      command.type === 'select-tuning-method' &&
      command.tuningMethod === 'reference-tone'
    ) {
      microphoneAbortController?.abort()
    }
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
