import type { LyricScript } from './preferences'

let simplified: ((text: string) => string) | undefined
let traditional: ((text: string) => string) | undefined
let loading: Promise<void> | undefined

/** Dictionaries are loaded only after the user selects conversion. */
export async function ensureLyricConversion(script: LyricScript): Promise<void> {
  if (script === 'original' || (simplified && traditional)) return
  loading ||= import('opencc-js').then(({ Converter }) => {
    simplified = Converter({ from: 'tw', to: 'cn' })
    traditional = Converter({ from: 'cn', to: 'tw' })
  })
  await loading
}

export function convertLyric(text: string, script: LyricScript): string {
  if (script === 'simplified') return simplified?.(text) ?? text
  if (script === 'traditional') return traditional?.(text) ?? text
  return text
}
