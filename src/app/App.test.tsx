import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'

import { App } from './App'
import {
  createTuningSession,
  type ReferenceToneOutput,
} from '../tuning/TuningSession'

class RecordingToneOutput implements ReferenceToneOutput {
  readonly playedFrequencies: number[] = []
  stopCount = 0

  play(frequencyHz: number) {
    this.playedFrequencies.push(frequencyHz)
    return Promise.resolve()
  }

  stop() {
    this.stopCount += 1
    return Promise.resolve()
  }
}

class UnavailableToneOutput implements ReferenceToneOutput {
  play() {
    return Promise.reject(new Error('Audio output unavailable'))
  }

  stop() {
    return Promise.resolve()
  }
}

describe('application routes', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
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
    expect(screen.getByRole('button', { name: 'Start tuning' })).toBeVisible()
    expect(
      screen.getAllByText(
        'Audio is processed on this device. It is not recorded or uploaded.',
      )[0],
    ).toBeVisible()
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

  it('plays the selected String until the player stops the Tuning Session', async () => {
    const user = userEvent.setup()
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    render(<App session={session} />)
    await user.click(screen.getByRole('button', { name: 'Play E2' }))

    expect(referenceToneOutput.playedFrequencies[0]).toBeCloseTo(82.407, 3)

    await user.click(screen.getByRole('button', { name: 'A2' }))
    expect(referenceToneOutput.playedFrequencies).toEqual([
      expect.any(Number),
      110,
    ])

    await user.click(screen.getByRole('button', { name: 'Stop A2' }))
    expect(referenceToneOutput.stopCount).toBe(1)
    expect(screen.getByRole('button', { name: 'Play A2' })).toBeVisible()
  })

  it('announces a Reference Tone failure and leaves Play available', async () => {
    const user = userEvent.setup()
    const session = createTuningSession({
      referenceToneOutput: new UnavailableToneOutput(),
    })

    render(<App session={session} />)
    await user.click(screen.getByRole('button', { name: 'Play E2' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Reference Tone could not start. Check browser audio and try again.',
    )
    expect(screen.getByRole('button', { name: 'Play E2' })).toBeVisible()
  })

  it('selects and calibrates a Chromatic Reference Tone while preserving the Guided String', async () => {
    const user = userEvent.setup()
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    render(<App session={session} />)
    await user.click(screen.getByRole('button', { name: 'A2' }))
    await user.click(screen.getByRole('button', { name: 'Chromatic' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Note' }),
      '1',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Octave' }),
      '5',
    )
    await user.clear(screen.getByRole('spinbutton', { name: 'Concert pitch' }))
    await user.type(
      screen.getByRole('spinbutton', { name: 'Concert pitch' }),
      '442',
    )
    await user.click(screen.getByRole('button', { name: 'Flats' }))

    expect(
      screen.getByText('D♭5', { selector: '[data-target-note]' }),
    ).toBeVisible()
    expect(screen.getByText('556.89 Hz')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Play D♭5' }))
    expect(referenceToneOutput.playedFrequencies.at(-1)).toBeCloseTo(556.89, 2)

    await user.click(screen.getByRole('button', { name: 'Guided' }))
    expect(screen.getByRole('button', { name: 'Stop A2' })).toBeVisible()
    expect(referenceToneOutput.playedFrequencies.at(-1)).toBe(110.5)
  })
})
