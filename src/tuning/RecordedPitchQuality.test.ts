// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMcleodPitchEstimator } from './McleodPitchEstimator'
import { createYinPitchEstimator } from './YinPitchEstimator'
import {
  decodeRecordingWav,
  loadRecordedFixtures,
  parseRecordedManifest,
  type RecordedPitchFixture,
} from './fixtures/RecordedPitchFixtures'
import {
  measureRecordedFixture,
  summarizeRecordedFrames,
  type RecordedFrameResult,
} from './fixtures/RecordedPitchQuality'
import { createPitchFixture } from './fixtures/SyntheticPitchFixtures'

// Parser/replay test data only. Never represented as real recording evidence.
const metadata: RecordedPitchFixture = {
  id: 'synthetic-harness-test',
  file: 'test.wav',
  sha256: '0'.repeat(64),
  source: 'Original generated parser test',
  recordedAt: '2026-10-19',
  redistributionTerms: 'Repository test terms',
  redistributionPermission: 'Original test author',
  referenceMethod: 'Mathematical input; NOT independent recording evidence',
  conditions: 'Unit test',
  instrumentId: 'guitar',
  presetId: 'standard',
  stringId: 'guitar-6',
  referenceFrequencyHz: 82.406889,
  concertPitchHz: 440,
  sampleRateHz: 48000,
  pluckOnsetSeconds: 0,
  sustainedStartSeconds: 0.15,
  sustainedEndSeconds: 0.5,
}
function wav(samples: Float32Array, sampleRate = 48000) {
  const bytes = Buffer.alloc(44 + samples.length * 2)
  bytes.write('RIFF')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((sample, index) =>
    bytes.writeInt16LE(Math.round(sample * 32767), 44 + index * 2),
  )
  return bytes
}
const frame: RecordedFrameResult = {
  signalEndMs: 200,
  sustained: true,
  rawFrequencyHz: metadata.referenceFrequencyHz,
  publishedFrequencyHz: metadata.referenceFrequencyHz,
  clarity: 0.99,
  selectedStringId: 'guitar-6',
  feedback: 'in-tune',
}

