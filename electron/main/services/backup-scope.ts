import { gunzipSync } from 'node:zlib'
import type { LibraryState } from '../../../src/shared/types'
import { decodeBackup } from './backup'
export function backupScope(bytes:Buffer):'all'|'settings'|'playlist' {
 if(bytes[0]===31&&bytes[1]===139)bytes=gunzipSync(bytes,{maxOutputLength:128*1024*1024})
 let raw=JSON.parse(bytes.toString().replace(/^\uFEFF/,''));if(typeof raw==='string')raw=JSON.parse(raw)
 const scope=raw.scope||raw.type
 if(['settings','setting','setting_v2'].includes(scope))return 'settings'
 if(['playlist','playList','playList_v2','playListPart','playListPart_v2','defautlList'].includes(scope))return 'playlist'
 return 'all'
}
export function restoreBackup(bytes:Buffer,current:LibraryState,merge=false):LibraryState {
 const next=decodeBackup(bytes),scope=backupScope(bytes)
 if(scope==='settings')return {...current,settings:next.settings}
 if(scope==='playlist'){
  const incoming=new Map(next.playlists.map(list=>[list.id,list]))
  return {...current,playlists:[...current.playlists.map(list=>{const imported=incoming.get(list.id);incoming.delete(list.id);if(!imported)return list;return merge?{...imported,tracks:[...list.tracks,...imported.tracks.filter(track=>!list.tracks.some(t=>t.id===track.id))]}:imported}),...incoming.values()]}
 }
 if(!merge)return next
 const imported=new Map(next.playlists.map(list=>[list.id,list]))
 return {...current,editedLyrics:{...current.editedLyrics,...next.editedLyrics},playlists:[...current.playlists.map(list=>{const incoming=imported.get(list.id);imported.delete(list.id);if(!incoming)return list;const ids=new Set(list.tracks.map(track=>track.id));return {...list,tracks:[...list.tracks,...incoming.tracks.filter(track=>!ids.has(track.id))]}}),...imported.values()]}
}
