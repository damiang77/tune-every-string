// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { createYinPitchEstimator } from './YinPitchEstimator'
import { loadRecordedFixtures } from './fixtures/RecordedPitchFixtures'
import { measureRecordedFixture } from './fixtures/RecordedPitchQuality'

it('YIN keeps the recorded Guitar A2 at its fundamental throughout the sustained interval', async () => {
  const recordings = await loadRecordedFixtures(
    fileURLToPath(
      new URL('./fixtures/recorded/manifest.json', import.meta.url),
    ),
  )
  const recording = recordings.find(
    ({ metadata }) => metadata.id === 'guitar-A2',
  )!
  const report = await measureRecordedFixture(
    recording,
    createYinPitchEstimator(),
  )
  expect(report.falseOctaves).toBe(0)
})
