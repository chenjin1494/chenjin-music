import { describe,it,expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { restoreBackup } from '../electron/main/services/backup-scope'
import { emptyLibrary } from '../src/shared/defaults'
describe('scoped backup restore',()=>{
 it('merges full backups without duplicating fixed lists',()=>{const current=emptyLibrary(),incoming=emptyLibrary();incoming.playlists[0].tracks=[{id:'wy_1',name:'歌曲',singer:'歌手',source:'wy',interval:null,meta:{songId:1,albumName:''}}];incoming.editedLyrics={wy_1:{lyric:'[00:01.00]编辑'}};const result=restoreBackup(Buffer.from(JSON.stringify(incoming)),current,true);expect(result.playlists.filter(list=>list.id==='default')).toHaveLength(1);expect(result.playlists[0].tracks).toHaveLength(1);expect(result.editedLyrics?.wy_1.lyric).toContain('编辑')})
 it('restores only settings without losing library',()=>{const current=emptyLibrary();current.playlists.push({id:'user',name:'保留',tracks:[],createdAt:1});const bytes=gzipSync(JSON.stringify({type:'setting_v2',data:{'player.volume':.33}}));const state=restoreBackup(bytes,current);expect(state.playlists).toEqual(current.playlists);expect(state.settings.volume).toBe(.33)})
 it('replaces one existing playlist and keeps all other data',()=>{const current=emptyLibrary();current.searchHistory=['保留'];const list={id:'love',name:'收藏',list:[{id:'wy_1',name:'测试',singer:'歌手',source:'wy',songmid:1}]};const state=restoreBackup(Buffer.from(JSON.stringify({type:'playListPart_v2',data:list})),current);expect(state.playlists.find(p=>p.id==='default')).toEqual(current.playlists[0]);expect(state.playlists.find(p=>p.id==='love')?.tracks).toHaveLength(1);expect(state.searchHistory).toEqual(['保留'])})
})
