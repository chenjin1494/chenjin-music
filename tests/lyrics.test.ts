import { describe, it, expect } from 'vitest'
import { parseLrc, parseTimedLyrics, mergeLyrics, lyricIndex, wordProgress } from '../src/renderer/src/domain/lyrics'
import { ensureLyricConversion, convertLyric } from '../src/renderer/src/domain/lyric-text'

describe('LRC timeline', () => {
  it('expands repeated timestamps and sorts them with millisecond precision', () => {
    expect(parseLrc('[00:12.30][00:02.005]你好\n[00:03]世界')).toEqual([{ time: 2.005, text: '你好' }, { time: 3, text: '世界' }, { time: 12.3, text: '你好' }])
  })
  it('applies document offset without confusing metadata for lyric text', () => {
    expect(parseLrc('[ar:artist]\n[offset:-500]\n[00:01.00] hello')[0]).toEqual({ time: .5, text: 'hello' })
    expect(parseLrc('[ti:untimed]')).toEqual([])
  })
  it('merges translation and romanization by timestamp instead of line index', () => {
    const lines = mergeLyrics('[00:01]One\n[00:03]Two', '[00:03.01]二', '[00:01]wan')
    expect(lines[0].roman).toBe('wan'); expect(lines[0].translation).toBeUndefined(); expect(lines[1].translation).toBe('二')
  })
  it('finds the latest lyric at boundaries, including duplicate timestamps', () => {
    const lines = parseLrc('[00:01]a\n[00:01]b\n[00:03]c')
    expect(lyricIndex(lines, .9)).toBe(-1); expect(lyricIndex(lines, 1)).toBe(1); expect(lyricIndex(lines, 100)).toBe(2); expect(lyricIndex([], 4)).toBe(-1)
  })
  it('handles malformed and missing data gracefully', () => {
    expect(parseLrc(null)).toEqual([]); expect(parseLrc('plain text\n[wrong]text')).toEqual([])
  })
})

describe('timed word lyrics', () => {
  it('parses LX relative millisecond tags without flattening word duration', () => {
    const [line] = parseTimedLyrics('[00:10.000]<0,300>你<300,700>好')
    expect(line.time).toBe(10); expect(line.text).toBe('你好')
    expect(line.words).toEqual([{ time: 10, duration: .3, text: '你' }, { time: 10.3, duration: .7, text: '好' }])
  })
  it('parses YRC absolute word tags and KRC relative tags', () => {
    expect(parseTimedLyrics('[10000,1000](10000,300,0)你(10300,700,0)好')[0].words?.[1].time).toBe(10.3)
    expect(parseTimedLyrics('[10000,1000]<0,300,0>你<300,700,0>好')[0].words?.[1].time).toBe(10.3)
  })
  it('parses QRC suffix tags with absolute times', () => {
    expect(parseTimedLyrics('[10000,1000]你(10000,300)好(10300,700)')[0].text).toBe('你好')
    expect(parseTimedLyrics('[10000,1000]你(10000,300)好(10300,700)')[0].words?.[0].duration).toBe(.3)
  })
  it('merges translated lines against timed lyrics and gracefully falls back to LRC', () => {
    const [line] = mergeLyrics('[00:01]Fallback', '[00:10]Hello', undefined, '[10000,1000](10000,1000,0)你好')
    expect(line.text).toBe('你好'); expect(line.translation).toBe('Hello')
    expect(mergeLyrics('[00:01]Fallback', null, null, 'malformed')[0].text).toBe('Fallback')
  })
  it('applies document offsets consistently to timed lines and words',()=>{
    for(const body of ['[00:10.000]<0,300>你<300,700>好','[10000,1000](10000,300,0)你(10300,700,0)好','[10000,1000]你(10000,300)好(10300,700)']){
      const [line]=parseTimedLyrics(`[offset:500]\n${body}`)
      expect(line.time).toBe(10.5);expect(line.words?.[1].time).toBe(10.8);expect(line.words?.[1].duration).toBe(.7)
    }
  })
  it('clamps word fill before and after the sung interval', () => {
    const word = { time: 10, duration: 2, text: 'music' }
    expect(wordProgress(word, 9)).toBe(0); expect(wordProgress(word, 11)).toBe(.5); expect(wordProgress(word, 13)).toBe(1)
    expect(wordProgress({ ...word, duration: 0 }, 10)).toBe(1)
  })
  it('lazily loads full OpenCC dictionaries and converts multi-character phrases', async () => {
    expect(convertLyric('音乐', 'original')).toBe('音乐')
    await ensureLyricConversion('traditional')
    expect(convertLyric('音乐与梦想的声音', 'traditional')).toBe('音樂與夢想的聲音')
    expect(convertLyric('音樂與夢想的聲音', 'simplified')).toBe('音乐与梦想的声音')
  })
})
