export interface PitchEstimation {
  readonly clarity: number | null
  readonly frequencyHz: number | null
  readonly signalLevel: number
}

export interface PitchEstimator {
  estimate(
    samples: Float32Array,
    sampleRateHz: number,
  ): Promise<PitchEstimation>
  stop?(): void
}

const MIN_FREQUENCY_HZ = 30
const MAX_FREQUENCY_HZ = 420
const MIN_SIGNAL_LEVEL = 0.01
const MIN_CLARITY = 0.85
const PEAK_CUTOFF = 0.93

function parabolicPeak(values: Float64Array, index: number) {
  const center = values[index] ?? 0
  const left = values[index - 1] ?? center
  const right = values[index + 1] ?? center
  const curvature = left - 2 * center + right

  if (curvature === 0) return index
  return index + (left - right) / (2 * curvature)
}

export async function estimatePitchWithMcleod(
  samples: Float32Array,
  sampleRateHz: number,
): Promise<PitchEstimation> {
  let energy = 0
  for (const sample of samples) energy += sample * sample
  const signalLevel = samples.length ? Math.sqrt(energy / samples.length) : 0

  if (signalLevel < MIN_SIGNAL_LEVEL) {
    return { clarity: null, frequencyHz: null, signalLevel }
  }

  const minimumLag = Math.max(2, Math.floor(sampleRateHz / MAX_FREQUENCY_HZ))
  const maximumLag = Math.min(
    samples.length - 2,
    Math.ceil(sampleRateHz / MIN_FREQUENCY_HZ),
  )
  const normalizedSquareDifference = new Float64Array(maximumLag + 1)

  for (let lag = 0; lag <= maximumLag; lag += 1) {
    let autocorrelation = 0
    let divisor = 0
    const comparedLength = samples.length - lag

    for (let index = 0; index < comparedLength; index += 1) {
      const first = samples[index] ?? 0
      const second = samples[index + lag] ?? 0
      autocorrelation += first * second
      divisor += first * first + second * second
    }
    normalizedSquareDifference[lag] = divisor
      ? (2 * autocorrelation) / divisor
      : 0
  }

  const peaks: Array<{ clarity: number; lag: number }> = []
  let crossedBelowZero = false
  for (let lag = 1; lag < maximumLag; lag += 1) {
    const previous = normalizedSquareDifference[lag - 1] ?? 0
    const current = normalizedSquareDifference[lag] ?? 0
    const next = normalizedSquareDifference[lag + 1] ?? 0

    if (current <= 0) crossedBelowZero = true
    if (
      lag >= minimumLag &&
      crossedBelowZero &&
      current > previous &&
      current >= next &&
      current > 0
    ) {
      peaks.push({ clarity: current, lag })
    }
  }

  const strongestClarity = Math.max(0, ...peaks.map(({ clarity }) => clarity))
  const peak = peaks.find(
    ({ clarity }) =>
      clarity >= MIN_CLARITY && clarity >= strongestClarity * PEAK_CUTOFF,
  )

  if (!peak) return { clarity: null, frequencyHz: null, signalLevel }

  const interpolatedLag = parabolicPeak(normalizedSquareDifference, peak.lag)
  return {
    clarity: peak.clarity,
    frequencyHz: sampleRateHz / interpolatedLag,
    signalLevel,
  }
}

export function createMcleodPitchEstimator(): PitchEstimator {
  return { estimate: estimatePitchWithMcleod }
}
