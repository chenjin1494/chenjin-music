import { PitchDelay } from './pitch-delay'

declare const sampleRate: number
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: unknown)
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean
}

class ChenjinPitchProcessor extends AudioWorkletProcessor {
  private readonly shifter = new PitchDelay(sampleRate, 2)

  constructor() {
    super()
    this.port.onmessage = ({ data }: MessageEvent<{ semitones?: number }>) => {
      if (typeof data.semitones === 'number') this.shifter.setSemitones(data.semitones)
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    this.shifter.process(inputs[0] ?? [], outputs[0] ?? [])
    return true
  }
}

registerProcessor('chenjin-pitch', ChenjinPitchProcessor)
