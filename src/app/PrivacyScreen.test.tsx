import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { App } from './App'
import { createTuningSession } from '../tuning/TuningSession'

afterEach(cleanup)

it('keeps privacy language navigation on the equivalent route and updates metadata', async () => {
  window.history.replaceState({}, '', '/privacy')
  render(
    <App
      session={createTuningSession({
        referenceToneOutput: { play: async () => {}, stop: async () => {} },
      })}
    />,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy')
  expect(screen.getByText(/does not record audio/)).toBeVisible()
  await userEvent.click(screen.getByRole('link', { name: 'PL' }))
  expect(window.location.pathname).toBe('/pl/prywatnosc')
  expect(document.documentElement.lang).toBe('pl')
  expect(document.title).toContain('Prywatność')
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${window.location.origin}/pl/prywatnosc`,
  )
  expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(3)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Prywatność',
  )
  await userEvent.click(screen.getByRole('link', { name: 'Wróć do stroika' }))
  expect(window.location.pathname).toBe('/pl')
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${window.location.origin}/pl`,
  )
})
