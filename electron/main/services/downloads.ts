import { net } from 'electron'
import { mkdir, stat, open, rename, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type NodeID3 from 'node-id3'
import iconv from 'iconv-lite'
import type { LibraryState, Track, Quality, DownloadTask } from '../../../src/shared/types'
import { getLyrics } from './providers'
import { tagFlac } from './flac-tags'

export function safeFilename(value:string):string {return value.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,160)||'未命名歌曲'}
export class DownloadManager {
 private targetOwners=new Set<string>()
 private active=new Map<string,AbortController>()
 private disposed=false
 private tasks: DownloadTask[]
 constructor(private getState:()=>LibraryState,private save:(state:LibraryState)=>unknown,private resolveUrl:(track:Track,quality:Quality)=>Promise<string>,private emit:(event:string,data:any)=>void) {
  this.tasks=getState().downloads;for(const task of this.tasks)if(task.status==='running')task.status='queued'
  queueMicrotask(()=>this.pump())
 }
 private publish(){const state=this.getState();state.downloads=structuredClone(this.tasks);void Promise.resolve(this.save(state)).catch(error=>this.emit('app.error',{message:`下载状态保存失败：${String(error)}`}));this.emit('downloads.updated',this.tasks)}
 async add(tracks:Track[],quality:Quality,playlistName?:string):Promise<DownloadTask[]> {
  if(!this.getState().settings.downloadEnabled)throw new Error('请先在设置中启用下载')
  if(!this.getState().settings.downloadPath)throw new Error('请先在设置中选择下载目录')
  const added=tracks.filter(track=>track.source!=='local'&&!this.tasks.some(task=>task.track.id===track.id&&task.quality===quality&&['queued','running','paused'].includes(task.status))).map(track=>({id:randomUUID(),track,quality,playlistName,status:'queued' as const,progress:0,received:0,total:0,speed:0}))
  if(!added.length)throw new Error('本地歌曲不需要下载')
  this.tasks.push(...added);this.publish();this.pump();return added
 }
 async action(id:string,action:string):Promise<void> {
  if(id==='all'){
   if(!['pause','resume','cancel','remove'].includes(action))throw new Error('不支持的批量操作')
   for(const task of this.tasks){if(action==='resume'){if(task.status!=='completed'){task.status='queued';task.error=undefined}}else if(action==='pause'){if(task.status!=='completed'){task.status='paused';this.active.get(task.id)?.abort()}}else{task.status='cancelled';this.active.get(task.id)?.abort()}}
   if(action==='remove')this.tasks=[];this.publish();this.pump();return
  }
  const task=this.tasks.find(t=>t.id===id);if(!task)throw new Error('下载任务不存在')
  if(action==='pause'){task.status='paused';this.active.get(id)?.abort()}
  else if(action==='resume'||action==='retry'||action==='start'){if(task.status==='completed')return;task.status='queued';task.error=undefined}
  else if(action==='cancel'){task.status='cancelled';this.active.get(id)?.abort()}
  else if(action==='remove'){task.status='cancelled';this.active.get(id)?.abort();this.tasks=this.tasks.filter(t=>t.id!==id)}
  else throw new Error('不支持的下载操作')
  this.publish();this.pump()
 }
 private pump(){if(this.disposed)return;const concurrency=Math.min(10,Math.max(1,Number(this.getState().settings.downloadConcurrency)||3));for(const task of this.tasks){if(this.active.size>=concurrency)break;if(task.status==='queued'&&!this.active.has(task.id))void this.run(task)}}
 private async run(task:DownloadTask) {
  const controller=new AbortController();this.active.set(task.id,controller);task.status='running';task.error=undefined;this.publish()
  let ownedTarget:string|undefined
  let file:Awaited<ReturnType<typeof open>>|undefined
  try {
   const settings=this.getState().settings
   const ext=task.quality.startsWith('flac')?'flac':'mp3'
   const name=safeFilename(String(settings.downloadFileName || '{name} - {singer}').replaceAll('{name}',task.track.name).replaceAll('{singer}',task.track.singer).replaceAll('{album}',task.track.meta.albumName).replaceAll('{source}',task.track.source).replaceAll('{quality}',task.quality).replaceAll('{playlist}',task.playlistName||'').replace('歌名',task.track.name).replace('歌手',task.track.singer))
   const directory=settings.downloadGroupByList&&task.playlistName?path.join(settings.downloadPath,safeFilename(task.playlistName)):settings.downloadPath
   await mkdir(directory,{recursive:true})
   const target=task.path || path.join(directory,`${name}.${ext}`);task.path=target
   ownedTarget=path.resolve(target).toLowerCase();if(this.targetOwners.has(ownedTarget)){ownedTarget=undefined;throw new Error('同名文件正在下载，请等待完成或修改文件名模板后重试')}this.targetOwners.add(ownedTarget)
   const part=target+'.part'
   const exists=await stat(target).catch(()=>null)
   if(exists && settings.skipExisting){task.status='completed';task.progress=1;task.received=exists.size;task.total=exists.size;return}
   let received=(await stat(part).catch(()=>null))?.size || 0
   let response:Response|undefined
   for(let attempt=0;attempt<3;attempt++){
    if(controller.signal.aborted)throw new Error('已取消')
    task.url=await this.resolveUrl(task.track,task.quality)
    response=await net.fetch(task.url,{headers:received?{Range:`bytes=${received}-`}:{},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])})
    if(response.ok)break
    await response.body?.cancel()
    if(attempt===2)throw new Error(`下载失败：HTTP ${response.status}`)
   }
   if(!response?.body)throw new Error('下载响应为空')
   if(received && response.status===206){const start=response.headers.get('content-range')?.match(/^bytes (\d+)-/);if(!start||Number(start[1])!==received)throw new Error('服务器返回的断点位置不匹配，请重试')}
   if(received && response.status!==206)received=0
   const range=response.headers.get('content-range');const length=Number(response.headers.get('content-length'))||0
   task.total=range?Number(range.split('/')[1])||received+length:received+length;task.received=received
   file=await open(part,received?'a':'w')
   const reader=response.body.getReader();let last=Date.now();let lastBytes=received
   try {while(true){const item=await reader.read();if(item.done)break;if(controller.signal.aborted)throw new Error('已取消');await file.write(item.value);task.received+=item.value.length;task.progress=task.total?Math.min(.999,task.received/task.total):0;const now=Date.now();if(now-last>=400){task.speed=(task.received-lastBytes)*1000/(now-last);last=now;lastBytes=task.received;this.emit('downloads.updated',this.tasks)}}}finally{reader.releaseLock()}
   await file.sync();await file.close();file=undefined
   if(task.total && task.received<task.total)throw new Error('下载中断，可继续任务恢复')
   const lyrics=(settings.downloadLyrics || settings.embedLyrics)?await getLyrics(task.track).catch(()=>({lyric:'',tlyric:null,rlyric:null,lxlyric:null})):null
   let cover:Buffer|undefined
   if(settings.embedCover&&task.track.meta.picUrl)try{const image=await net.fetch(task.track.meta.picUrl,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(image.ok){const parts:Buffer[]=[];let size=0;for await(const chunk of image.body as any){const data=Buffer.from(chunk);size+=data.length;if(size>5_000_000)throw new Error('封面过大');parts.push(data)}cover=Buffer.concat(parts)}}catch{}
   const embeddedLyrics=settings.embedLyrics&&lyrics?[lyrics.lyric,settings.embedWordLyrics?lyrics.lxlyric:'',settings.embedTranslation?lyrics.tlyric:'',settings.embedRoman?lyrics.rlyric:''].filter(Boolean).join('\n\n'):undefined
    if(ext==='flac')await tagFlac(part,{title:task.track.name,artist:task.track.singer,album:task.track.meta.albumName,lyrics:embeddedLyrics,cover})
   if(ext==='mp3') {
    const tags:any={title:task.track.name,artist:task.track.singer,album:task.track.meta.albumName}
    if(embeddedLyrics)tags.unsynchronisedLyrics={language:'chi',text:embeddedLyrics}
    if(cover)tags.image=cover
    const {default:tagger}=await import('node-id3');const tagged=tagger.update(tags,part);if(tagged instanceof Error)throw tagged;if(tagged!==true)throw new Error('音频已下载，但标签写入失败')
   }
   if(lyrics?.lyric && settings.downloadLyrics){const encoding=settings.lyricEncoding==='gbk'?'gbk':'utf8';await writeFile(target.replace(/\.[^.]+$/,'.lrc'),iconv.encode(lyrics.lyric,encoding));if(lyrics.tlyric&&settings.downloadTranslation!==false)await writeFile(target.replace(/\.[^.]+$/,'.translation.lrc'),iconv.encode(lyrics.tlyric,encoding));if(lyrics.rlyric&&settings.downloadRoman!==false)await writeFile(target.replace(/\.[^.]+$/,'.roman.lrc'),iconv.encode(lyrics.rlyric,encoding));if(lyrics.lxlyric&&settings.downloadWordLyrics!==false)await writeFile(target.replace(/\.[^.]+$/,'.lx.lrc'),lyrics.lxlyric,'utf8')}
   if(controller.signal.aborted)throw new Error('已取消')
   await rename(part,target);task.status='completed';task.progress=1;task.speed=0
  } catch(error) {
   if(task.status==='running'){task.status=controller.signal.aborted?'paused':'failed';task.error=error instanceof Error?error.message:String(error)}
   task.speed=0
  } finally {await file?.close().catch(()=>{});if(ownedTarget)this.targetOwners.delete(ownedTarget);this.active.delete(task.id);this.publish();this.pump()}
 }
 dispose(){this.disposed=true;for(const [id,controller] of this.active){const task=this.tasks.find(t=>t.id===id);if(task?.status==='running')task.status='paused';controller.abort()}this.publish()}
}
