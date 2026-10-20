import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const [manifest, report, ...extra] = process.argv.slice(2)
if (!manifest || !report || extra.length) {
  console.error(
    'Usage: npm run test:pitch:recorded -- /absolute/manifest.json /absolute/report.json',
  )
  process.exit(1)
}
if (resolve(manifest) === resolve(report)) {
  console.error('The report must not overwrite the recording manifest')
  process.exit(1)
}
const run = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'src/tuning/RecordedPitchQuality.test.ts',
    '--reporter=verbose',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PITCH_RECORDINGS_MANIFEST: resolve(manifest),
      PITCH_RECORDINGS_REPORT: resolve(report),
    },
  },
)
if (run.error) console.error(run.error.message)
process.exit(run.status ?? 1)
