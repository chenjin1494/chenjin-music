import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Track, SourceId, Quality, SearchResult, OnlinePlaylist, Lyrics, Comment } from '../../../src/shared/types'
import { formatTime } from '../../../src/shared/defaults'
import { deduplicateTracks } from '../../../src/shared/compat'
import { fetchJSON, fetchText, fetchBytes, queryURL, decodeText } from './network'
import { decodeKrc, decodeQrc, decodeMrc, decodeKuwo, parseAbsoluteWordLyrics } from './lyric-codecs'

export const onlineSources: SourceId[]=['kw','kg','tx','wy','mg']
const online=onlineSources
const detailsCache=new Map<string,{expires:number;value:unknown}>(),inflight=new Map<string,Promise<unknown>>()
async function detailCached<T>(key:string,load:()=>Promise<T>,ttl=300000):Promise<T>{const entry=detailsCache.get(key);if(entry&&entry.expires>Date.now())return structuredClone(entry.value) as T;const existing=inflight.get(key);if(existing)return structuredClone(await existing) as T;const promise=load();inflight.set(key,promise);try{const value=await promise;if(detailsCache.size>=200)detailsCache.delete(detailsCache.keys().next().value!);detailsCache.set(key,{value:structuredClone(value),expires:Date.now()+ttl});return structuredClone(value)}finally{inflight.delete(key)}}
export function clearProviderCache(){detailsCache.clear()}
const checkedSource=(source:string)=>{if(!online.includes(source as SourceId))throw new Error('此平台不支持在线功能');return source as SourceId}
const paging=(page:unknown,limit:unknown)=>({page:Math.max(1,Math.floor(Number(page)||1)),limit:Math.min(100,Math.max(1,Math.floor(Number(limit)||30)))})
export function imageURL(value:unknown,base=''):string|null{const text=String(value??'').replace(/\{size\}/g,'400');if(!text)return null;try{const url=new URL(text,base||undefined);if(!['https:','http:'].includes(url.protocol))return null;return url.toString().replace('http://imge.kugou.com/','https://imgessl.kugou.com/')}catch{return null}}
export function contentLeaves(value:any,predicate:(item:any)=>boolean):any[]{const out:any[]=[],stack=Array.isArray(value)?[...value]:[value];let count=0;while(stack.length&&count++<50000){const item=stack.shift();if(!item||typeof item!=='object')continue;if(predicate(item))out.push(item);for(const key of ['contents','child','children','itemList','contentItemList'])if(Array.isArray(item[key]))stack.push(...item[key])}return out}
const requireRows=(rows:unknown,label:string):any[]=>{if(!Array.isArray(rows))throw new Error(`${label}返回了不支持的数据结构`);return rows}
const mb=(bytes: unknown)=>Number(bytes)>0?`${(Number(bytes)/1048576).toFixed(2)}M`:null
function track(source: SourceId, id: any, name: any, singer: any, album: any, seconds: any, extra: Record<string,any>={}): Track {
 const qualities=extra.qualitys || [{type:'128k',size:null}]
 return {id:`${source}_${id}`,name:decodeText(name),singer:decodeText(singer),source,interval:seconds?formatTime(Number(seconds)):null,meta:{songId:id,albumName:decodeText(album),...extra,qualitys:qualities,_qualitys:Object.fromEntries(qualities.map((q:any)=>[q.type,{size:q.size,...(q.hash?{hash:q.hash}:{})}]))}}
}
export function normalizePlatformTrack(source: SourceId, raw: any): Track {
 if(!raw||typeof raw!=='object')throw new Error('歌曲数据无效')
 if(source==='mg'&&typeof raw.songData==='string'){try{raw={...raw,...JSON.parse(raw.songData)}}catch{throw new Error('咪咕歌曲元数据无效')}}
 if(source==='kg')raw={...raw,FileSize:raw.FileSize??raw.filesize_128??raw.filesize,HQFileSize:raw.HQFileSize??raw.filesize_320??raw['320filesize'],SQFileSize:raw.SQFileSize??raw.filesize_flac??raw.sqfilesize,ResFileSize:raw.ResFileSize??raw.filesize_high,FileHash:raw.FileHash??raw.hash??raw.HASH,HQFileHash:raw.HQFileHash??raw.hash_320??raw['320hash'],SQFileHash:raw.SQFileHash??raw.hash_flac??raw.sqhash,ResFileHash:raw.ResFileHash??raw.hash_high,Duration:raw.timelength?Number(raw.timelength)/1000:raw.Duration??(Number(raw.duration)>10000?Number(raw.duration)/1000:raw.duration),OriSongName:raw.OriSongName??raw.audio_name??raw.song_name,Singers:raw.Singers??raw.authors?.map((a:any)=>({name:a.author_name,id:a.author_id})),imgurl:raw.imgurl??raw.AlbumSizableCover??raw.album_sizable_cover??raw.trans_param?.union_cover}
 if(source==='kw')raw={...raw,N_MINFO:raw.N_MINFO??raw.MINFO??raw.minfo,artist:raw.artist??raw.singer??raw.artists?.map((a:any)=>a.name).join('、'),pic:raw.pic??raw.albumPic}
 if(source==='kw') {
  const qualities: any[]=[]
  for(const item of String(raw.N_MINFO || '').split(';')){const match=item.match(/bitrate:(\d+),format:\w+,size:([\w.]+)/);if(match){const q=({128:'128k',320:'320k',2000:'flac',4000:'flac24bit'} as any)[match[1]];if(q)qualities.push({type:q,size:match[2]})}}
  return track(source,String(raw.MUSICRID || raw.musicrid || raw.id || raw.rid).replace('MUSIC_',''),raw.SONGNAME || raw.name,raw.ARTIST || raw.artist,raw.ALBUM || raw.album,raw.DURATION || raw.duration,{albumId:raw.ALBUMID || raw.albumid || raw.albumId,singerIds:raw.ARTISTID?[String(raw.ARTISTID)]:[],picUrl:imageURL(raw.pic || raw.pic120 || raw.albumpic),...(qualities.length?{qualitys:qualities}:{})})
 }
 if(source==='kg') {
  const qualities: any[]=[]
  for(const [type,sizeKey,hashKey] of [['128k','FileSize','FileHash'],['320k','HQFileSize','HQFileHash'],['flac','SQFileSize','SQFileHash'],['flac24bit','ResFileSize','ResFileHash']])if(Number(raw[sizeKey])>0)qualities.push({type,size:mb(raw[sizeKey]),hash:raw[hashKey]})
  const full=String(raw.filename || raw.FileName || '').split(' - ')
  return track(source,raw.Audioid || raw.audio_id || raw.hash || raw.FileHash,raw.OriSongName || raw.songname || full.slice(1).join(' - ') || raw.name,raw.Singers?.map((s:any)=>s.name).join('、') || raw.singername || full[0],raw.AlbumName || raw.album_name,raw.Duration || raw.duration,{hash:raw.FileHash || raw.hash,albumAudioId:raw.MixSongID || raw.album_audio_id,albumId:raw.AlbumID || raw.album_id,singerIds:raw.Singers?.map((s:any)=>String(s.id??s.author_id)),picUrl:imageURL(raw.imgurl),...(qualities.length?{qualitys:qualities}:{})})
 }
 if(source==='tx') {
  raw=raw.songInfo || raw.data || raw
  const file=raw.file || {};const qualities: any[]=[]
  for(const [type,key] of [['128k','size_128mp3'],['320k','size_320mp3'],['flac','size_flac'],['flac24bit','size_hires']])if(Number(file[key])>0)qualities.push({type,size:mb(file[key])})
  const mid=raw.mid || raw.songmid;const albumMid=raw.album?.mid || raw.albummid
  return track(source,mid,raw.title || raw.name || raw.songname,raw.singer?.map((s:any)=>s.name).join('、'),raw.album?.name || raw.albumname,raw.interval,{id:raw.id || raw.songid,strMediaMid:file.media_mid || raw.strMediaMid || mid,albumId:albumMid,albumMid,singerIds:raw.singer?.map((s:any)=>s.mid??String(s.id)),picUrl:albumMid?`https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`:null,...(qualities.length?{qualitys:qualities}:{})})
 }
 if(source==='wy') {
  raw=raw.baseInfo?.simpleSongData || raw
  const qualities: any[]=[]
  for(const [type,key] of [['128k','l'],['320k','h'],['flac','sq'],['flac24bit','hr']])if(raw[key])qualities.push({type,size:mb(raw[key].size)})
  return track(source,raw.id,raw.name,(raw.ar || raw.artists || []).map((s:any)=>s.name).join('、'),raw.al?.name || raw.album?.name,(raw.dt || raw.duration)/1000,{albumId:raw.al?.id || raw.album?.id,singerIds:(raw.ar||raw.artists||[]).map((s:any)=>String(s.id)),picUrl:imageURL(raw.al?.picUrl || raw.album?.picUrl),...(qualities.length?{qualitys:qualities}:{})})
 }
 const qualities=(raw.audioFormats || raw.newRateFormats || []).map((q:any)=>({type:({PQ:'128k',HQ:'320k',SQ:'flac',ZQ24:'flac24bit',ZQ:'flac24bit'} as any)[q.formatType],size:mb(q.asize || q.size || q.androidSize)})).filter((q:any)=>q.type)
 return track('mg',raw.copyrightId || raw.copyrightid || raw.songId,raw.name || raw.songName,(raw.singerList || raw.singers || []).map((s:any)=>s.name || s.singerName).join('、') || raw.singer,raw.album || raw.albumName,raw.duration,{id:raw.songId,contentId:raw.contentId,copyrightId:raw.copyrightId || raw.copyrightid,albumId:raw.albumId,singerIds:(raw.singerList||raw.singers||[]).map((s:any)=>String(s.id??s.singerId)),picUrl:imageURL(raw.img3 || raw.img2 || raw.img1 || raw.imgItems?.[0]?.img || raw.albumImgs?.[0]?.img || raw.img,'https://d.musicapp.migu.cn'),lrcUrl:raw.lrcUrl || raw.lyricUrl,mrcUrl:raw.mrcUrl || raw.mrcurl,trcUrl:raw.trcUrl,...(qualities.length?{qualitys:qualities}:{})})
}
function qqSign(text: string): string {
 const digest=createHash('sha1').update(text).digest('hex')
 const pick=(positions:number[])=>positions.map(n=>digest[n] || '').join('')
 const xor=[89,39,179,150,218,82,58,252,177,52,186,123,120,64,242,133,143,161,121,179].map((mask,i)=>mask^parseInt(digest.slice(i*2,i*2+2),16))
 return `zzc${pick([23,14,6,36,16,40,7,19])}${Buffer.from(xor).toString('base64').replace(/[\/+=]/g,'')}${pick([16,1,32,12,19,27,8,5])}`.toLowerCase()
}
async function qq(module: string, method: string, param: any, signed=false): Promise<any> {
 const payload={comm:{ct:19,cv:2151,uin:'0',tmeAppID:'qqmusic'},req:{module,method,param}}
 const body=JSON.stringify(payload)
 const data=await fetchJSON(`https://u.y.qq.com/cgi-bin/${signed?'musics':'musicu'}.fcg${signed?'?sign='+qqSign(body):''}`,{method:'POST',headers:{'content-type':'application/json','referer':'https://y.qq.com/','user-agent':'QQMusic 14090508(android 12)'},body})
 if(data.code!==0 || data.req?.code!==0)throw new Error(`QQ 音乐接口暂时不可用（code=${data.code}, req=${data.req?.code??'missing'}）`)
 return data.req.data
}
async function netease(endpoint: string, data: any, token?: string): Promise<any> {
 const text=JSON.stringify(data);const digest=createHash('md5').update(`nobody${endpoint}use${text}md5forencrypt`).digest('hex')
 const cipher=createCipheriv('aes-128-ecb',Buffer.from('e82ckenh8dichen8'),null)
 const encrypted=Buffer.concat([cipher.update(`${endpoint}-36cd479b6b5-${text}-36cd479b6b5-${digest}`),cipher.final()]).toString('hex').toUpperCase()
 const response=await fetchJSON(`https://interface3.music.163.com${endpoint.replace(/^\/api\//,'/eapi/')}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://music.163.com',...(token?{cookie:`MUSIC_U=${token}`}:{})},body:new URLSearchParams({params:encrypted}).toString()})
 if(response.code && response.code!==200)throw new Error(`网易云音乐接口返回 ${response.code}`)
 return response
}
function miguHeaders(keyword: string): Record<string,string> {
 const timestamp=String(Date.now());const deviceId='963B7AA0D21511ED807EE5846EC87D20'
 const sign=createHash('md5').update(`${keyword}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${timestamp}`).digest('hex')
 return {timestamp,deviceId,sign,uiVersion:'A_music_3.6.1',channel:'0146921'}
}
export async function search(source: string, keyword: string, page=1, limit=30): Promise<SearchResult> {
 keyword=String(keyword || '').trim().slice(0,300);({page,limit}=paging(page,limit))
 if(!keyword)return {list:[],total:0,page,limit,source}
 if(source==='all') {
  const results=await Promise.allSettled(online.map(id=>search(id,keyword,page,limit)))
  const valid=results.filter((r):r is PromiseFulfilledResult<SearchResult>=>r.status==='fulfilled').map(r=>r.value)
  if(!valid.length)throw new Error('所有平台搜索失败，请检查网络或代理设置')
  const list=deduplicateTracks(valid.flatMap(r=>r.list));const term=keyword.toLocaleLowerCase()
  list.sort((a,b)=>(b.name.toLocaleLowerCase().includes(term)?1:0)-(a.name.toLocaleLowerCase().includes(term)?1:0))
  return {list,total:valid.reduce((sum,r)=>sum+r.total,0),page,limit,source,failures:results.flatMap((r,i)=>r.status==='rejected'?[{source:online[i],error:r.reason instanceof Error?r.reason.message:String(r.reason)}]:[])} as SearchResult
 }
 let data:any;let rows:any[]=[];let total=0
 if(source==='kw') {
  data=await fetchJSON(queryURL('https://search.kuwo.cn/r.s',{client:'kt',all:keyword,pn:page-1,rn:limit,uid:0,ver:'kwplayer_ar_9.2.2.1',vipver:1,show_copyright_off:1,newver:1,ft:'music',cluster:0,strategy:2012,encoding:'utf8',rformat:'json',vermerge:1,mobi:1,issubtitle:1}))
  if(!Array.isArray(data.abslist)&&Number(data.TOTAL)!==0)throw new Error('酷我搜索接口暂时不可用');rows=data.abslist || [];total=Number(data.TOTAL)||0
 } else if(source==='kg') {
  data=await fetchJSON(queryURL('https://songsearch.kugou.com/song_search_v2',{platform:'AndroidFilter',iscorrection:1,keyword,hifiquality:0,pagesize:limit,PrivilegeFilter:0,page}))
  if(data.error_code!==0)throw new Error('酷狗搜索接口暂时不可用');rows=requireRows(data.data?.lists,'酷狗搜索');total=data.data?.total||0
 } else if(source==='tx') {
  data=await qq('music.search.SearchCgiService','DoSearchForQQMusicDesktop',{grp:1,num_per_page:limit,page_num:page,query:keyword,remoteplace:'txt.newclient.top',search_type:0,searchid:randomBytes(16).toString('hex').toUpperCase()+'00001'},true)
  rows=data.body?.song?.list || [];total=data.meta?.sum||0
 } else if(source==='wy') {
  data=await netease('/api/search/song/list/page',{keyword,needCorrect:'1',channel:'typing',offset:limit*(page-1),scene:'normal',total:page===1,limit})
  rows=data.data?.resources || data.result?.songs || [];total=data.data?.totalCount || data.result?.songCount || 0
 } else if(source==='mg') {
  data=await fetchJSON(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll',{isCorrect:0,isCopyright:1,searchSwitch:JSON.stringify({song:1,album:0,singer:0,tagSong:1,mvSong:0,bestShow:1,songlist:0,lyricSong:0}),pageSize:limit,text:keyword,pageNo:page,sort:0,sid:'USS'}),{headers:miguHeaders(keyword)})
  if(data.code!=='000000')throw new Error(data.info || '咪咕搜索接口暂时不可用');rows=requireRows(data.songResultData?.resultList,'咪咕搜索').flat();total=Number(data.songResultData?.totalCount)||0
 } else throw new Error('不支持的搜索平台')
 return {list:deduplicateTracks(rows.map(r=>normalizePlatformTrack(source as SourceId,r))).filter(t=>t.name&&t.meta.songId!=null&&String(t.meta.songId)!=='undefined').slice(0,limit),total,page,limit,source}
}
export const playlistInfo=(source:SourceId,raw:any):OnlinePlaylist=>({id:source==='kg'&&/^\d+$/.test(String(raw.id??raw.specialid))?'id_'+String(raw.id??raw.specialid):String(raw.id??raw.tid??raw.dissid??raw.specialid??raw.playlistId??raw.musicListId??raw.resId??raw.logEvent?.contentId),source,name:decodeText(raw.name??raw.title??raw.dissname??raw.specialname??raw.musicListName??raw.txt),cover:imageURL(raw.coverImgUrl??raw.cover??raw.img??raw.pic??raw.imgurl??raw.picUrl??raw.image??raw.imgItem?.img??raw.imgItems?.[0]?.img??raw.imageUrl,'https://d.musicapp.migu.cn')??'',author:decodeText(raw.creator?.nickname??raw.creator?.name??raw.author??raw.nickname??raw.uname??raw.ownerName??raw.userName??''),description:decodeText(raw.description??raw.desc??raw.intro??raw.info??raw.summary??raw.txt2??raw.introduction??''),playCount:Number(raw.playCount??raw.playcount??raw.listencnt??raw.listen_num??raw.listennum??raw.playnum??raw.opNumItem?.playNum)||0})
export async function getPlaylists(source: SourceId='wy',page=1,tag='',sort='hot'): Promise<OnlinePlaylist[]> {
 checkedSource(source);page=paging(page,24).page
 let rows:any[]=[]
 if(source==='wy'){const d=await netease('/api/playlist/list',{cat:tag||'全部',order:sort==='new'?'new':'hot',offset:(page-1)*24,limit:24,total:true});rows=d.playlists || d.data?.playlists || []}
 else if(source==='kw'){const [tagId,kind]=tag.split('-');if(kind&&kind!=='10000')throw new Error('此酷我标签类型暂不支持');const d=await fetchJSON(queryURL(`https://wapi.kuwo.cn/api/pc/classify/playlist/${tagId?'getTagPlayList':'getRcmPlayList'}`,{loginUid:0,loginSid:0,appUid:76039576,pn:page,rn:24,order:sort==='new'?'new':'hot',...(tagId?{id:tagId}: {})}));if(d.code!==200)throw new Error('酷我歌单接口暂不可用');rows=requireRows(d.data?.data,'酷我歌单')}
 else if(source==='kg'){const order=({'recommended':'5','recommend':'5','hot':'6','new':'7','collect':'3','hotCollect':'3','rising':'8'} as Record<string,string>)[sort]||(['5','6','7','3','8'].includes(sort)?sort:'5');const d=await fetchJSON(queryURL('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial',{is_ajax:1,cdn:'cdn',t:order,c:tag,p:page}));if(d.status!==1)throw new Error('酷狗分类歌单接口暂不可用');rows=requireRows(d.special_db,'酷狗分类歌单')}
 else if(source==='tx'){const d=await fetchJSON(queryURL('https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg',{picmid:1,g_tk:5381,loginUin:0,hostUin:0,format:'json',inCharset:'utf8',outCharset:'utf-8',notice:0,platform:'yqq.json',needNewCode:0,categoryId:Number(tag)||10000000,sortId:sort==='new'?2:5,sin:(page-1)*24,ein:page*24-1}),{headers:{referer:'https://y.qq.com/'}});if(d.code!==0)throw new Error(`QQ歌单接口返回 ${d.code}`);rows=requireRows(d.data?.list,'QQ歌单')}
 else {const url=tag?queryURL('https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-listbytag/release',{pageNumber:page,templateVersion:2,tagId:tag}):queryURL('https://app.c.nf.migu.cn/pc/bmw/page-data/playlist-square-recommend/v1.0',{templateVersion:2,pageNo:1});const d=await fetchJSON(url);if(d.code!=='000000')throw new Error(`咪咕歌单接口返回 ${d.code}`);rows=contentLeaves(d.data,item=>String(item.resType)==='2021'||(!item.contents&&item.logEvent?.contentId&&item.title&&item.imageUrl))}
 const list=[...new Map(rows.map(r=>{const info=playlistInfo(source,r);return [info.id,info] as const})).values()].filter(r=>r.id!=='undefined'&&r.name);if(page===1&&!list.length)throw new Error('平台未返回可用歌单，此发现接口暂不可用');return source==='mg'&&!tag?list.slice((page-1)*30,page*30):list
}
export function extractEmbeddedSongs(html:string):any[]{const match=/(?:var\s+data|global\.features)\s*=\s*\[/.exec(html);if(!match)throw new Error('酷狗公开页面未提供歌曲数据，歌单可能不可用');const start=match.index+match[0].length-1;let depth=0,quoted=false,escaped=false;for(let i=start;i<html.length;i++){const char=html[i];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}if(char==='"')quoted=true;else if(char==='[')depth++;else if(char===']'&&--depth===0){try{return requireRows(JSON.parse(html.slice(start,i+1)),'酷狗歌曲')}catch(error){throw new Error(`酷狗页面歌曲数据格式已变化：${error instanceof Error?error.message:String(error)}`)}}}throw new Error('酷狗页面歌曲数据不完整')}
function parsePlaylistId(input:string):{id:string;token?:string} {
 const [link,token]=String(input).split('###')
 if(/^id_\d+$/.test(link))return {id:link.slice(3),token}
 if(/^\d+$/.test(link))return {id:link,token}
 try {const url=new URL(link);const id=url.searchParams.get('id') || new URLSearchParams(url.hash.replace(/^#\/?(?:playlist\?)?/,'')).get('id') || url.searchParams.get('playlistId') || url.pathname.match(/\d+/g)?.at(-1);if(id)return {id,token}}catch{}
 const id=link.match(/(?:__|\/)(\d+)(?:\.html)?/)?.[1]
 if(id)return {id,token}
 throw new Error('请输入正确的歌单链接或编号')
}
export async function getPlaylist(source:SourceId,input:string):Promise<{info:OnlinePlaylist;tracks:Track[]}>{checkedSource(source);return detailCached(`playlist:${source}:${input}`,()=>loadPlaylist(source,input))}
async function loadPlaylist(source: SourceId,input:string): Promise<{info:OnlinePlaylist;tracks:Track[]}> {
 if(source==='kg'&&!/^id_\d+$/.test(input)&&!/^https?:\/\/[^/]+\/(?:yy\/)?special\/single\//.test(input)&&!/^https?:\/\/m\.kugou\.com\/plist\/list\//.test(input))return loadKugouShare(input)
 if(source==='wy'&&/^https?:/.test(input.split('###')[0])){const [address,token]=input.split('###');const parsed=new URL(address);if(!parsed.searchParams.get('id')&&!parsed.hash.includes('id=')&&!/\/playlist\/\d+/.test(parsed.pathname)){const response=await fetchBytes(address,{},2_000_000);const final=new URL(response.url);if(!/(^|\.)(163\.com|netease\.com)$/.test(final.hostname))throw new Error('网易短链跳转到了未知平台');input=final.toString()+(token?'###'+token:'')}}
 const {id,token}=parsePlaylistId(input);let raw:any;let rows:any[]=[]
 if(source==='wy'){const d=await netease('/api/v6/playlist/detail',{id,n:100000,s:8},token);raw=d.playlist || d.result;if(!raw)throw new Error('歌单不存在或需要登录令牌');rows=raw.tracks || []
  if(raw.trackIds?.length>rows.length){const ids=raw.trackIds.map((r:any)=>r.id);rows=[];for(let i=0;i<ids.length;i+=500){const batch=await netease('/api/v3/song/detail',{c:JSON.stringify(ids.slice(i,i+500).map((id:any)=>({id}))),ids:JSON.stringify(ids.slice(i,i+500))},token);rows.push(...requireRows(batch.songs,'网易歌曲详情'))}if(rows.length<ids.length)throw new Error('网易未公开此歌单的全部歌曲，请检查歌单权限或令牌')}
 } else if(source==='kw'){const d=await fetchJSON(queryURL('https://nplserver.kuwo.cn/pl.svc',{op:'getlistinfo',pid:id,pn:0,rn:1000,encode:'utf8',keyset:'pl2012',identity:'kuwo',pcmp4:1,newver:1,vipver:'MUSIC_9.0.5.0_W1'}));if(d.result!=='ok')throw new Error('酷我歌单详情接口暂不可用');raw={...d,id};rows=requireRows(d.musiclist,'酷我歌单');const total=Number(d.total)||rows.length;let currentPage=1;while(rows.length<total&&currentPage<10){const more=await fetchJSON(queryURL('https://nplserver.kuwo.cn/pl.svc',{op:'getlistinfo',pid:id,pn:currentPage++,rn:1000,encode:'utf8',keyset:'pl2012',identity:'kuwo',pcmp4:1,newver:1,vipver:'MUSIC_9.0.5.0_W1'}));const batch=requireRows(more.musiclist,'酷我歌单');if(!batch.length)break;rows.push(...batch)}if(rows.length<total)throw new Error('酷我未公开此歌单的全部歌曲，请检查权限或稍后重试')}
 else if(source==='kg'){const text=await fetchText(`https://m.kugou.com/plist/list/${id}?json=true`);if(text.trim().startsWith('{')){const d=JSON.parse(text);raw=d.info?.list??{id}}else{const title=text.match(/<title>([^<]*)<\/title>/i)?.[1]?.replace(/_精选集.*$/,'')??'';raw={id,name:title,description:text.match(/name="description"\s+content="([^"]*)"/i)?.[1]??''}}let currentPage=1,total=Infinity;while(rows.length<total&&currentPage<=100){const d=await fetchJSON(queryURL('https://mobiles.kugou.com/api/v3/special/song',{specialid:id,page:currentPage,pagesize:100,version:9108,plat:0}));if(d.errcode!==0)throw new Error(`酷狗歌单接口返回 ${d.errcode}`);const batch=requireRows(d.data?.info,'酷狗歌单歌曲');total=Number(d.data.total)||0;if(!batch.length&&rows.length<total)throw new Error('酷狗未返回此歌单的全部歌曲');rows.push(...batch);currentPage++}if(rows.length<total)throw new Error('酷狗歌单超过当前支持的10000首限制')}
 else if(source==='tx'){const d=await fetchJSON(queryURL('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg',{type:1,json:1,utf8:1,onlysong:0,new_format:1,disstid:id,loginUin:0,hostUin:0,format:'json',inCharset:'utf8',outCharset:'utf-8',notice:0,platform:'yqq.json',needNewCode:0}),{headers:{referer:'https://y.qq.com/'}}).catch(()=>({}));raw=d.cdlist?.[0];rows=raw?.songlist??[];if(raw){const total=Number(raw.songnum??raw.total_song_num)||rows.length;for(let begin=rows.length;begin<total&&begin<10000;begin+=1000){const more=await qq('music.srfDissInfo.aiDissInfo','uniform_get_Dissinfo',{disstid:Number(id),userinfo:0,tag:0,orderlist:1,song_begin:begin,song_num:1000,onlysonglist:1,enc_host_uin:''});const batch=requireRows(more.songlist,'QQ歌单详情');if(!batch.length)break;rows.push(...batch)}if(rows.length<total)throw new Error('QQ未公开此歌单的全部歌曲')}if(!raw){const result=await qq('music.srfDissInfo.aiDissInfo','uniform_get_Dissinfo',{disstid:Number(id),userinfo:1,tag:1,orderlist:1,song_begin:0,song_num:1000,onlysonglist:0,enc_host_uin:''});raw={id,name:result.dirinfo?.title,pic:result.dirinfo?.picurl,description:result.dirinfo?.desc,author:result.dirinfo?.host_nick};rows=requireRows(result.songlist,'QQ歌单详情');const total=Number(result.total_song_num)||rows.length;for(let begin=rows.length;begin<total&&begin<10000;begin+=1000){const more=await qq('music.srfDissInfo.aiDissInfo','uniform_get_Dissinfo',{disstid:Number(id),userinfo:0,tag:0,orderlist:1,song_begin:begin,song_num:1000,onlysonglist:1,enc_host_uin:''});const batch=requireRows(more.songlist,'QQ歌单详情');if(!batch.length)break;rows.push(...batch)}if(rows.length<total)throw new Error('QQ未公开此歌单的全部歌曲')}}
 else {const details=await fetchJSON(queryURL('https://c.musicapp.migu.cn/MIGUM3.0/resource/playlist/v2.0',{playlistId:id}));if(details.code!=='000000')throw new Error(`咪咕歌单详情返回 ${details.code}`);raw=details.data;let currentPage=1,total=Infinity;while(rows.length<total&&currentPage<=200){const songs=await fetchJSON(queryURL('https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0',{pageNo:currentPage,pageSize:50,playlistId:id}));if(songs.code!=='000000')throw new Error(`咪咕歌单歌曲返回 ${songs.code}`);const batch=requireRows(songs.data?.songList,'咪咕歌单');total=Number(songs.data.totalCount)||batch.length;rows.push(...batch);if(!batch.length)break;currentPage++}if(rows.length<total)throw new Error('咪咕歌单未返回全部歌曲，请稍后重试')}
 if(!raw)throw new Error('无法读取歌单，请检查链接和平台权限')
 return {info:playlistInfo(source,{...raw,id}),tracks:deduplicateTracks(rows.map(r=>normalizePlatformTrack(source,r)))}
}
export async function getBoards(source:SourceId):Promise<{id:string;name:string}[]> {
 if(source==='wy'){const d=await netease('/api/toplist',{});return (d.list||[]).map((r:any)=>({id:String(r.id),name:r.name}))}
 if(source==='kg'){const d=await fetchJSON('https://m.kugou.com/rank/list?json=true');return contentLeaves(requireRows(d.rank?.list,'酷狗榜单'),r=>r.rankid&&r.rankname).map(r=>({id:String(r.rankid),name:decodeText(r.rankname)}))}
 if(source==='tx'){const d=await fetchJSON('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?format=json&platform=h5');return (d.data?.topList||[]).map((r:any)=>({id:String(r.id),name:r.topTitle}))}
 if(source==='kw'){const d=await fetchJSON('https://wapi.kuwo.cn/api/pc/bang/list');const list=contentLeaves(d,r=>r.sourceid&&(!r.child||!r.child.length)).map(r=>({id:String(r.sourceid),name:decodeText(r.name)}));if(!list.length)throw new Error('酷我榜单接口未返回榜单');return list}
 checkedSource(source);const d=await fetchJSON('https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0');if(d.code!=='000000')throw new Error(`咪咕榜单接口返回 ${d.code}`);const rows=contentLeaves(d.data,r=>r.rankId&&r.rankName);if(!rows.length)throw new Error('咪咕榜单接口未返回榜单');return [...new Map(rows.map(r=>[String(r.rankId),{id:String(r.rankId),name:decodeText(r.rankName)}])).values()]
}
export async function getBoardTracks(source:SourceId,id:string,page=1):Promise<SearchResult> {
 if(source==='wy'){const result=await getPlaylist(source,id);return {list:result.tracks.slice((page-1)*100,page*100),total:result.tracks.length,page,limit:100,source}}
 if(source==='kg'){const text=await fetchText(queryURL('https://m.kugou.com/rank/info/',{rankid:id,page,json:true}));if(text.trim().startsWith('{')){const d=JSON.parse(text);const rows=requireRows(d.songs?.list??d.data?.info,'酷狗榜单歌曲');return {list:rows.map(r=>normalizePlatformTrack(source,r)),total:Number(d.songs?.total??d.data?.total)||rows.length,page,limit:30,source}}const rows=extractEmbeddedSongs(text);return {list:rows.map(r=>normalizePlatformTrack(source,r)),total:Number(text.match(/total:\s*['"](\d+)/)?.[1])||rows.length,page,limit:30,source}}
 if(source==='tx'){const d=await qq('musicToplist.ToplistInfoServer','GetDetail',{topid:Number(id),offset:(page-1)*100,num:100,period:''});const list=(d.songInfoList || []).map((r:any)=>normalizePlatformTrack(source,r));return {list,total:d.data?.totalNum || list.length,page,limit:100,source}}
 if(source==='kw'){const d=await fetchJSON(queryURL('https://kbangserver.kuwo.cn/ksong.s',{from:'pc',fmt:'json',pn:page-1,rn:100,type:'bang',data:'content',id,show_copyright_off:0,pcmp4:1,isbang:1}));const list=(d.musiclist || []).map((r:any)=>normalizePlatformTrack(source,r));return {list,total:Number(d.num)||list.length,page,limit:100,source}}
 const d=await fetchJSON(queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querycontentbyId.do',{columnId:id,needAll:0}));if(d.code!=='000000')throw new Error(`咪咕榜单歌曲返回 ${d.code}`);const rows=d.contentList??d.data?.contentList??d.columnInfo?.contents?.map((item:any)=>item.objectInfo);if(!Array.isArray(rows))throw new Error('咪咕此榜单歌曲接口暂不可用');const list=rows.map((r:any)=>normalizePlatformTrack(source,r));return {list:list.slice((page-1)*100,page*100),total:list.length,page,limit:100,source}
}
export async function getLyrics(song:Track):Promise<Lyrics> {
 const id=song.meta.songId
 if(song.source==='local') {if(!song.meta.filePath)return {lyric:''};try{return {lyric:await readFile(song.meta.filePath.replace(/\.[^.]+$/,'.lrc'),'utf8')}}catch{return {lyric:''}}}
 if(song.source==='wy'){const d=await netease('/api/song/lyric/v1',{id,lv:-1,tv:-1,rv:-1,yv:-1});return {lyric:d.lrc?.lyric || '',tlyric:d.tlyric?.lyric,rlyric:d.romalrc?.lyric,lxlyric:d.yrc?.lyric}}
 if(song.source==='kw'){
  try{const response=await fetchBytes(queryURL('https://mlyric.kuwo.cn/mobi.s',{f:'web',type:'lyric',lrcx:1,rid:id,encode:'utf8'}),{},4_000_000);const result=decodeKuwo(response.bytes);if(result.lyric)return result}catch(error){console.warn('酷我逐字歌词暂不可用',String(error))}
  const d=await fetchJSON(queryURL('https://m.kuwo.cn/newh5/singles/songinfoandlrc',{musicId:id}));if(!d.data&&d.status!==200)throw new Error(`酷我歌词接口返回 ${d.status??d.code}`);return {lyric:requireRows(d.data?.lrclist,'酷我歌词').map((r:any)=>{const centiseconds=Math.round(Number(r.time)*100);return `[${formatTime(Math.floor(centiseconds/100))}.${String(centiseconds%100).padStart(2,'0')}]${r.lineLyric??''}`}).join('\n')}
 }
 if(song.source==='tx'){
  const detail=song.meta.id?song:await getTrackDetails(song),songID=Number(detail.meta.id);if(!songID)throw new Error('QQ歌词缺少songID')
  const d=await qq('music.musichallSong.PlayLyricInfo','GetPlayLyricInfo',{songID,crypt:1,qrc:1,qrc_t:0,roma:1,roma_t:0,trans:1,trans_t:0,lrc_t:0,interval:0,type:-1,ct:19,cv:1873,format:'json'})
  return {...parseAbsoluteWordLyrics(decodeQrc(d.lyric||'')),tlyric:d.trans?parseAbsoluteWordLyrics(decodeQrc(d.trans)).lyric:null,rlyric:d.roma?parseAbsoluteWordLyrics(decodeQrc(d.roma)).lyric:null}
 }
 if(song.source==='kg'){const d=await fetchJSON(queryURL('https://lyrics.kugou.com/search',{ver:1,man:'yes',client:'pc',keyword:`${song.name} ${song.singer}`,hash:song.meta.hash,timelength:0,lrctxt:1}));const candidate=d.candidates?.[0];if(!candidate)return {lyric:''};const fmt=Number(candidate.krctype)===1&&Number(candidate.contenttype)!==1?'krc':'lrc';const result=await fetchJSON(queryURL('https://lyrics.kugou.com/download',{ver:1,client:'pc',id:candidate.id,accesskey:candidate.accesskey,fmt,charset:'utf8'}));return fmt==='krc'?decodeKrc(result.content):{lyric:result.content?Buffer.from(result.content,'base64').toString():''}}
 if(song.source==='mg'){
  let meta=song.meta
  if(!meta.mrcUrl){const d=await fetchJSON('https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=2',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({resourceId:String(meta.id||id)}).toString()}).catch(()=>({}));meta={...meta,...d.resource?.[0]}}
  const headers={referer:'https://app.c.nf.migu.cn/',channel:'0146921'};let result:Lyrics={lyric:''}
  if(typeof meta.mrcUrl==='string'&&meta.mrcUrl)try{result=decodeMrc(await fetchText(meta.mrcUrl,{headers},4_000_000))}catch(error){if(!meta.lrcUrl)throw error}
  if(!result.lyric&&typeof meta.lrcUrl==='string')result={lyric:await fetchText(meta.lrcUrl,{headers},4_000_000)}
  if(typeof meta.trcUrl==='string'&&meta.trcUrl)result.tlyric=await fetchText(meta.trcUrl,{headers},4_000_000)
  return result
 }
 return {lyric:''}
}
export interface ProviderComment extends Comment { images?:string[]; reply?:ProviderComment[]; rootId?:string; replyCount?:number; location?:string }
export type CommentKind='normal'|'hot'|'reply'
export function normalizeComment(source:SourceId,raw:any,depth=0):ProviderComment {
 const user=raw.user??{},seconds=raw.time??raw.PubTime,instant=seconds!=null?Number(seconds):NaN
 const imageValues=raw.images??(raw.mpic?[raw.mpic]:raw.Pic?[raw.Pic]:[])
 const item:ProviderComment={id:String(raw.commentId??raw.commentid??raw.id??raw.CmId??raw.replyId??raw.subcommentid??''),author:decodeText(user.nickName??user.nickname??raw.Nick??raw.u_name??raw.user_name??raw.rootcommentnick??raw.replynick??raw.nick??''),avatar:imageURL(user.avatarUrl??user.middleIcon??user.bigIcon??raw.Avatar??raw.u_pic??raw.user_pic??raw.avatarurl)??undefined,text:decodeText(raw.content??raw.Content??raw.msg??raw.commentInfo??raw.replyInfo??raw.rootcommentcontent??raw.subcommentcontent??'').replace(/\\n/g,'\n'),time:String(raw.commentTime??raw.replyTime??raw.addtime??(Number.isFinite(instant)?new Date(instant<100000000000?instant*1000:instant).toLocaleString('zh-CN'):'')),likes:Number(raw.likedCount??raw.PraiseNum??raw.like_num??raw.like?.likenum??raw.praisenum??raw.opNumItem?.thumbNum)||0,images:Array.isArray(imageValues)?imageValues.map(value=>imageURL(typeof value==='string'?value:value.url)).filter((url):url is string=>!!url):[],rootId:raw.rootcommentid??raw.SeqNo,location:raw.location??raw.Location??raw.ipLocation?.location,replyCount:Number(raw.reply_num??raw.replyTotalCount??raw.replyCount)||0,reply:[]}
 if(depth<4){const replies=raw.replyComments??raw.SubComments??raw.middlecommentcontent??raw.child_comments??[];if(Array.isArray(replies))item.reply=replies.slice(0,100).map(reply=>normalizeComment(source,reply,depth+1))}
 const quoted=raw.beReplied?.[0]
 if(quoted&&depth<4)return {...normalizeComment(source,{...quoted,commentId:quoted.beRepliedCommentId},depth+1),id:item.id,rootId:String(quoted.beRepliedCommentId),reply:[item]}
 if(raw.pcontent&&depth<4)return {...item,text:decodeText(raw.pcontent),author:decodeText(raw.puser),avatar:undefined,reply:[item]}
 return item
}
export async function getComments(song:Track,page=1,kind:CommentKind='normal',rootId?:string):Promise<ProviderComment[]> {
 page=paging(page,20).page;if(!['normal','hot','reply'].includes(kind))throw new Error('无效评论类别')
 if(kind==='reply'&&!rootId)throw new Error('回复评论缺少根评论编号')
 let rows:any[]=[]
 if(song.source==='wy'){
  if(kind==='reply')throw new Error('网易云此评论接口只支持附带引用回复')
  const rid=`R_SO_4_${song.meta.songId}`,d=await netease(kind==='hot'?`/api/v1/resource/hotcomments/${rid}`:`/api/v1/resource/comments/${rid}`,{rid,offset:(page-1)*20,limit:20,total:true,beforeTime:Date.now().toString()});rows=d.hotComments??d.comments??[]
 }else if(song.source==='tx'){
  if(kind==='reply')throw new Error('QQ此评论接口只支持附带回复')
  const detail=song.meta.id?song:await getTrackDetails(song),id=detail.meta.id
  if(kind==='hot'){const d=await qq('music.globalComment.CommentRead','GetHotCommentList',{BizType:1,BizId:String(id),LastCommentSeqNo:'',PageSize:20,PageNum:page-1,HotType:1,WithAirborne:0,PicEnable:1});rows=d.CommentList?.Comments??[]}
  else{const d=await fetchJSON(queryURL('https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg',{biztype:1,topid:id,cmd:8,pagenum:page-1,pagesize:20,format:'json'}));if(d.code!==0)throw new Error(`QQ评论返回 ${d.code}`);rows=d.comment?.commentlist??[]}
 }else if(song.source==='kw'){
  if(kind==='reply')throw new Error('酷我此评论接口只支持附带回复')
  const d=await fetchJSON(queryURL('https://ncomment.kuwo.cn/com.s',{type:kind==='hot'?'get_rec_comment':'get_comment',f:'web',aapiver:1,prod:'kwplayer_ar_10.5.2.0',digest:15,sid:song.meta.songId,start:(page-1)*20,msgflag:1,count:20,newver:3,uid:0}),{headers:{'user-agent':'Dalvik/2.1.0 (Linux; U; Android 9;)'}});if(String(d.code)!=='200')throw new Error(`酷我评论返回 ${d.code}`);rows=kind==='hot'?d.hot_comments??[]:d.comments??[]
 }else if(song.source==='kg'){
  if(!song.meta.hash)throw new Error('酷狗歌曲缺少评论hash')
  if(kind==='reply'){const d=await fetchJSON(queryURL('http://comment.service.kugou.com/index.php',{r:'commentsv2/getReplyWithLike',code:'fc4be23b4e972707f36b8a828a93ba8a',p:page,pagesize:20,ver:'1.01',clientver:8373,kugouid:687373022,need_show_image:1,appid:1001,childrenid:song.meta.songId,tid:rootId}),{headers:{'user-agent':'Android712-AndroidPhone-8983-18-0-COMMENT-wifi'}});if(d.err_code!==0)throw new Error(`酷狗回复返回 ${d.err_code}`);rows=d.list??[]}
  else{const params={dfid:'0',mid:'16249512204336365674023395779019',clienttime:Date.now(),uuid:'0',extdata:song.meta.hash,appid:1005,code:'fc4be23b4e972707f36b8a828a93ba8a',schash:song.meta.hash,clientver:11409,p:page,clienttoken:'',pagesize:20,ver:10,kugouid:0};const d=await fetchJSON(signedKugouURL(`http://m.comment.service.kugou.com/r/v1/rank/${kind==='hot'?'topliked':'newest'}`,params));if(d.err_code!==0)throw new Error(`酷狗评论返回 ${d.err_code}`);rows=d.list??[]}
 }else if(song.source==='mg'){
  const id=song.meta.id;if(!id)throw new Error('咪咕歌曲缺少评论songId');const cacheKey=`mg-comment:${id}:${page}`;let cursor=''
  if(kind==='normal'&&page>1){const entry=detailsCache.get(cacheKey);if(!entry||entry.expires<Date.now())throw new Error('咪咕最新评论需按页顺序读取');cursor=String(entry.value)}
  const d=await fetchJSON(queryURL(`https://app.c.nf.migu.cn/MIGUM3.0/user/comment/stack/${kind==='reply'?encodeURIComponent(rootId!)+'/':''}v1.0`,{pageSize:20,queryType:kind==='normal'?1:2,resourceId:id,resourceType:2,...(kind==='normal'?{commentId:cursor}:kind==='hot'?{hotCommentStart:(page-1)*20}:{start:(page-1)*20})}));if(d.code!=='000000')throw new Error(`咪咕评论返回 ${d.code}`);rows=kind==='hot'?d.data?.hotComments??[]:kind==='reply'?d.data?.mainCommentItem?.replyComments??[]:d.data?.comments??[]
  if(kind==='normal'&&rows.length)detailsCache.set(`mg-comment:${id}:${page+1}`,{value:rows.at(-1).commentId,expires:Date.now()+300000})
 }
 return requireRows(rows,'评论').map(row=>normalizeComment(song.source,row))
}
export function signedKugouURL(base:string,params:Record<string,unknown>,web=false,body=''):string {const key=web?'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt':'OIlwieks28dk2k092lksi2UIkp';const pairs=Object.entries(params).filter(([,v])=>v!=null).map(([k,v])=>`${k}=${v}`).sort().join('');return queryURL(base,{...params,signature:createHash('md5').update(key+pairs+body+key).digest('hex')})}
export async function getHotSearch(source:SourceId):Promise<string[]> {
 if(source==='wy'){const d=await netease('/api/search/chart/detail',{id:'HOT_SEARCH_SONG#@#'});return requireRows(d.data?.itemList,'网易热搜').map((r:any)=>r.searchWord)}
 if(source==='tx'){const d=await qq('tencent_musicsoso_hotkey.HotkeyService','GetHotkeyForQQMusicPC',{});return (d.vec_hotkey||d.hotkey||[]).map((r:any)=>r.query || r.k)}
 if(source==='kw'){const d=await fetchJSON(queryURL('https://hotword.kuwo.cn/hotword.s',{prod:'kwplayer_ar_9.3.0.1',corp:'kuwo',newver:2,vipver:'9.3.0.1',source:'kwplayer_ar_9.3.0.1_40.apk',p2p:1,notrace:0,uid:0,plat:'kwplayer_ar',rformat:'json',encoding:'utf8',tabid:1}),{headers:{'user-agent':'Dalvik/2.1.0 (Linux; U; Android 9;)'}});if(d.status!=='ok')throw new Error('酷我热搜接口暂不可用');return requireRows(d.tagvalue,'酷我热搜').map((r:any)=>r.key)}
 if(source==='kg'){const d=await fetchJSON('https://gateway.kugou.com/api/v3/search/hot_tab?signature=ee44edb9d7155821412d220bcaf509dd&appid=1005&clientver=10026&plat=0',{headers:{dfid:'1ssiv93oVqMp27cirf2CvoF1',mid:'156798703528610303473757548878786007104',clienttime:'1584257267','x-router':'msearch.kugou.com','user-agent':'Android9-AndroidPhone-10020-130-0-searchrecommendprotocol-wifi','kg-rc':'1'}});if(d.errcode!==0)throw new Error('酷狗热搜接口暂不可用');return requireRows(d.data?.list,'酷狗热搜').flatMap((r:any)=>(r.keywords??[]).map((k:any)=>decodeText(k.keyword)))}
 if(source==='mg'){const d=await fetchJSON('https://jadeite.migu.cn/music_search/v3/search/hotword');if(d.code!=='000000')throw new Error(`咪咕热搜返回 ${d.code}`);return requireRows(d.data?.hotwords?.[0]?.hotwordList,'咪咕热搜').filter(r=>r.resourceType==='song').map(r=>decodeText(r.word))}
 return []
}
export async function getSuggestions(source:SourceId,keyword:string):Promise<string[]> {
 if(!keyword.trim())return []
 if(source==='wy'){const d=await netease('/api/search/suggest/web',{s:keyword,limit:8});return (d.result?.songs || []).map((r:any)=>r.name)}
 if(source==='tx'){const d=await fetchJSON(queryURL('https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg',{is_xml:0,format:'json',key:keyword}),{headers:{referer:'https://y.qq.com/'}});return (d.data?.song?.itemlist || []).map((r:any)=>r.name)}
 return (await search(source,keyword,1,5)).list.map(t=>t.name)
}

export interface PlaylistSearchResult {list:OnlinePlaylist[];total:number;page:number;limit:number;source:string;failures?:{source:SourceId;error:string}[]}
export async function searchPlaylists(source:string,keyword:string,page=1,limit=20):Promise<PlaylistSearchResult>{
 keyword=String(keyword??'').trim().slice(0,300);({page,limit}=paging(page,limit));if(!keyword)return {list:[],total:0,page,limit,source}
 if(source==='all'){const results=await Promise.allSettled(online.map(src=>searchPlaylists(src,keyword,page,limit)));const valid=results.filter((r):r is PromiseFulfilledResult<PlaylistSearchResult>=>r.status==='fulfilled').map(r=>r.value);if(!valid.length)throw new Error('所有平台歌单搜索失败');return {list:valid.flatMap(r=>r.list),total:valid.reduce((sum,r)=>sum+r.total,0),page,limit,source,failures:results.flatMap((r,i)=>r.status==='rejected'?[{source:online[i],error:String(r.reason?.message??r.reason)}]:[])}}
 const src=checkedSource(source);let rows:any[],total:number
 if(src==='wy'){const d=await netease('/api/cloudsearch/pc',{s:keyword,type:1000,limit,total:page===1,offset:(page-1)*limit});rows=requireRows(d.result?.playlists??[], '网易歌单搜索');total=Number(d.result?.playlistCount)||0}
 else if(src==='kw'){const d=await fetchJSON(queryURL('https://search.kuwo.cn/r.s',{all:keyword,pn:page-1,rn:limit,rformat:'json',encoding:'utf8',ver:'mbox',vipver:'MUSIC_8.7.7.0_BCS37',plat:'pc',ft:'playlist',pay:0,needliveshow:0}));rows=requireRows(d.abslist,'酷我歌单搜索');total=Number(d.TOTAL)||0;rows=rows.map(r=>({...r,id:r.playlistid??r.id,name:r.name??r.NAME,cover:r.pic??r.img,author:r.uname}))}
 else if(src==='tx'){const d=await fetchJSON(queryURL('https://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist',{page_no:page-1,num_per_page:limit,format:'json',query:keyword,remoteplace:'txt.yqq.playlist',inCharset:'utf8',outCharset:'utf-8'}),{headers:{referer:'https://y.qq.com/'}});if(d.code!==0)throw new Error(`QQ歌单搜索返回 ${d.code}`);rows=requireRows(d.data?.list,'QQ歌单搜索');total=Number(d.data.sum)||0}
 else if(src==='kg'){const d=await fetchJSON(queryURL('https://msearchretry.kugou.com/api/v3/search/special',{keyword,page,pagesize:limit,showtype:10,filter:0,version:7910,sver:2}));if(d.errcode!==0)throw new Error(`酷狗歌单搜索返回 ${d.errcode}`);rows=requireRows(d.data?.info,'酷狗歌单搜索');total=Number(d.data.total)||0}
 else {const d=await fetchJSON(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll',{isCorrect:1,isCopyright:1,searchSwitch:JSON.stringify({song:0,album:0,singer:0,tagSong:0,mvSong:0,bestShow:0,songlist:1,lyricSong:0}),pageSize:limit,text:keyword,pageNo:page,sort:0,sid:'USS'}),{headers:miguHeaders(keyword)});if(d.code!=='000000')throw new Error(`咪咕歌单搜索返回 ${d.code}`);rows=requireRows(d.songListResultData?.result??d.songListResultData?.resultList,'咪咕歌单搜索');total=Number(d.songListResultData.totalCount)||0}
 return {list:rows.map(r=>playlistInfo(src,r)).filter(r=>r.id!=='undefined'&&r.name).slice(0,limit),total,page,limit,source}
}
export interface PlaylistTag {id:string;name:string;group?:string}
export async function getPlaylistTags(source:SourceId):Promise<PlaylistTag[]>{return detailCached(`tags:${source}`,async()=>{
 checkedSource(source)
 if(source==='wy'){const d=await netease('/api/playlist/catalogue',{});return requireRows(d.sub,'网易歌单标签').map(r=>({id:r.name,name:r.name,group:d.categories?.[r.category]}))}
 if(source==='kw'){const d=await fetchJSON('https://wapi.kuwo.cn/api/pc/classify/playlist/getTagList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0&vipver=9.0.5.0&source=kwplayer_pc_9.0.5.0&loginUid=0&loginSid=0&appUid=76039576');if(d.code!==200)throw new Error('酷我歌单标签接口不可用');return requireRows(d.data,'酷我标签').flatMap(group=>(group.data??[]).map((r:any)=>({id:`${r.id}-${r.digest}`,name:r.name,group:group.name})))}
 if(source==='tx'){const d=await fetchJSON('https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg?format=json&inCharset=utf8&outCharset=utf-8',{headers:{referer:'https://y.qq.com/'}});if(d.code!==0)throw new Error(`QQ歌单标签返回 ${d.code}`);return requireRows(d.data?.categories,'QQ标签').flatMap(group=>(group.items??[]).map((r:any)=>({id:String(r.categoryId),name:decodeText(r.categoryName),group:group.categoryGroupName})))}
 if(source==='mg'){const d=await fetchJSON('https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-taglist/release');if(d.code!=='000000')throw new Error(`咪咕标签返回 ${d.code}`);const rows=Array.isArray(d.data)?d.data.flatMap((group:any)=>(group.content??[]).map((r:any)=>({id:String(r.texts?.[1]??r.tagId),name:decodeText(r.texts?.[0]??r.tagName),group:decodeText(group.header?.title??'热门')}))).filter((r:any)=>r.name&&r.id!=='undefined'):contentLeaves(d.data,r=>r.tagId||r.actionUrl?.includes('tagId=')||r.action?.includes('tagId=')).map(r=>({id:String(r.tagId??(r.actionUrl??r.action)?.match(/tagId=([^&]+)/)?.[1]),name:decodeText(r.tagName??r.title??r.txt)})).filter(r=>r.name&&r.id!=='undefined');if(!rows.length)throw new Error('咪咕公开标签结构暂不可用');return rows}
 if(source==='kg'){const d=await fetchJSON(queryURL('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial',{is_smarty:1}));if(d.status!==1)throw new Error('酷狗歌单标签接口暂不可用');const groups=d.data?.tagids;if(!groups||typeof groups!=='object')throw new Error('酷狗标签结构无效');const tags=Object.entries(groups).flatMap(([group,value]:[string,any])=>requireRows(value.data,'酷狗标签').map((r:any)=>({id:String(r.id),name:decodeText(r.name),group})));if(d.data?.hotTag?.status===1)tags.unshift(...Object.values(d.data.hotTag.data).map((r:any)=>({id:String(r.special_id),name:decodeText(r.special_name),group:'热门'})));return tags}throw new Error('不支持的歌单标签平台')
 },3600000)}
export async function getTrackDetails(song:Track):Promise<Track>{return detailCached(`track:${song.source}:${song.meta.songId}`,async()=>{
 if(song.source==='local')return song
 if(song.source==='wy'){const id=song.meta.songId,d=await netease('/api/v3/song/detail',{c:JSON.stringify([{id}]),ids:JSON.stringify([id])});if(!d.songs?.[0])throw new Error('网易歌曲详情不存在');return normalizePlatformTrack('wy',d.songs[0])}
 if(song.source==='tx'){const d=await qq('music.pf_song_detail_svr','get_song_detail_yqq',{song_mid:String(song.meta.songId)});if(!d.track_info)throw new Error('QQ歌曲详情暂不可用');return normalizePlatformTrack('tx',d.track_info)}
 if(song.source==='kw'){const picture=(await fetchText(queryURL('https://artistpicserver.kuwo.cn/pic.web',{corp:'kuwo',type:'rid_pic',pictype:500,size:500,rid:song.meta.songId}))).trim();return {...song,meta:{...song.meta,picUrl:imageURL(picture)??song.meta.picUrl}}}
 return {...song,meta:{...song.meta,picUrl:imageURL(song.meta.picUrl,song.source==='mg'?'https://d.musicapp.migu.cn':'')}}
 })}
export interface EntityTracks {info:{id:string;name:string;cover:string;description:string;author:string};list:Track[];total:number;page:number;limit:number;source:SourceId}
const entityInfo=(id:string,raw:any)=>({id,name:decodeText(raw.name??raw.title??raw.album_name??raw.singername??raw.albumName??''),cover:imageURL(raw.picUrl??raw.img??raw.imgItems?.[0]?.img??raw.imgurl??raw.sizable_cover??raw.cover,'https://d.musicapp.migu.cn')??'',description:decodeText(raw.description??raw.summary??raw.info??raw.briefDesc??raw.intro??''),author:decodeText(raw.artist??raw.singer??raw.author_name??raw.singerName??'')})
export async function getAlbum(source:SourceId,id:string,page=1,limit=100):Promise<EntityTracks>{checkedSource(source);({page,limit}=paging(page,limit));return detailCached(`album:${source}:${id}:${page}:${limit}`,async()=>{
 let raw:any,rows:any[],total:number
 if(source==='wy'){const d=await netease(`/api/v1/album/${encodeURIComponent(id)}`,{});raw=d.album;rows=requireRows(d.songs,'网易专辑');total=rows.length;rows=rows.slice((page-1)*limit,page*limit)}
 else if(source==='kw'){const d=await fetchJSON(queryURL('https://search.kuwo.cn/r.s',{pn:page-1,rn:limit,stype:'albuminfo',albumid:id,show_copyright_off:0,encoding:'utf8',vipver:'MUSIC_9.1.0'}));raw=d;rows=requireRows(d.musiclist,'酷我专辑').map(r=>({...r,album:d.name,albumid:id}));total=Number(d.songnum)||rows.length}
 else if(source==='mg'){const [info,songs]=await Promise.all([fetchJSON(queryURL('https://app.c.nf.migu.cn/MIGUM3.0/resource/album/v2.0',{albumId:id})),fetchJSON(queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/queryAlbumSong',{albumId:id,pageNo:page}))]);if(info.code!=='000000'||songs.code!=='000000')throw new Error('咪咕专辑接口暂不可用');raw=info.data;rows=requireRows(songs.data?.songList??songs.songList,'咪咕专辑');total=Number(raw?.totalCount)||rows.length}
 else if(source==='tx'){const d=await qq('music.musichallAlbum.AlbumSongList','GetAlbumSongList',{albumMid:id,albumID:0,begin:(page-1)*limit,num:limit,order:2});rows=requireRows(d.songList,'QQ专辑');raw={name:rows[0]?.songInfo?.album?.name,cover:`https://y.gtimg.cn/music/photo_new/T002R500x500M000${id}.jpg`};total=Number(d.totalNum)||rows.length}
 else {const d=await fetchJSON(queryURL('https://mobiles.kugou.com/api/v3/album/song',{version:9108,albumid:id,plat:0,pagesize:limit,area_code:0,page,with_res_tag:0}));if(d.errcode!==0)throw new Error(`酷狗专辑返回 ${d.errcode}`);rows=requireRows(d.data?.info,'酷狗专辑');raw={name:rows[0]?.album_name??''};total=Number(d.data.total)||rows.length}
 if(!raw)throw new Error('专辑不存在或暂不可用');return {info:entityInfo(id,raw),list:rows.map(r=>normalizePlatformTrack(source,r)),total,page,limit,source}
 })}
export async function getSinger(source:SourceId,id:string,page=1,limit=100):Promise<EntityTracks>{checkedSource(source);({page,limit}=paging(page,limit));return detailCached(`singer:${source}:${id}:${page}:${limit}`,async()=>{
 let raw:any,rows:any[],total:number
 if(source==='wy'){const [info,songs]=await Promise.all([netease('/api/artist/head/info/get',{id}),netease('/api/v2/artist/songs',{id,order:'hot',offset:(page-1)*limit,limit,total:true})]);raw=info.data?.artist??info.artist;rows=requireRows(songs.songs,'网易歌手');total=Number(songs.total)||rows.length}
 else if(source==='tx'){const d=await qq('musichall.song_list_server','GetSingerSongList',{singerMid:id,order:1,begin:(page-1)*limit,num:limit});rows=requireRows(d.songList,'QQ歌手');raw={name:rows[0]?.songInfo?.singer?.find((s:any)=>s.mid===id)?.name,cover:`https://y.gtimg.cn/music/photo_new/T001R500x500M000${id}.jpg`};total=Number(d.totalNum)||rows.length}
 else if(source==='kg'){const [info,songs]=await Promise.all([fetchJSON(queryURL('https://mobiles.kugou.com/api/v5/singer/info',{singerid:id})),fetchJSON(queryURL('https://mobiles.kugou.com/api/v5/singer/song',{singerid:id,page,pagesize:limit}))]);if(info.errcode!==0||songs.errcode!==0)throw new Error('酷狗歌手接口暂不可用');raw=info.data;rows=requireRows(songs.data?.info,'酷狗歌手');total=Number(songs.data.total)||rows.length}
 else throw new Error('此平台的歌手详情未提供受支持的公开接口')
 if(!raw)throw new Error('歌手不存在或暂不可用');return {info:entityInfo(id,raw),list:rows.map(r=>normalizePlatformTrack(source,r)),total,page,limit,source}
 })}

/** Parse JSON assigned to a known page variable without executing page scripts. */
export function embeddedJSON(html:string,name:string):any {
 const start=new RegExp('(?:var\\s+)?'+name+'\\s*=\\s*([\\[{])').exec(html);if(!start)throw new Error('分享页面没有公开歌单数据')
 const offset=start.index+start[0].length-1;let depth=0,quoted=false,escape=false
 for(let i=offset;i<html.length;i++){const char=html[i];if(quoted){if(escape)escape=false;else if(char==='\\')escape=true;else if(char==='"')quoted=false;continue}if(char==='"')quoted=true;else if(char==='['||char==='{')depth++;else if((char===']'||char==='}')&&--depth===0)return JSON.parse(html.slice(offset,i+1))}
 throw new Error('分享页面数据不完整')
}
async function kugouRequest(url:string,init?:Parameters<typeof fetchJSON>[1]):Promise<any>{let d:any;try{d=await fetchJSON(url,init)}catch(error){if(!String(error).includes('ERR_BLOCKED_BY_CLIENT'))throw error;d=await fetchJSON(url,{...init,transport:'kugou-share'})}const code=d.error_code??d.errcode??d.err_code;if(code!=null&&Number(code)!==0)throw new Error(`酷狗分享接口返回 ${code}`);return d.data??(Array.isArray(d.info)?d:d.info??d)}
async function hydrateKugouHashes(rows:any[]):Promise<Track[]>{
 const unique=[...new Map(rows.map(row=>[String(row.hash??row.audio_info?.hash??row.FileHash),row])).values()];const output:Track[]=[]
 for(let i=0;i<unique.length;i+=100){const batch=unique.slice(i,i+100),body={area_code:'1',show_privilege:1,show_album_info:'1',is_publish:'',appid:1005,clientver:11451,mid:'1',dfid:'-',clienttime:Date.now(),key:'OIlwieks28dk2k092lksi2UIkp',fields:'album_info,author_name,audio_info,ori_audio_name,base,songname',data:batch.map(row=>({hash:row.hash??row.audio_info?.hash??row.FileHash}))};const d=await kugouRequest('https://gateway.kugou.com/v2/album_audio/audio',{method:'POST',headers:{'content-type':'application/json','x-router':'kmr.service.kugou.com','kg-rc':'1','kg-thash':'13a3164','user-agent':'Android712-AndroidPhone-11451-376-0-FeeCacheUpdate-wifi'},body:JSON.stringify(body)});for(const item of requireRows(d,'酷狗分享歌曲')){const r=Array.isArray(item)?item[0]:item;if(!r)continue;output.push(normalizePlatformTrack('kg',{...r,...r.base,...r.audio_info,hash:r.audio_info?.hash??r.hash,audio_id:r.audio_info?.audio_id??r.base?.audio_id??r.audio_id,songname:r.songname,audio_name:r.songname??r.base?.ori_audio_name??r.ori_audio_name,album_audio_id:r.audio_info?.audio_group_id,'320hash':r.audio_info?.hash_320,sqhash:r.audio_info?.hash_flac,res_hash:r.audio_info?.hash_high,filesize:r.audio_info?.filesize,'320filesize':r.audio_info?.filesize_320,sqfilesize:r.audio_info?.filesize_flac,res_filesize:r.audio_info?.filesize_high,timelen:r.audio_info?.timelength,singername:r.author_name??r.authors?.map((a:any)=>a.author_name).join('、'),album_name:r.album_info?.album_name,album_id:r.album_info?.album_id,imgurl:r.album_info?.sizable_cover}))}}
 if(output.length<unique.length)throw new Error('酷狗未公开此分享歌单的全部歌曲')
 return deduplicateTracks(output)
}
async function loadKugouShare(input:string,depth=0):Promise<{info:OnlinePlaylist;tracks:Track[]}>{
 if(depth>3||input.length>2048)throw new Error('酷狗分享链接跳转过多或长度无效')
 const headers={mid:'1586163242519',clienttime:'1586163242519',dfid:'-',referer:'https://m3ws.kugou.com/share/index.php','user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}
 let raw:any,rows:any[]=[],gcid='',chain='',id=''
 if(/^\d+$/.test(input)){
  const d=await kugouRequest('https://t.kugou.com/command/',{method:'POST',headers:{'content-type':'application/json','kg-rc':'1','kg-thash':'network_super_call.cpp:3676261689:379'},body:JSON.stringify({appid:1001,clientver:9020,mid:'21511157a05844bd085308bc76ef3343',clienttime:640612895,key:'36164c4015e704673c588ee202b9ecb8',data:input})});raw=d.info??d;gcid=raw.global_collection_id??'';id=String(raw.id??input)
  if(!gcid&&raw.type===2)return loadPlaylist('kg','id_'+id)
  rows=d.list??[]
  if(raw.userid!=null&&!gcid){const total=Number(raw.count)||0;for(let page=1;page<=Math.max(1,Math.ceil(total/100));page++){if(page>100)throw new Error('酷狗分享超过10000首限制');const more=await kugouRequest('https://www2.kugou.kugou.com/apps/kucodeAndShare/app/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appid:1001,clientver:9020,mid:'21511157a05844bd085308bc76ef3343',clienttime:640612895,key:'36164c4015e704673c588ee202b9ecb8',data:{id:raw.id,type:3,userid:raw.userid,collect_type:0,page,pagesize:100}})});if(page===1)rows=[];rows.push(...requireRows(Array.isArray(more)?more:more.list,'个人分享歌曲'))}if(rows.length<total)throw new Error('酷狗未返回完整个人分享')}
 }else{
  let url:URL;try{url=new URL(input)}catch{throw new Error('请输入酷狗分享链接或分享码')}
  if(!/(^|\.)kugou\.com$/.test(url.hostname)||!['http:','https:'].includes(url.protocol))throw new Error('酷狗分享地址来源无效')
  gcid=url.searchParams.get('global_collection_id')??'';chain=url.searchParams.get('chain')??''
  if(!gcid&&!chain){const response=await fetchBytes(url.toString(),{headers},4_000_000);if(response.url!==url.toString())return loadKugouShare(response.url,depth+1);const html=response.bytes.toString();gcid=html.match(/"global_collection_id"\s*:\s*"([\w]+)"/)?.[1]??''
   if(!gcid){const encoded=(input+' '+html).match(/gcid_\w+/)?.[0];if(encoded){const params={dfid:'-',appid:1005,mid:0,clientver:20109,clienttime:640612895,uuid:'-'},body=JSON.stringify({ret_info:1,data:[{id:encoded,id_type:2}]});const d=await kugouRequest(signedKugouURL('https://t.kugou.com/v1/songlist/batch_decode',params,false,body),{method:'POST',headers:{...headers,'content-type':'application/json'},body});gcid=d.list?.[0]?.global_collection_id??''}}
   if(!gcid){chain=url.pathname.match(/\/share\/([\w]+)\.html/)?.[1]??'';if(chain)rows=requireRows(embeddedJSON(html,'dataFromSmarty'),'PC分享歌曲');else{const info=embeddedJSON(html,'phpParam');gcid=info.global_collection_id??'';chain=info.chain??''}}
  }
 }
 if(chain&&!gcid&&!rows.length){const d=await kugouRequest(queryURL('https://m.kugou.com/schain/transfer',{pagesize:10000,chain,su:1,page:1}),{headers});raw=d.info??d;gcid=d.global_collection_id??raw.global_collection_id??'';rows=d.list??[];if(!gcid&&!rows.length){const html=await fetchText(`https://www.kugou.com/share/${encodeURIComponent(chain)}.html`,{headers});rows=requireRows(embeddedJSON(html,'dataFromSmarty'),'PC分享歌曲')}}
 if(chain&&!gcid&&rows.length){const expected=Number(raw?.count??raw?.songcount)||rows.length;for(let page=2;rows.length<expected&&page<=100;page++){const d=await kugouRequest(queryURL('https://m.kugou.com/schain/transfer',{pagesize:100,chain,su:1,page}),{headers});const batch=requireRows(d.list,'个人分享chain');if(!batch.length)break;rows.push(...batch)}if(rows.length<expected)throw new Error('酷狗个人分享chain分页不完整')}
 if(gcid){
  const basic={appid:1058,srcappid:2919,clientver:20000,clienttime:1586163242519,mid:1586163242519,uuid:1586163242519,dfid:'-'}
  if(chain){let total=Infinity;rows=[];for(let page=1;rows.length<total&&page<=200;page++){const d=await kugouRequest(signedKugouURL('https://m3ws.kugou.com/v2/zlist/list',{...basic,listid:15,type:0,pagesize:50,global_collection_id:gcid,page,share_type:'collect',chain},true),{headers});raw=d.info?.[0];if(!raw)throw new Error('酷狗个人歌单不存在');total=Number(raw.count)||0;const batch=requireRows(d.list?.info,'个人歌单');if(!batch.length&&rows.length<total)throw new Error('酷狗个人歌单分页不完整');rows.push(...batch)}if(rows.length<total)throw new Error('酷狗个人歌单超过10000首限制')}
  else{raw=await kugouRequest(signedKugouURL('https://mobiles.kugou.com/api/v5/special/info_v2',{...basic,specialid:0,global_specialid:gcid,format:'json'},true),{headers});const total=Number(raw.songcount)||0;rows=[];for(let page=1;rows.length<total&&page<=100;page++){const d=await kugouRequest(signedKugouURL('https://mobiles.kugou.com/api/v5/special/song_v2',{...basic,specialid:0,global_specialid:gcid,plat:0,version:8000,page,pagesize:100},true),{headers});const batch=requireRows(d.info,'个人歌单');if(!batch.length)break;rows.push(...batch)}if(rows.length<total)throw new Error('酷狗个人歌单分页不完整')}
 }
 if(!rows.length)throw new Error('分享链接没有公开歌曲或已过期')
 const tracks=await hydrateKugouHashes(rows);const info=playlistInfo('kg',{...raw,id:input,name:raw?.name??raw?.specialname??'分享歌单',cover:raw?.pic??raw?.img??raw?.imgurl,author:raw?.username??raw?.list_create_username??raw?.nickname});return {info:{...info,id:input},tracks}
}
