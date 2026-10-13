import type { Settings } from '../../../shared/types'

export interface ThemeFile {
  format: 'chenjin-theme'
  version: 1
  theme: Settings['theme']
  accent: string
  font: string
  colors: Record<string, string>
  background?: string
  backgroundOpacity?: number
}
const keys = ['bg', 'sidebar', 'surface', 'text', 'muted']
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export function validThemeBackground(value:unknown):value is string{
 if(typeof value!=='string'||value.length>12_000_000)return false
 if(!value)return true
 if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(value))return true
 try{return ['http:','https:'].includes(new URL(value).protocol)}catch{return false}
}

export function parseTheme(value: unknown): ThemeFile {
  if (!value || typeof value !== 'object') throw new Error('主题文件格式无效')
  const input = value as Record<string, unknown>
  if (input.format !== 'chenjin-theme' || input.version !== 1) throw new Error('不是受支持的琛瑾音乐主题文件')
  if (!['dark', 'light', 'system'].includes(String(input.theme)) || !isColor(input.accent)) throw new Error('主题模式或强调色无效')
  const colors: Record<string, string> = {}
  if (input.colors && typeof input.colors === 'object') {
    for (const key of keys) {
      const color = (input.colors as Record<string, unknown>)[key]
      if (color !== undefined && !isColor(color)) throw new Error(`主题颜色 ${key} 无效`)
      if (isColor(color)) colors[key] = color
    }
  }
  if(input.background!==undefined&&!validThemeBackground(input.background))throw new Error('主题背景地址无效')
  return { format: 'chenjin-theme', version: 1, theme: input.theme as Settings['theme'], accent: input.accent, font: typeof input.font === 'string' ? input.font.slice(0, 200) : '', colors, background: typeof input.background==='string'?input.background:'',backgroundOpacity:typeof input.backgroundOpacity==='number'&&Number.isFinite(input.backgroundOpacity)?Math.max(0,Math.min(1,input.backgroundOpacity)):.25 }
}

export function exportTheme(settings: Settings): ThemeFile {
  return parseTheme({ format: 'chenjin-theme', version: 1, theme: settings.theme, accent: settings.accent, font: settings.font, colors: settings.themeColors || {},background:settings.themeBackground||'',backgroundOpacity:settings.themeBackgroundOpacity })
}
