export interface LyricWord {
  time: number
  duration: number
  text: string
}
export interface LyricLine {
  time: number
  text: string
  duration?: number
  words?: LyricWord[]
  translation?: string
  roman?: string
}

export function parseLrc(text: string | null | undefined): LyricLine[] {
  if (!text) return []
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
  const lines: LyricLine[] = []
  for (const row of text.replace(/\r/g, '').split('\n')) {
    const tags = [...row.matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)]
    const content = row.replace(/\[[^\]]*\]/g, '').trim()
    for (const tag of tags) {
      lines.push({ time: Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] || 0}`) + offset), text: content })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

/** LX relative word tags, KRC relative tags, and YRC absolute word tags. */
export function parseTimedLyrics(text: string | null | undefined): LyricLine[] {
  if (!text) return []
  const lines: LyricLine[] = []
  const offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000
  for (const row of text.replace(/\r/g, '').split('\n')) {
    const milliseconds = row.match(/^\[(\d+),(\d+)\]/)
    const timestamp = row.match(/^\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/)
    if (!milliseconds && !timestamp) continue
    const time = milliseconds
      ? Number(milliseconds[1]) / 1000
      : Number(timestamp![1]) * 60 + Number(timestamp![2]) + Number(`0.${timestamp![3] || 0}`)
    const body = row.slice((milliseconds || timestamp)![0].length)
    const words: LyricWord[] = []
    // LX/KRC <offset,duration[,unused]>word offsets are relative to line start.
    for (const token of body.matchAll(/<(\d+),(\d+)(?:,\d+)?>([^<]*)/g)) {
      words.push({ time: time + Number(token[1]) / 1000, duration: Number(token[2]) / 1000, text: token[3] })
    }
    // YRC (absoluteStart,duration,unused)word tags.
    if (!words.length) for (const token of body.matchAll(/\((\d+),(\d+),\d+\)([^()]*)/g)) {
      words.push({ time: Number(token[1]) / 1000, duration: Number(token[2]) / 1000, text: token[3] })
    }
    // QRC word(absoluteStart,duration) tags.
    if (!words.length) for (const token of body.matchAll(/([^()]+)\((\d+),(\d+)\)/g)) {
      words.push({ time: Number(token[2]) / 1000, duration: Number(token[3]) / 1000, text: token[1] })
    }
    if (!words.length) continue
    lines.push({
      time:Math.max(0,time+offset),
      duration: milliseconds ? Number(milliseconds[2]) / 1000 : Math.max(0, ...words.map(word => word.time + word.duration - time)),
      text: words.map(word => word.text).join(''),
      words:words.map(word=>({...word,time:Math.max(0,word.time+offset)})),
    })
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function mergeLyrics(lyric: string, translation?: string | null, roman?: string | null, timed?: string | null): LyricLine[] {
  const translations = parseLrc(translation)
  const romans = parseLrc(roman)
  const wordLines = parseTimedLyrics(timed) || []
  const base = wordLines.length ? wordLines : parseLrc(lyric)
  return base.map(line => ({
    ...line,
    translation: translations.find(other => Math.abs(other.time - line.time) < 0.12)?.text,
    roman: romans.find(other => Math.abs(other.time - line.time) < 0.12)?.text,
  }))
}

export function lyricIndex(lines: LyricLine[], seconds: number): number {
  let low = 0, high = lines.length - 1, result = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (lines[middle].time <= seconds) { result = middle; low = middle + 1 }
    else high = middle - 1
  }
  return result
}

export function wordProgress(word: LyricWord, seconds: number): number {
  if (seconds < word.time) return 0
  if (word.duration <= 0) return 1
  return Math.max(0, Math.min(1, (seconds - word.time) / word.duration))
}
