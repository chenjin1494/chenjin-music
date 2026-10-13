import type { Track, SourceId, Quality } from './types'

/** LX scripts deliberately use the legacy flattened song contract. */
export function toScriptTrack(track: Track): Record<string, unknown> {
 const meta=track.meta
 return {name:track.name,singer:track.singer,source:track.source,interval:track.interval,songmid:meta.songId,albumName:meta.albumName,img:meta.picUrl || '',albumId:meta.albumId || '',typeUrl:{},types:meta.qualitys || [],_types:meta._qualitys || {},
  ...(track.source==='kg'?{hash:meta.hash,albumAudioId:meta.albumAudioId}:{}),
  ...(track.source==='tx'?{strMediaMid:meta.strMediaMid,albumMid:meta.albumMid,songId:meta.id}:{}),
  ...(track.source==='mg'?{copyrightId:meta.copyrightId,lrcUrl:meta.lrcUrl,mrcUrl:meta.mrcUrl,trcUrl:meta.trcUrl}:{}),
  ...(track.source==='local'?{filePath:meta.filePath,ext:meta.ext}: {})}
}
export function normalizeTrack(input: any): Track {
 if(!input || typeof input.name!=='string')throw new Error('歌曲缺少名称')
 const source=input.source as SourceId
 if(!['kw','kg','tx','wy','mg','local'].includes(source))throw new Error('歌曲来源暂不支持')
 const meta = input.meta ? {...input.meta} : {songId:input.songmid ?? input.songId ?? input.hash,albumName:input.albumName || '',picUrl:input.img || null,qualitys:input.types || [],_qualitys:input._types || {},albumId:input.albumId,...Object.fromEntries(['hash','albumAudioId','strMediaMid','albumMid','copyrightId','lrcUrl','mrcUrl','trcUrl','filePath','ext'].filter(k=>input[k]!=null).map(k=>[k,input[k]])),...(source==='tx'?{id:input.songId}:{})}
 if(meta.songId==null)meta.songId=meta.filePath || input.id
 if(meta.songId==null)throw new Error('歌曲缺少平台编号')
 meta.albumName=String(meta.albumName || '')
 if(meta._qualitys?.flac32bit){meta._qualitys.flac24bit=meta._qualitys.flac32bit;delete meta._qualitys.flac32bit}
 if(Array.isArray(meta.qualitys))meta.qualitys=meta.qualitys.map((q:any)=>({...q,type:q.type==='flac32bit'?'flac24bit':q.type}))
 return {id:String(input.id || `${source}_${meta.songId}`),name:input.name,singer:String(input.singer || ''),source,interval:input.interval || null,meta}
}
export function deduplicateTracks(tracks: Track[]): Track[] {
 const seen=new Set<string>()
 return tracks.filter(track=>{if(seen.has(track.id))return false;seen.add(track.id);return true})
}
export function availableQuality(track: Track, desired: Quality): Quality {
 const qualities=track.meta.qualitys?.map(q=>q.type)
 if(!qualities?.length || qualities.includes(desired))return desired
 return (['flac24bit','flac','320k','128k'] as Quality[]).find(q=>qualities.includes(q)) || '128k'
}
