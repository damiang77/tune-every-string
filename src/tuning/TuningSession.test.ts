import { describe, expect, it } from 'vitest'

import { createTuningSession, type ReferenceToneOutput } from './TuningSession'

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

describe('Tuning Session', () => {
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
})
