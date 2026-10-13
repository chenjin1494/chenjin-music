import type { Track } from './types'
export type TrackSortField='name'|'singer'|'albumName'|'interval'|'source'|'random'
const fields=['name','singer','albumName','interval','source','random']
const seconds=(track:Track)=>{const duration=Number(track.meta.duration);if(Number.isFinite(duration)&&duration>0)return duration;return (track.interval||'0').split(':').reduce((total,value)=>total*60+(Number(value)||0),0)}
export function sortTracks(tracks:Track[],field:string,direction='asc'):Track[]{
 if(!fields.includes(field)||!['asc','desc'].includes(direction))throw new Error('不支持的歌单排序方式')
 const result=[...tracks]
 if(field==='random'){for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
 return result.sort((a,b)=>{const comparison=field==='interval'?seconds(a)-seconds(b):String(field==='albumName'?a.meta.albumName:a[field as keyof Track]).localeCompare(String(field==='albumName'?b.meta.albumName:b[field as keyof Track]),'zh-CN',{numeric:true,sensitivity:'base'});return direction==='desc'?-comparison:comparison})
}
