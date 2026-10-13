import { inflateSync } from 'node:zlib'
import { parseSource } from './source-runtime'
import initSqlJs from 'sql.js'
import { readFile,stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { emptyLibrary } from '../../../src/shared/defaults'
import type { LibraryState,Playlist,DownloadTask } from '../../../src/shared/types'
import { migrateLegacyPreferences } from './legacy-preferences'
import { normalizeTrack,normalizeSettings } from './library'
const require=createRequire(typeof __filename!=='undefined'?__filename:path.resolve('package.json'))
export async function importLegacyDirectory(directory:string):Promise<LibraryState> {
 const dataDirectory=(await stat(path.join(directory,'LxDatas')).catch(()=>null))?.isDirectory()?path.join(directory,'LxDatas'):directory
 const databasePath=path.join(dataDirectory,'lx.data.db')
 const wal=await stat(databasePath+'-wal').catch(()=>null)
 if(wal&&wal.size>0)throw new Error('请先关闭 LX Music 后再导入数据目录，以确保数据库写入完成；也可直接导入原应用导出的备份')
 const modulePath=require.resolve('sql.js');const SQL=await initSqlJs({locateFile:file=>path.join(path.dirname(modulePath),file)})
 const bytes=await readFile(databasePath);if(bytes.length>256*1024*1024)throw new Error('旧数据库超过导入大小限制')
 const db=new SQL.Database(bytes)
 const rows=(sql:string)=>{const result=db.exec(sql)[0];return result?result.values.map(values=>Object.fromEntries(result.columns.map((name,i)=>[name,values[i]]))):[]}
 const state=emptyLibrary()
 try{
  const info=rows('SELECT * FROM my_list ORDER BY position')
  if(!info.length)throw new Error('旧数据库中没有可识别的歌单')
  state.playlists=info.map(raw=>{
   const id=String(raw.id)
   const escaped=id.replaceAll("'","''")
   const tracks=rows(`SELECT m.* FROM my_list_music_info m LEFT JOIN my_list_music_info_order o ON m.listId=o.listId AND m.id=o.musicInfoId WHERE m.listId='${escaped}' ORDER BY o."order"`).map(t=>normalizeTrack({...t,meta:JSON.parse(String(t.meta))}))
   return {id,name:id==='default'?'试听列表':id==='love'?'我喜欢的音乐':String(raw.name),source:raw.source||undefined,sourceListId:raw.sourceListId||undefined,locationUpdateTime:Number(raw.locationUpdateTime)||null,createdAt:Date.now(),tracks} as Playlist
  })
  try{state.dislikes=rows('SELECT * FROM dislike_list').flatMap(rule=>{const type=String(rule.type),content=String(rule.content);return type==='music'?[content]:type==='singer'?['@'+content]:[content]})}catch{}
  try{state.downloads=rows('SELECT * FROM download_list ORDER BY position').map(raw=>({id:String(raw.id),track:normalizeTrack(JSON.parse(String(raw.musicInfo))),quality:raw.quality,status:raw.isComplate?'completed':'paused',progress:Number(raw.progress_total)?Number(raw.progress_downloaded)/Number(raw.progress_total):0,received:Number(raw.progress_downloaded)||0,total:Number(raw.progress_total)||0,speed:0,path:String(raw.filePath),url:raw.url || undefined} as DownloadTask))}catch{}
  try{const lyrics:Record<string,any>={};for(const row of rows("SELECT * FROM lyric WHERE source='edited'")){const key=String(row.type);if(!['lyric','tlyric','rlyric','lxlyric'].includes(key))continue;const id=String(row.id);const value=lyrics[id]||(lyrics[id]={lyric:''});value[key]=Buffer.from(String(row.text),'base64').toString('utf8')}state.editedLyrics=lyrics}catch{}
   for(const name of ['config_v2.json','config.json'])try{const config=JSON.parse(await readFile(path.join(dataDirectory,name),'utf8'));state.settings=normalizeSettings(config.setting || config);break}catch{}
  try{const apis=JSON.parse(await readFile(path.join(dataDirectory,'user_api.json'),'utf8')).userApis;for(const api of apis || []){if(typeof api.script!=='string')continue;const script=api.script.startsWith('gz_')?inflateSync(Buffer.from(api.script.slice(3),'base64'),{maxOutputLength:9_000_000}).toString():api.script;try{state.scripts.push({...parseSource(script),enabled:false,status:'从旧目录导入，尚未启用'})}catch{}}}catch{}
  for(const [file,key] of [['theme.json','legacyThemes'],['sound_effect.json','legacySoundEffects'],['hot_key.json','legacyHotkeys']] as const)try{state.settings[key]=JSON.parse(await readFile(path.join(dataDirectory,file),'utf8'))}catch{}
  state.settings=await migrateLegacyPreferences(state.settings,dataDirectory)
   return state
 }finally{db.close()}
}
