import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

// Count every emitted JS chunk, including the pitch worker: stricter than initial JS.
const assets = await readdir(new URL('../dist/assets/', import.meta.url))
let compressedBytes = 0
for (const name of assets) {
  if (/\.(wav|mp3|ogg|flac|onnx|tflite|bin)$/i.test(name)) {
    throw new Error(`Unexpected recording or model asset: ${name}`)
  }
  if (!name.endsWith('.js')) continue
  const contents = await readFile(
    new URL(`../dist/assets/${name}`, import.meta.url),
  )
  compressedBytes += gzipSync(contents).length
}
if (!compressedBytes)
  throw new Error('No JavaScript found; build the application first')
console.log(
  `All JavaScript including worker: ${compressedBytes} gzip bytes (budget 200000)`,
)
if (compressedBytes > 200_000)
  throw new Error('Compressed JavaScript exceeds release budget')
