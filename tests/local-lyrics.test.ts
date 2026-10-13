import { afterEach, describe, expect, it } from 'vitest'
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { parseTimedLyrics } from '../src/renderer/src/domain/lyrics'
import path from 'node:path'
import os from 'node:os'
import iconv from 'iconv-lite'
import NodeID3 from 'node-id3'
import type { Lyrics, Track } from '../src/shared/types'
import { lyricText, readLocalLyrics } from '../electron/main/services/local-lyrics'
import { LyricCache } from '../electron/main/services/lyric-cache'
import { tagFlac } from '../electron/main/services/flac-tags'

const directories: string[] = []
async function temporary(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'chenjin-local-lyrics-test-'))
  directories.push(directory)
  return directory
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const resolved = path.resolve(directory)
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('chenjin-local-lyrics-test-')) throw new Error('Unexpected temporary cleanup target')
    await rm(resolved, { recursive: true, force: true })
  }
})
const track = (filePath?: string, id = 'local:lyric-fixture'): Track => ({ id, name: '真实歌词测试', singer: '测试艺人', source: 'local', interval: '00:01', meta: { songId: id, albumName: '测试专辑', ...(filePath ? { filePath } : {}) } })
async function fixture(extension: 'mp3' | 'flac'): Promise<string> {
  const directory = await temporary(), target = path.join(directory, `中文曲名.${extension}`)
  await copyFile(path.resolve(`tests/fixtures/sine.${extension}`), target)
  return target
}
const main = '[00:00.10]后来听见中文音乐\n[00:00.50]保持原文'
const translated = '[00:00.10]Translated line'
const roman = '[00:00.10]hou lai ting jian'
const word = '[0,1000]<0,300,0>中文<300,700,0>逐字'

function localKrc(): Buffer {
  const language = Buffer.from(JSON.stringify({ content: [{ type: 1, lyricContent: [['本地翻译']] }, { type: 0, lyricContent: [['ben', 'di']] }] })).toString('base64')
  const payload = deflateSync(`[language:${language}]\n[2400,1200]<0,400,0>本<500,700,0>地`)
  const xorKey = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]
  const encrypted = Buffer.from(payload)
  for (let index = 0; index < encrypted.length; index++) encrypted[index] ^= xorKey[index % xorKey.length]
  return Buffer.concat([Buffer.from('krc1'), encrypted])
}

function embedMP3(file: string, text = main): void {
  const tags: NodeID3.Tags = { title: '真实音频fixture', unsynchronisedLyrics: { language: 'chi', text } }
  const result = NodeID3.update(tags, file)
  if (result instanceof Error) throw result
}

