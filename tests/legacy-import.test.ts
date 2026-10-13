import { vi,describe,it,expect } from 'vitest'
vi.mock('electron',()=>({BrowserWindow:class{},ipcMain:{}}))
import initSqlJs from 'sql.js'
import { mkdtemp,writeFile,readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import os from 'node:os'
import { importLegacyDirectory } from '../electron/main/services/legacy-import'
describe('read-only LX SQLite migration',()=>{
 it('imports ordered songs/settings/compressed scripts without changing original DB',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'chenjin-legacy-'));const SQL=await initSqlJs();const db=new SQL.Database()
  db.run('CREATE TABLE my_list(id,name,source,sourceListId,position,locationUpdateTime);CREATE TABLE my_list_music_info(id,listId,name,singer,source,interval,meta);CREATE TABLE my_list_music_info_order(listId,musicInfoId,"order");CREATE TABLE dislike_list(type,content,meta);CREATE TABLE lyric(id,source,type,text);')
  db.run('INSERT INTO my_list VALUES(?,?,?,?,?,?)',['default','默认',null,null,0,null]);db.run('INSERT INTO my_list VALUES(?,?,?,?,?,?)',['love','收藏',null,null,1,null])
  for(const [id,order] of [['wy_1',1],['wy_2',0]] as const){db.run('INSERT INTO my_list_music_info VALUES(?,?,?,?,?,?,?)',[id,'default',id,'歌手','wy','00:12',JSON.stringify({songId:id,albumName:'专辑'})]);db.run('INSERT INTO my_list_music_info_order VALUES(?,?,?)',['default',id,order])}
  db.run('INSERT INTO dislike_list VALUES(?,?,?)',['music','晴天@周杰伦',null]);db.run('INSERT INTO lyric VALUES(?,?,?,?)',['wy_1','edited','lyric',Buffer.from('[offset:300]\n[00:01.00]专属偏移').toString('base64')]);const bytes=Buffer.from(db.export());db.close();const file=path.join(folder,'lx.data.db');await writeFile(file,bytes)
  await writeFile(path.join(folder,'config_v2.json'),JSON.stringify({setting:{'player.volume':.23}}));await writeFile(path.join(folder,'user_api.json'),JSON.stringify({userApis:[{script:'gz_'+deflateSync(Buffer.from('/**\n * @name 迁移脚本\n */\nlx.send(lx.EVENT_NAMES.inited,{sources:{}})')).toString('base64')}]}))
  const state=await importLegacyDirectory(folder);expect(state.playlists[0].tracks.map(t=>t.id)).toEqual(['wy_2','wy_1']);expect(state.settings.volume).toBe(.23);expect(state.dislikes).toEqual(['晴天@周杰伦']);expect(state.scripts[0].enabled).toBe(false);expect(state.editedLyrics?.wy_1.lyric).toBe('[offset:300]\n[00:01.00]专属偏移');expect(await readFile(file)).toEqual(bytes)
  await writeFile(file+'-wal',Buffer.from('pending'));await expect(importLegacyDirectory(folder)).rejects.toThrow('先关闭 LX')
 })
})
