import { afterEach, expect, it, vi } from 'vitest'
import {
  createTuningSession,
  type MicrophoneStartOptions,
} from './TuningSession'

async function listeningSession() {
  let capture: MicrophoneStartOptions | undefined
  let frequencyHz: number | null = 82.407
  const session = createTuningSession({
    initialTuningMethod: 'listen',
    referenceToneOutput: { async play() {}, async stop() {} },
    pitchEstimator: {
      async estimate() {
        return {
          frequencyHz,
          clarity: frequencyHz === null ? null : 0.99,
          signalLevel: frequencyHz === null ? 0 : 0.5,
        }
      },
    },
    microphoneInput: {
      async start(options) {
        capture = options
        return {
          sampleRateHz: 48000,
          appliedSettings: {},
          availableAudioInputs: [],
        }
      },
      async stop() {},
    },
  })
  await session.dispatch({ type: 'start-listening' })
  return {
    session,
    async send(frequency: number | null) {
      frequencyHz = frequency
      for (let i = 0; i < 3; i++) {
        capture!.onFrame({
          capturedAtMs: Date.now(),
          samples: new Float32Array([0.5, -0.5]),
        })
        await vi.advanceTimersByTimeAsync(0)
      }
    },
  }
}

afterEach(() => vi.useRealTimers())

it('keeps one feedback message readable while measurements respond immediately', async () => {
  vi.useFakeTimers()
  const { session, send } = await listeningSession()
  try {
    await send(80)
    expect(session.getSnapshot().pitchFeedback).toBe('too-low')
    expect(session.getSnapshot()).toMatchObject({
      displayPitchFeedback: 'acquiring',
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(session.getSnapshot()).toMatchObject({
      displayPitchFeedback: 'too-low',
    })
    await send(85)
    await vi.advanceTimersByTimeAsync(100)
    await send(80)
    await vi.advanceTimersByTimeAsync(1000)
    expect(session.getSnapshot()).toMatchObject({
      displayPitchFeedback: 'too-low',
    })
    await send(85)
    await vi.advanceTimersByTimeAsync(259)
    expect(session.getSnapshot()).toMatchObject({
      displayPitchFeedback: 'too-low',
    })
    await vi.advanceTimersByTimeAsync(1)
    expect(session.getSnapshot()).toMatchObject({
      displayPitchFeedback: 'too-high',
    })
    await send(80)
    await vi.advanceTimersByTimeAsync(999)
    expect(session.getSnapshot().displayPitchFeedback).toBe('too-high')
    await vi.advanceTimersByTimeAsync(1)
    expect(session.getSnapshot().displayPitchFeedback).toBe('too-low')
  } finally {
    await session.dispatch({ type: 'stop' })
  }
})

it('clears pending messages on target changes and stop', async () => {
  vi.useFakeTimers()
  const { session, send } = await listeningSession()
  await send(80)
  await vi.advanceTimersByTimeAsync(1000)
  expect(session.getSnapshot()).toMatchObject({
    displayPitchFeedback: 'too-low',
  })
  await session.dispatch({ type: 'select-string', stringId: 'guitar-5' })
  expect(session.getSnapshot()).toMatchObject({
    displayPitchFeedback: 'acquiring',
  })
  await send(108)
  await session.dispatch({ type: 'stop' })
  const stopped = session.getSnapshot()
  expect(stopped).toMatchObject({ displayPitchFeedback: 'no-signal' })
  await vi.advanceTimersByTimeAsync(2000)
  expect(session.getSnapshot()).toBe(stopped)
})
