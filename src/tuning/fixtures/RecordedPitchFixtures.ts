/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { getTuningPresets, instruments } from '../TuningCatalog'

export interface RecordedPitchFixture {
  id: string
  file: string
  sha256: string
  source: string
  recordedAt: string
  redistributionTerms: string
  redistributionPermission: string
  referenceMethod: string
  conditions: string
  instrumentId: string
  presetId: string
  stringId: string
  referenceFrequencyHz: number
  concertPitchHz: number
  sampleRateHz: number
  pluckOnsetSeconds: number
  sustainedStartSeconds: number
  sustainedEndSeconds: number
}

const textFields = [
  'id',
  'file',
  'source',
  'recordedAt',
  'redistributionTerms',
  'redistributionPermission',
  'referenceMethod',
  'conditions',
  'instrumentId',
  'presetId',
  'stringId',
] as const
const numericFields = [
  'referenceFrequencyHz',
  'concertPitchHz',
  'sampleRateHz',
  'pluckOnsetSeconds',
  'sustainedStartSeconds',
  'sustainedEndSeconds',
] as const

export function parseRecordedManifest(input: unknown): RecordedPitchFixture[] {
  if (!Array.isArray(input) || !input.length)
    throw new Error('Recording manifest must be a nonempty array')
  const ids = new Set<string>()
  return input.map((value: unknown) => {
    if (!value || typeof value !== 'object')
      throw new Error('Invalid recording')
    const entry = value as Record<string, unknown>
    for (const field of textFields) {
      if (typeof entry[field] !== 'string' || !entry[field].trim())
        throw new Error(`Missing recording metadata: ${field}`)
    }
    for (const field of numericFields) {
      if (typeof entry[field] !== 'number' || !Number.isFinite(entry[field]))
        throw new Error(`Invalid recording metadata: ${field}`)
    }
    if (
      typeof entry.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error('Invalid recording SHA-256')
    const fixture = entry as unknown as RecordedPitchFixture
    if (ids.has(fixture.id))
      throw new Error(`Duplicate recording: ${fixture.id}`)
    ids.add(fixture.id)
    if (
      isAbsolute(fixture.file) ||
      !fixture.file.toLowerCase().endsWith('.wav')
    )
      throw new Error('Recording file must be a relative WAV path')
    const instrument = instruments.find(
      (item) => item.id === fixture.instrumentId,
    )
    const preset =
      instrument &&
      getTuningPresets(instrument.id).find(
        (item) => item.id === fixture.presetId,
      )
    if (!preset?.targets.some((target) => target.stringId === fixture.stringId))
      throw new Error('Unknown recording Instrument, preset or String')
    if (
      fixture.concertPitchHz < 430 ||
      fixture.concertPitchHz > 450 ||
      fixture.referenceFrequencyHz <= 0 ||
      !Number.isInteger(fixture.sampleRateHz) ||
      fixture.sampleRateHz < 8000 ||
      fixture.sampleRateHz > 192000 ||
      fixture.pluckOnsetSeconds < 0 ||
      fixture.sustainedStartSeconds < fixture.pluckOnsetSeconds ||
      fixture.sustainedEndSeconds <= fixture.sustainedStartSeconds
    )
      throw new Error('Invalid recording frequency, rate or intervals')
    return fixture
  })
}

// Deliberately limited to RIFF mono PCM16: reject formats rather than silently
// resampling, downmixing or decoding compressed/float data as integer samples.
export function decodeRecordingWav(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (
    bytes.length < 12 ||
    tag(0) !== 'RIFF' ||
    tag(8) !== 'WAVE' ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    throw new Error('Invalid or truncated RIFF WAV')
  let sampleRateHz: number | undefined
  let data: { offset: number; length: number } | undefined
  let offset = 12
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Truncated WAV chunk')
    const length = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + length > bytes.length) throw new Error('Truncated WAV data')
    if (tag(offset) === 'fmt ') {
      if (
        sampleRateHz !== undefined ||
        length < 16 ||
        view.getUint16(start, true) !== 1 ||
        view.getUint16(start + 2, true) !== 1 ||
        view.getUint16(start + 14, true) !== 16 ||
        view.getUint16(start + 12, true) !== 2
      )
        throw new Error('Expected one mono PCM16 WAV format')
      sampleRateHz = view.getUint32(start + 4, true)
      if (
        sampleRateHz < 8000 ||
        sampleRateHz > 192000 ||
        view.getUint32(start + 8, true) !== sampleRateHz * 2
      )
        throw new Error('Invalid WAV sample or byte rate')
    } else if (tag(offset) === 'data') {
      if (data || !length || length % 2)
        throw new Error('Invalid WAV sample data')
      data = { offset: start, length }
    }
    offset = start + length + (length % 2)
    if (offset > bytes.length) throw new Error('Missing WAV padding')
  }
  if (sampleRateHz === undefined || !data)
    throw new Error('Missing WAV format or data')
  const { offset: dataOffset, length } = data
  const samples = Float32Array.from(
    { length: length / 2 },
    (_, index) => view.getInt16(dataOffset + index * 2, true) / 32768,
  )
  return { sampleRateHz, samples }
}

export async function loadRecordedFixtures(manifestPath: string) {
  const root = await realpath(dirname(resolve(manifestPath)))
  const entries = parseRecordedManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
  )
  return Promise.all(
    entries.map(async (metadata) => {
      const file = await realpath(resolve(root, metadata.file))
      const pathFromRoot = relative(root, file)
      if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot))
        throw new Error('Recording must remain inside manifest directory')
      const bytes = await readFile(file)
      if (createHash('sha256').update(bytes).digest('hex') !== metadata.sha256)
        throw new Error(`Recording checksum mismatch: ${metadata.id}`)
      const audio = decodeRecordingWav(bytes)
      if (
        audio.sampleRateHz !== metadata.sampleRateHz ||
        metadata.sustainedEndSeconds > audio.samples.length / audio.sampleRateHz
      )
        throw new Error(`Recording rate/interval mismatch: ${metadata.id}`)
      return { metadata, ...audio }
    }),
  )
}
