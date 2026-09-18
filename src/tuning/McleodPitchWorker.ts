import { estimatePitchWithMcleod } from './McleodPitchEstimator'
import type { PitchEstimationRange } from './McleodPitchEstimator'

interface PitchWorkerRequest {
  readonly id: number
  readonly range?: PitchEstimationRange
  readonly sampleRateHz: number
  readonly samples: Float32Array
}

self.addEventListener(
  'message',
  async (event: MessageEvent<PitchWorkerRequest>) => {
    const { id, range, sampleRateHz, samples } = event.data
    const estimation = await estimatePitchWithMcleod(
      samples,
      sampleRateHz,
      range,
    )
    self.postMessage({ estimation, id })
  },
)
