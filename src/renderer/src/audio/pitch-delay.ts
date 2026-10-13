/**
 * Dual-read-head delay pitch shifter.
 * Each head sweeps a short delay at (1 - ratio) samples/sample. Heads are
 * half a window apart and use complementary sin² windows, so a head reset
 * happens while its contribution is zero. This keeps playback time unchanged.
 * A 40 ms window trades modest latency for smooth, inexpensive stereo output.
 */
export class PitchDelay {
  private readonly buffers: Float32Array[]
  private readonly window: number
  private readonly mask: number
  private cursor = 0
  private phase = 0
  private ratio = 1
  private target = 1

  constructor(sampleRate: number, channels = 2, windowSeconds = 0.04) {
    this.window = Math.max(64, Math.round(sampleRate * windowSeconds))
    const size = 2 ** Math.ceil(Math.log2(this.window + 256))
    this.mask = size - 1
    this.buffers = Array.from({ length: channels }, () => new Float32Array(size))
  }

  setSemitones(semitones: number): void {
    this.target = 2 ** (Math.max(-12, Math.min(12, semitones)) / 12)
  }

  private read(buffer: Float32Array, delay: number): number {
    const position = this.cursor - delay
    const first = Math.floor(position)
    const fraction = position - first
    return buffer[first & this.mask] * (1 - fraction) + buffer[(first + 1) & this.mask] * fraction
  }

  process(input: Float32Array[], output: Float32Array[]): void {
    const count = output[0]?.length ?? 0
    for (let i = 0; i < count; i++) {
      this.ratio += (this.target - this.ratio) * 0.002
      const other = (this.phase + 0.5) % 1
      const weight = Math.sin(Math.PI * this.phase) ** 2
      for (let channel = 0; channel < output.length; channel++) {
        const buffer = this.buffers[channel % this.buffers.length]
        const source = input[channel] ?? input[0]
        const sample = source?.[i] ?? 0
        buffer[this.cursor & this.mask] = sample
        output[channel][i] = Math.abs(this.target - 1) < 0.00001 && Math.abs(this.ratio - 1) < 0.00001
          ? sample
          : this.read(buffer, 8 + this.phase * this.window) * weight
            + this.read(buffer, 8 + other * this.window) * (1 - weight)
      }
      this.cursor++
      this.phase = ((this.phase + (1 - this.ratio) / this.window) % 1 + 1) % 1
    }
  }
}
