import type { ReferenceToneOutput } from './TuningSession'

const ATTACK_SECONDS = 0.025
const RELEASE_SECONDS = 0.05
const PEAK_GAIN = 0.16

interface Voice {
  readonly gain: GainNode
  readonly oscillator: OscillatorNode
}

class WebAudioReferenceTone implements ReferenceToneOutput {
  private activeVoice: Voice | undefined
  private audioContext: AudioContext | undefined

  async play(frequencyHz: number) {
    const audioContext = this.getAudioContext()

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    void this.releaseActiveVoice(audioContext.currentTime)

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequencyHz, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + ATTACK_SECONDS)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)

    this.activeVoice = { gain, oscillator }
  }

  async stop() {
    const audioContext = this.audioContext

    if (!audioContext) return

    await this.releaseActiveVoice(audioContext.currentTime)
    this.audioContext = undefined

    if (audioContext.state !== 'closed') {
      await audioContext.close()
    }
  }

  private getAudioContext() {
    this.audioContext ??= new AudioContext()
    return this.audioContext
  }

  private releaseActiveVoice(now: number) {
    const voice = this.activeVoice
    this.activeVoice = undefined

    if (!voice) return Promise.resolve()

    const stopAt = now + RELEASE_SECONDS
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
    voice.gain.gain.linearRampToValueAtTime(0, stopAt)

    return new Promise<void>((resolve) => {
      voice.oscillator.addEventListener(
        'ended',
        () => {
          voice.oscillator.disconnect()
          voice.gain.disconnect()
          resolve()
        },
        { once: true },
      )
      voice.oscillator.stop(stopAt)
    })
  }
}

export function createWebAudioReferenceTone(): ReferenceToneOutput {
  return new WebAudioReferenceTone()
}
