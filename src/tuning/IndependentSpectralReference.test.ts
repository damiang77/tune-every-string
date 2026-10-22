import { describe, expect, it } from 'vitest'
import { measureSpectralReference } from './fixtures/IndependentSpectralReference'

describe('independent offline spectral reference', () => {
  it('measures detuning rather than copying a nominal note label', () => {
    const nominal = 82.406889
    const measured = nominal * 2 ** (17 / 1200)
    const rate = 8000
    const samples = Float32Array.from(
      { length: rate * 2 },
      (_, index) =>
        0.4 * Math.sin((2 * Math.PI * measured * index) / rate) +
        0.2 * Math.sin((4 * Math.PI * measured * index) / rate),
    )
    const result = measureSpectralReference(samples, rate, nominal)
    expect(
      Math.abs(1200 * Math.log2(result.frequencyHz / measured)),
    ).toBeLessThan(0.1)
    expect(result.maximumBlockDeviationCents).toBeLessThan(0.1)
    expect(result.hardwareCalibration).toBe('unavailable')
  })
  it('rejects silence, missing windows and invalid configuration', () => {
    expect(() =>
      measureSpectralReference(new Float32Array(16000), 8000, 82),
    ).toThrow(/energy/)
    expect(() =>
      measureSpectralReference(new Float32Array(100), 8000, 82),
    ).toThrow(/outside/)
    expect(() =>
      measureSpectralReference(new Float32Array(16000), 8000, 0),
    ).toThrow(/configuration/)
  })
  it('flags changing pitch without presenting the reference as calibrated', () => {
    const rate = 8000
    const samples = Float32Array.from({ length: rate * 2 }, (_, index) => {
      const time = index / rate
      return 0.4 * Math.sin(2 * Math.PI * (82 * time + time * time))
    })
    const result = measureSpectralReference(samples, rate, 82)
    expect(result.maximumBlockDeviationCents).toBeGreaterThan(3)
    expect(result.referenceWarnings).toContain(
      'Reference varies by more than 3 cents between blocks',
    )
  })
})