describe('real local audio lyric extraction', () => {
  it.each(['utf16-le','utf16-be'])('decodes %s with and without BOM while retaining supplementary Chinese and emoji',encoding=>{const text='[00:00.10]中文歌词𠀀🎵\n[00:03.00]下一句';const bytes=iconv.encode(text,encoding);const bom=encoding==='utf16-le'?Buffer.from([255,254]):Buffer.from([254,255]);expect(lyricText(bytes)).toBe(text);expect(lyricText(Buffer.concat([bom,bytes]))).toBe(text)})
  it('reads mixed Windows UTF-16 main and companion lyrics beside a real MP3',async()=>{const file=await fixture('mp3'),base=file.replace(/\.mp3$/,'');await writeFile(base+'.lrc',Buffer.concat([Buffer.from([255,254]),iconv.encode(main,'utf16-le')]));await writeFile(base+'.translation.lrc',Buffer.concat([Buffer.from([254,255]),iconv.encode(translated,'utf16-be')]));await writeFile(base+'.roman.lrc',iconv.encode(roman,'utf16-le'));await writeFile(base+'.lx.lrc',iconv.encode(word,'utf16-be'));expect(await readLocalLyrics(track(file))).toEqual({lyric:main,tlyric:translated,rlyric:roman,lxlyric:word})})
  it('decodes UTF-8 BOM and GB18030 Chinese without changing lyric text', () => {
    expect(lyricText(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(main)]))).toBe(main)
    const legacy = '[00:01.00]中文歌词与𠀀扩展汉字'
    expect(lyricText(iconv.encode(legacy, 'gb18030'))).toBe(legacy)
  })

  it('reads UTF-8 main and GB18030 translation/roman/word sidecars beside a real MP3', async () => {
    const file = await fixture('mp3'), base = file.replace(/\.mp3$/, '')
    await writeFile(base + '.lrc', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(main)]))
    const translation = '[00:00.10]这是中文翻译'
    await writeFile(base + '.translation.lrc', iconv.encode(translation, 'gb18030'))
    await writeFile(base + '.roman.lrc', Buffer.from(roman))
    await writeFile(base + '.lx.lrc', iconv.encode(word, 'gb18030'))
    expect(await readLocalLyrics(track(file))).toEqual({ lyric: main, tlyric: translation, rlyric: roman, lxlyric: word })
  })

  it('extracts real embedded ID3 unsynchronised lyrics using music-metadata', async () => {
    const file = await fixture('mp3')
    embedMP3(file)
    expect(await readLocalLyrics(track(file))).toEqual({ lyric: main, tlyric: null, rlyric: null, lxlyric: null })
  })

  it('prefers explicit sidecar lyrics over embedded lyrics and retains every companion field', async () => {
    const file = await fixture('mp3'), base = file.replace(/\.mp3$/, '')
    embedMP3(file, '[00:00.10]Embedded fallback')
    await writeFile(base + '.lrc', main)
    await writeFile(base + '.translation.lrc', translated)
    await writeFile(base + '.roman.lrc', roman)
    await writeFile(base + '.lx.lrc', word)
    expect(await readLocalLyrics(track(file))).toEqual({ lyric: main, tlyric: translated, rlyric: roman, lxlyric: word })
  })

  it('returns word-only local lyrics rather than replacing them with embedded plain lyrics', async () => {
    const file = await fixture('mp3')
    embedMP3(file, 'Embedded plain fallback')
    await writeFile(file.replace(/\.mp3$/, '.lx.lrc'), word)
    expect(await readLocalLyrics(track(file))).toEqual({ lyric: '', tlyric: null, rlyric: null, lxlyric: word })
  })

  it('extracts real FLAC Vorbis LYRICS tags and lets a matching sidecar take precedence', async () => {
    const file = await fixture('flac')
    await tagFlac(file, { title: '测试FLAC', artist: '艺人', album: '专辑', lyrics: main })
    expect((await readLocalLyrics(track(file)))?.lyric).toBe('[00:00.100]后来听见中文音乐\n[00:00.500]保持原文')
    await writeFile(file.replace(/\.flac$/, '.lrc'), '[00:00.10]Sidecar takes priority')
    expect((await readLocalLyrics(track(file)))?.lyric).toBe('[00:00.10]Sidecar takes priority')
  })

  it('decodes a real local KRC sidecar with aligned words, translation and romanization', async () => {
    const file = await fixture('mp3')
    await writeFile(file.replace(/\.mp3$/, '.krc'), localKrc())
    const lyrics = await readLocalLyrics(track(file))
    expect(lyrics?.lyric).toBe('[00:02.400]本地')
    expect(lyrics?.tlyric).toBe('[00:02.400]本地翻译')
    expect(lyrics?.rlyric).toBe('[00:02.400]bendi')
    expect(parseTimedLyrics(lyrics?.lxlyric)[0].words).toEqual([{ time: 2.4, duration: .4, text: '本' }, { time: 2.9, duration: .7, text: '地' }])
  })

  it('keeps explicit LRC main and translation over KRC while using its word and roman metadata', async () => {
    const file = await fixture('mp3'), base = file.replace(/\.mp3$/, '')
    await writeFile(base + '.krc', localKrc())
    await writeFile(base + '.lrc', main)
    await writeFile(base + '.translation.lrc', translated)
    const lyrics = await readLocalLyrics(track(file))
    expect(lyrics?.lyric).toBe(main)
    expect(lyrics?.tlyric).toBe(translated)
    expect(lyrics?.rlyric).toBe('[00:02.400]bendi')
    expect(parseTimedLyrics(lyrics?.lxlyric)[0].words?.[1]).toEqual({ time: 2.9, duration: .7, text: '地' })
  })

  it('returns null for missing paths, corrupt audio and unrelated translation-only data', async () => {
    expect(await readLocalLyrics(track())).toBeNull()
    const directory = await temporary(), missing = path.join(directory, 'missing.mp3')
    expect(await readLocalLyrics(track(missing))).toBeNull()
    const corrupt = path.join(directory, 'broken.mp3')
    await writeFile(corrupt, 'not an audio file')
    await writeFile(path.join(directory, 'broken.translation.lrc'), translated)
    expect(await readLocalLyrics(track(corrupt))).toBeNull()
  })

  it('ignores oversized sidecars and falls back to real embedded audio lyrics', async () => {
    const file = await fixture('mp3')
    embedMP3(file)
    await writeFile(file.replace(/\.mp3$/, '.lrc'), Buffer.alloc(2_000_001, 65))
    expect((await readLocalLyrics(track(file)))?.lyric).toBe(main)
  })
})

