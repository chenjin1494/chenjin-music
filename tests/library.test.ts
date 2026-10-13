import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryStore, normalizeSettings, normalizeState, uniqueTracks } from '../electron/main/services/library'
import type { Track } from '../src/shared/types'
const track=(id:string,source:Track['source']='wy'):Track=>({id,name:id,singer:'测试歌手',source,interval:null,meta:{songId:id,albumName:''}})
describe('library',()=>{
 it('按平台与歌曲编号去重，保留不同平台歌曲',()=>{expect(uniqueTracks([track('1'),{...track('1'),id:'alternate'},track('1','tx')])).toHaveLength(2)})
 it('迁移旧歌单并确保歌单编号唯一',()=>{const state=normalizeState({userList:[{id:'x',name:'旧歌单',list:[{name:'歌曲',source:'kg',songmid:'hash',singer:'歌手'}]},{id:'x',name:'重复编号',list:[]}]});expect(state.playlists[0].tracks[0].meta.songId).toBe('hash');expect(new Set(state.playlists.map(x=>x.id)).size).toBe(2);expect(state.settings.openAPI).toBe(false)})
 it('约束设置数值，拒绝无效主题与音质',()=>{const settings=normalizeSettings({volume:3,downloadConcurrency:-2,quality:'invalid' as any,theme:'invalid' as any,eq:[99]});expect(settings.volume).toBe(1);expect(settings.downloadConcurrency).toBe(1);expect(settings.quality).toBe('128k');expect(settings.theme).toBe('dark');expect(settings.eq).toEqual([15,0,0,0,0,0,0,0,0,0])})
 it('原子保存全状态并拒绝丢失歌曲的排序',async()=>{const directory=await mkdtemp(join(tmpdir(),'chenjin-library-'));try{const path=join(directory,'library.json');const store=new LibraryStore(path);await store.load();const list=await store.create('测试');await store.add(list.id,[track('a'),track('b'),track('a')]);await expect(store.reorder(list.id,['a'])).rejects.toThrow('全部歌曲');await store.reorder(list.id,['b','a']);const reloaded=new LibraryStore(path);const saved=await reloaded.load();expect(saved.playlists.find(x=>x.id===list.id)?.tracks.map(x=>x.id)).toEqual(['b','a']);expect(JSON.parse(await readFile(path,'utf8')).settings.volume).toBe(.75)}finally{await rm(directory,{recursive:true,force:true})}})
 it('串行原子写入不会被旧快照覆盖',async()=>{const directory=await mkdtemp(join(tmpdir(),'chenjin-library-'));try{const store=new LibraryStore(join(directory,'state.json'));await Promise.all([store.create('一'),store.create('二'),store.settings({volume:.2})]);const other=new LibraryStore(store.filePath);const saved=await other.load();expect(saved.playlists.map(x=>x.name)).toContain('一');expect(saved.playlists.map(x=>x.name)).toContain('二');expect(saved.settings.volume).toBe(.2)}finally{await rm(directory,{recursive:true,force:true})}})
})
