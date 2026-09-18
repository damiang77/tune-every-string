import type { PitchEstimation, PitchEstimator } from './McleodPitchEstimator'

interface PitchWorkerResponse {
  readonly estimation: PitchEstimation
  readonly id: number
}

class WebWorkerPitchEstimator implements PitchEstimator {
  private readonly pending = new Map<
    number,
    {
      reject: (error: Error) => void
      resolve: (estimation: PitchEstimation) => void
    }
  >()
  private nextRequestId = 0
  private worker: Worker | undefined

  private getWorker() {
    if (this.worker) return this.worker

    const worker = new Worker(
      new URL('./McleodPitchWorker.ts', import.meta.url),
      {
        type: 'module',
      },
    )
    worker.addEventListener(
      'message',
      (event: MessageEvent<PitchWorkerResponse>) => {
        const request = this.pending.get(event.data.id)
        if (!request) return

        this.pending.delete(event.data.id)
        request.resolve(event.data.estimation)
      },
    )
    worker.addEventListener('error', () => {
      const error = new Error('Pitch estimation worker failed')
      this.pending.forEach(({ reject }) => reject(error))
      this.pending.clear()
    })
    this.worker = worker
    return worker
  }

  estimate(
    samples: Float32Array,
    sampleRateHz: number,
    range?: Parameters<PitchEstimator['estimate']>[2],
  ) {
    const id = this.nextRequestId
    this.nextRequestId += 1

    return new Promise<PitchEstimation>((resolve, reject) => {
      this.pending.set(id, { reject, resolve })
      this.getWorker().postMessage({ id, range, sampleRateHz, samples })
    })
  }
}

export function createWebWorkerPitchEstimator(): PitchEstimator {
  return new WebWorkerPitchEstimator()
}
