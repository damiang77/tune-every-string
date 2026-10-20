import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

// Match directory-index hosting rather than Vite's SPA fallback to English HTML.
const root = resolve('dist')
const headers = Object.fromEntries(
  (await readFile(resolve(root, '_headers'), 'utf8'))
    .split('\n')
    .filter((line) => line.startsWith('  '))
    .map((line) => {
      const colon = line.indexOf(':')
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()]
    }),
)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    )
    let file = resolve(root, `.${path}`)
    if (file !== root && !file.startsWith(root + sep))
      throw new Error('Outside build')
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
    const body = await readFile(file)
    const compress =
      /\bgzip\b/.test(request.headers['accept-encoding'] ?? '') &&
      ['.html', '.js', '.css', '.svg'].includes(extname(file))
    response.writeHead(200, {
      ...(compress
        ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }
        : {}),
      ...headers,
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    })
    response.end(compress ? gzipSync(body) : body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
}).listen(4279, '127.0.0.1')
