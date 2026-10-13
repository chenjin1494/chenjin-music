import type { Lyrics } from '../../../shared/types'
import { parseLrc, parseTimedLyrics, type LyricLine } from './lyrics'
export type LyricField='lyric'|'tlyric'|'rlyric'|'lxlyric'
export type LyricDocument=Record<LyricField,string>
export const LYRIC_FIELDS:LyricField[]=['lyric','tlyric','rlyric','lxlyric']
export const MAX_LYRIC_BYTES=2*1024*1024
export interface LyricIssue {field:LyricField;line:number;level:'error'|'warning';message:string}
const timeRx=/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const msRx=/^\s*\[(\d+),(\d+)\]/
const timestampMs=(match:RegExpMatchArray)=>Number(match[1])*60000+Number(match[2])*1000+Number(`0.${match[3]||0}`)*1000
export function lyricDocument(lyrics:Lyrics):LyricDocument {return {lyric:lyrics.lyric||'',tlyric:lyrics.tlyric||'',rlyric:lyrics.rlyric||'',lxlyric:lyrics.lxlyric||''}}
export function documentBytes(document:LyricDocument):number{return new TextEncoder().encode(LYRIC_FIELDS.map(key=>document[key]).join('')).byteLength}
export function formatLyricTimestamp(milliseconds:number):string {
 if(!Number.isFinite(milliseconds))throw new Error('时间必须是有限数字')
 const value=Math.max(0,Math.round(milliseconds)),minutes=Math.floor(value/60000),seconds=Math.floor(value%60000/1000),fraction=value%1000
 return `[${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(fraction).padStart(3,'0')}]`
}
export function lyricOffset(text:string):number{return Number(text.match(/\[offset:\s*([+-]?\d+)\s*\]/i)?.[1]||0)}
export function rowTime(text:string):number|null {const ms=text.match(msRx);if(ms)return Number(ms[1]);const tag=[...text.matchAll(timeRx)][0];return tag?timestampMs(tag):null}
/** Move absolute starts only: LX/KRC <relative,duration> and line/word durations remain intact. */
function shiftRow(row:string,delta:number,timed=false):string {
 const first=rowTime(row);if(first==null)return row
 const applied=Math.max(0,Math.round(first+delta))-first
 let result=row.replace(timeRx,(_tag,...parts)=>formatLyricTimestamp(timestampMs([_tag,...parts.slice(0,3)] as RegExpMatchArray)+delta))
 result=result.replace(msRx,(tag,start,duration)=>tag.replace(`[${start},${duration}]`,`[${Math.max(0,Math.round(Number(start)+delta))},${duration}]`))
 // YRC absolute (start,duration,unused), and QRC word(start,duration).
 if(timed||msRx.test(row))result=result.replace(/\((\d+),(\d+)(,\d+)?\)/g,(_tag,start,duration,tail)=>`(${Math.max(0,Math.round(Number(start)+applied))},${duration}${tail||''})`)
 return result
}
export function shiftLyricText(text:string,deltaMilliseconds:number,field:LyricField='lyric'):string {
 if(!Number.isFinite(deltaMilliseconds)||Math.abs(deltaMilliseconds)>86400000)throw new Error('偏移超出允许范围')
 return text.split(/\r?\n/).map(row=>shiftRow(row,Math.round(deltaMilliseconds),field==='lxlyric')).join('\n')
}
export function shiftAllLyrics(document:LyricDocument,deltaMilliseconds:number):LyricDocument {return Object.fromEntries(LYRIC_FIELDS.map(key=>[key,shiftLyricText(document[key],deltaMilliseconds,key)])) as LyricDocument}
export function changeLyricRow(text:string,rowIndex:number,valueMilliseconds:number,mode:'set'|'shift'='set',field:LyricField='lyric'):string {
 if(!Number.isInteger(rowIndex)||rowIndex<0)throw new Error('请选择有效歌词行')
 if(!Number.isFinite(valueMilliseconds))throw new Error('时间必须是有限数字')
 const rows=text.split(/\r?\n/);if(rowIndex>=rows.length)throw new Error('请选择有效歌词行')
 const row=rows[rowIndex],old=rowTime(row)
 if(old==null){
  if(mode==='shift')throw new Error('当前行没有时间戳，请先校准到播放位置')
  if(!row.trim()||/^\s*\[[^\]]+:[^\]]*\]\s*$/.test(row))throw new Error('元信息或空行不能校准为歌词')
  if(field==='lxlyric'&&!/<\d+,\d+(?:,\d+)?>|\(\d+,\d+(?:,\d+)?\)/.test(row))throw new Error('逐字歌词行需要保留字级时间标记')
  rows[rowIndex]=formatLyricTimestamp(valueMilliseconds-lyricOffset(text))+row
 }else rows[rowIndex]=shiftRow(row,mode==='shift'?valueMilliseconds:Math.max(0,Math.round(valueMilliseconds-lyricOffset(text)))-old,field==='lxlyric')
 return rows.join('\n')
}
export function validateLyricDocument(document:LyricDocument):LyricIssue[] {
 const issues:LyricIssue[]=[]
 if(documentBytes(document)>MAX_LYRIC_BYTES)issues.push({field:'lyric',line:0,level:'error',message:'四种歌词合计不能超过2MB'})
 for(const field of LYRIC_FIELDS){
  const rows=document[field].split(/\r?\n/)
  rows.forEach((row,index)=>{
   const tags=[...row.matchAll(timeRx)],ms=row.match(msRx)
   if(tags.some(tag=>Number(tag[2])>=60))issues.push({field,line:index+1,level:'error',message:'时间戳秒数必须小于60'})
   if([...row.matchAll(/\[([^\]]*)\]/g)].some(tag=>/^[-+]?\d+[:,]/.test(tag[1])&&!/^\d+:\d{1,2}(?:[.:]\d{1,3})?$|^\d+,\d+$/.test(tag[1])))issues.push({field,line:index+1,level:'error',message:'时间戳格式无效'})
   if(tags.some(tag=>!Number.isSafeInteger(Math.round(timestampMs(tag))))||(ms&&(!Number.isSafeInteger(Number(ms[1]))||!Number.isSafeInteger(Number(ms[2])))))issues.push({field,line:index+1,level:'error',message:'时间数值超出允许范围'})
   if(field==='lxlyric'&&(tags.length||ms)&&!/<\d+,\d+(?:,\d+)?>|\(\d+,\d+(?:,\d+)?\)/.test(row))issues.push({field,line:index+1,level:'warning',message:'逐字歌词行没有字级时间标记'})
   if(row.trim()&&!tags.length&&!ms&&!/^\s*\[[a-z][^\]]*\]\s*$/i.test(row))issues.push({field,line:index+1,level:'warning',message:'此行没有时间戳，将作为纯文本保存'})
  })
 }
 return issues
}
export function previewLyricText(text:string,field:LyricField):LyricLine[] {return (field==='lxlyric'?parseTimedLyrics(text):parseLrc(text)).filter(line=>Number.isFinite(line.time)&&(!line.words||line.words.every(word=>Number.isFinite(word.time)&&Number.isFinite(word.duration))))}
/** Bounded snapshots for one edit session; fresh edits discard the redo branch. */
export class LyricEditorHistory {
 private entries:LyricDocument[]
 private position=0
 constructor(initial:LyricDocument,private limit=50,private byteLimit=8*1024*1024){this.entries=[{...initial}]}
 get current():LyricDocument{return {...this.entries[this.position]}}
 get canUndo():boolean{return this.position>0}
 get canRedo():boolean{return this.position<this.entries.length-1}
 get length():number{return this.entries.length}
 commit(next:LyricDocument):boolean {
  if(documentBytes(next)>MAX_LYRIC_BYTES)throw new Error('四种歌词合计不能超过2MB')
  if(LYRIC_FIELDS.every(key=>next[key]===this.entries[this.position][key]))return false
  this.entries=this.entries.slice(0,this.position+1);this.entries.push({...next});this.position=this.entries.length-1
  while(this.entries.length>Math.max(2,this.limit)||(this.entries.length>2&&this.entries.reduce((sum,entry)=>sum+documentBytes(entry),0)>this.byteLimit)){this.entries.shift();this.position--}
  return true
 }
 undo():LyricDocument {if(this.canUndo)this.position--;return this.current}
 redo():LyricDocument {if(this.canRedo)this.position++;return this.current}
}
