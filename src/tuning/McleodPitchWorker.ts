import { estimatePitchWithMcleod } from './McleodPitchEstimator'

interface PitchWorkerRequest {
  readonly id: number
  readonly sampleRateHz: number
  readonly samples: Float32Array
}

self.addEventListener(
  'message',
  async (event: MessageEvent<PitchWorkerRequest>) => {
    const { id, sampleRateHz, samples } = event.data
    const estimation = await estimatePitchWithMcleod(samples, sampleRateHz)
    self.postMessage({ estimation, id })
  },
)
