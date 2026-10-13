import type { LibraryState, Playlist, Track } from '../../../../src/shared/types'
import { normalizeTrack } from '../library'

export type SyncMode = 'merge_local_remote' | 'merge_remote_local' | 'overwrite_local_remote' | 'overwrite_remote_local' | 'overwrite_local_remote_full' | 'overwrite_remote_local_full' | 'cancel'
export const SYNC_MODES: SyncMode[] = ['merge_local_remote','merge_remote_local','overwrite_local_remote','overwrite_remote_local','overwrite_local_remote_full','overwrite_remote_local_full','cancel']
export interface WireList { id: string; name: string; source?: string; sourceListId?: string; locationUpdateTime?: number | null; list: Track[] }
export interface ListData { defaultList: Track[]; loveList: Track[]; userList: WireList[] }
export interface SyncAction { action: string; data?: any }
const LIMIT = 100_000
const array = (value: unknown): any[] => { if (!Array.isArray(value) || value.length > LIMIT) throw new Error('Invalid sync array'); return value }
const text = (value: unknown): string => { if (typeof value !== 'string' || value.length > 65536) throw new Error('Invalid sync string'); return value }
export function toListData(state: Pick<LibraryState, 'playlists'>): ListData {
  return {
    defaultList: structuredClone(state.playlists.find(p => p.id === 'default')?.tracks ?? []),
    loveList: structuredClone(state.playlists.find(p => p.id === 'love')?.tracks ?? []),
    userList: state.playlists.filter(p => !['default','love','temp','download'].includes(p.id)).map(p => ({ id: p.id, name: p.name, source: p.source, sourceListId: p.sourceListId, locationUpdateTime: p.locationUpdateTime ?? null, list: structuredClone(p.tracks) })),
  }
}
export function validateListData(raw: unknown): ListData {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid list data')
  const data = raw as ListData
  const music = (items: unknown) => array(items).map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.singer !== 'string') throw new Error('Invalid music data')
    return normalizeTrack(item)
  })
  const ids = new Set<string>(['default','love','temp','download'])
  return { defaultList: music(data.defaultList ?? []), loveList: music(data.loveList ?? []), userList: array(data.userList ?? []).map(p => {
    const id = text(p.id); if (ids.has(id)) throw new Error('Duplicate or reserved playlist id'); ids.add(id)
    return { id, name: text(p.name), source: p.source, sourceListId: p.sourceListId, locationUpdateTime: Number.isFinite(p.locationUpdateTime) ? p.locationUpdateTime : null, list: music(p.list ?? []) }
  }) }
}
export function fromListData(data: ListData, existing: Playlist[]): Playlist[] {
  const createdAt = (id: string) => existing.find(p => p.id === id)?.createdAt ?? Date.now()
  const builtins: Playlist[] = ['default','love'].map((id,i) => ({ id, name: existing.find(p => p.id === id)?.name ?? (i ? '我喜欢的音乐' : '试听列表'), createdAt: createdAt(id), tracks: i ? data.loveList : data.defaultList }))
  return [...builtins, ...data.userList.map(p => ({ id:p.id, name:p.name, source:p.source as Playlist['source'], sourceListId:p.sourceListId, locationUpdateTime:p.locationUpdateTime, tracks:p.list, createdAt:createdAt(p.id) })), ...existing.filter(p => ['temp','download'].includes(p.id))]
}
function unique<T extends {id:string}>(items: T[]): T[] { const seen = new Set<string>(); return items.filter(item => !seen.has(item.id) && Boolean(seen.add(item.id))) }
function mergeTracks(local: Track[], remote: Track[], baseline: Track[] = []): Track[] {
  const localIds = new Set(local.map(t=>t.id)), remoteIds = new Set(remote.map(t=>t.id))
  const removed = new Set(baseline.filter(t => !localIds.has(t.id) || !remoteIds.has(t.id)).map(t=>t.id))
  return unique([...local,...remote]).filter(t => !removed.has(t.id))
}
export function mergeListData(local: ListData, remote: ListData, baseline?: ListData): ListData {
  const result: ListData = { defaultList: mergeTracks(local.defaultList,remote.defaultList,baseline?.defaultList), loveList: mergeTracks(local.loveList,remote.loveList,baseline?.loveList), userList: [] }
  const localMap = new Map(local.userList.map(p=>[p.id,p])), remoteMap = new Map(remote.userList.map(p=>[p.id,p]))
  const baseMap = new Map(baseline?.userList.map(p=>[p.id,p]) ?? [])
  const removed = new Set([...baseMap.keys()].filter(id => !localMap.has(id) || !remoteMap.has(id)))
  for (const p of unique([...local.userList,...remote.userList])) {
    if (removed.has(p.id)) continue
    const l = localMap.get(p.id), r = remoteMap.get(p.id), b = baseMap.get(p.id)
    if (!l || !r) { result.userList.push(structuredClone(p)); continue }
    const merged = structuredClone(l)
    for (const field of ['name','source','sourceListId'] as const) if (b && l[field] === b[field]) (merged as any)[field] = r[field]
    merged.list = mergeTracks(l.list,r.list,b?.list)
    result.userList.push(merged)
  }
  remote.userList.forEach((p,index) => {
    if (removed.has(p.id) || !(p.locationUpdateTime ?? 0)) return
    const localTime = localMap.get(p.id)?.locationUpdateTime ?? 0
    if ((p.locationUpdateTime ?? 0) <= localTime) return
    const current = result.userList.findIndex(l=>l.id===p.id)
    if (current < 0) return
    const [moving] = result.userList.splice(current,1); moving.locationUpdateTime=p.locationUpdateTime
    result.userList.splice(Math.min(index,result.userList.length),0,moving)
  })
  return result
}
export function resolveListConflict(local: ListData, remote: ListData, mode: SyncMode): ListData {
  if (mode === 'cancel') throw new Error('cancel')
  const [source,target] = mode.includes('remote_local') ? [remote,local] : [local,remote]
  if (mode.startsWith('merge')) return mergeListData(source,target)
  if (mode.endsWith('_full')) return structuredClone(source)
  const result = structuredClone(source)
  for (const p of target.userList) if (!result.userList.some(l=>l.id===p.id)) result.userList.push(structuredClone(p))
  return result
}
export function rulesToArray(raw: unknown): string[] {
  const lines = text(raw).split('\n').flatMap(line=>{
    const [rawName,rawSinger]=line.split('@')
    const name=(rawName ?? '').trim().toLocaleLowerCase(), singer=(rawSinger ?? '').trim().toLocaleLowerCase()
    return name ? [singer?`${name}@${singer}`:name] : singer?[`@${singer}`]:[]
  })
  return [...new Set(lines)]
}
export function mergeRules(local: string, remote: string, baseline?: string): string {
  const l=rulesToArray(local),r=rulesToArray(remote), b=baseline == null ? [] : rulesToArray(baseline)
  const removed=new Set(b.filter(x=>!l.includes(x)||!r.includes(x)))
  return [...new Set([...l,...r])].filter(x=>!removed.has(x)).join('\n')
}
function position<T>(items: T[], selected: T[], at: number): T[] {
  if (!Number.isInteger(at) || at < 0) throw new Error('Invalid position')
  const rest = items.filter(x=>!selected.includes(x)); rest.splice(Math.min(at,rest.length),0,...selected); return rest
}
/** Apply LX action names and parameter shapes, rather than app-specific operations. */
export function applyListAction(current: ListData, event: SyncAction): ListData {
  if (event.action === 'list_data_overwrite') return validateListData(event.data)
  const data=structuredClone(current), value=event.data
  const all = (): WireList[] => [{id:'default',name:'',list:data.defaultList},{id:'love',name:'',list:data.loveList},...data.userList]
  const list=(id: unknown): WireList => { const p=all().find(p=>p.id===text(id)); if (!p) throw new Error('Playlist not found'); return p }
  const setMusic=(id:string,tracks:Track[])=> { if(id==='default') data.defaultList=tracks; else if(id==='love') data.loveList=tracks; else list(id).list=tracks }
  const musics=(raw:unknown)=>array(raw).map(normalizeTrack)
  switch(event.action) {
    case 'list_create': {
      const added = array(value.listInfos).map(p=>({id:text(p.id),name:text(p.name),source:p.source,sourceListId:p.sourceListId,locationUpdateTime:p.locationUpdateTime ?? null,list:[]}))
      if(added.some(p=>all().some(l=>l.id===p.id)) || new Set(added.map(p=>p.id)).size!==added.length) throw new Error('Duplicate playlist')
      data.userList=position(data.userList,added,value.position); break
    }
    case 'list_remove': { const ids=array(value); if(ids.some(id=>['default','love'].includes(id))) throw new Error('Reserved playlist'); data.userList=data.userList.filter(p=>!ids.includes(p.id)); break }
    case 'list_update': for(const p of array(value)) { const target=list(p.id); for(const key of ['name','source','sourceListId','locationUpdateTime']) if(Object.hasOwn(p,key)) (target as any)[key]=p[key] }; break
    case 'list_update_position': { const selected=array(value.ids).map(id=>list(id)); data.userList=position(data.userList,selected,value.position); for(const p of selected)p.locationUpdateTime=Date.now(); break }
    case 'list_music_overwrite': setMusic(value.listId,musics(value.musicInfos)); break
    case 'list_music_add':
    case 'list_music_move': {
      const id=event.action==='list_music_add'?value.id:value.toId, tracks=musics(value.musicInfos), target=list(id)
      const existing=new Set(target.list.map(t=>t.id)), additions=unique(tracks).filter(t=>!existing.has(t.id))
      setMusic(id,value.addMusicLocationType==='top'?[...additions,...target.list]:[...target.list,...additions])
      if(event.action==='list_music_move') { const ids=new Set(tracks.map(t=>t.id)); setMusic(value.fromId,list(value.fromId).list.filter(t=>!ids.has(t.id))) }; break
    }
    case 'list_music_remove': { const ids=array(value.ids); setMusic(value.listId,list(value.listId).list.filter(t=>!ids.includes(t.id))); break }
    case 'list_music_clear': for(const id of array(value))setMusic(id,[]); break
    case 'list_music_update': for(const p of array(value)) { const target=list(p.id), track=normalizeTrack(p.musicInfo); setMusic(p.id,target.list.map(t=>t.id===track.id?track:t)) }; break
    case 'list_music_update_position': { const target=list(value.listId), ids=array(value.ids), selected=ids.map(id=>target.list.find(t=>t.id===id)); if(selected.some(x=>!x))throw new Error('Music not found'); setMusic(value.listId,position(target.list,selected as Track[],value.position)); break }
    default: throw new Error('Unknown list sync action')
  }
  return validateListData(data)
}
export function applyDislikeAction(current:string, event:SyncAction):string {
  switch(event.action) {
    case 'dislike_data_overwrite': return rulesToArray(event.data).join('\n')
    case 'dislike_music_clear': return ''
    case 'dislike_music_add': return mergeRules(current,array(event.data).map(item=>`${item.name ?? ''}@${item.singer ?? ''}`).join('\n'))
    default: throw new Error('Unknown dislike sync action')
  }
}
