import type { PitchEstimation } from './McleodPitchEstimator'

export type PitchFeedback =
  'no-signal' | 'acquiring' | 'too-low' | 'in-tune' | 'too-high'

export interface DetectedPitch {
  readonly centsDeviation: number
  readonly clarity: number
  readonly frequencyHz: number
}

export interface PitchTrackingResult {
  readonly detectedPitch: DetectedPitch | null
  readonly pitchFeedback: PitchFeedback
}

const IN_TUNE_CENTS = 5
const REQUIRED_STABLE_READINGS = 3
const MIN_SIGNAL_LEVEL = 0.01

export function createPitchFeedbackTracker() {
  let recentFrequenciesHz: number[] = []
  let consecutiveInTuneReadings = 0

  function reset() {
    recentFrequenciesHz = []
    consecutiveInTuneReadings = 0
  }

  function update(
    estimation: PitchEstimation,
    targetFrequencyHz: number,
  ): PitchTrackingResult {
    if (estimation.frequencyHz === null || estimation.clarity === null) {
      reset()
      return {
        detectedPitch: null,
        pitchFeedback:
          estimation.signalLevel < MIN_SIGNAL_LEVEL ? 'no-signal' : 'acquiring',
      }
    }

    recentFrequenciesHz = [
      ...recentFrequenciesHz.slice(-2),
      estimation.frequencyHz,
    ]
    const sortedFrequencies = [...recentFrequenciesHz].sort(
      (first, second) => first - second,
    )
    const middleIndex = Math.floor(sortedFrequencies.length / 2)
    const smoothedFrequencyHz =
      sortedFrequencies.length % 2 === 0
        ? ((sortedFrequencies[middleIndex - 1] ?? 0) +
            (sortedFrequencies[middleIndex] ?? 0)) /
          2
        : (sortedFrequencies[middleIndex] ?? estimation.frequencyHz)
    const rawCentsDeviation =
      1_200 * Math.log2(estimation.frequencyHz / targetFrequencyHz)
    const centsDeviation =
      1_200 * Math.log2(smoothedFrequencyHz / targetFrequencyHz)
    const rawReadingIsInTune = Math.abs(rawCentsDeviation) <= IN_TUNE_CENTS
    consecutiveInTuneReadings = rawReadingIsInTune
      ? consecutiveInTuneReadings + 1
      : 0

    let pitchFeedback: PitchFeedback = 'acquiring'
    if (
      rawReadingIsInTune &&
      consecutiveInTuneReadings >= REQUIRED_STABLE_READINGS
    ) {
      pitchFeedback = 'in-tune'
    } else if (
      rawCentsDeviation < -IN_TUNE_CENTS &&
      centsDeviation < -IN_TUNE_CENTS
    ) {
      pitchFeedback = 'too-low'
    } else if (
      rawCentsDeviation > IN_TUNE_CENTS &&
      centsDeviation > IN_TUNE_CENTS
    ) {
      pitchFeedback = 'too-high'
    }

    return {
      detectedPitch: Object.freeze({
        centsDeviation,
        clarity: estimation.clarity,
        frequencyHz: smoothedFrequencyHz,
      }),
      pitchFeedback,
    }
  }

  return { reset, update }
}
