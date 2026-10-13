import { gunzipSync, gzipSync } from 'node:zlib'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { LibraryState } from '../../../src/shared/types'
import { normalizeState } from './library'

export interface BackupEnvelope { format: 'chenjin-music'; version: 1; exportedAt: string; data: LibraryState }
export function encodeBackup(state: LibraryState, compressed = true): Buffer {
 const envelope: BackupEnvelope = { format:'chenjin-music',version:1,exportedAt:new Date().toISOString(),data:normalizeState(state) }
 const data=Buffer.from(JSON.stringify(envelope,null,2),'utf8');return compressed?gzipSync(data):data
}
export function decodeBackup(input: Buffer | string): LibraryState {
 let bytes=typeof input==='string'?Buffer.from(input,'utf8'):input
 if(bytes.length>128*1024*1024)throw new Error('备份文件超过 128 MB 限制')
 try {
  if(bytes[0]===0x1f&&bytes[1]===0x8b)bytes=gunzipSync(bytes,{maxOutputLength:128*1024*1024})
  let raw=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''))
  if(typeof raw==='string')raw=JSON.parse(raw)
  if(!raw||typeof raw!=='object')throw new Error('备份结构无效')
  if(raw.format==='chenjin-music'&&raw.version>1)throw new Error('此备份来自更新版本，请先升级琛瑾音乐')
  let data:any
  if(raw.format==='chenjin-music')data=raw.data
  else switch(raw.type){
   case 'allData':case 'allData_v2':data={settings:raw.setting,playlists:raw.playList,...(raw.defaultList?{defaultList:raw.defaultList.list||raw.defaultList}:{})};break
   case 'setting':case 'setting_v2':data={settings:raw.data};break
   case 'playList':case 'playList_v2':data={playlists:raw.data};break
   case 'playListPart':case 'playListPart_v2':data={playlists:[raw.data]};break
   case 'defautlList':data={defaultList:raw.data.list||raw.data};break
   default:data=raw.data??raw
  }
  if(Array.isArray(data))data={playlists:data}
  if(!data||typeof data!=='object'||!['playlists','list','userList','defaultList','loveList','settings','setting','scripts'].some(key=>key in data))throw new Error('文件不包含支持的音乐库数据')
  return normalizeState(data)
 }catch(error){throw new Error(`无法读取备份：${error instanceof Error?error.message:String(error)}`)}
}
export async function exportBackup(path:string,state:LibraryState,compressed=true):Promise<string>{const temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,encodeBackup(state,compressed));await rename(temp,path);return path}
export async function importBackup(path:string):Promise<LibraryState>{return decodeBackup(await readFile(path))}
export function exportBackupText(state:LibraryState):string{return encodeBackup(state,false).toString('utf8')}
