import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'

import { App } from './App'

describe('application routes', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState({}, '', '/')
    document.title = ''
    document.querySelector('meta[name="description"]')?.remove()
  })

  it('renders the English Tuner Screen at the root route', () => {
    window.history.replaceState({}, '', '/')

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Tune Every String' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Tuner' })).toBeVisible()
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('renders the Polish Tuner Screen at the Polish route', () => {
    window.history.replaceState({}, '', '/pl')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Stroik' })).toBeVisible()
    expect(document.title).toBe('Tune Every String | Stroik online')
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Spokojny, prywatny stroik online do gitary i basu.',
    )
  })

  it('changes locale through the visible language switch', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')

    render(<App />)
    await user.click(screen.getByRole('link', { name: 'PL' }))

    expect(window.location.pathname).toBe('/pl')
    expect(screen.getByRole('heading', { name: 'Stroik' })).toBeVisible()
    expect(document.documentElement).toHaveAttribute('lang', 'pl')
    expect(document.title).toBe('Tune Every String | Stroik online')
  })
})
