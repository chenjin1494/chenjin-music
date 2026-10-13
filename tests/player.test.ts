import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { nextIndex, nextPlayableIndex, chooseNext, insertNext, uniqueTracks, appendPriority, moveItem, randomUnplayedIndex, trackKey } from '../src/renderer/src/domain/player'
import { PitchDelay } from '../src/renderer/src/audio/pitch-delay'
import { shortcutFromEvent, shortcutMatches } from '../src/renderer/src/domain/shortcuts'
import { parseTheme } from '../src/renderer/src/domain/theme'
import { parsePlaylistAddress, trackMetadataTarget } from '../src/renderer/src/domain/online'
import { parseEffect, effectSettings } from '../src/renderer/src/domain/effects'
import {readSearchSession,saveSearchSession,clearSearchSession} from '../src/renderer/src/domain/search-session'

const track = (id: string, source: Track['source'] = 'local'): Track => ({ id, name: id, singer: '', source, interval: null, meta: { songId: id, albumName: '' } })

describe('player queue domain', () => {
  it('handles empty queue, initial playback, order end and loop wrap', () => {
    expect(nextIndex(0, -1, 'listLoop')).toBe(-1)
    expect(nextIndex(4, -1, 'order')).toBe(0)
    expect(nextIndex(4, 3, 'order')).toBe(-1)
    expect(nextIndex(4, 3, 'listLoop')).toBe(0)
  })
  it('repeats a single track only on natural end, not manual next', () => {
    expect(nextIndex(3, 1, 'singleLoop', true)).toBe(1)
    expect(nextIndex(3, 1, 'singleLoop', false)).toBe(2)
  })
  it('random mode never immediately repeats when multiple tracks exist', () => {
    for (let i = 0; i < 5; i++) for (const value of [0, .25, .5, .75, .999]) {
      const next = nextIndex(5, i, 'random', false, () => value)
      expect(next).not.toBe(i); expect(next).toBeGreaterThanOrEqual(0); expect(next).toBeLessThan(5)
    }
    expect(nextIndex(1, 0, 'random')).toBe(0)
  })
  it('edits a base queue without disturbing earlier history', () => {
    const a = track('a'), b = track('b'), c = track('c'), d = track('d')
    expect(insertNext([a, b, c], 0, [c, d, c]).map(item => item.id)).toEqual(['a', 'c', 'd', 'b'])
    expect(insertNext([], -1, [a, b]).map(item => item.id)).toEqual(['a', 'b'])
  })
  it('deduplicates by source and id and keeps provider collisions', () => {
    const tracks = [track('1'), track('1'), track('1', 'wy')]
    expect(uniqueTracks(tracks)).toHaveLength(2); expect(uniqueTracks(tracks)[0]).toBe(tracks[0])
  })
  it('appends later tracks FIFO and leaves the base queue untouched', () => {
    const base = [track('a'), track('b')], priority = [track('p')]
    const result = appendPriority(priority, [track('q'), track('p')])
    expect(result.map(item => item.id)).toEqual(['p', 'q'])
    expect(priority.map(item => item.id)).toEqual(['p'])
    expect(base.map(item => item.id)).toEqual(['a', 'b'])
  })
  it('priority tracks take precedence in every mode then resume the base queue', () => {
    const base = [track('a'), track('b'), track('c')]
    for (const mode of ['random', 'singleLoop', 'listLoop', 'order'] as const) {
      const first = chooseNext(base, 0, [track('p'), track('q')], mode, true, false)
      expect(first.priority?.id).toBe('p'); expect(first.index).toBe(0)
      const second = chooseNext(base, first.index, first.remaining, mode, true, true)
      expect(second.priority?.id).toBe('q'); expect(second.index).toBe(0)
      const resume = chooseNext(base, second.index, second.remaining, mode, true, true, [], () => 0)
      expect(resume.priority).toBeUndefined(); expect(resume.index).toBe(1)
      expect(base.map(item => item.id)).toEqual(['a', 'b', 'c'])
    }
  })
  it('skips disliked artists and tracks in main and priority queues without retry loops', () => {
    const base = [{ ...track('a'), singer: 'Artist' }, track('b'), track('c')]
    expect(nextPlayableIndex(base, -1, 'order', false, ['@Artist'])).toBe(1)
    expect(nextPlayableIndex(base, 1, 'random', false, ['@Artist', 'c'], () => .99)).toBe(1)
    expect(nextPlayableIndex(base, 0, 'listLoop', false, ['@Artist', 'b', 'c'])).toBe(-1)
    expect(chooseNext(base, 0, [track('p'), track('q')], 'singleLoop', true, false, ['p']).priority?.id).toBe('q')
  })
  it('none stops on natural end but supports manual next and priority return',()=>{
    const base=[track('a'),track('b')]
    expect(nextIndex(2,0,'none',true)).toBe(-1)
    expect(nextIndex(2,0,'none',false)).toBe(1)
    expect(nextIndex(2,1,'none',false)).toBe(-1)
    expect(chooseNext(base,0,[track('p')],'none',true,false).priority?.id).toBe('p')
    expect(chooseNext(base,0,[],'none',true,true).index).toBe(1)
  })
  it('random selection visits every allowed track before resetting and can stop at exhaustion',()=>{
    const base=[track('a'),track('b'),track('c'),track('d')],played=[trackKey(base[0])]
    let current=0
    for(let round=0;round<2;round++){
      const result=randomUnplayedIndex(base,current,played,['d'],true,()=>.99)
      expect(result.reset).toBe(false);expect(played).not.toContain(trackKey(base[result.index]))
      current=result.index;played.push(trackKey(base[current]))
    }
    expect(new Set(played).size).toBe(3)
    expect(randomUnplayedIndex(base,current,played,['d'],false).index).toBe(-1)
    const restarted=randomUnplayedIndex(base,current,played,['d'],true,()=>0)
    expect(restarted.reset).toBe(true);expect(restarted.index).not.toBe(current)
    expect(randomUnplayedIndex(base,current,played,['a','b','c','d']).index).toBe(-1)
  })
  it('moves items immutably and rejects invalid drag targets', () => {
    const items = ['a', 'b', 'c']
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(items, -1, 1)).toEqual(items)
    expect(items).toEqual(['a', 'b', 'c'])
  })
})

