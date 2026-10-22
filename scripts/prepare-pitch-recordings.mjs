import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { measureSpectralReference } from '../src/tuning/fixtures/IndependentSpectralReference.ts'

// Node 24's native type stripping runs the standalone reference helper. This
// script and its sources never enter the production import graph.
const destination = new URL('../src/tuning/fixtures/recorded/', import.meta.url)
const sources = JSON.parse(
  await readFile(new URL('sources.json', destination), 'utf8'),
)
const cache = resolve(
  process.argv[2] ?? '/tmp/tune-every-string-recording-sources',
)
await mkdir(cache, { recursive: true })
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const fixtures = [],
  references = []
for (const source of sources) {
  const original = resolve(cache, `${source.id}.flac`)
  let bytes
  try {
    bytes = await readFile(original)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const response = await fetch(source.sourceUrl)
    if (!response.ok)
      throw new Error(`Recording download failed: ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(original, bytes, { flag: 'wx' })
  }
  if (hash(bytes) !== source.sourceSha256)
    throw new Error(`Source checksum mismatch: ${source.id}`)
  const file = `${source.id}.wav`
  const output = new URL(file, destination)
  // First two seconds, unchanged sample rate, no gain/normalization/looping or
  // pitch shifting. Bass PCM24 is quantized to PCM16; Guitar PCM16 is decoded.
  const conversion = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-i',
      original,
      '-t',
      '2',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      fileURLToPath(output),
    ],
    { encoding: 'utf8' },
  )
  if (conversion.status !== 0)
    throw new Error(conversion.stderr || 'ffmpeg conversion failed')
  const pcm = await readFile(output)
  // Locate RIFF chunks: ffmpeg may emit LIST metadata before sample data.
  let rate, samples
  for (let offset = 12; offset + 8 <= pcm.length;) {
    const kind = pcm.toString('ascii', offset, offset + 4)
    const length = pcm.readUInt32LE(offset + 4),
      start = offset + 8
    if (kind === 'fmt ') {
      if (
        pcm.readUInt16LE(start) !== 1 ||
        pcm.readUInt16LE(start + 2) !== 1 ||
        pcm.readUInt16LE(start + 14) !== 16
      )
        throw new Error('Conversion did not produce mono PCM16')
      rate = pcm.readUInt32LE(start + 4)
    }
    if (kind === 'data')
      samples = Float32Array.from(
        { length: length / 2 },
        (_, i) => pcm.readInt16LE(start + i * 2) / 32768,
      )
    offset = start + length + (length % 2)
  }
  if (!rate || !samples) throw new Error('Missing converted WAV data')
  const nominal = 440 * 2 ** ((source.midiNoteNumber - 69) / 12)
  const reference = measureSpectralReference(samples, rate, nominal)
  // Detect onset from a fixed 1%-of-peak amplitude rule, not from either pitch
  // estimator. Source edits may already have trimmed the physical pluck.
  let peak = 0
  for (const value of samples) peak = Math.max(peak, Math.abs(value))
  const onset = samples.findIndex((value) => Math.abs(value) > peak * 0.01)
  references.push({ id: source.id, ...reference })
  fixtures.push({
    id: source.id,
    file,
    sha256: hash(pcm),
    source: `${source.author}; ${source.sourceUrl}; original SHA-256 ${source.sourceSha256}`,
    recordedAt: source.recordedAt,
    redistributionTerms: 'CC0 1.0 Universal; full text in CC0-1.0.txt',
    redistributionPermission:
      'Publisher CC0 dedication; see docs/pitch-recording-sources.md and upstream license at pinned source revision',
    referenceKind: 'offline-spectral',
    referenceMaximumDeviationCents: reference.maximumBlockDeviationCents,
    referenceEvidence: 'references.json',
    referenceMethod: `${reference.method}; median of four 0.5s blocks starting at 0.4, 0.6, 0.8, 1.0 seconds; computational file-clock reference, NOT physical calibration; see references.json for block spread and warnings`,
    conditions: `${source.conditions}; first 2 seconds converted to mono PCM16 without resampling, gain or pitch change; onset is a file-amplitude proxy, NOT physical capture onset`,
    instrumentId: source.instrumentId,
    presetId: source.presetId,
    stringId: source.stringId,
    referenceFrequencyHz: reference.frequencyHz,
    concertPitchHz: 440,
    sampleRateHz: rate,
    pluckOnsetSeconds: onset / rate,
    sustainedStartSeconds: 0.4,
    sustainedEndSeconds: 1.5,
  })
}
await writeFile(
  new URL('manifest.json', destination),
  JSON.stringify(fixtures, null, 2) + '\n',
)
await writeFile(
  new URL('references.json', destination),
  JSON.stringify(references, null, 2) + '\n',
)
console.log(
  `Prepared ${fixtures.length} recorded regression inputs. Physical calibration and device latency remain unmeasured.`,
)
