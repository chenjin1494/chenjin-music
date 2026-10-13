import { readFile } from 'node:fs/promises'
import iconv from 'iconv-lite'
import { parseFile } from 'music-metadata'
import { decodeKrc } from './lyric-codecs'
import type { Lyrics,Track } from '../../../src/shared/types'
export function lyricText(bytes:Buffer):string{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')}catch{return iconv.decode(bytes,'gb18030')}}
function stamp(milliseconds:number):string{const ms=Math.max(0,Math.round(milliseconds));return `[${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000)%60<10?'0':''}${Math.floor(ms/1000)%60}.${(ms%1000).toString().padStart(3,'0')}]`}
export async function readLocalLyrics(track:Track):Promise<Lyrics|null>{
 if(!track.meta.filePath)return null
 const base=track.meta.filePath.replace(/\.[^.]+$/,'')
 const read=async(extension:string)=>{try{const bytes=await readFile(base+extension);if(bytes.length>2_000_000)throw new Error('歌词文件过大');return lyricText(bytes)}catch{return null}}
 const sidecar=await read('.lrc')
 const result:Lyrics={lyric:sidecar||'',tlyric:await read('.translation.lrc'),rlyric:await read('.roman.lrc'),lxlyric:await read('.lx.lrc')}
 if(!result.lxlyric)try{const bytes=await readFile(base+'.krc');if(bytes.length>2_000_000)throw new Error('KRC歌词文件过大');const krc=decodeKrc(bytes);result.lyric=result.lyric||krc.lyric;result.lxlyric=krc.lxlyric;result.tlyric=result.tlyric||krc.tlyric;result.rlyric=result.rlyric||krc.rlyric}catch{}
 if(!result.lyric&&!result.lxlyric)try{
  const meta=await parseFile(track.meta.filePath,{skipCovers:true});const embedded=meta.common.lyrics?.[0]
  if(embedded?.syncText?.some(item=>item.timestamp!=null))result.lyric=embedded.syncText.map(item=>stamp(item.timestamp||0)+item.text).join('\n')
  else result.lyric=embedded?.text||embedded?.syncText?.map(item=>item.text).join('\n')||''
 }catch{}
 return result.lyric||result.lxlyric?result:null
}
