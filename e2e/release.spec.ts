import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import en from '../src/i18n/locales/en/translation.json' with { type: 'json' }
import pl from '../src/i18n/locales/pl/translation.json' with { type: 'json' }

const deployedOrigin = process.env.DEPLOYED_ORIGIN
const metadataOrigin =
  process.env.METADATA_ORIGIN ?? deployedOrigin ?? 'https://example.test'

for (const path of ['/', '/pl', '/privacy', '/pl/prywatnosc']) {
  test(`direct route, localization and accessibility: ${path}`, async ({
    page,
  }) => {
    const response = await page.request.get(path)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    )
    expect(response.headers()['permissions-policy']).toBe(
      'microphone=(self), camera=()',
    )
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['referrer-policy']).toBe('no-referrer')
    expect(await response.text()).toContain(`href="${metadataOrigin}${path}"`)
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute(
      'lang',
      path.startsWith('/pl') ? 'pl' : 'en',
    )
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${deployedOrigin ?? 'http://127.0.0.1:4279'}${path}`,
    )
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([])
    await page.reload()
    await expect(page.getByRole('main')).toBeVisible()
  })
}

test('language switch preserves privacy route', async ({ page }) => {
  await page.goto('/privacy')
  await page.getByRole('link', { name: 'PL', exact: true }).click()
  await expect(page).toHaveURL('/pl/prywatnosc')
  await page.getByRole('link', { name: 'EN', exact: true }).click()
  await expect(page).toHaveURL('/privacy')
})

test('settings persist, fit the viewport, and expose accessible controls', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Instrument', exact: true })
    .selectOption('guitar')
  await page
    .getByRole('combobox', { name: 'Tuning preset' })
    .selectOption('drop-d')
  await page.getByRole('checkbox', { name: 'Show precise pitch' }).check()
  await page.getByRole('spinbutton', { name: 'Concert pitch' }).fill('442')
  await page.getByRole('button', { name: 'Chromatic', exact: true }).click()
  await page.getByRole('button', { name: 'Flats', exact: true }).click()
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Instrument', exact: true }),
  ).toHaveValue('guitar')
  await expect(
    page.getByRole('combobox', { name: 'Tuning preset' }),
  ).toHaveValue('drop-d')
  await expect(
    page.getByRole('checkbox', { name: 'Show precise pitch' }),
  ).toBeChecked()
  await expect(
    page.getByRole('button', { name: 'Flats', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('keyboard order, focus indicator and reduced motion', async ({
  page,
  browserName,
}) => {
  const tabKey = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const name of ['Tune Every String', 'EN', 'PL']) {
    await page.keyboard.press(tabKey)
    await expect(page.getByRole('link', { name, exact: true })).toBeFocused()
  }
  await page.keyboard.press(tabKey)
  const settings = page.getByRole('button', { name: 'Settings', exact: true })
  await expect(settings).toBeFocused()
  expect(
    await settings.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).toBe('solid')
  await page.keyboard.press('Enter')
  await expect(settings).toHaveAttribute('aria-expanded', 'true')
  expect(
    await page
      .getByRole('complementary')
      .evaluate((element) =>
        parseFloat(getComputedStyle(element).animationDuration),
      ),
  ).toBeLessThanOrEqual(0.01)
})

for (const [error, message] of [
  ['NotAllowedError', 'Microphone access was denied.'],
  ['NotFoundError', 'No microphone is available.'],
  ['NotReadableError', 'The microphone could not start.'],
]) {
  test(`microphone ${error} provides recovery through Reference Tone`, async ({
    page,
  }) => {
    await page.addInitScript((name) => {
      // Isolate capture errors from host audio-output permission policies.
      AudioContext.prototype.resume = async () => undefined
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Simulated capture failure', name)
      }
    }, error)
    await page.goto('/')
    await page
      .getByRole('button', { name: 'Start tuning', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(message)
    await page
      .getByRole('button', { name: 'Use Reference Tone', exact: true })
      .click()
    await page.getByRole('button', { name: /^Play / }).click()
    await expect(page.getByRole('button', { name: /^Stop / })).toBeVisible()
    await page.getByRole('button', { name: /^Stop / }).click()
    await expect(page.getByRole('button', { name: /^Play / })).toBeVisible()
  })
}

test('synthetic microphone runs the worker, publishes non-color feedback and stops on navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = []
    Object.defineProperty(window, '__releaseTracks', { value: tracks })
    // Inject analyser samples so this check does not depend on host audio hardware.
    AudioContext.prototype.resume = async () => undefined
    AnalyserNode.prototype.getFloatTimeDomainData = function (samples) {
      for (let index = 0; index < samples.length; index++) {
        samples[index] =
          0.25 * Math.sin((2 * Math.PI * 110 * index) / this.context.sampleRate)
      }
    }
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext()
      const destination = context.createMediaStreamDestination()
      const track = destination.stream.getAudioTracks()[0]
      tracks.push(track)
      const stop = track.stop.bind(track)
      track.stop = () => {
        stop()
        void context.close()
      }
      return destination.stream
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start tuning', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('In Tune', {
    timeout: 15000,
  })
  await expect(page.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
  await page.getByRole('link', { name: 'Privacy', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tracks = (
          window as unknown as { __releaseTracks: MediaStreamTrack[] }
        ).__releaseTracks
        return (
          tracks.length > 0 &&
          tracks.every((track) => track.readyState === 'ended')
        )
      }),
    )
    .toBe(true)
})

test('mobile production content appears within two seconds with a stable meter', async ({
  page,
  browserName,
}) => {
  test.skip(
    !!deployedOrigin,
    'Repeatable performance budgets use the local gzip server',
  )
  test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only')
  await page.setViewportSize({ width: 390, height: 844 })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  let releaseFonts!: () => void
  let heldFonts = 0
  const fontGate = new Promise<void>((resolve) => {
    releaseFonts = resolve
  })
  await page.route('**/*.woff2', async (route) => {
    heldFonts++
    await fontGate
    await route.continue()
  })
  await page.addInitScript(() => {
    const checkUsefulContent = () => {
      const button = [...document.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === 'Start tuning',
      )
      if (
        button &&
        !button.disabled &&
        button.getBoundingClientRect().height > 0
      ) {
        performance.mark('release-useful-content')
      } else {
        requestAnimationFrame(checkUsefulContent)
      }
    }
    requestAnimationFrame(checkUsefulContent)
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('button', { name: 'Start tuning', exact: true }),
  ).toBeVisible()
  await expect.poll(() => heldFonts).toBeGreaterThan(0)
  await expect
    .poll(() =>
      page.evaluate(
        () => performance.getEntriesByName('release-useful-content').length,
      ),
    )
    .toBe(1)
  const usefulContentMs = await page.evaluate(
    () => performance.getEntriesByName('release-useful-content')[0]?.startTime,
  )
  expect(usefulContentMs).toBeLessThan(2000)
  const fcp = await page.evaluate(
    () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
  )
  expect(fcp).toBeDefined()
  expect(fcp).toBeLessThan(2000)
  const meter = page.locator('[class*="_meter_"]')
  const layout = () =>
    meter.evaluate((element) => {
      const node = element as HTMLElement
      return {
        top: node.offsetTop,
        height: node.offsetHeight,
        width: node.offsetWidth,
      }
    })
  const before = await layout()
  releaseFonts()
  await page.evaluate(() => document.fonts.ready)
  const after = await layout()
  for (const dimension of ['top', 'height', 'width'] as const) {
    expect(Math.abs(after[dimension] - before[dimension])).toBeLessThanOrEqual(
      2,
    )
  }
  await test.info().attach('mobile-performance', {
    body: JSON.stringify({
      firstContentfulPaintMs: fcp,
      usefulContentMs,
      latencyMs: 150,
      downloadMbps: 1.6,
      cpuSlowdown: 4,
    }),
    contentType: 'application/json',
  })
})

for (const [path, copy] of [
  ['/', en],
  ['/pl', pl],
] as const) {
  test(`both Reference Tone modes keep runtime requests on device: ${path}`, async ({
    page,
  }) => {
    const externalRequests: string[] = []
    const policyErrors: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (
        ['http:', 'https:'].includes(url.protocol) &&
        url.origin !== (deployedOrigin ?? 'http://127.0.0.1:4279')
      ) {
        externalRequests.push(request.url())
      }
    })
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /content.security.policy|violates.*directive/i.test(message.text())
      ) {
        policyErrors.push(message.text())
      }
    })
    await page.goto(path)
    await page
      .getByRole('button', {
        name: copy.tuner.action.useReferenceTone,
        exact: true,
      })
      .click()
    for (const mode of ['guided', 'chromatic'] as const) {
      await page
        .getByRole('button', { name: copy.tuner.settings.open, exact: true })
        .click()
      await page
        .getByRole('button', {
          name: copy.tuner.selection.mode[mode],
          exact: true,
        })
        .click()
      await page
        .getByRole('button', { name: copy.tuner.settings.close, exact: true })
        .click()
      const play = copy.tuner.action.play.split('{{')[0]!.trim()
      const stop = copy.tuner.action.stop.split('{{')[0]!.trim()
      await page.getByRole('button', { name: new RegExp(`^${play} `) }).click()
      await expect(
        page.getByRole('button', { name: new RegExp(`^${stop} `) }),
      ).toBeVisible()
      await page.getByRole('button', { name: new RegExp(`^${stop} `) }).click()
    }
    await page
      .getByRole('button', {
        name: copy.tuner.selection.method.listen,
        exact: true,
      })
      .click()
    await page
      .getByRole('link', { name: copy.navigation.privacy, exact: true })
      .click()
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    ).toBe(0)
    expect(externalRequests).toEqual([])
    expect(policyErrors).toEqual([])
  })
}
