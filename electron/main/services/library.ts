import { normalizeAppearance } from '../../../src/shared/appearance'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { migrateLegacySettings } from '../../../src/shared/legacy-settings'
import { similarityKey } from '../../../src/shared/dislike'
import { SQLiteStore } from './sqlite'
import { defaultSettings, emptyLibrary } from '../../../src/shared/defaults'
import type { LibraryState, Playlist, Settings, Track } from '../../../src/shared/types'

export function trackKey(track: Track): string { return `${track.source}:${track.meta?.songId ?? track.id}` }
export function uniqueTracks(tracks: Track[]): Track[] { const seen = new Set<string>(); return tracks.filter(track => { const key = trackKey(track); if (seen.has(key)) return false; seen.add(key); return true }) }
export function normalizeTrack(raw: any): Track {
 if (!raw || typeof raw !== 'object') throw new Error('歌曲数据无效')
 const source = ['kw','kg','tx','wy','mg','local'].includes(raw.source) ? raw.source : 'local'
 const meta = { ...(raw.meta ?? raw.metaData ?? {}), songId: raw.meta?.songId ?? raw.metaData?.songId ?? raw.songmid ?? raw.songId ?? raw.hash ?? raw.filePath ?? raw.id ?? randomUUID(), albumName: String(raw.meta?.albumName ?? raw.metaData?.albumName ?? raw.albumName ?? ''), picUrl: raw.meta?.picUrl ?? raw.metaData?.picUrl ?? raw.img ?? null, qualitys: raw.meta?.qualitys ?? raw.metaData?.qualitys ?? raw.types ?? [], _qualitys: raw.meta?._qualitys ?? raw.metaData?._qualitys ?? raw._types ?? {} } as Track['meta']
 for (const key of ['hash','albumAudioId','strMediaMid','albumMid','albumId','copyrightId','lrcUrl','mrcUrl','trcUrl','filePath','ext']) if (meta[key] == null && raw[key] != null) meta[key] = raw[key]
 if (source === 'tx' && meta.id == null && raw.songId != null) meta.id = raw.songId
 if (Array.isArray(meta.qualitys)) meta.qualitys = meta.qualitys.map((q: any) => ({...q,type:q.type==='flac32bit'?'flac24bit':q.type}))
 if (meta._qualitys?.flac32bit) { meta._qualitys.flac24bit=meta._qualitys.flac32bit; delete meta._qualitys.flac32bit }
 return { id: String(raw.id ?? `${source}:${meta.songId}`), name: String(raw.name ?? raw.title ?? '未知歌曲'), singer: String(raw.singer ?? raw.artist ?? '未知歌手'), source, interval: raw.interval == null ? null : String(raw.interval), meta }
}
export function normalizeState(raw: any): LibraryState {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('音乐库数据无效')
 const base = emptyLibrary()
 const lists = raw.playlists ?? raw.list?.userList ?? raw.userList ?? (Array.isArray(raw.list) ? raw.list : undefined)
 const hasLegacyLists = Array.isArray(raw.list?.defaultList ?? raw.defaultList) || Array.isArray(raw.list?.loveList ?? raw.loveList)
 const playlists: Playlist[] = Array.isArray(lists) ? lists.map((list: any) => ({ id: String(list.id ?? randomUUID()), name: String(list.name ?? '导入歌单'), source: list.source, sourceListId: list.sourceListId, locationUpdateTime: list.locationUpdateTime, createdAt: Number(list.createdAt) || Date.now(), tracks: (Array.isArray(list.tracks ?? list.list) ? list.tracks ?? list.list : []).map(normalizeTrack) })) : hasLegacyLists ? [] : base.playlists
 const legacyDefault = raw.list?.defaultList ?? raw.defaultList
 const legacyLove = raw.list?.loveList ?? raw.loveList
 if (Array.isArray(legacyDefault)) playlists.unshift({ id: 'default', name: '试听列表', createdAt: Date.now(), tracks: legacyDefault.map(normalizeTrack) })
 if (Array.isArray(legacyLove)) playlists.push({ id: 'love', name: '我喜欢的音乐', createdAt: Date.now(), tracks: legacyLove.map(normalizeTrack) })
 const ids = new Set<string>(); for (const list of playlists) { if (ids.has(list.id)) list.id = randomUUID(); ids.add(list.id) }
 return { ...base, version: 1, editedLyrics:raw.editedLyrics&&typeof raw.editedLyrics==='object'&&!Array.isArray(raw.editedLyrics)?structuredClone(raw.editedLyrics):{}, playlists, settings: normalizeSettings(raw.settings ?? raw.setting ?? {}), scripts: Array.isArray(raw.scripts) ? raw.scripts : [], downloads: Array.isArray(raw.downloads) ? raw.downloads : [], searchHistory: Array.isArray(raw.searchHistory) ? raw.searchHistory.filter((x: unknown) => typeof x === 'string').slice(0,100) : [], dislikes: Array.isArray(raw.dislikes) ? raw.dislikes.filter((x: unknown) => typeof x === 'string') : [], player: raw.player && Array.isArray(raw.player.queue) ? {queue: raw.player.queue.map(normalizeTrack), currentId: raw.player.currentId, progress: Math.max(0,Number(raw.player.progress)||0),...(Array.isArray(raw.player.priorityQueue)?{priorityQueue:raw.player.priorityQueue.map(normalizeTrack)}:{}),...(raw.player.priorityCurrent?{priorityCurrent:normalizeTrack(raw.player.priorityCurrent)}:{}),...(Number.isFinite(raw.player.resumeIndex)?{resumeIndex:raw.player.resumeIndex}:{})} : undefined }
}
export function normalizeSettings(patch: Partial<Settings>, current: Settings = defaultSettings): Settings {
 const migrated=migrateLegacySettings(patch)
  const result = { ...structuredClone(current), ...migrated }
  if(!Object.prototype.hasOwnProperty.call(migrated,'closeBehavior')&&Object.prototype.hasOwnProperty.call(migrated,'closeToTray'))result.closeBehavior=migrated.closeToTray===true?'tray':'ask'
  if(!['ask','tray','quit'].includes(String(result.closeBehavior)))result.closeBehavior='ask'
  result.closeToTray=result.closeBehavior==='tray'
 const clamp = (n: unknown, min: number, max: number, fallback: number) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback
 result.volume = clamp(result.volume, 0, 1, .75); result.playbackRate = clamp(result.playbackRate,.25,4,1)
 result.downloadConcurrency = Math.round(clamp(result.downloadConcurrency,1,10,3))
 result.openAPIPort = Math.round(clamp(result.openAPIPort,1024,65535,23330)); result.syncPort = Math.round(clamp(result.syncPort,1024,65535,23332))
 if (!['128k','320k','flac','flac24bit'].includes(result.quality)) result.quality = '128k'
 if (!['dark','light','system'].includes(result.theme)) result.theme = 'dark'
 if (!['listLoop','random','order','singleLoop','none'].includes(result.playMode)) result.playMode = 'listLoop'
 result.reverb=clamp(result.reverb,0,1,0);result.pitch=clamp(result.pitch,-12,12,0);result.reverbDecay=clamp(result.reverbDecay,.2,8,2);result.pannerSpeed=clamp(result.pannerSpeed,.02,2,.15)
 result.eq = Array.from({length:10}, (_,i) => clamp(result.eq?.[i],-15,15,0))
 for (const [key,value] of Object.entries(defaultSettings)) { if (typeof value === 'boolean' && typeof result[key] !== 'boolean') result[key] = value; if (typeof value === 'string' && typeof result[key] !== 'string') result[key] = value }
 result.appearance=normalizeAppearance(result.appearance)
  return result
}
export class LibraryStore {
 private state: LibraryState = emptyLibrary()
 private writes: Promise<void> = Promise.resolve()
 private pendingWrite?:LibraryState
 private writing=false
 private database?: SQLiteStore
 constructor(readonly filePath: string, private changed: (state: LibraryState) => void = () => {}) {}
 async load(): Promise<LibraryState> {
  if(this.filePath.endsWith('.db')) {
   this.database=new SQLiteStore(this.filePath)
   const stored=await this.database.load()
   if(stored)this.state=normalizeState(stored)
   else {try{this.state=normalizeState(JSON.parse(await readFile(join(dirname(this.filePath),'library.json'),'utf8')))}catch{}await this.database.save(this.state)}
  } else try { this.state = normalizeState(JSON.parse(await readFile(this.filePath,'utf8'))) } catch (error: any) { if (error.code !== 'ENOENT') { try { await rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`) } catch {} } }
  return this.get()
 }
 async close():Promise<void>{await this.flush();await this.database?.close()}
 get(): LibraryState { return structuredClone(this.state) }
 flush(): Promise<void> { return this.writes }
 async save(state: LibraryState): Promise<LibraryState> { this.state = normalizeState(state); await this.persist(); return this.get() }
 async mutate(change: (state: LibraryState) => void): Promise<LibraryState> { const next = this.get(); change(next); this.state = normalizeState(next); await this.persist(); return this.get() }
 private persist(): Promise<void> {
  this.pendingWrite=structuredClone(this.state)
  if(!this.writing){
   this.writing=true
   this.writes=(async()=>{try{while(this.pendingWrite){const snapshot=this.pendingWrite;this.pendingWrite=undefined
    if(this.database)await this.database.save(snapshot)
    else {await mkdir(dirname(this.filePath),{recursive:true});const temp=`${this.filePath}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(snapshot,null,2),'utf8');await rename(temp,this.filePath)}
   }this.changed(this.get())}finally{this.writing=false}})()
  }
  return this.writes
 }
 async settings(patch: Partial<Settings>) {this.state={...this.state,settings:normalizeSettings(patch,this.state.settings)};await this.persist();return structuredClone(this.state.settings)}
 private playlist(state: LibraryState, id: string) { const list = state.playlists.find(x => x.id === id); if (!list) throw new Error('歌单不存在'); return list }
 async create(name: string): Promise<Playlist> { if (!String(name ?? '').trim()) throw new Error('请输入歌单名称'); const list: Playlist = {id:randomUUID(),name:name.trim(),tracks:[],createdAt:Date.now()}; await this.mutate(s => {s.playlists.push(list)}); return list }
 async rename(id: string,name: string) { if(['default','love'].includes(id))throw new Error('默认列表不能重命名');if (!String(name ?? '').trim()) throw new Error('请输入歌单名称'); await this.mutate(s => {this.playlist(s,id).name = name.trim()}); return this.get().playlists.find(x=>x.id===id)! }
 async remove(id: string) {if(['default','love'].includes(id))throw new Error('默认列表不能删除'); await this.mutate(s => {this.playlist(s,id); s.playlists = s.playlists.filter(x=>x.id!==id)}); return true }
 async add(id: string,tracks: Track[]) { await this.mutate(s => {const list = this.playlist(s,id); list.tracks = uniqueTracks(s.settings.addMusicLocation==='top'?[...tracks.map(normalizeTrack),...list.tracks]:[...list.tracks,...tracks.map(normalizeTrack)])}); return this.get().playlists.find(x=>x.id===id)! }
 async removeTracks(id: string,ids: string[]) { await this.mutate(s => {const list=this.playlist(s,id); list.tracks=list.tracks.filter(t=>!ids.includes(t.id))}); return this.get().playlists.find(x=>x.id===id)! }
 async reorder(id: string,ids: string[]) { await this.mutate(s => {const list=this.playlist(s,id); const map = new Map(list.tracks.map(t=>[t.id,t])); if (ids.length!==list.tracks.length || new Set(ids).size!==ids.length || ids.some(x=>!map.has(x))) throw new Error('排序必须包含歌单中的全部歌曲且不能重复'); list.tracks=ids.map(x=>map.get(x)!)}); return this.get().playlists.find(x=>x.id===id)! }
 async transfer(from:string,to:string,trackIds:string[],move=false){if(from===to)return this.get();await this.mutate(state=>{const origin=this.playlist(state,from),target=this.playlist(state,to);const tracks=origin.tracks.filter(track=>trackIds.includes(track.id));target.tracks=uniqueTracks([...target.tracks,...tracks]);if(move)origin.tracks=origin.tracks.filter(track=>!trackIds.includes(track.id))});return this.get()}
 async order(ids:string[]){await this.mutate(state=>{const map=new Map(state.playlists.map(list=>[list.id,list]));if(ids.length!==state.playlists.length||new Set(ids).size!==ids.length||ids.some(id=>!map.has(id)))throw new Error('歌单排序必须包含全部歌单');const fixed=['default','love'];state.playlists=[...fixed.map(id=>map.get(id)).filter((list):list is Playlist=>!!list),...ids.filter(id=>!fixed.includes(id)).map(id=>map.get(id)!)]});return this.get()}
 async dedupe(id: string) { await this.mutate(s => {const list=this.playlist(s,id);const seen=new Set<string>();list.tracks=uniqueTracks(list.tracks).filter(track=>{const key=similarityKey(track);if(seen.has(key))return false;seen.add(key);return true})}); return this.get().playlists.find(x=>x.id===id)! }
}

export class MemoryCache {
 private values = new Map<string,{expires:number;value:unknown}>()
 get<T>(key:string): T | undefined {const entry=this.values.get(key); if (!entry || entry.expires<Date.now()) {this.values.delete(key);return undefined} return structuredClone(entry.value) as T}
 set(key:string,value:unknown,ttl=300_000) {if (this.values.size>=300) this.values.delete(this.values.keys().next().value!);this.values.set(key,{value:structuredClone(value),expires:Date.now()+ttl})}
 count(){const now=Date.now();for(const [key,value]of this.values)if(value.expires<now)this.values.delete(key);return this.values.size}
 clear() {this.values.clear()}
}
