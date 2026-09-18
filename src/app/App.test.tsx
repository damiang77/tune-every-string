import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

import { App } from './App'
import {
  createTuningSession,
  type MicrophoneCapture,
  type MicrophoneInput,
  type MicrophoneStartOptions,
  type ReferenceToneOutput,
} from '../tuning/TuningSession'

class ControlledMicrophoneInput implements MicrophoneInput {
  readonly starts: MicrophoneStartOptions[] = []
  stopCount = 0
  private finish: ((capture: MicrophoneCapture) => void) | undefined

  start(options: MicrophoneStartOptions) {
    this.starts.push(options)
    return new Promise<MicrophoneCapture>((resolve) => {
      this.finish = resolve
    })
  }

  finishStart() {
    this.finish?.({
      appliedSettings: { deviceId: 'default' },
      availableAudioInputs: [
        { deviceId: 'default', label: 'Built-in microphone' },
        { deviceId: 'usb', label: 'USB microphone' },
      ],
      sampleRateHz: 48_000,
    })
  }

  stop() {
    this.stopCount += 1
    return Promise.resolve()
  }

  interrupt() {
    this.starts.at(-1)?.onInterruption('audio-suspended')
  }
}

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

  it('shows permitted audio inputs in settings and switches capture', async () => {
    const user = userEvent.setup()
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      initialTuningMethod: 'listen',
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })
    render(<App session={session} />)

    await user.click(screen.getByRole('button', { name: 'Start tuning' }))
    microphoneInput.finishStart()
    expect(await screen.findByText('Listening for a clear note.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Audio input' }),
      'usb',
    )
    await vi.waitFor(() => expect(microphoneInput.starts).toHaveLength(2))
    microphoneInput.finishStart()

    expect(microphoneInput.stopCount).toBe(1)
    expect(microphoneInput.starts[1]?.deviceId).toBe('usb')
  })

  it('offers a Resume tuning action after an audio interruption', async () => {
    const user = userEvent.setup()
    const microphoneInput = new ControlledMicrophoneInput()
    const session = createTuningSession({
      initialTuningMethod: 'listen',
      microphoneInput,
      referenceToneOutput: new RecordingToneOutput(),
    })
    render(<App session={session} />)
    await user.click(screen.getByRole('button', { name: 'Start tuning' }))
    microphoneInput.finishStart()
    await screen.findByText('Listening for a clear note.')

    microphoneInput.interrupt()
    expect(
      await screen.findByRole('button', { name: 'Resume tuning' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resume tuning' }))
    microphoneInput.finishStart()

    expect(await screen.findByText('Listening for a clear note.')).toBeVisible()
  })

  it('selects and calibrates a Chromatic Reference Tone while preserving the Guided String', async () => {
    const user = userEvent.setup()
    const referenceToneOutput = new RecordingToneOutput()
    const session = createTuningSession({ referenceToneOutput })

    render(<App session={session} />)
    await user.click(screen.getByRole('button', { name: 'A2' }))
    await user.click(screen.getByRole('button', { name: 'Settings' }))
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

  it('changes the Guitar Tuning Preset and controls String Lock', async () => {
    const user = userEvent.setup()
    const session = createTuningSession({
      referenceToneOutput: new RecordingToneOutput(),
    })

    render(<App session={session} />)
    expect(screen.getByRole('button', { name: 'E2' })).toHaveTextContent('E2')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tuning preset' }),
      'drop-d',
    )
    expect(screen.getByRole('button', { name: 'D2' })).toBeVisible()
    expect(screen.getByText('Six-string guitar · Drop D')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Lock D2' }))
    expect(screen.getByRole('button', { name: 'Unlock D2' })).toBeVisible()
    expect(session.getSnapshot().stringLock).toBe(true)
  })

  it('selects Bass and exposes all three four-string presets', async () => {
    const user = userEvent.setup()
    const session = createTuningSession({
      referenceToneOutput: new RecordingToneOutput(),
    })

    render(<App session={session} />)
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Instrument' }),
      'bass',
    )

    expect(screen.getByText('Four-string bass · Standard')).toBeVisible()
    for (const noteName of ['E1', 'A1', 'D2', 'G2']) {
      expect(screen.getByRole('button', { name: noteName })).toBeVisible()
    }

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tuning preset' }),
      'drop-d',
    )
    expect(screen.getByRole('button', { name: 'D1' })).toBeVisible()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tuning preset' }),
      'half-step-down',
    )
    expect(screen.getByRole('button', { name: 'E♭1' })).toBeVisible()
  })
})
