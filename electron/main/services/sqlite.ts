import { Worker } from 'node:worker_threads'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { LibraryState } from '../../../src/shared/types'

const workerSource=String.raw`
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
let db,SQL,serial=Promise.resolve();
async function ready(){SQL=await require(workerData.module)({locateFile:file=>path.join(workerData.dist,file)});let bytes;try{bytes=await fs.readFile(workerData.file)}catch(e){if(e.code!=='ENOENT')throw e}try{db=bytes?new SQL.Database(bytes):new SQL.Database()}catch(e){await fs.rename(workerData.file,workerData.file+'.corrupt-'+Date.now());db=new SQL.Database()}
db.run('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS playlists(id TEXT PRIMARY KEY,name TEXT NOT NULL,source TEXT,source_list_id TEXT,created_at INTEGER); CREATE TABLE IF NOT EXISTS tracks(id TEXT PRIMARY KEY,source TEXT NOT NULL,name TEXT NOT NULL,singer TEXT NOT NULL,meta TEXT NOT NULL,interval TEXT); CREATE TABLE IF NOT EXISTS playlist_tracks(playlist_id TEXT NOT NULL,track_id TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(playlist_id,track_id),FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE); CREATE INDEX IF NOT EXISTS idx_track_name ON tracks(name); CREATE INDEX IF NOT EXISTS idx_playlist_order ON playlist_tracks(playlist_id,position); CREATE TABLE IF NOT EXISTS downloads(id TEXT PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS dislikes(rule TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS source_scripts(id TEXT PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS lyric_cache(track_id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at INTEGER); PRAGMA user_version=1;');}
const initialized=ready();
function state(){const result=db.exec("SELECT value FROM metadata WHERE key='state'");if(!result[0]?.values[0]?.[0])return null;const state=JSON.parse(result[0].values[0][0]);if(state._normalizedTracks){delete state._normalizedTracks;const tracks=new Map();for(const row of db.exec('SELECT id,source,name,singer,meta,interval FROM tracks')[0]?.values||[]){tracks.set(row[0],{id:row[0],source:row[1],name:row[2],singer:row[3],meta:JSON.parse(row[4]),interval:row[5]})}const lists=new Map(state.playlists.map(p=>[p.id,p]));for(const row of db.exec('SELECT playlist_id,track_id FROM playlist_tracks ORDER BY playlist_id,position')[0]?.values||[]){const list=lists.get(row[0]),track=tracks.get(row[1]);if(list&&track)list.tracks.push(track)}}return state}
async function save(input){db.run('BEGIN TRANSACTION');try{db.run('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)',['state',JSON.stringify({...input,playlists:input.playlists.map(p=>({...p,tracks:[]})),_normalizedTracks:true})]);
const old=db.exec("SELECT value FROM metadata WHERE key='listsHash'")[0]?.values[0]?.[0];const lists=crypto.createHash('sha256').update(JSON.stringify(input.playlists)).digest('hex');
if(old!==lists){db.run('DELETE FROM playlist_tracks;DELETE FROM playlists;DELETE FROM tracks');const ps=db.prepare('INSERT INTO playlists VALUES(?,?,?,?,?)'),ts=db.prepare('INSERT OR REPLACE INTO tracks VALUES(?,?,?,?,?,?)'),ls=db.prepare('INSERT INTO playlist_tracks VALUES(?,?,?)');try{for(const p of input.playlists){ps.run([p.id,p.name,p.source||null,p.sourceListId||null,p.createdAt]);const seen=new Set();for(let i=0;i<p.tracks.length;i++){const t=p.tracks[i];ts.run([t.id,t.source,t.name,t.singer,JSON.stringify(t.meta),t.interval]);if(!seen.has(t.id)){ls.run([p.id,t.id,i]);seen.add(t.id)}}}}finally{ps.free();ts.free();ls.free()}db.run('INSERT OR REPLACE INTO metadata VALUES(?,?)',['listsHash',lists])}
db.run('DELETE FROM downloads;DELETE FROM source_scripts;DELETE FROM dislikes');for(const t of input.downloads)db.run('INSERT INTO downloads VALUES(?,?)',[t.id,JSON.stringify(t)]);for(const s of input.scripts)db.run('INSERT INTO source_scripts VALUES(?,?)',[s.id,JSON.stringify(s)]);for(const rule of new Set(input.dislikes))db.run('INSERT INTO dislikes VALUES(?)',[rule]);db.run('COMMIT');}catch(e){db.run('ROLLBACK');throw e}
await fs.mkdir(path.dirname(workerData.file),{recursive:true});const tmp=workerData.file+'.tmp';await fs.writeFile(tmp,Buffer.from(db.export()));await fs.rename(tmp,workerData.file);return true}
parentPort.on('message',message=>{serial=serial.catch(()=>{}).then(async()=>{try{await initialized;let value;if(message.method==='load')value=state();else if(message.method==='save')value=await save(message.data);else if(message.method==='query')value=db.exec(message.data);else if(message.method==='close'){db.close();value=true}parentPort.postMessage({id:message.id,value})}catch(e){parentPort.postMessage({id:message.id,error:e.message})}})});
`

export class SQLiteStore {
 private worker: Worker
 private sequence=0
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>()
 constructor(readonly filename:string) {
  const require=createRequire(typeof __filename!=='undefined'?__filename:path.resolve('package.json'))
  const modulePath=require.resolve('sql.js')
  this.worker=new Worker(workerSource,{eval:true,workerData:{file:filename,module:modulePath,dist:path.dirname(modulePath)}})
  this.worker.on('message',message=>{const task=this.pending.get(message.id);if(!task)return;this.pending.delete(message.id);message.error?task.reject(new Error(message.error)):task.resolve(message.value)})
  this.worker.on('error',error=>{for(const task of this.pending.values())task.reject(error);this.pending.clear()})
  this.worker.on('exit',code=>{if(code!==0){for(const task of this.pending.values())task.reject(new Error(`数据库进程退出：${code}`));this.pending.clear()}})
 }
 private call<T>(method:string,data?:unknown):Promise<T>{const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,method,data})})}
 load():Promise<LibraryState|null>{return this.call('load')}
 save(state:LibraryState):Promise<boolean>{return this.call('save',state)}
 query(sql:string):Promise<any[]>{if(!/^\s*SELECT\b/i.test(sql))throw new Error('仅允许读取查询');return this.call('query',sql)}
 async close(){await this.call('close');await this.worker.terminate()}
}
