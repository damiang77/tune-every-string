// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createMcleodPitchEstimator } from './McleodPitchEstimator'
import { createYinPitchEstimator } from './YinPitchEstimator'
import { loadRecordedFixtures } from './fixtures/RecordedPitchFixtures'
import { measureRecordedFixture } from './fixtures/RecordedPitchQuality'

const manifest = fileURLToPath(
  new URL('./fixtures/recorded/manifest.json', import.meta.url),
)
// These recordings have qualified regression baselines, not device acceptance.
// The strict external recorded command still evaluates EVERY recording at 3c.
const stableRegressionInputs = new Set([
  'guitar-D2',
  'guitar-Dsharp2',
  'guitar-E2',
  'guitar-E4',
  'bass-D',
])

describe('bundled real-instrument regression coverage (not release approval)', () => {
  for (const [estimator, createEstimator] of Object.entries({
    MPM: createMcleodPitchEstimator,
    YIN: createYinPitchEstimator,
  })) {
    it(`${estimator}: preserves accurate stable recordings and reports all challenge inputs`, async () => {
      const recordings = await loadRecordedFixtures(manifest)
      expect(recordings).toHaveLength(11)
      const reports = []
      for (const recording of recordings) {
        const report = await measureRecordedFixture(
          recording,
          createEstimator(),
        )
        reports.push(report)
        // All included notes currently select the intended target without misses.
        expect(report.sustainedFrames, recording.metadata.id).toBeGreaterThan(
          10,
        )
        expect(report.missed, recording.metadata.id).toBe(0)
        expect(report.falseStrings, recording.metadata.id).toBe(0)
        expect(report.falseOctaves, recording.metadata.id).toBe(0)
        if (stableRegressionInputs.has(recording.metadata.id)) {
          expect(
            report.failures,
            `${estimator}/${recording.metadata.id}`,
          ).toEqual([])
        }
        expect(report.actualDeviceLatencyMs).toBeNull()
        expect(report.accuracyQualified).toBe(false)
      }
      console.table(
        reports.map((report) => ({
          estimator,
          fixture: report.fixtureId,
          p95Cents: report.publishedAbsoluteCents.p95,
          missed: report.missed,
          falseStrings: report.falseStrings,
          falseOctaves: report.falseOctaves,
          comparisonFailures: report.failures.join('; '),
        })),
      )
    }, 120000)
  }
})
