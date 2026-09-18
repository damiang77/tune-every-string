import { describe, expect, it } from 'vitest'

import { guitarStandardTuning } from './TuningCatalog'
import {
  createMcleodPitchEstimator,
  type PitchEstimation,
  type PitchEstimator,
} from './McleodPitchEstimator'
import { createTuningSession, type ReferenceToneOutput } from './TuningSession'
import type {
  MicrophoneCapture,
  MicrophoneInput,
  MicrophoneStartOptions,
} from './TuningSession'

class ControlledMicrophoneInput implements MicrophoneInput {
  readonly starts: MicrophoneStartOptions[] = []
  readonly capture: MicrophoneCapture
  stopCount = 0
  private resolveStart: ((capture: MicrophoneCapture) => void) | undefined
  private rejectStart: ((error: unknown) => void) | undefined

  constructor(sampleRateHz = 48_000) {
    this.capture = {
      appliedSettings: {
        autoGainControl: false,
        channelCount: 1,
        deviceId: 'built-in',
        echoCancellation: false,
        noiseSuppression: false,
      },
      sampleRateHz,
    }
  }

  start(options: MicrophoneStartOptions) {
    this.starts.push(options)
    return new Promise<MicrophoneCapture>((resolve, reject) => {
      this.resolveStart = resolve
      this.rejectStart = reject
    })
  }

  finishStart() {
    this.resolveStart?.(this.capture)
  }

  failStart(error: unknown) {
    this.rejectStart?.(error)
  }

  stop() {
    this.stopCount += 1
    return Promise.resolve()
  }

  sendFrame(samples: number[], capturedAtMs: number) {
    this.starts.at(-1)?.onFrame({
      capturedAtMs,
      samples: Float32Array.from(samples),
    })
  }
}

class DeferredPitchEstimator implements PitchEstimator {
  private pending: ((estimation: PitchEstimation) => void) | undefined

  estimate() {
    return new Promise<PitchEstimation>((resolve) => {
      this.pending = resolve
    })
  }

  resolve(estimation: PitchEstimation) {
    if (!this.pending) throw new Error('No pitch estimate is pending')
    const resolve = this.pending
    this.pending = undefined
    resolve(estimation)
  }
}

function createSineFrame(
  frequencyHz: number,
  sampleRateHz = 48_000,
  amplitude = 0.5,
) {
  return Array.from(
    { length: 4_096 },
    (_, index) =>
      amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRateHz),
  )
}

function createNoiseFrame() {
  let state = 123_456_789
  return Array.from({ length: 4_096 }, () => {
    state = (1_103_515_245 * state + 12_345) % 2_147_483_648
    return (state / 2_147_483_648 - 0.5) * 0.5
  })
}

async function flushPitchEstimation() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

class RecordingToneOutput implements ReferenceToneOutput {
  readonly playedFrequencies: number[] = []
  stopCount = 0

  play(frequencyHz: number) {
    this.playedFrequencies.push(frequencyHz)
    return Promise.resolve()
  }

  stop() {
    this.stopCount += 1
    return Promise.resolve()
  }
}

class DeferredToneOutput implements ReferenceToneOutput {
  readonly playedFrequencies: number[] = []
  readonly pendingPlays: Array<() => void> = []
  stopCount = 0

  play(frequencyHz: number) {
    this.playedFrequencies.push(frequencyHz)
    return new Promise<void>((resolve) => this.pendingPlays.push(resolve))
  }

  stop() {
    this.stopCount += 1
    return Promise.resolve()
  }

  completeNextPlay() {
    const complete = this.pendingPlays.shift()

    if (!complete) throw new Error('No Reference Tone is waiting to start')
    complete()
  }
}

class FlakyToneOutput implements ReferenceToneOutput {
  playCount = 0

  play() {
    this.playCount += 1

    return this.playCount === 1
      ? Promise.reject(new Error('Audio output unavailable'))
      : Promise.resolve()
  }

  stop() {
    return Promise.resolve()
  }
}

class RetuneFailureOutput implements ReferenceToneOutput {
  playCount = 0

  play() {
    this.playCount += 1
    return this.playCount === 2
      ? Promise.reject(new Error('Audio output unavailable'))
      : Promise.resolve()
  }

