import { describe, expect, it } from 'vitest'
import { createMcleodPitchEstimator } from './McleodPitchEstimator'
import { createYinPitchEstimator } from './YinPitchEstimator'
import { instruments, getTuningPresets } from './TuningCatalog'
import {
  createTuningSession,
  type MicrophoneStartOptions,
} from './TuningSession'
import {
  createPitchFixture,
  fixtureKinds,
} from './fixtures/SyntheticPitchFixtures'

const estimators = {
  MPM: createMcleodPitchEstimator,
  YIN: createYinPitchEstimator,
}
const percentile95 = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] ?? null

// Same production-facing session commands and snapshots for both estimators.
// Capture timestamps model signal time, never hardware/browser latency.
describe('repeatable pitch quality', () => {
  for (const [estimatorName, createEstimator] of Object.entries(estimators)) {
    it(`${estimatorName}: clears dropouts, recovers and respects selection boundaries`, async () => {
      let capture: MicrophoneStartOptions | undefined
      const session = createTuningSession({
        initialTuningMethod: 'listen',
        pitchEstimator: createEstimator(),
        referenceToneOutput: { async play() {}, async stop() {} },
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
      const send = async (
        frequencyHz: number,
        kind: Parameters<typeof createPitchFixture>[3],
        offsetSamples = 0,
      ) => {
        capture!.onFrame({
          capturedAtMs: offsetSamples / 48 + 4096 / 48,
          samples: createPitchFixture(
            frequencyHz,
            48000,
            4096,
            kind,
            offsetSamples,
          ),
        })
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      try {
        await session.dispatch({ type: 'start-listening' })
        for (let index = 0; index < 5; index += 1)
          await send(82.406889, 'clean', index * 1920)
        expect(session.getSnapshot().pitchFeedback).toBe('in-tune')
        await send(82.406889, 'dropout', 11520)
        expect(session.getSnapshot().detectedPitch).toBeNull()
        expect(session.getSnapshot().pitchFeedback).toBe('no-signal')
        for (let index = 0; index < 5; index += 1)
          await send(82.406889, 'dropout', 21120 + index * 1920)
        expect(session.getSnapshot().pitchFeedback).toBe('in-tune')
        const boundary = Math.sqrt(82.406889 * 110)
        for (let index = 0; index < 5; index += 1)
          await send(boundary * 2 ** (-25 / 1200), 'clean')
        expect(session.getSnapshot().selectedString.id).toBe('guitar-6')
        for (let index = 0; index < 5; index += 1)
          await send(boundary * 2 ** (25 / 1200), 'clean')
        expect(session.getSnapshot().selectedString.id).toBe('guitar-5')
      } finally {
        await session.dispatch({ type: 'stop' })
      }
    })
    it(`${estimatorName}: measures every launch target and adversarial signal`, async () => {
      const rows: Array<Record<string, string | number | null>> = []
      for (const instrument of instruments) {
        const errors: number[] = []
        const latencies: number[] = []
        let falseStrings = 0
        let falseOctaves = 0
        let missed = 0
        let minimumClarity = 1
        const missesByKind: Record<string, number> = {}
        for (const preset of getTuningPresets(instrument.id)) {
          for (const concertPitchHz of [430, 440, 450]) {
            for (const sampleRateHz of [44100, 48000]) {
              for (const target of preset.targets) {
                for (const kind of fixtureKinds) {
                  if (
                    kind !== 'clean' &&
                    (concertPitchHz !== 440 || sampleRateHz !== 48000)
                  )
                    continue
                  let capture: MicrophoneStartOptions | undefined
                  const session = createTuningSession({
                    instrument,
                    tuningPreset: preset,
                    concertPitchHz,
                    initialTuningMethod: 'listen',
                    pitchEstimator: createEstimator(),
                    referenceToneOutput: { async play() {}, async stop() {} },
                    microphoneInput: {
                      async start(options) {
                        capture = options
                        return {
                          sampleRateHz,
                          appliedSettings: {},
                          availableAudioInputs: [],
                        }
                      },
                      async stop() {},
                    },
                  })
                  await session.dispatch({ type: 'start-listening' })
                  const frequencyHz =
                    concertPitchHz * 2 ** ((target.midiNoteNumber - 69) / 12)
                  const sampleCount = instrument.id === 'bass' ? 8192 : 4096
                  let firstResultMs: number | null = null
                  for (let frame = 0; frame < 5; frame += 1) {
                    const offsetSamples = Math.round(
                      (frame * sampleRateHz) / 25,
                    )
                    capture!.onFrame({
                      capturedAtMs:
                        ((sampleCount + offsetSamples) / sampleRateHz) * 1000,
                      samples: createPitchFixture(
                        frequencyHz,
                        sampleRateHz,
                        sampleCount,
                        kind,
                        offsetSamples,
                      ),
                    })
                    // Drain estimation + session publication, without inspecting worker internals.
                    await new Promise((resolve) => setTimeout(resolve, 0))
                    const snapshot = session.getSnapshot()
                    if (snapshot.detectedPitch && firstResultMs === null) {
                      firstResultMs =
                        ((sampleCount + offsetSamples) / sampleRateHz) * 1000
                    }
                  }
                  const snapshot = session.getSnapshot()
                  if (
                    kind === 'silence' ||
                    kind === 'low-amplitude' ||
                    kind === 'noise-only'
                  ) {
                    expect(
                      snapshot.detectedPitch,
                      `${estimatorName}/${kind}`,
                    ).toBeNull()
                    expect(snapshot.pitchFeedback).toBe(
                      kind === 'noise-only' ? 'acquiring' : 'no-signal',
                    )
                  } else if (snapshot.detectedPitch) {
                    const cents =
                      1200 *
                      Math.log2(
                        snapshot.detectedPitch.frequencyHz / frequencyHz,
                      )
                    errors.push(Math.abs(cents))
                    minimumClarity = Math.min(
                      minimumClarity,
                      snapshot.detectedPitch.clarity,
                    )
                    if (snapshot.selectedString.id !== target.stringId)
                      falseStrings += 1
                    if (Math.abs(cents) > 600) falseOctaves += 1
                    if (firstResultMs !== null) latencies.push(firstResultMs)
                    if (kind === 'clean') {
                      expect(Math.abs(cents)).toBeLessThanOrEqual(3)
                      expect(snapshot.selectedString.id).toBe(target.stringId)
                      expect(snapshot.pitchFeedback).toBe('in-tune')
                    }
                  } else {
                    missed += 1
                    missesByKind[kind] = (missesByKind[kind] ?? 0) + 1
                    expect(
                      kind,
                      `${estimatorName}: missing clean target`,
                    ).not.toBe('clean')
                  }
                  await session.dispatch({ type: 'stop' })
                }
              }
            }
          }
        }
        console.log(
          estimatorName,
          instrument.id,
          'misses by signal:',
          missesByKind,
        )
        rows.push({
          estimator: estimatorName,
          instrument: instrument.id,
          readings: errors.length,
          p95AbsoluteCents: percentile95(errors),
          p95FirstResultSignalMs: percentile95(latencies),
          minimumClarity,
          falseStrings,
          falseOctaves,
          missed,
        })
      }
      console.table(rows)
    }, 120000)
  }
})