function renderPitch(semitones: number, frequency = 440): Float32Array {
  const rate = 48000, frames = 48000
  const shifter = new PitchDelay(rate)
  shifter.setSemitones(semitones)
  const output = new Float32Array(frames)
  for (let offset = 0; offset < frames; offset += 128) {
    const size = Math.min(128, frames - offset)
    const input = Float32Array.from({ length: size }, (_, index) => Math.sin(2 * Math.PI * frequency * (offset + index) / rate) * .4)
    const left = new Float32Array(size), right = new Float32Array(size)
    shifter.process([input], [left, right])
    expect([...right].every(Number.isFinite)).toBe(true)
    output.set(left, offset)
  }
  return output
}
function frequencyOf(samples: Float32Array): number {
  let crossings = 0
  const begin = 24000
  for (let index = begin + 1; index < samples.length; index++) if (samples[index - 1] <= 0 && samples[index] > 0) crossings++
  return crossings * 48000 / (samples.length - begin)
}

describe('independent pitch DSP', () => {
  it('is transparent at zero semitones and keeps duration exactly unchanged', () => {
    const samples = renderPitch(0)
    expect(samples).toHaveLength(48000)
    for (const index of [0, 1, 127, 1000, 47999]) expect(samples[index]).toBeCloseTo(Math.sin(2 * Math.PI * 440 * index / 48000) * .4, 6)
  })
  it('shifts a real sine waveform approximately an octave in both directions', () => {
    expect(frequencyOf(renderPitch(12))).toBeCloseTo(880, -2)
    expect(frequencyOf(renderPitch(-12))).toBeCloseTo(220, -2)
  })
  it('clamps extreme requests and emits finite bounded samples', () => {
    const samples = renderPitch(100)
    expect([...samples].every(sample => Number.isFinite(sample) && Math.abs(sample) <= .401)).toBe(true)
    expect(frequencyOf(samples)).toBeCloseTo(880, -2)
  })
})

