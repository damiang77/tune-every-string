import type { PitchEstimator } from './McleodPitchEstimator'

// Cumulative mean normalized difference and first threshold dip:
// de Cheveigné & Kawahara (2002), doi:10.1121/1.1458024.
// Kept out of the production worker; this is the comparison estimator.
export function createYinPitchEstimator(): PitchEstimator {
  return {
    async estimate(
      samples,
      sampleRateHz,
      range = {
        minimumFrequencyHz: 30,
        maximumFrequencyHz: 420,
      },
    ) {
      const signalLevel = Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0) /
          (samples.length || 1),
      )
      const empty = { clarity: null, frequencyHz: null, signalLevel }
      if (signalLevel < 0.01) return empty
      const maximumLag = Math.min(
        Math.floor(samples.length / 2) - 1,
        Math.ceil(sampleRateHz / range.minimumFrequencyHz),
      )
      const minimumLag = Math.max(
        2,
        Math.floor(sampleRateHz / range.maximumFrequencyHz),
      )
      if (maximumLag <= minimumLag) return empty
      const difference = new Float64Array(maximumLag + 1)
      const windowLength = samples.length - maximumLag
      let cumulative = 0
      difference[0] = 1
      for (let lag = 1; lag <= maximumLag; lag += 1) {
        let sum = 0
        for (let index = 0; index < windowLength; index += 1) {
          const delta = samples[index]! - samples[index + lag]!
          sum += delta * delta
        }
        cumulative += sum
        difference[lag] = cumulative ? (sum * lag) / cumulative : 1
      }
      for (let lag = minimumLag; lag < maximumLag; lag += 1) {
        if (difference[lag]! >= 0.15) continue
        while (lag + 1 < maximumLag && difference[lag + 1]! < difference[lag]!)
          lag += 1
        const center = difference[lag]!
        const left = difference[lag - 1]!
        const right = difference[lag + 1]!
        const curvature = left - 2 * center + right
        const period = lag + (curvature ? (left - right) / (2 * curvature) : 0)
        const frequencyHz = sampleRateHz / period
        if (
          frequencyHz < range.minimumFrequencyHz ||
          frequencyHz > range.maximumFrequencyHz
        )
          return empty
        return { clarity: 1 - center, frequencyHz, signalLevel }
      }
      return empty
    },
  }
}
