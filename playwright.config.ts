import { defineConfig, devices } from '@playwright/test'

const deployedOrigin = process.env.DEPLOYED_ORIGIN
if (
  deployedOrigin &&
  (new URL(deployedOrigin).origin !== deployedOrigin ||
    !deployedOrigin.startsWith('https://'))
) {
  throw new Error(
    'DEPLOYED_ORIGIN must be an HTTPS origin without a trailing slash',
  )
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: deployedOrigin ?? 'http://127.0.0.1:4279',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: deployedOrigin
    ? undefined
    : {
        command: 'npm run build:production && node scripts/serve-release.mjs',
        url: 'http://127.0.0.1:4279',
        reuseExistingServer: false,
        env: { SITE_ORIGIN: 'https://example.test' },
      },
})