  stop() {
    return Promise.resolve()
  }
}

describe('Tuning Session', () => {
  it('starts Listen from a player command and reports the actual capture configuration', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })

    const starting = session.dispatch({ type: 'start-listening' })

    expect(session.getSnapshot()).toMatchObject({
      lifecycleStatus: 'starting',
      pitchFeedback: 'no-signal',
      tuningMethod: 'listen',
    })
    expect(microphoneInput.starts).toHaveLength(1)

    microphoneInput.finishStart()
    await starting

    expect(session.getSnapshot()).toMatchObject({
      diagnostics: {
        appliedAudioSettings: microphoneInput.capture.appliedSettings,
        sampleRateHz: 48_000,
      },
      lifecycleStatus: 'listening',
      pitchFeedback: 'no-signal',
    })
  })

  it('requires stable Detected Pitch before reporting In Tune', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })

    for (const [index, frequencyHz] of [109.8, 110.2].entries()) {
      microphoneInput.sendFrame(createSineFrame(frequencyHz), index * 40)
      await flushPitchEstimation()
      expect(session.getSnapshot().pitchFeedback).toBe('acquiring')
    }

    microphoneInput.sendFrame(createSineFrame(110), 80)
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: {
        centsDeviation: expect.closeTo(0, 1),
        frequencyHz: expect.closeTo(110, 1),
      },
      pitchFeedback: 'in-tune',
    })

    microphoneInput.sendFrame(createSineFrame(110), 120)
    expect(session.getSnapshot().pitchFeedback).toBe('in-tune')
    await flushPitchEstimation()
  })

  it('automatically selects the nearest String in Guided Listen', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    await session.dispatch({
      type: 'select-tuning-mode',
      tuningMode: 'chromatic',
    })

    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start

    expect(session.getSnapshot()).toMatchObject({
      selectedString: { noteName: 'E2' },
      tuningMode: 'guided',
    })

    microphoneInput.sendFrame(createSineFrame(110), 0)
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: { frequencyHz: expect.closeTo(110, 1) },
      selectedString: { noteName: 'A2' },
      targetPitch: { noteName: 'A2' },
      tuningMode: 'guided',
    })
  })

  it('does not let smoothing turn an out-of-tune reading into a stable result', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })

    for (const [index, frequencyHz] of [110, 110, 112].entries()) {
      microphoneInput.sendFrame(createSineFrame(frequencyHz), index * 40)
      await flushPitchEstimation()
    }

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: { frequencyHz: expect.closeTo(110, 1) },
      pitchFeedback: 'acquiring',
    })
  })

  it('discards a pending estimate when the selected String changes', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const pitchEstimator = new DeferredPitchEstimator()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator,
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start

    microphoneInput.sendFrame(createSineFrame(82.407), 0)
    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })
    pitchEstimator.resolve({
      clarity: 1,
      frequencyHz: 82.407,
      signalLevel: 0.4,
    })
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: null,
      pitchFeedback: 'acquiring',
      selectedString: { noteName: 'A2' },
    })
  })

  it('publishes signal level and frame timing without retaining microphone frames', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start

    microphoneInput.sendFrame([0.5, -0.5, 0.5, -0.5], 100)
    microphoneInput.sendFrame([0.25, -0.25, 0.25, -0.25], 140)

    expect(session.getSnapshot()).toMatchObject({
      diagnostics: {
        frameIntervalMs: 40,
        signalLevel: 0.25,
      },
      pitchFeedback: 'acquiring',
    })
    expect(session.getSnapshot().diagnostics).not.toHaveProperty('samples')

    microphoneInput.sendFrame([0, 0, 0, 0], 180)
    expect(session.getSnapshot().pitchFeedback).toBe('no-signal')
  })

  it('uses the audio context sample rate to estimate Detected Pitch', async () => {
    const microphoneInput = new ControlledMicrophoneInput(44_100)
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-4' })

    microphoneInput.sendFrame(createSineFrame(146.832, 44_100), 0)
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: { frequencyHz: expect.closeTo(146.832, 2) },
      diagnostics: { sampleRateHz: 44_100 },
    })
  })

  it('estimates the highest Standard Guitar String without an octave error', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-1' })

    microphoneInput.sendFrame(createSineFrame(329.628), 0)
    await flushPitchEstimation()

    expect(session.getSnapshot().detectedPitch?.frequencyHz).toBeCloseTo(
      329.628,
      1,
    )
  })

  it('rejects silence and unreliable noise before publishing Detected Pitch', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start

    microphoneInput.sendFrame(createSineFrame(82.407, 48_000, 0.001), 0)
    await flushPitchEstimation()
    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: null,
      pitchFeedback: 'no-signal',
    })

    microphoneInput.sendFrame(createNoiseFrame(), 40)
    await flushPitchEstimation()
    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: null,
      pitchFeedback: 'acquiring',
    })
  })

  it('reports a clean Detected Pitch against the selected Guitar String', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })

    microphoneInput.sendFrame(createSineFrame(108), 100)
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: {
        centsDeviation: expect.closeTo(-31.77, 1),
        clarity: expect.any(Number),
        frequencyHz: expect.closeTo(108, 1),
      },
      pitchFeedback: 'too-low',
      selectedString: { noteName: 'A2' },
    })
    expect(session.getSnapshot().detectedPitch?.clarity).toBeGreaterThan(0.95)
  })

  it('reports Too High for a Detected Pitch above the selected String', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })

    microphoneInput.sendFrame(createSineFrame(112), 0)
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: { centsDeviation: expect.closeTo(31.19, 1) },
      pitchFeedback: 'too-high',
    })
  })

  it('reports Too High for a Detected Pitch above the selected String', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      pitchEstimator: createMcleodPitchEstimator(),
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start
    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })

    microphoneInput.sendFrame(createSineFrame(112), 0)
    await flushPitchEstimation()

    expect(session.getSnapshot()).toMatchObject({
      detectedPitch: { centsDeviation: expect.closeTo(31.19, 1) },
      pitchFeedback: 'too-high',
    })
  })

  it('cancels unresolved permission and switches to Reference Tone', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })

    const switchMethod = session.dispatch({
      type: 'select-tuning-method',
      tuningMethod: 'reference-tone',
    })
    microphoneInput.finishStart()
    await Promise.all([start, switchMethod])

    expect(microphoneInput.starts[0]?.signal.aborted).toBe(true)
    expect(microphoneInput.stopCount).toBe(1)
    expect(session.getSnapshot()).toMatchObject({
      lifecycleStatus: 'inactive',
      tuningMethod: 'reference-tone',
    })
  })

  it.each([
    ['permission-denied', 'permission-denied'],
    ['unavailable', 'microphone-unavailable'],
    ['unsupported', 'microphone-unsupported'],
    ['unreadable', 'microphone-unreadable'],
  ] as const)('reports %s microphone failure distinctly', async (_, reason) => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })

    microphoneInput.failStart({ reason })
    await start

    expect(session.getSnapshot()).toMatchObject({
      lifecycleStatus: 'failed',
      microphoneError: reason,
      tuningMethod: 'listen',
    })
  })

  it('stops Listen and releases microphone capture', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start

    await session.dispatch({ type: 'stop' })

    expect(microphoneInput.stopCount).toBe(1)
    expect(session.getSnapshot()).toMatchObject({
      lifecycleStatus: 'inactive',
      pitchFeedback: 'no-signal',
    })
  })

  it('stops Listen before playing a Reference Tone', async () => {
    const microphoneInput = new ControlledMicrophoneInput()
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({
      microphoneInput,
      referenceToneOutput,
    })
    const start = session.dispatch({ type: 'start-listening' })
    microphoneInput.finishStart()
    await start

    await session.dispatch({ type: 'play-reference-tone' })

    expect(microphoneInput.stopCount).toBe(1)
    expect(referenceToneOutput.playedFrequencies).toHaveLength(1)
    expect(session.getSnapshot()).toMatchObject({
      lifecycleStatus: 'inactive',
      referenceToneStatus: 'playing',
      tuningMethod: 'reference-tone',
    })
  })

  it('exposes Standard Guitar strings in order with pitches derived from A4 = 440 Hz', () => {
    const session = createTuningSession({
      referenceToneOutput: new RecordingToneOutput(),
    })

    const snapshot = session.getSnapshot()

    expect(snapshot.instrument).toMatchObject({ id: 'guitar', name: 'Guitar' })
    expect(snapshot.instrument.strings.map(({ id }) => id)).toEqual([
      'guitar-6',
      'guitar-5',
      'guitar-4',
      'guitar-3',
      'guitar-2',
      'guitar-1',
    ])
    expect(snapshot.tuningPreset).toMatchObject({
      id: 'standard',
      instrumentId: 'guitar',
      name: 'Standard',
    })
    expect(
      snapshot.tuningPreset.targets.map(({ stringId }) => stringId),
    ).toEqual(snapshot.instrument.strings.map(({ id }) => id))
    expect(
      snapshot.strings.map(({ noteName, midiNoteNumber, frequencyHz }) => ({
        noteName,
        midiNoteNumber,
        frequencyHz: Number(frequencyHz.toFixed(3)),
      })),
    ).toEqual([
      { noteName: 'E2', midiNoteNumber: 40, frequencyHz: 82.407 },
      { noteName: 'A2', midiNoteNumber: 45, frequencyHz: 110 },
      { noteName: 'D3', midiNoteNumber: 50, frequencyHz: 146.832 },
      { noteName: 'G3', midiNoteNumber: 55, frequencyHz: 195.998 },
      { noteName: 'B3', midiNoteNumber: 59, frequencyHz: 246.942 },
      { noteName: 'E4', midiNoteNumber: 64, frequencyHz: 329.628 },
    ])
    expect(snapshot.strings).toHaveLength(6)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.strings)).toBe(true)
  })

  it('selects, plays, changes, and stops a Reference Tone through typed commands', async () => {
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({ referenceToneOutput })
    const observedSnapshots: unknown[] = []
    session.subscribe(() => observedSnapshots.push(session.getSnapshot()))

    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })

    expect(session.getSnapshot()).toMatchObject({
      tuningMethod: 'reference-tone',
      tuningMode: 'guided',
      selectedString: { noteName: 'A2', frequencyHz: 110 },
      referenceToneStatus: 'stopped',
    })

    await session.dispatch({ type: 'play-reference-tone' })
    expect(referenceToneOutput.playedFrequencies).toEqual([110])
    expect(session.getSnapshot().referenceToneStatus).toBe('playing')

    await session.dispatch({ type: 'select-string', stringId: 'guitar-1' })
    expect(referenceToneOutput.playedFrequencies).toHaveLength(2)
    expect(referenceToneOutput.playedFrequencies[1]).toBeCloseTo(329.628, 3)
    expect(session.getSnapshot()).toMatchObject({
      selectedString: { noteName: 'E4' },
      referenceToneStatus: 'playing',
    })

    await session.dispatch({ type: 'stop' })
    expect(referenceToneOutput.stopCount).toBe(1)
    expect(session.getSnapshot().referenceToneStatus).toBe('stopped')
    expect(observedSnapshots).toHaveLength(4)
    expect(observedSnapshots.every(Object.isFrozen)).toBe(true)
  })

  it('applies delayed Reference Tone commands in the order the player sends them', async () => {
    const referenceToneOutput = new DeferredToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    const play = session.dispatch({ type: 'play-reference-tone' })
    const stop = session.dispatch({ type: 'stop' })
    referenceToneOutput.completeNextPlay()
    await Promise.all([play, stop])

    expect(referenceToneOutput.stopCount).toBe(1)
    expect(session.getSnapshot().referenceToneStatus).toBe('stopped')

    const restart = session.dispatch({ type: 'play-reference-tone' })
    referenceToneOutput.completeNextPlay()
    await restart

    const selectA2 = session.dispatch({
      type: 'select-string',
      stringId: 'guitar-5',
    })
    const selectE4 = session.dispatch({
      type: 'select-string',
      stringId: 'guitar-1',
    })

    expect(referenceToneOutput.playedFrequencies.at(-1)).toBe(110)
    referenceToneOutput.completeNextPlay()
    await selectA2
    await Promise.resolve()
    referenceToneOutput.completeNextPlay()
    await selectE4

    expect(referenceToneOutput.playedFrequencies.at(-1)).toBeCloseTo(329.628, 3)
    expect(session.getSnapshot().selectedString.noteName).toBe('E4')
  })

  it('reports a Reference Tone failure and allows the player to retry', async () => {
    const referenceToneOutput = new FlakyToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    await session.dispatch({ type: 'play-reference-tone' })

    expect(session.getSnapshot()).toMatchObject({
      referenceToneError: 'audio-unavailable',
      referenceToneStatus: 'stopped',
    })

    await session.dispatch({ type: 'play-reference-tone' })

    expect(referenceToneOutput.playCount).toBe(2)
    expect(session.getSnapshot()).toMatchObject({
      referenceToneError: null,
      referenceToneStatus: 'playing',
    })
  })

  it('accepts an ordered Instrument and Tuning Preset with another String count', () => {
    const instrument = {
      id: 'bass',
      name: 'Bass',
      strings: [
        { id: 'bass-4', position: 4 },
        { id: 'bass-3', position: 3 },
        { id: 'bass-2', position: 2 },
        { id: 'bass-1', position: 1 },
      ],
    } as const
    const tuningPreset = {
      id: 'standard',
      instrumentId: 'bass',
      name: 'Standard',
      targets: [
        { stringId: 'bass-4', noteName: 'E1', midiNoteNumber: 28 },
        { stringId: 'bass-3', noteName: 'A1', midiNoteNumber: 33 },
        { stringId: 'bass-2', noteName: 'D2', midiNoteNumber: 38 },
        { stringId: 'bass-1', noteName: 'G2', midiNoteNumber: 43 },
      ],
    } as const

    const session = createTuningSession({
      instrument,
      referenceToneOutput: new RecordingToneOutput(),
      tuningPreset,
    })

    expect(
      session.getSnapshot().strings.map(({ noteName }) => noteName),
    ).toEqual(['E1', 'A1', 'D2', 'G2'])
  })

  it('derives Target Pitches from a Concert Pitch within 430 to 450 Hz', () => {
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({
      concertPitchHz: 442,
      referenceToneOutput,
    })

    expect(session.getSnapshot().strings[1]?.frequencyHz).toBeCloseTo(110.5, 5)
    expect(() =>
      createTuningSession({
        concertPitchHz: 429,
        referenceToneOutput,
      }),
    ).toThrow('Concert Pitch must be between 430 and 450 Hz')
  })

  it('plays in Chromatic Mode without losing the Guided Mode selection', async () => {
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })
    await session.dispatch({
      type: 'select-tuning-mode',
      tuningMode: 'chromatic',
    })

    expect(session.getSnapshot()).toMatchObject({
      chromaticTarget: {
        frequencyHz: 440,
        midiNoteNumber: 69,
        noteName: 'A4',
      },
      selectedString: { noteName: 'A2' },
      tuningMode: 'chromatic',
    })

    await session.dispatch({ type: 'play-reference-tone' })
    expect(referenceToneOutput.playedFrequencies).toEqual([440])

    await session.dispatch({ type: 'select-tuning-mode', tuningMode: 'guided' })
    expect(referenceToneOutput.playedFrequencies.at(-1)).toBe(110)
    expect(session.getSnapshot()).toMatchObject({
      selectedString: { noteName: 'A2' },
      tuningMode: 'guided',
    })
  })

  it('recalibrates Guided and Chromatic Target Pitches during a Tuning Session', async () => {
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    await session.dispatch({
      type: 'select-tuning-mode',
      tuningMode: 'chromatic',
    })
    await session.dispatch({ type: 'play-reference-tone' })
    await session.dispatch({ type: 'set-concert-pitch', concertPitchHz: 442 })

    expect(referenceToneOutput.playedFrequencies).toEqual([440, 442])
    expect(session.getSnapshot()).toMatchObject({
      chromaticTarget: { frequencyHz: 442, noteName: 'A4' },
      concertPitchHz: 442,
    })
    expect(
      session.getSnapshot().strings.find(({ noteName }) => noteName === 'A2'),
    ).toMatchObject({ frequencyHz: 110.5 })

    await expect(
      session.dispatch({ type: 'set-concert-pitch', concertPitchHz: 451 }),
    ).rejects.toThrow('Concert Pitch must be between 430 and 450 Hz')
    expect(session.getSnapshot().concertPitchHz).toBe(442)
  })

  it('selects Chromatic notes and remembers the Accidental Preference', async () => {
    let savedPreference: 'sharps' | 'flats' | undefined
    const preferenceStore = {
      loadAccidentalPreference: () => savedPreference,
      saveAccidentalPreference: (preference: 'sharps' | 'flats') => {
        savedPreference = preference
      },
    }
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({
      preferenceStore,
      referenceToneOutput,
    })

    expect(session.getSnapshot().accidentalPreference).toBe('sharps')
    expect(session.getSnapshot().chromaticNoteOptions.slice(0, 2)).toEqual([
      { noteName: 'C', pitchClass: 0 },
      { noteName: 'C♯', pitchClass: 1 },
    ])
    expect(session.getSnapshot().chromaticOctaveOptions).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])

    await session.dispatch({
      type: 'select-tuning-mode',
      tuningMode: 'chromatic',
    })
    await session.dispatch({ type: 'play-reference-tone' })
    await session.dispatch({ type: 'select-chromatic-note', pitchClass: 1 })
    await session.dispatch({ type: 'select-chromatic-octave', octave: 5 })
    expect(referenceToneOutput.playedFrequencies).toEqual([
      440,
      expect.closeTo(277.183, 3),
      expect.closeTo(554.365, 3),
    ])
    expect(session.getSnapshot().chromaticTarget).toMatchObject({
      midiNoteNumber: 73,
      noteName: 'C♯5',
    })

    await session.dispatch({
      type: 'set-accidental-preference',
      accidentalPreference: 'flats',
    })
    expect(savedPreference).toBe('flats')
    expect(session.getSnapshot().chromaticTarget.noteName).toBe('D♭5')

    const restoredSession = createTuningSession({
      preferenceStore,
      referenceToneOutput: new RecordingToneOutput(),
    })
    await restoredSession.dispatch({
      type: 'select-chromatic-note',
      pitchClass: 1,
    })
    expect(restoredSession.getSnapshot()).toMatchObject({
      accidentalPreference: 'flats',
      chromaticTarget: { noteName: 'D♭4' },
    })
  })

  it('keeps a Tuning Preset conventional spelling when Chromatic Mode uses sharps', async () => {
    const flatPreset = {
      ...guitarStandardTuning,
      id: 'half-step-down',
      name: 'Half Step Down',
      targets: guitarStandardTuning.targets.map((target, index) =>
        index === 0
          ? { ...target, midiNoteNumber: 39, noteName: 'E♭2' }
          : target,
      ),
    }
    const session = createTuningSession({
      referenceToneOutput: new RecordingToneOutput(),
      tuningPreset: flatPreset,
    })

    await session.dispatch({
      type: 'set-accidental-preference',
      accidentalPreference: 'sharps',
    })

    expect(session.getSnapshot().strings[0]?.noteName).toBe('E♭2')
  })

  it('selects Target Pitches at both ends of the supported Chromatic range', async () => {
    const session = createTuningSession({
      referenceToneOutput: new RecordingToneOutput(),
    })

    await session.dispatch({ type: 'select-chromatic-note', pitchClass: 0 })
    await session.dispatch({ type: 'select-chromatic-octave', octave: 1 })
    expect(session.getSnapshot().chromaticTarget).toMatchObject({
      frequencyHz: expect.closeTo(32.703, 3),
      midiNoteNumber: 24,
      noteName: 'C1',
    })

    await session.dispatch({ type: 'select-chromatic-note', pitchClass: 11 })
    await session.dispatch({ type: 'select-chromatic-octave', octave: 7 })
    expect(session.getSnapshot().chromaticTarget).toMatchObject({
      frequencyHz: expect.closeTo(3951.066, 3),
      midiNoteNumber: 107,
      noteName: 'B7',
    })
  })

  it('keeps the selected mode when audio output fails while retuning', async () => {
    const session = createTuningSession({
      referenceToneOutput: new RetuneFailureOutput(),
    })

    await session.dispatch({ type: 'play-reference-tone' })
    await session.dispatch({
      type: 'select-tuning-mode',
      tuningMode: 'chromatic',
    })

    expect(session.getSnapshot()).toMatchObject({
      referenceToneError: 'audio-unavailable',
      referenceToneStatus: 'stopped',
      targetPitch: { noteName: 'A4' },
      tuningMode: 'chromatic',
    })
  })
})