describe('renderer configuration', () => {
  it('retains real search results until explicitly cleared and bounds old sessions',()=>{
    clearSearchSession();const result={list:[track('设置')],total:1};saveSearchSession('query',result)
    expect(readSearchSession('query')).toBe(result)
    clearSearchSession();expect(readSearchSession('query')).toBeUndefined()
    for(let index=0;index<9;index++)saveSearchSession(String(index),result)
    expect(readSearchSession('0')).toBeUndefined();expect(readSearchSession('8')).toBe(result)
    clearSearchSession()
  })
  it('matches exact modifier combinations and ignores bare modifiers', () => {
    const event = { code: 'KeyF', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false } as KeyboardEvent
    expect(shortcutFromEvent(event)).toBe('Ctrl+KeyF')
    expect(shortcutMatches(event, 'Ctrl+KeyF')).toBe(true)
    expect(shortcutMatches({ ...event, shiftKey: true } as KeyboardEvent, 'Ctrl+KeyF')).toBe(false)
    expect(shortcutFromEvent({ ...event, code: 'ControlLeft' })).toBe('')
  })
  it('preserves complete provider sharing links and rejects non-HTTP addresses',()=>{
    expect(parsePlaylistAddress('https://music.163.com/#/playlist?id=12345','kw')).toEqual({source:'wy',id:'https://music.163.com/#/playlist?id=12345'})
    expect(parsePlaylistAddress('https://y.qq.com/n/ryqq/playlist/54321','wy')).toEqual({source:'tx',id:'https://y.qq.com/n/ryqq/playlist/54321'})
    expect(parsePlaylistAddress('https://www.kuwo.cn/playlist_detail/67890','tx')).toEqual({source:'kw',id:'https://www.kuwo.cn/playlist_detail/67890'})
    expect(parsePlaylistAddress('https://www.kugou.com/yy/special/single/999.html','wy')).toEqual({source:'kg',id:'https://www.kugou.com/yy/special/single/999.html'})
    expect(parsePlaylistAddress('12345','mg')).toEqual({source:'mg',id:'12345'})
    expect(parsePlaylistAddress('https://notqq.com/playlist/123','wy')).toEqual({source:'wy',id:'https://notqq.com/playlist/123'})
    expect(parsePlaylistAddress('https://www.kugou.com/pcshare/index.html?global_collection_id=abc','wy')).toEqual({source:'kg',id:'https://www.kugou.com/pcshare/index.html?global_collection_id=abc'})
    expect(parsePlaylistAddress('123###MUSIC_U-token','wy')).toEqual({source:'wy',id:'123###MUSIC_U-token'})
    expect(()=>parsePlaylistAddress('javascript:alert(1)','wy')).toThrow()
  })
  it('extracts real album and artist IDs without inventing missing IDs',()=>{
    const song={...track('song','wy'),singer:'Artist',meta:{songId:'song',albumName:'Album',albumId:123,singerIds:[{id:456,name:'Artist'}]}}
    expect(trackMetadataTarget(song,'album')).toEqual({kind:'album',source:'wy',id:'123',name:'Album'})
    expect(trackMetadataTarget(song,'singer')).toEqual({kind:'singer',source:'wy',id:'456',name:'Artist'})
    expect(trackMetadataTarget(track('song'),'album')).toBeUndefined()
  })
  it('bounds imported DSP presets and excludes unrelated user settings',()=>{
    const effect=parseEffect({name:'Personal',eq:Array(10).fill(30),pitch:99,reverb:99,reverbDecay:-1,panner:true,pannerSpeed:99,proxy:'unsafe',downloadPath:'unsafe'})
    expect(effect.eq).toEqual(Array(10).fill(15));expect(effect.pitch).toBe(12);expect(effect.reverb).toBe(1);expect(effect.reverbDecay).toBe(.2)
    expect(effectSettings(effect)).not.toHaveProperty('proxy');expect(effectSettings(effect)).not.toHaveProperty('name')
    expect(()=>parseEffect({eq:[1,2]})).toThrow();expect(()=>parseEffect({eq:Array(10).fill(NaN)})).toThrow()
  })
  it('imports only supported appearance values and rejects invalid theme colors', () => {
    expect(parseTheme({ format: 'chenjin-theme', version: 1, theme: 'dark', accent: '#a78bfa', colors: { bg: '#112233', arbitrary: 'ignored' } }).colors).toEqual({ bg: '#112233' })
    expect(() => parseTheme({ format: 'chenjin-theme', version: 1, theme: 'dark', accent: 'url(script)' })).toThrow()
    expect(() => parseTheme({ format: 'other', version: 1 })).toThrow()
  })
})
