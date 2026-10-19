export const fixtureKinds = [
  'clean',
  'harmonics',
  'noise',
  'noise-only',
  'clipping',
  'silence',
  'low-amplitude',
  'attack',
  'decay',
  'dropout',
  'octave-heavy',
] as const
export type FixtureKind = (typeof fixtureKinds)[number]

// Original deterministic mathematical signals; these are not instrument recordings.
export function createPitchFixture(
  frequencyHz: number,
  sampleRateHz: number,
  sampleCount: number,
  kind: FixtureKind,
  offsetSamples = 0,
): Float32Array {
  let seed = 123456789 + offsetSamples
  return Float32Array.from({ length: sampleCount }, (_, index) => {
    const time = (index + offsetSamples) / sampleRateHz
    const phase = 2 * Math.PI * frequencyHz * time
    const fundamental = Math.sin(phase)
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = (seed / 2 ** 32 - 0.5) * 0.04
    switch (kind) {
      case 'clean':
        return 0.5 * fundamental
      case 'harmonics':
        return (
          0.35 * fundamental +
          0.15 * Math.sin(2 * phase) +
          0.08 * Math.sin(3 * phase)
        )
      case 'noise-only':
        return noise * 10
      case 'noise':
        return 0.5 * fundamental + noise
      case 'clipping':
        return Math.max(-0.3, Math.min(0.3, 0.9 * fundamental))
      case 'silence':
        return 0
      case 'low-amplitude':
        return 0.001 * fundamental
      case 'attack':
        return (
          0.5 * Math.min(1, time / 0.03) * fundamental +
          (time < 0.01 ? noise : 0)
        )
      case 'decay':
        return 0.5 * Math.exp(-time * 3) * fundamental
      case 'dropout':
        return time >= 0.2 && time < 0.4 ? 0 : 0.5 * fundamental
      case 'octave-heavy':
        return 0.18 * fundamental + 0.5 * Math.sin(2 * phase)
    }
  })
}
