// Offline reference only. This does not use MPM/YIN, and it does not calibrate
// the recording device's sample clock. Nominal pitch only bounds the search.
export function measureSpectralReference(
  samples: Float32Array,
  sampleRateHz: number,
  nominalFrequencyHz: number,
  startsSeconds: readonly number[] = [0.4, 0.6, 0.8, 1],
  windowSeconds = 0.5,
) {
  if (
    !Number.isFinite(sampleRateHz) ||
    sampleRateHz <= 0 ||
    !Number.isFinite(nominalFrequencyHz) ||
    nominalFrequencyHz <= 0 ||
    !Number.isFinite(windowSeconds) ||
    windowSeconds <= 0 ||
    !startsSeconds.length
  )
    throw new Error('Invalid spectral reference configuration')
  const lower = nominalFrequencyHz * 2 ** (-50 / 1200)
  const upper = nominalFrequencyHz * 2 ** (50 / 1200)
  const blocks = startsSeconds.map((startSeconds) => {
    const start = Math.round(startSeconds * sampleRateHz)
    const length = Math.round(windowSeconds * sampleRateHz)
    if (
      !Number.isFinite(startSeconds) ||
      start < 0 ||
      length < 32 ||
      start + length > samples.length
    )
      throw new Error('Spectral reference window outside recording')
    let mean = 0
    for (let index = 0; index < length; index += 1)
      mean += samples[start + index] ?? 0
    mean /= length
    const window = Float64Array.from(
      { length },
      (_, index) =>
        ((samples[start + index] ?? 0) - mean) *
        (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (length - 1))),
    )
    const power = (frequency: number) => {
      const angle = (2 * Math.PI * frequency) / sampleRateHz
      const cosine = Math.cos(angle),
        sine = Math.sin(angle)
      let real = 0,
        imaginary = 0,
        phaseReal = 1,
        phaseImaginary = 0
      for (const sample of window) {
        real += sample * phaseReal
        imaginary += sample * phaseImaginary
        const nextReal = phaseReal * cosine - phaseImaginary * sine
        phaseImaginary = phaseImaginary * cosine + phaseReal * sine
        phaseReal = nextReal
      }
      return real * real + imaginary * imaginary
    }
    // Coarse scan locates a peak before bounded golden-section refinement.
    const step = (upper - lower) / 40
    let best = lower,
      bestPower = -1
    for (let index = 0; index <= 40; index += 1) {
      const candidate = lower + index * step
      const candidatePower = power(candidate)
      if (candidatePower > bestPower) {
        best = candidate
        bestPower = candidatePower
      }
    }
    if (bestPower <= 1e-12)
      throw new Error('No usable spectral reference energy')
    let left = Math.max(lower, best - step),
      right = Math.min(upper, best + step)
    const ratio = (Math.sqrt(5) - 1) / 2
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const a = right - ratio * (right - left),
        b = left + ratio * (right - left)
      if (power(a) > power(b)) right = b
      else left = a
    }
    const frequencyHz = (left + right) / 2
    return {
      startSeconds,
      endSeconds: startSeconds + windowSeconds,
      frequencyHz,
      searchBoundary:
        Math.abs(frequencyHz - lower) < step / 10 ||
        Math.abs(frequencyHz - upper) < step / 10,
    }
  })
  const sorted = blocks.map((block) => block.frequencyHz).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const frequencyHz =
    sorted.length % 2
      ? sorted[middle]!
      : (sorted[middle - 1]! + sorted[middle]!) / 2
  const maximumBlockDeviationCents = Math.max(
    ...blocks.map((block) =>
      Math.abs(1200 * Math.log2(block.frequencyHz / frequencyHz)),
    ),
  )
  return {
    method:
      'Hann-windowed fundamental DFT peak; bounded golden-section optimization',
    kind: 'offline-spectral' as const,
    frequencyHz,
    nominalFrequencyHz,
    searchRangeCents: 50,
    maximumBlockDeviationCents,
    blocks,
    hardwareCalibration: 'unavailable',
    referenceWarnings: [
      'Computational reference relative to file sample clock; not physical-device calibration',
      ...(blocks.some((block) => block.searchBoundary)
        ? ['Reference peak touches search boundary']
        : []),
      ...(maximumBlockDeviationCents > 3
        ? ['Reference varies by more than 3 cents between blocks']
        : []),
    ],
  }
}
