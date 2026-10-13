import { describe,it,expect } from 'vitest'
import { mkdtemp,writeFile,readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { tagFlac } from '../electron/main/services/flac-tags'
import { isDisliked,dislikeRule } from '../src/shared/dislike'
describe('media tags and dislike compatibility',()=>{
 it('writes valid FLAC metadata without altering audio frame bytes',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'chenjin-flac-'));const file=path.join(folder,'test.flac')
  const frames=Buffer.from([255,248,0,42,41,40]);const streaminfo=Buffer.concat([Buffer.from([128,0,0,34]),Buffer.alloc(34)])
  await writeFile(file,Buffer.concat([Buffer.from('fLaC'),streaminfo,frames]));await tagFlac(file,{title:'测试',artist:'歌手',album:'专辑',lyrics:'[00:01.00]词'})
  const bytes=await readFile(file);expect(bytes.subarray(0,4).toString()).toBe('fLaC');expect(bytes.subarray(-frames.length)).toEqual(frames)
  const offset=4+38;expect(bytes[offset]&127).toBe(4);expect(bytes[offset]&128).toBe(128);expect(bytes.toString()).toContain('TITLE=测试');expect(bytes.toString()).toContain('LYRICS=[00:01.00]词')
 })
 it('matches LX song and singer rules and historical track IDs',()=>{
  const track:any={id:'wy_1',name:'晴天',singer:'周杰伦'}
  expect(dislikeRule(track)).toBe('晴天@周杰伦');expect(isDisliked(track,['@周杰伦'])).toBe(true);expect(isDisliked(track,['晴 天@周杰伦'])).toBe(true);expect(isDisliked(track,['wy_1'])).toBe(true);expect(isDisliked(track,['晴天@其他'])).toBe(false)
 })
})
