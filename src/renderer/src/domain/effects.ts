import type { Settings } from '../../../shared/types'

export interface UserEffect { name: string; eq: number[]; reverb: number; reverbDecay: number; panner: boolean; pannerSpeed: number; pitch: number; reverbDryGain: number; reverbWetGain: number }
const clamp = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
export function parseEffect(value: unknown, name?: string): UserEffect {
  if (!value || typeof value !== 'object') throw new Error('无效的音效预设')
  const effect = value as Record<string, unknown>
  if (!Array.isArray(effect.eq) || effect.eq.length !== 10 || effect.eq.some(gain => typeof gain !== 'number' || !Number.isFinite(gain))) throw new Error('音效预设必须包含十段均衡器')
  return { name: (name || String(effect.name || '自定义音效')).trim().slice(0, 60), eq: effect.eq.map(gain => clamp(gain, -15, 15, 0)), reverb: clamp(effect.reverb, 0, 1, 0), reverbDecay: clamp(effect.reverbDecay, .2, 8, 1.8), panner: effect.panner === true, pannerSpeed: clamp(effect.pannerSpeed, .02, 2, .12), pitch: clamp(effect.pitch, -12, 12, 0), reverbDryGain: clamp(effect.reverbDryGain, 0, 2, 1), reverbWetGain: clamp(effect.reverbWetGain, 0, 2, 1) }
}
export function captureEffect(settings: Settings, name: string): UserEffect { return parseEffect(settings, name) }
export function effectSettings(effect: UserEffect): Partial<Settings> { const { name, ...values } = effect; return { ...values, eq: [...values.eq] } }
