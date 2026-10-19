import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const origin = process.env.SITE_ORIGIN
if (
  !origin ||
  new URL(origin).origin !== origin ||
  !origin.startsWith('https://')
)
  throw Error(
    'Set SITE_ORIGIN to the production HTTPS origin (no trailing slash).',
  )
const template = readFileSync('dist/index.html', 'utf8')
const csp =
  "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
for (const privacy of [false, true]) {
  const paths = privacy
    ? { en: '/privacy', pl: '/pl/prywatnosc' }
    : { en: '/', pl: '/pl' }
  for (const locale of ['en', 'pl']) {
    const copy = JSON.parse(
      readFileSync(`src/i18n/locales/${locale}/translation.json`, 'utf8'),
    )[privacy ? 'privacy' : 'meta']
    const escape = (text) =>
      text
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
    const links =
      `<link rel="canonical" href="${origin}${paths[locale]}" data-route-metadata />` +
      Object.entries({ ...paths, 'x-default': paths.en })
        .map(
          ([lang, path]) =>
            `<link rel="alternate" hreflang="${lang}" href="${origin}${path}" data-route-metadata />`,
        )
        .join('')
    const html = template
      .replace('<html lang="en">', `<html lang="${locale}">`)
      .replace(
        /<title>.*?<\/title>/,
        `<title>Tune Every String | ${escape(copy.title)}</title>`,
      )
      .replace(
        /content="A calm, private browser tuner for guitar and bass\."/,
        `content="${escape(copy.description)}"`,
      )
      .replace(
        '<head>',
        `<head><meta http-equiv="Content-Security-Policy" content="${csp}" />${links}`,
      )
    const directory = `dist${paths[locale] === '/' ? '' : paths[locale]}`
    mkdirSync(directory, { recursive: true })
    writeFileSync(`${directory}/index.html`, html)
  }
}
writeFileSync(
  'dist/_headers',
  `/*\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  Permissions-Policy: microphone=(self), camera=()\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n`,
)