describe('on-disk edited lyric cache', () => {
  const lyrics: Lyrics = { lyric: main, tlyric: translated, rlyric: roman, lxlyric: word }

  it('persists all fields across cache instances and atomically replaces edited lyrics', async () => {
    const directory = await temporary(), cache = new LyricCache(directory), item = track(undefined, 'wy:/id with spaces')
    expect(await cache.get(item)).toBeNull()
    await cache.set(item, lyrics)
    expect(await new LyricCache(directory).get(item)).toEqual(lyrics)
    const edit = { ...lyrics, lyric: '[00:00.20]Edited version' }
    await cache.set(item, edit)
    expect(await cache.get(item)).toEqual(edit)
    expect(await readdir(directory)).toEqual([createHash('sha256').update(item.id).digest('hex') + '.json'])
  })

  it('ignores ordinary empty writes but persists intentional empty edited overrides', async () => {
    const directory = await temporary(), cache = new LyricCache(directory), item = track()
    await cache.set(item, lyrics)
    await cache.set(item, { lyric: '', tlyric: '', rlyric: '', lxlyric: '' })
    expect(await cache.get(item)).toEqual(lyrics)
    const empty: Lyrics = { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }
    await cache.set(item, empty, true)
    expect(await new LyricCache(directory).get(item)).toEqual(empty)
  })

  it('caches word-only lyrics and removes only the requested song', async () => {
    const directory = await temporary(), cache = new LyricCache(directory), first = track(undefined, 'song-a'), second = track(undefined, 'song-b')
    await cache.set(first, { lyric: '', lxlyric: word })
    await cache.set(second, lyrics)
    expect((await cache.get(first))?.lxlyric).toBe(word)
    await cache.remove(first)
    await cache.remove(first)
    expect(await cache.get(first)).toBeNull()
    expect(await cache.get(second)).toEqual(lyrics)
  })

  it('returns null for corrupt JSON or missing lyric fields without changing the file', async () => {
    const directory = await temporary(), cache = new LyricCache(directory), item = track()
    await cache.set(item, lyrics)
    const file = path.join(directory, createHash('sha256').update(item.id).digest('hex') + '.json')
    await writeFile(file, '{broken json')
    expect(await cache.get(item)).toBeNull()
    expect(await readFile(file, 'utf8')).toBe('{broken json')
    await writeFile(file, JSON.stringify({ lyric: 123, tlyric: translated }))
    expect(await cache.get(item)).toBeNull()
  })

  it('clears only recognized cache files and preserves unrelated data', async () => {
    const directory = await temporary(), cache = new LyricCache(directory)
    await cache.set(track(undefined, 'song-a'), lyrics)
    await cache.set(track(undefined, 'song-b'), lyrics)
    await writeFile(path.join(directory, 'notes.json'), '{"keep":true}')
    await writeFile(path.join(directory, 'pending.json.tmp'), 'unfinished')
    await cache.clear()
    expect((await readdir(directory)).sort()).toEqual(['notes.json', 'pending.json.tmp'])
    expect(await cache.get(track(undefined, 'song-a'))).toBeNull()
    expect(await cache.get(track(undefined, 'song-b'))).toBeNull()
    await new LyricCache(path.join(directory, 'missing-folder')).clear()
  })
})
