import type {
  MicrophoneError,
  MicrophoneInput,
  MicrophoneStartOptions,
} from './TuningSession'

const FRAME_INTERVAL_MS = 40

function analyserFrameSize(
  sampleRateHz: number,
  minimumAnalysisWindowSeconds: number,
) {
  const requiredSamples = sampleRateHz * minimumAnalysisWindowSeconds
  return Math.min(
    32_768,
    Math.max(32, 2 ** Math.ceil(Math.log2(requiredSamples))),
  )
}

interface MicrophoneFailure {
  readonly reason: MicrophoneError
}

function microphoneFailure(reason: MicrophoneError): MicrophoneFailure {
  return { reason }
}

function mapCaptureFailure(error: unknown): MicrophoneFailure {
  if (!(error instanceof DOMException)) {
    return microphoneFailure('microphone-unreadable')
  }

  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return microphoneFailure('permission-denied')
  }

  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
    return microphoneFailure('microphone-unavailable')
  }

  if (error.name === 'NotReadableError' || error.name === 'AbortError') {
    return microphoneFailure('microphone-unreadable')
  }

  return microphoneFailure('microphone-unreadable')
}

class WebAudioMicrophoneInput implements MicrophoneInput {
  private analyser: AnalyserNode | undefined
  private audioContext: AudioContext | undefined
  private frameTimer: ReturnType<typeof setInterval> | undefined
  private source: MediaStreamAudioSourceNode | undefined
  private stream: MediaStream | undefined

  async start({
    minimumAnalysisWindowSeconds,
    onFrame,
    signal,
  }: MicrophoneStartOptions) {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined'
    ) {
      throw microphoneFailure('microphone-unsupported')
    }

    await this.stop()

    const audioContext = new AudioContext()
    this.audioContext = audioContext
    try {
      if (audioContext.state === 'suspended') await audioContext.resume()
    } catch (error) {
      await this.stop()
      throw mapCaptureFailure(error)
    }

    const captureRequest = navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: { ideal: false },
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: false },
        noiseSuppression: { ideal: false },
      },
      video: false,
    })
    const abortRequest = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Microphone request cancelled', 'AbortError'))
        return
      }
      signal.addEventListener(
        'abort',
        () =>
          reject(
            new DOMException('Microphone request cancelled', 'AbortError'),
          ),
        { once: true },
      )
    })

    let stream: MediaStream
    try {
      stream = await Promise.race([captureRequest, abortRequest])
    } catch (error) {
      if (signal.aborted) {
        void captureRequest.then(
          (lateStream) => {
            lateStream.getTracks().forEach((track) => track.stop())
          },
          () => undefined,
        )
      }
      await this.stop()
      throw mapCaptureFailure(error)
    }

    if (signal.aborted) {
      stream.getTracks().forEach((track) => track.stop())
      await this.stop()
      throw microphoneFailure('microphone-unreadable')
    }

    try {
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = analyserFrameSize(
        audioContext.sampleRate,
        minimumAnalysisWindowSeconds,
      )
      source.connect(analyser)

      const samples = new Float32Array(analyser.fftSize)
      this.stream = stream
      this.source = source
      this.analyser = analyser
      this.frameTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples)
        onFrame({
          capturedAtMs: performance.now(),
          samples,
        })
      }, FRAME_INTERVAL_MS)

      const settings = stream.getAudioTracks()[0]?.getSettings() ?? {}
      const appliedSettings = {
        ...(typeof settings.autoGainControl === 'boolean'
          ? { autoGainControl: settings.autoGainControl }
          : {}),
        ...(typeof settings.channelCount === 'number'
          ? { channelCount: settings.channelCount }
          : {}),
        ...(typeof settings.deviceId === 'string'
          ? { deviceId: settings.deviceId }
          : {}),
        ...(typeof settings.echoCancellation === 'boolean'
          ? { echoCancellation: settings.echoCancellation }
          : {}),
        ...(typeof settings.noiseSuppression === 'boolean'
          ? { noiseSuppression: settings.noiseSuppression }
          : {}),
      }
      return {
        appliedSettings,
        sampleRateHz: audioContext.sampleRate,
      }
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop())
      await this.stop()
      throw mapCaptureFailure(error)
    }
  }

  async stop() {
    if (this.frameTimer !== undefined) clearInterval(this.frameTimer)
    this.frameTimer = undefined
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    const audioContext = this.audioContext
    this.analyser = undefined
    this.audioContext = undefined
    this.source = undefined
    this.stream = undefined

    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close()
    }
  }
}

export function createWebAudioMicrophoneInput(): MicrophoneInput {
  return new WebAudioMicrophoneInput()
}
