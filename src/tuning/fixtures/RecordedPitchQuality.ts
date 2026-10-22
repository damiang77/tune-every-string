import type { PitchEstimation, PitchEstimator } from '../McleodPitchEstimator'
import { getTuningPresets, instruments } from '../TuningCatalog'
import {
  createTuningSession,
  type MicrophoneStartOptions,
} from '../TuningSession'
import type { RecordedPitchFixture } from './RecordedPitchFixtures'

export interface RecordedFrameResult {
  signalEndMs: number
  sustained: boolean
  rawFrequencyHz: number | null
  publishedFrequencyHz: number | null
  clarity: number | null
  selectedStringId: string
  feedback: string
}

const percentile = (values: number[], fraction: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] ??
  null

export function summarizeRecordedFrames(
  frames: RecordedFrameResult[],
  metadata: RecordedPitchFixture,
) {
  const sustained = frames.filter((frame) => frame.sustained)
  const errors = (field: 'rawFrequencyHz' | 'publishedFrequencyHz') =>
    sustained.flatMap((frame) =>
      frame[field] === null
        ? []
        : [
            Math.abs(
              1200 * Math.log2(frame[field] / metadata.referenceFrequencyHz),
            ),
          ],
    )
  const raw = errors('rawFrequencyHz')
  const published = errors('publishedFrequencyHz')
  const distribution = (values: number[]) => ({
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    maximum: values.length ? Math.max(...values) : null,
  })
  const clarity = sustained.flatMap((frame) =>
    frame.clarity === null ? [] : [frame.clarity],
  )
  const rawCents = distribution(raw)
  const publishedCents = distribution(published)
  const missed = sustained.filter(
    (frame) => frame.publishedFrequencyHz === null,
  ).length
  const falseStrings = sustained.filter(
    (frame) =>
      frame.publishedFrequencyHz !== null &&
      frame.selectedStringId !== metadata.stringId,
  ).length
  const falseOctaves = published.filter((error) => error > 600).length
  const failures: string[] = []
  if (!sustained.length)
    failures.push('No complete sustained-note analysis windows')
  if (rawCents.p95 === null || rawCents.p95 > 3)
    failures.push('Raw sustained p95 exceeds 3 cents or has no detections')
  if (publishedCents.p95 === null || publishedCents.p95 > 3)
    failures.push(
      'Published sustained p95 exceeds 3 cents or has no detections',
    )
  if (sustained.length - raw.length)
    failures.push('Raw sustained frames missed')
  if (missed) failures.push('Sustained frames missed')
  if (falseStrings) failures.push('False sustained String selections')
  if (falseOctaves) failures.push('False sustained octave selections')
  const referenceWarnings: string[] = []
  if (metadata.referenceKind !== 'independent-measurement')
    referenceWarnings.push(
      'No independent measured reference; cents describe a comparison, not certified accuracy',
    )
  if (!metadata.referenceEvidence?.trim())
    referenceWarnings.push('Reference measurement evidence missing')
  if (metadata.referenceMaximumDeviationCents === undefined)
    referenceWarnings.push('Reference stability not supplied')
  else if (metadata.referenceMaximumDeviationCents > 3)
    referenceWarnings.push(
      'Reference varies by more than 3 cents; a fixed frequency cannot qualify this interval',
    )
  return {
    fixtureId: metadata.id,
    accuracyQualified: referenceWarnings.length === 0,
    referenceWarnings,
    acceptanceBlockers: [...referenceWarnings, ...failures],
    sustainedFrames: sustained.length,
    rawAbsoluteCents: rawCents,
    publishedAbsoluteCents: publishedCents,
    rawMissed: sustained.length - raw.length,
    missed,
    falseStrings,
    falseOctaves,
    clarity: {
      minimum: clarity.length ? Math.min(...clarity) : null,
      p50: percentile(clarity, 0.5),
    },
    // Offline signal time excludes capture hardware, worker scheduling and computation.
    firstPublishedSignalMs:
      frames.find(
        (frame) =>
          frame.signalEndMs >= 0 && frame.publishedFrequencyHz !== null,
      )?.signalEndMs ?? null,
    firstInTuneSignalMs:
      frames.find(
        (frame) => frame.signalEndMs >= 0 && frame.feedback === 'in-tune',
      )?.signalEndMs ?? null,
    actualDeviceLatencyMs: null,
    failures,
  }
}

export async function measureRecordedFixture(
  recording: {
    metadata: RecordedPitchFixture
    sampleRateHz: number
    samples: Float32Array
  },
  estimator: PitchEstimator,
) {
  const { metadata, samples, sampleRateHz } = recording
  const instrument = instruments.find(
    (item) => item.id === metadata.instrumentId,
  )
  const preset = getTuningPresets(metadata.instrumentId).find(
    (item) => item.id === metadata.presetId,
  )
  if (!instrument || !preset) throw new Error('Unknown recording configuration')
  let capture: MicrophoneStartOptions | undefined
  let frameSize = 0
  const observation: { pending?: Promise<PitchEstimation> } = {}
  const pendingEstimation = () => observation.pending
  const observedEstimator: PitchEstimator = {
    estimate(...args) {
      observation.pending = estimator.estimate(...args)
      return observation.pending
    },
  }
  const session = createTuningSession({
    instrument,
    tuningPreset: preset,
    concertPitchHz: metadata.concertPitchHz,
    initialTuningMethod: 'listen',
    pitchEstimator: observedEstimator,
    referenceToneOutput: { async play() {}, async stop() {} },
    microphoneInput: {
      async start(options) {
        capture = options
        frameSize = Math.max(
          32,
          2 **
            Math.ceil(
              Math.log2(sampleRateHz * options.minimumAnalysisWindowSeconds),
            ),
        )
        return { sampleRateHz, appliedSettings: {}, availableAudioInputs: [] }
      },
      async stop() {},
    },
  })
  const frames: RecordedFrameResult[] = []
  try {
    await session.dispatch({ type: 'start-listening' })
    if (!capture) throw new Error('Recording capture did not start')
    const hop = Math.round(sampleRateHz * 0.04)
    // Replay from time zero to retain the actual pluck attack and selection history.
    for (let start = 0; start + frameSize <= samples.length; start += hop) {
      const end = start + frameSize
      if (end / sampleRateHz > metadata.sustainedEndSeconds) break
      delete observation.pending
      capture.onFrame({
        capturedAtMs: (end / sampleRateHz) * 1000,
        samples: samples.slice(start, end),
      })
      const pending = pendingEstimation()
      if (!pending)
        throw new Error('Session did not estimate the recorded frame')
      // TuningSession registers its publication callback before this await.
      const raw = await pending
      // Drain the session's catch/finally chain before sending another frame.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const snapshot = session.getSnapshot()
      frames.push({
        signalEndMs:
          (end / sampleRateHz) * 1000 - metadata.pluckOnsetSeconds * 1000,
        sustained: start / sampleRateHz >= metadata.sustainedStartSeconds,
        rawFrequencyHz: raw.frequencyHz,
        publishedFrequencyHz: snapshot.detectedPitch?.frequencyHz ?? null,
        clarity: snapshot.detectedPitch?.clarity ?? null,
        selectedStringId: snapshot.selectedString.id,
        feedback: snapshot.pitchFeedback,
      })
    }
    return { ...summarizeRecordedFrames(frames, metadata), frames }
  } finally {
    await session.dispatch({ type: 'stop' })
    estimator.stop?.()
  }
}
