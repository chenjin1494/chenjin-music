import { describe,it,expect } from 'vitest'
import { mkdtemp,readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SQLiteStore } from '../electron/main/services/sqlite'
import { LibraryStore } from '../electron/main/services/library'

describe('SQLite worker persistence',()=>{
 it('saves relational rows and restores library after worker restart',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'chenjin-sqlite-'))
  const file=path.join(dir,'chenjin.data.db')
  const store=new LibraryStore(file);await store.load()
  const playlist=await store.create('事务歌单')
  await store.add(playlist.id,[{id:'wy_42',source:'wy',name:'真实结构',singer:'测试',interval:'00:03',meta:{songId:42,albumName:'专辑'}}])
  await store.settings({volume:.42});await store.close()
  expect((await readFile(file)).subarray(0,15).toString()).toBe('SQLite format 3')
  const reopened=new LibraryStore(file);const restored=await reopened.load()
  expect(restored.settings.volume).toBe(.42);expect(restored.playlists.find(p=>p.id===playlist.id)?.tracks[0].meta.songId).toBe(42)
  await reopened.close()
   const db=new SQLiteStore(file)
   const snapshot=JSON.parse((await db.query("SELECT value FROM metadata WHERE key='state'"))[0].values[0][0])
   expect(snapshot._normalizedTracks).toBe(true);expect(snapshot.playlists.find((p:any)=>p.id===playlist.id).tracks).toEqual([])
   expect((await db.query("SELECT value FROM metadata WHERE key='listsHash'"))[0].values[0][0]).toMatch(/^[a-f0-9]{64}$/)
   expect((await db.load())?.playlists.find(p=>p.id===playlist.id)?.tracks[0].name).toBe('真实结构')
   await db.close()
 })
})
