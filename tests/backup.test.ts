import { describe, expect, it } from 'vitest'
import { gzipSync } from 'node:zlib'
import { emptyLibrary } from '../src/shared/defaults'
import { decodeBackup, encodeBackup, exportBackupText } from '../electron/main/services/backup'
describe('backup',()=>{
 it('gzip 与 JSON 真实往返保留设置和歌单',()=>{const state=emptyLibrary();state.settings.volume=.3;state.searchHistory=['晴天'];const gzip=encodeBackup(state);expect([...gzip.subarray(0,2)]).toEqual([31,139]);expect(decodeBackup(gzip)).toEqual(state);expect(decodeBackup(exportBackupText(state))).toEqual(state)})
 it('迁移旧版 LX 列表和设置',()=>{const state=decodeBackup(JSON.stringify({list:{defaultList:[{name:'晴天',singer:'周杰伦',source:'tx',songmid:'song-mid',albumName:'叶惠美'}],loveList:[],userList:[{id:'old',name:'收藏',list:[]}]},setting:{volume:.4}}));expect(state.playlists.find(x=>x.id==='default')?.tracks[0].name).toBe('晴天');expect(state.playlists.find(x=>x.id==='old')?.name).toBe('收藏');expect(state.settings.volume).toBe(.4)})
 it('拒绝损坏压缩包、无关 JSON 和未来版本',()=>{expect(()=>decodeBackup(Buffer.from([31,139,0]))).toThrow('无法读取备份');expect(()=>decodeBackup('{"unrelated":true}')).toThrow('不包含支持');expect(()=>decodeBackup('{"format":"chenjin-music","version":9,"data":{}}')).toThrow('更新版本')})
 it('接受带 UTF-8 BOM 的未压缩备份',()=>{expect(decodeBackup('\uFEFF'+exportBackupText(emptyLibrary())).playlists).toHaveLength(2)})
 it('读取 v2 全备份、单列表和历史双重编码',()=>{const list={id:'love',name:'收藏',list:[{name:'测试',singer:'歌手',source:'kg',songmid:7,hash:'HASH'}]};const state=decodeBackup(gzipSync(JSON.stringify(JSON.stringify({type:'allData_v2',playList:[list],setting:{'player.volume':.25}}))));expect(state.playlists[0].tracks[0].meta.hash).toBe('HASH');expect(state.settings.volume).toBe(.25);expect(decodeBackup(JSON.stringify({type:'playListPart_v2',data:list})).playlists[0].id).toBe('love');expect(decodeBackup(JSON.stringify({type:'setting_v2',data:{'player.playQuality':'flac'}})).settings.quality).toBe('flac')})
 it('识别压缩的旧歌单数组',()=>{const old=[{id:'p',name:'旧列表',list:[{name:'歌',source:'wy',songmid:1}]}];expect(decodeBackup(gzipSync(JSON.stringify(old))).playlists[0].tracks[0].meta.songId).toBe(1)})
})
