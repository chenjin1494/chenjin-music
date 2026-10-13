import { normalizeTrack } from '../../../src/shared/compat'
import type { SourceId, Track } from '../../../src/shared/types'

export type OnlineLinkSource = Exclude<SourceId,'local'>
export type PlayerLinkAction = 'play'|'pause'|'skipNext'|'skipPrev'|'togglePlay'|'collect'|'uncollect'|'dislike'
export type DeepLinkAction =
 | {type:'player';action:PlayerLinkAction}
 | {type:'search';keyword:string;source:OnlineLinkSource|'all'|null}
 | {type:'music';action:'play';tracks:Track[]}
 | {type:'music';action:'searchPlay';name:string;singer:string;albumName:string;interval:string|null;playLater:boolean}
 | {type:'songlist';action:'open'|'play';source:OnlineLinkSource;link:string;/** LX protocol index is one-based. */index?:number}
const sources=['kw','kg','tx','wy','mg'] as const
const playerActions:PlayerLinkAction[]=['play','pause','skipNext','skipPrev','togglePlay','collect','uncollect','dislike']
const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function decode(value:string):string {try{return decodeURIComponent(value)}catch{throw new Error('链接包含无效URI编码')}}
function object(value:unknown):Record<string,any>{if(!record(value))throw new Error('链接data必须是JSON对象');return value}
function text(value:unknown,name:string,max:number,required=false,numeric=false):string {
 if(value==null){if(required)throw new Error(`${name}缺失`);return ''}
 if(typeof value!=='string'&&!(numeric&&typeof value==='number'&&Number.isFinite(value)))throw new Error(`${name}类型错误`)
 const result=String(value);if(result.length>max)throw new Error(`${name}过长`);if(required&&!result.trim())throw new Error(`${name}为空`);return result
}
function online(value:unknown):OnlineLinkSource {if(!sources.includes(value as OnlineLinkSource))throw new Error('链接歌曲来源不支持');return value as OnlineLinkSource}
function searchSource(value:unknown):OnlineLinkSource|'all'|null {return value==='all'?'all':sources.includes(value as OnlineLinkSource)?value as OnlineLinkSource:null}
function json(value:string):unknown {try{return JSON.parse(value, (key,item)=>{if(key==='__proto__')throw new Error('非法数据字段');return item})}catch{throw new Error('链接JSON数据无效')}}
function musicTrack(raw:unknown,legacy:boolean):Track {
 const item=object(raw),source=item.source
 if(source==='local'){if(legacy)throw new Error('LX链接不支持本地来源')}else online(source)
 text(item.name,'name',200,true);if(item.singer==null&&!record(item.meta))throw new Error('singer缺失');text(item.singer,'singer',200);text(item.interval,'interval',64)
 const modern=record(item.meta),meta=modern?item.meta:item
 text(modern?meta.songId:item.songmid??item.songId,'songmid',64,source!=='local',true)
 text(meta.albumName,'albumName',200);text(modern?meta.picUrl:item.img,'img',1024)
 text(meta.albumId,'albumId',64,false,true)
 if(modern&&meta.qualitys!=null&&!Array.isArray(meta.qualitys))throw new Error('qualitys必须是音质数组')
 if(source==='mg')for(const key of ['lrcUrl','trcUrl','mrcUrl'])text(meta[key],key,1024)
 if(!modern){
  if(source==='kg')text(item.hash,'hash',64,true)
  if(source==='tx')text(item.strMediaMid,'strMediaMid',64,true)
  if(source==='mg')text(item.copyrightId,'copyrightId',64,true,true)
  if(!Array.isArray(item.types))throw new Error('types必须是音质数组')
  const qualities=item.types.filter((q:unknown)=>record(q)&&['128k','320k','flac','flac24bit'].includes(q.type)).map((q:Record<string,any>)=>{
   if(q.size!=null&&typeof q.size!=='string')throw new Error('音质size类型错误')
   if(source==='kg'&&typeof q.hash!=='string')throw new Error('酷狗音质hash缺失')
   return {...q}
  })
  if(!qualities.length)throw new Error('链接没有可用音质')
  return normalizeTrack({...item,types:qualities})
 }
 // normalizeTrack shallow-copies meta. JSON input is fresh, so nested platform metadata is retained without mutating a caller's track.
 return normalizeTrack(item)
}
/** Pure parser: throws on unsupported/invalid links; never changes queues, playlists, settings or protocol association. */
export function parseDeepLink(input:string,allowLegacy=false):DeepLinkAction {
 if(typeof input!=='string'||Buffer.byteLength(input,'utf8')>=16000)throw new Error('链接过长或类型错误')
 const match=input.trim().match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/is);if(!match)throw new Error('链接格式无效')
 const scheme=match[1].toLowerCase(),legacy=scheme==='lxmusic';if(scheme!=='chenjinmusic'&&!legacy)throw new Error('未知链接协议');if(legacy&&!allowLegacy)throw new Error('旧LX链接关联未启用')
 const separator=match[2].indexOf('?'),route=separator<0?match[2]:match[2].slice(0,separator),query=separator<0?'':match[2].slice(separator+1)
 const segments=route.split('/').map(decode),type=segments.shift(),action=segments.shift(),paths=segments
 const params=new Map<string,string>()
 if(query)for(const part of query.split('&')){if(!part)continue;const equal=part.indexOf('='),key=decode(equal<0?part:part.slice(0,equal)),value=decode(equal<0?'':part.slice(equal+1));if(params.has(key))throw new Error(`链接参数${key}重复`);params.set(key,value)}
 const payload=params.has('data')?json(params.get('data')!):undefined
 if(type==='player'){
  if(!playerActions.includes(action as PlayerLinkAction)||paths.length)throw new Error('未知player动作或路径')
  return {type:'player',action:action as PlayerLinkAction}
 }
 if(type==='search'&&!legacy){
  if(action||paths.length)throw new Error('简单search链接不能包含动作路径')
  const keyword=text(params.get('keyword')??params.get('keywords'),'keyword',300,true).trim()
  return {type:'search',keyword,source:searchSource(params.get('source')??'all')}
 }
 if(type==='play'&&!legacy){
  if(action||paths.length)throw new Error('简单play链接不能包含动作路径')
  const serialized=params.get('track');let raw:unknown
  if(serialized)raw=json(serialized);else if(payload!=null)raw=payload;else {const source=params.get('source')??'wy',id=text(params.get('id')??params.get('songId'),'歌曲编号',64,true);raw={source,name:params.get('name')??'链接歌曲',singer:params.get('singer')??'',meta:{songId:id,albumName:params.get('album')??''}}}
  return {type:'music',action:'play',tracks:[musicTrack(raw,false)]}
 }
 if(type==='music'){
  if(action==='search'){
   if(paths.length>2)throw new Error('search路径过多')
   const data=payload==null?undefined:object(payload),keyword=data?text(data.keywords,'keywords',128,true,true):text(paths.length>1?paths[1]:paths[0],'keywords',16000,true).slice(0,128)
   return {type:'search',keyword,source:searchSource(data?data.source:paths.length>1?paths[0]:null)}
  }
  if(action==='play'){
   if(paths.length)throw new Error('music/play只支持JSON歌曲数据')
   const data=object(payload),songs=Array.isArray(data.songs)?data.songs:Array.isArray(data.tracks)?data.tracks:[data]
   if(!songs.length||songs.length>100)throw new Error('歌曲数量无效')
   return {type:'music',action:'play',tracks:songs.map(song=>musicTrack(song,legacy))}
  }
  if(action==='searchPlay'){
   if(paths.length>1)throw new Error('searchPlay路径过多')
   let data:Record<string,any>
   if(paths.length){const parts=paths[0].trim().split('-').map(p=>p.trim());data={name:parts[0],singer:parts[1]??''}}else data=object(payload)
   if(data.playLater!=null&&typeof data.playLater!=='boolean')throw new Error('playLater必须是boolean')
   return {type:'music',action:'searchPlay',name:text(data.name,'name',200,true),singer:text(data.singer,'singer',200),albumName:text(data.albumName,'albumName',200),interval:text(data.interval,'interval',64)||null,playLater:data.playLater===true}
  }
  throw new Error('未知music动作')
 }
 if(type==='songlist'){
  if(action!=='open'&&action!=='play')throw new Error('未知songlist动作')
  if(paths.length>(action==='play'?3:2))throw new Error('songlist路径过多')
  const data=payload==null?{source:paths[0],url:paths[1],index:paths[2]}:object(payload),source=online(data.source)
  const id=data.id!=null?text(data.id,'id',64,false,true):'',url=text(data.url,'url',500),link=id||url;if(!link)throw new Error('歌单id或url缺失')
  let index:number|undefined
  if(action==='play'&&data.index!=null){
   if(payload==null){const parsed=parseInt(String(data.index),10);if(Number.isFinite(parsed))index=Math.max(1,Math.min(1_000_000,parsed))}
   else {if(typeof data.index!=='number'||!Number.isFinite(data.index))throw new Error('index必须是有限数字');index=Math.max(1,Math.min(1_000_000,Math.trunc(data.index)))}
  }
  return {type:'songlist',action,source,link,...(index==null?{}:{index})}
 }
 throw new Error('未知链接类型')
}