describe('recorded fixture validation and reporting', () => {
  it('requires rights, reference and valid target metadata', () => {
    for (const patch of [
      { redistributionTerms: '' },
      { referenceMethod: '' },
      { sha256: 'bad' },
      { stringId: 'bass-4' },
      { concertPitchHz: 460 },
      { sustainedEndSeconds: 0.1 },
      { sampleRateHz: NaN },
    ]) {
      expect(() => parseRecordedManifest([{ ...metadata, ...patch }])).toThrow()
    }
    expect(() => parseRecordedManifest([])).toThrow()
    expect(() => parseRecordedManifest([metadata, metadata])).toThrow(
      /Duplicate/,
    )
  })
  it('decodes signed PCM16 and rejects stereo, compressed and truncated WAVs', () => {
    const bytes = wav(new Float32Array([-1, 0, 1]))
    expect([...decodeRecordingWav(bytes).samples]).toEqual([
      -32767 / 32768,
      0,
      32767 / 32768,
    ])
    for (const [offset, value] of [
      [22, 2],
      [20, 3],
      [32, 4],
    ] as const) {
      const invalid = Buffer.from(bytes)
      invalid.writeUInt16LE(value, offset)
      expect(() => decodeRecordingWav(invalid)).toThrow()
    }
    expect(() =>
      decodeRecordingWav(bytes.subarray(0, bytes.length - 1)),
    ).toThrow()
  })
  it('checks checksums, sample rates, intervals and path containment before replay', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pitch-recordings-'))
    const bytes = wav(new Float32Array(24000))
    const fixtureRoot = join(root, 'fixtures')
    await mkdir(fixtureRoot)
    const manifest = join(fixtureRoot, 'manifest.json')
    const valid = {
      ...metadata,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    try {
      await writeFile(join(fixtureRoot, 'test.wav'), bytes)
      await writeFile(manifest, JSON.stringify([valid]))
      expect(await loadRecordedFixtures(manifest)).toHaveLength(1)
      for (const patch of [
        { sha256: 'f'.repeat(64) },
        { sampleRateHz: 44100 },
        { sustainedEndSeconds: 1 },
      ]) {
        await writeFile(manifest, JSON.stringify([{ ...valid, ...patch }]))
        await expect(loadRecordedFixtures(manifest)).rejects.toThrow()
      }
      await writeFile(join(root, 'outside.wav'), bytes)
      await symlink(join(root, 'outside.wav'), join(fixtureRoot, 'link.wav'))
      for (const file of ['../outside.wav', 'link.wav']) {
        await writeFile(manifest, JSON.stringify([{ ...valid, file }]))
        await expect(loadRecordedFixtures(manifest)).rejects.toThrow(
          /inside manifest directory/,
        )
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  it('reports every sustained frame, misses and errors instead of only a final good frame', () => {
    const frames = Array.from({ length: 20 }, (_, index) => ({
      ...frame,
      signalEndMs: 200 + index * 40,
    }))
    frames[0] = {
      ...frame,
      rawFrequencyHz: metadata.referenceFrequencyHz * 2,
      publishedFrequencyHz: metadata.referenceFrequencyHz * 2,
      selectedStringId: 'guitar-4',
    }
    frames[1] = {
      ...frame,
      rawFrequencyHz: null,
      publishedFrequencyHz: null,
      clarity: null,
    }
    const report = summarizeRecordedFrames(frames, metadata)
    expect(report.sustainedFrames).toBe(20)
    expect(report.publishedAbsoluteCents.p95).toBe(1200)
    expect(report.rawMissed).toBe(1)
    expect(report.missed).toBe(1)
    expect(report.falseStrings).toBe(1)
    expect(report.falseOctaves).toBe(1)
    expect(report.failures.length).toBeGreaterThan(0)
    expect(report.actualDeviceLatencyMs).toBeNull()
    expect(
      summarizeRecordedFrames([], metadata).failures.length,
    ).toBeGreaterThan(0)
  })
  it('cleans up and fails instead of reusing old feedback when estimation rejects', async () => {
    let stopped = false
    await expect(
      measureRecordedFixture(
        {
          metadata,
          sampleRateHz: 48000,
          samples: new Float32Array(24000),
        },
        {
          async estimate() {
            throw new Error('Estimator failed')
          },
          stop() {
            stopped = true
          },
        },
      ),
    ).rejects.toThrow('Estimator failed')
    expect(stopped).toBe(true)
  })
  for (const [name, createEstimator] of Object.entries({
    MPM: createMcleodPitchEstimator,
    YIN: createYinPitchEstimator,
  })) {
    it(`${name} replays PCM through TuningSession and reports sustained accuracy`, async () => {
      const audio = decodeRecordingWav(
        wav(
          createPitchFixture(
            metadata.referenceFrequencyHz,
            48000,
            24000,
            'clean',
          ),
        ),
      )
      const report = await measureRecordedFixture(
        { metadata, ...audio },
        createEstimator(),
      )
      expect(report.sustainedFrames).toBeGreaterThan(3)
      expect(report.failures).toEqual([])
      expect(report.frames.at(-1)?.feedback).toBe('in-tune')
      expect(report.firstPublishedSignalMs).toBeGreaterThan(0)
    })
  }
})

const manifestPath = process.env.PITCH_RECORDINGS_MANIFEST
// Default runs validate the harness. Explicit recorded runs fail if no inputs exist.
describe.runIf(Boolean(manifestPath))(
  'external real-instrument recordings',
  () => {
    it('compares MPM/YIN on identical verified recordings and writes frame-level evidence', async () => {
      if (!manifestPath)
        throw new Error('PITCH_RECORDINGS_MANIFEST is required')
      const recordings = await loadRecordedFixtures(manifestPath)
      const reports = []
      for (const recording of recordings) {
        for (const [estimator, createEstimator] of Object.entries({
          MPM: createMcleodPitchEstimator,
          YIN: createYinPitchEstimator,
        })) {
          reports.push({
            estimator,
            metadata: recording.metadata,
            ...(await measureRecordedFixture(recording, createEstimator())),
          })
        }
      }
      const output = process.env.PITCH_RECORDINGS_REPORT
      if (output)
        await writeFile(
          output,
          JSON.stringify(
            { kind: 'offline-recorded-replay', reports },
            null,
            2,
          ) + '\n',
          { flag: 'wx' },
        )
      console.table(
        reports.map((report) => ({
          estimator: report.estimator,
          fixtureId: report.fixtureId,
          sustainedFrames: report.sustainedFrames,
          p95Cents: report.publishedAbsoluteCents.p95,
          missed: report.missed,
          falseStrings: report.falseStrings,
          falseOctaves: report.falseOctaves,
          failures: report.failures.join('; '),
        })),
      )
      // Preserve the full report before asserting, so failed inputs remain reviewable.
      expect(
        new Set(recordings.map(({ metadata }) => metadata.instrumentId)),
      ).toEqual(new Set(['guitar', 'bass']))
      for (const report of reports)
        expect(
          report.failures,
          `${report.estimator}/${report.fixtureId}`,
        ).toEqual([])
    }, 120000)
  },
)
