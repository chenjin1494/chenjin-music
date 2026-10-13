import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, shell, net } from 'electron'
import { createReadStream, mkdirSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { parseFile } from 'music-metadata'
import type { LibraryState, PlayerStatus, Quality, Settings, SourceId, Track } from '../../src/shared/types'
import { formatTime } from '../../src/shared/defaults'
import { readLocalLyrics } from './services/local-lyrics'
import { LyricCache } from './services/lyric-cache'
import { LibraryStore, MemoryCache, normalizeTrack } from './services/library'
import { exportBackup, exportBackupText, importBackup } from './services/backup'
import { restoreBackup } from './services/backup-scope'
import { importLegacyDirectory } from './services/legacy-import'
import { fetchText } from './services/network'
import { gzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
import { DesktopService } from './services/desktop'
import { OpenAPIService, initialPlayerStatus } from './services/open-api'
import * as providers from './services/providers'
import { SourceRuntime } from './services/source-runtime'
import { availableQuality } from '../../src/shared/compat'
import { sortTracks } from '../../src/shared/track-sort'
import { rankAlternativeTracks } from '../../src/shared/song-match'
import { isDisliked } from '../../src/shared/dislike'
import { parseDeepLink } from './services/deeplink'
import { parseStartup,parsePlaylistLaunch } from './services/startup'
import { DownloadManager } from './services/downloads'
import { SyncService, type SyncMode } from './services/sync'
import { UpdateService } from './services/updates'
import { configureProxy } from './services/network'

if(process.platform==='win32')app.setAppUserModelId('com.chenjin.music')
const startup=parseStartup(process.argv)
if(startup.disableHardwareAcceleration)app.disableHardwareAcceleration()
if(startup.disableHardwareMediaKeys)app.commandLine.appendSwitch('disable-features','HardwareMediaKeyHandling')
const portableDirectory=process.env.PORTABLE_EXECUTABLE_DIR
const storageDirectory=!app.isPackaged&&process.env.CHENJIN_TEST_USER_DATA?process.env.CHENJIN_TEST_USER_DATA:portableDirectory?join(portableDirectory,'data'):undefined
if(storageDirectory){mkdirSync(storageDirectory,{recursive:true});app.setPath('userData',storageDirectory)}
protocol.registerSchemesAsPrivileged([{scheme:'chenjin-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}])
let mainWindow: BrowserWindow | undefined
let quitting=false
let library: LibraryStore
let runtime: SourceRuntime
let downloads: DownloadManager
let desktop: DesktopService
let api: OpenAPIService
let sync: SyncService
let updates: UpdateService
let lyricCache:LyricCache
let editedLyrics:LyricCache
let status: PlayerStatus={...initialPlayerStatus}
let lastProgressSave=0
let pendingFlush:{token:string,windowId:number,resolve:()=>void}|undefined
async function flushRenderer(){
 const win=mainWindow;if(!win||win.isDestroyed())return
 await new Promise<void>(resolve=>{const token=randomUUID(),timer=setTimeout(()=>{if(pendingFlush?.token===token)pendingFlush=undefined;resolve()},3000);pendingFlush={token,windowId:win.webContents.id,resolve:()=>{clearTimeout(timer);pendingFlush=undefined;resolve()}};win.webContents.send('app.flush',{token})})
}
const savePlaybackProgress=()=>{if(!library)return;const state=library.get();if(state.player&&state.settings.savePlayTime){void library.mutate(s=>{if(s.player)s.player.progress=Math.max(0,status.progress)}).catch(error=>emit('app.error',{message:`播放进度保存失败：${error}`}))}}
const cache=new MemoryCache()
const mediaFiles=new Map<string,string>()
const localFiles=new Set<string>()
const importedTracks=new Map<string,Track>()
const trustedWindows=new Set<number>()
const methods=new Set(['library.load','app.flushReady','library.save','settings.update','files.import','audio.importImpulse','theme.importImage','playlists.create','playlists.rename','playlists.remove','playlists.add','playlists.removeTracks','playlists.reorder','playlists.sort','playlists.dedupe','playlists.transfer','playlists.order','playlists.refresh','discovery.tags','search.playlists','metadata.detail','discovery.album','discovery.singer','backup.import','backup.importLegacyDirectory','backup.export','backup.exportText','sources.importURL','sources.import','sources.activate','sources.remove','search','discovery.playlists','discovery.playlist','discovery.boards','discovery.board','lyrics','lyrics.save','comments','search.hot','search.suggest','playback.resolve','playback.alternatives','playback.status','playback.command','downloads.add','downloads.action','desktop.lyric','desktop.lock','desktop.top','app.info','app.openExternal','app.openPath','app.selectDirectory','update.check','update.download','update.cancel','update.install','sync.status','sync.auth','sync.mode','sync.device.remove','cache.clear','cache.stats'])
const emit=(event:string,data:unknown)=>{for(const win of BrowserWindow.getAllWindows()){if(trustedWindows.has(win.webContents.id)&&!win.isDestroyed())win.webContents.send(event,data)}}
const command=(command:string,value?:unknown)=>{
 if(command==='windowMinimize'){mainWindow?.minimize();return}
 if(command==='windowToggleMin'){mainWindow?.isMinimized()?mainWindow.restore():mainWindow?.minimize();return}
 if(command==='windowToggleHide'){mainWindow?.isVisible()?mainWindow.hide():mainWindow?.show();return}
 if(command==='windowClose'){mainWindow?.close();return}
 if(command==='desktopLyric'){void updateSettings({desktopLyric:!library.get().settings.desktopLyric});return}
 if(command==='desktopLock'){desktop.setLock(!library.get().settings.desktopLyricLock);return}
 if(command==='desktopTop'){desktop.setTop(!library.get().settings.desktopLyricTop);return}
 if(command==='seekBack')command='seekBackward'
 if(command==='volumeUp'){command='volume';value=Math.min(1,status.volume+.05)}else if(command==='volumeDown'){command='volume';value=Math.max(0,status.volume-.05)}else if(command==='seekForward'){command='seek';value=Math.min(status.duration,status.progress+5)}else if(command==='seekBackward'){command='seek';value=Math.max(0,status.progress-5)}
 if(command==='quit'){quitting=true;app.quit();return}mainWindow?.webContents.send('player.command',{action:command,value})
}
const quality=(value:unknown):Quality=>{if(!['128k','320k','flac','flac24bit'].includes(String(value)))throw new Error('音质参数无效');return value as Quality}
const source=(value:unknown):SourceId=>{if(!['kw','kg','tx','wy','mg','local'].includes(String(value)))throw new Error('音乐平台参数无效');return value as SourceId}
const page=(value:unknown)=>Math.max(1,Math.floor(Number(value)||1))
const allowedURL=(url:string)=>{try{return ['https:','http:'].includes(new URL(url).protocol)}catch{return false}}
function secureWindow(win:BrowserWindow) {
 const windowId=win.webContents.id
 trustedWindows.add(windowId)
 win.on('closed',()=>trustedWindows.delete(windowId))
 win.webContents.setWindowOpenHandler(({url})=>{if(allowedURL(url))void shell.openExternal(url);return {action:'deny'}})
 win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL()){event.preventDefault();if(allowedURL(url))void shell.openExternal(url)}})
 win.webContents.on('will-attach-webview',event=>event.preventDefault())
 win.webContents.on('will-redirect',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault()})
 win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false))
 win.webContents.session.setPermissionCheckHandler(()=>false)
}
function loadRenderer(win:BrowserWindow,lyric=false) {
 const dev=process.env.ELECTRON_RENDERER_URL
 if(dev){const url=new URL(dev);if(lyric)url.searchParams.set('lyric','1');void win.loadURL(url.toString())}
 else void win.loadFile(join(__dirname,'../renderer/index.html'),lyric?{query:{lyric:'1'}}:undefined)
}
function createWindow(lyric=false) {
 const win=new BrowserWindow({width:lyric?900:1360,height:lyric?160:880,minWidth:lyric?400:960,minHeight:lyric?90:640,show:false,frame:false,transparent:lyric,backgroundColor:lyric?'#00000000':'#111118',resizable:true,skipTaskbar:lyric,alwaysOnTop:lyric,title:'琛瑾音乐',webPreferences:{preload:join(__dirname,'../preload/index.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false}})
 secureWindow(win);loadRenderer(win,lyric)
 if(!lyric)win.webContents.once('did-finish-load',()=>{const links=pendingDeepLinks;pendingDeepLinks=[];for(const link of links)handleDeepLink(link)})
 win.once('ready-to-show',()=>{if(lyric)win.showInactive();else {if(!startup.hidden)win.show();if(library.get().settings.startInFullscreen)win.setFullScreen(true);desktop?.status(status,library.get().settings)}win.webContents.send('lyric.status',status)})
 if(!lyric){let closing=false;win.on('close',event=>{if(quitting)return;event.preventDefault();if(library.get().settings.closeToTray&&library.get().settings.tray){win.hide();return}if(closing)return;closing=true;if(process.platform==='darwin')void flushRenderer().finally(()=>win.destroy());else app.quit()});win.on('closed',()=>{mainWindow=undefined})}
 return win
}
function assertSender(event:Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
 const win=BrowserWindow.fromWebContents(event.sender)
 if(!win||!trustedWindows.has(event.sender.id)||event.senderFrame!==event.sender.mainFrame)throw new Error('此页面无权调用桌面接口')
 const url=event.senderFrame?.url??''
 if(process.env.ELECTRON_RENDERER_URL){if(new URL(url).origin!==new URL(process.env.ELECTRON_RENDERER_URL).origin)throw new Error('接口来源不可信')}
 else {if(!url.startsWith('file:')||!url.split('?')[0].endsWith('/renderer/index.html'))throw new Error('接口来源不可信')}
}
async function registerMedia() {
 protocol.handle('chenjin-media',async request=>{
  const token=new URL(request.url).hostname
  const path=mediaFiles.get(token)
  if(!path)return new Response('媒体文件不存在',{status:404})
  if(/^https?:\/\//i.test(path)){
   try{
    const headers=new Headers();const range=request.headers.get('range');if(range)headers.set('Range',range)
    const response=await net.fetch(path,{method:request.method==='HEAD'?'HEAD':'GET',headers,signal:request.signal})
    const result=new Headers();for(const key of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']){const value=response.headers.get(key);if(value)result.set(key,value)}result.set('Cache-Control','no-store')
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:result})
   }catch{return new Response('在线音频连接失败',{status:502})}
  }
  try{
   const info=await stat(path);if(!info.isFile())return new Response('媒体文件不存在',{status:404})
   const headers:Record<string,string>={'Accept-Ranges':'bytes','Content-Type':({'.mp3':'audio/mpeg','.flac':'audio/flac','.wav':'audio/wav','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.opus':'audio/ogg','.wma':'audio/x-ms-wma'} as Record<string,string>)[extname(path).toLowerCase()]??'application/octet-stream','Cache-Control':'no-store'}
   let start=0,end=info.size-1,httpStatus=200
   const range=request.headers.get('range')
   if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}})
    if(!match[1])start=Math.max(0,info.size-Number(match[2]));else {start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}
    if(start> end||start>=info.size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}})
    httpStatus=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`
   }
   headers['Content-Length']=String(Math.max(0,end-start+1))
   if(request.method==='HEAD'||info.size===0)return new Response(null,{status:httpStatus,headers})
   const stream=createReadStream(path,{start,end});request.signal.addEventListener('abort',()=>stream.destroy(),{once:true})
   return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>,{status:httpStatus,headers})
  }catch{return new Response('无法读取媒体文件',{status:404})}
 })
}
async function resolveTrack(raw:Track,q:Quality,proxy=true):Promise<string> {
 const track=normalizeTrack(raw)
 if(track.source==='local'){
  const path=track.meta.filePath;if(!path)throw new Error('本地歌曲缺少文件路径')
  if(!['.mp3','.flac','.wav','.m4a','.aac','.ogg','.opus','.wma','.aiff','.aif'].includes(extname(path).toLowerCase()))throw new Error('此文件格式不能作为本地音频播放')
  const canonical=await realpath(path).catch(()=>null)
  const saved=library.get().playlists.some(list=>list.tracks.some(t=>t.source==='local'&&t.meta.filePath===path))||library.get().player?.queue.some(t=>t.source==='local'&&t.meta.filePath===path)
  if(!saved&&!localFiles.has(canonical||path))throw new Error('请先通过文件导入授权此音乐文件')
  if(!canonical){
   if(library.get().settings.autoSwitchSource===false)throw new Error('本地音乐文件已移动或不存在')
   const script=library.get().scripts.find(item=>item.enabled);if(script?.sources?.local?.actions.includes('musicUrl'))try{const url=await runtime.request(track,q);const token=randomUUID();mediaFiles.set(token,url);return proxy?`chenjin-media://${token}/stream`:url}catch{}
   const result=await providers.search('all',`${track.name} ${track.singer}`,1,10)
   for(const candidate of rankAlternativeTracks(track,result.list).slice(0,4))try{return await resolveTrack(candidate,q,proxy)}catch{}
   throw new Error('本地文件不存在，且没有可用的同曲播放来源')
  }
  const token=randomUUID();mediaFiles.set(token,canonical);if(mediaFiles.size>1000)mediaFiles.delete(mediaFiles.keys().next().value!)
  return `chenjin-media://${token}/audio${extname(canonical)}`
 }
 if(proxy&&library.get().settings.playDownloaded!==false){const completed=library.get().downloads.find(task=>task.track.id===track.id&&task.status==='completed'&&task.path);if(completed?.path)try{const file=await realpath(completed.path);const token=randomUUID();mediaFiles.set(token,file);return `chenjin-media://${token}/audio${extname(file)}`}catch{}}
 let url:unknown
 try{url=await runtime.request(track,proxy?availableQuality(track,q):q)}catch(failure){
  const state=library.get(),enabled=state.scripts.find(script=>script.enabled),allowed=proxy?state.settings.autoSwitchSource!==false:!!state.settings.downloadOtherSource
  if(!allowed||!enabled)throw failure
  const results=await providers.search('all',`${track.name} ${track.singer}`,1,10)
  const candidates=rankAlternativeTracks(track,results.list).filter(item=>!isDisliked(item,state.dislikes)&&enabled.sources?.[item.source]?.actions.includes('musicUrl')).slice(0,4)
  for(const candidate of candidates)try{url=await runtime.request(candidate,proxy?availableQuality(candidate,q):q);break}catch{}
  if(!url)throw failure
 }
 const value=typeof url==='string'?url:String((url as any)?.url??'')
 if(!allowedURL(value))throw new Error('音源返回了无效的播放地址')
 if(!proxy)return value
 const token=randomUUID();mediaFiles.set(token,value);if(mediaFiles.size>1000)mediaFiles.delete(mediaFiles.keys().next().value!)
 return `chenjin-media://${token}/stream`
}
async function chooseOpen(filters:Electron.FileFilter[],multiple=false) {const options:Electron.OpenDialogOptions={filters,properties:multiple?['openFile','multiSelections']:['openFile']};const result=mainWindow?await dialog.showOpenDialog(mainWindow,options):await dialog.showOpenDialog(options);return result.canceled?[]:result.filePaths}
async function importFiles(params:any):Promise<Track[]> {
 const paths=await chooseOpen([{name:'音乐文件',extensions:['mp3','flac','wav','m4a','aac','ogg','opus','wma','aiff']}],true)
 const tracks:Track[]=[];const failures:string[]=[]
 for(const file of paths){try{const path=await realpath(file);const meta=await parseFile(path,{duration:true});const id=`local:${createHash('sha256').update(path).digest('hex').slice(0,24)}`;tracks.push({id,name:meta.common.title||basename(path,extname(path)),singer:meta.common.artist||meta.common.artists?.join(' / ')||'未知歌手',source:'local',interval:formatTime(meta.format.duration||0),meta:{songId:id,albumName:meta.common.album||'',filePath:path,ext:extname(path).slice(1),duration:meta.format.duration,bitrate:meta.format.bitrate,picUrl:meta.common.picture?.[0]?`data:${meta.common.picture[0].format};base64,${Buffer.from(meta.common.picture[0].data).toString('base64')}`:null}});localFiles.add(path)}catch(error){failures.push(`${basename(file)}：${error instanceof Error?error.message:String(error)}`)}}
 if(!tracks.length&&failures.length)throw new Error(`音乐导入失败：${failures.join('；')}`)
 for(const track of tracks)importedTracks.set(track.id,track)
 if(params.playlistId??params.id)await library.add(params.playlistId??params.id,tracks)
 if(failures.length)emit('app.error',{message:`部分文件无法导入：${failures.join('；')}`})
 return tracks
}
async function cached<T>(key:string,load:()=>Promise<T>):Promise<T>{const value=cache.get<T>(key);if(value!==undefined)return value;const result=await load();cache.set(key,result);return result}
async function updateSettings(patch:Partial<Settings>) {const previous=library.get().settings;const next=await library.settings(patch);try{await api.configure(next);await sync.configure(next);await configureProxy(next.proxy);desktop.apply(next)}catch(error){await library.settings(previous);await api.configure(previous);await sync.configure(previous);await configureProxy(previous.proxy);desktop.apply(previous);throw error}if(app.isPackaged){if(next.associateLegacyScheme)app.setAsDefaultProtocolClient('lxmusic');else if(previous.associateLegacyScheme&&app.isDefaultProtocolClient('lxmusic'))app.removeAsDefaultProtocolClient('lxmusic')}return next}
async function invoke(method:string,input?:unknown,senderId?:number):Promise<unknown> {
 if(!methods.has(method))throw new Error('不允许调用此接口')
 const p=input==null?{}:input
 if(typeof p!=='object'||Array.isArray(p))throw new Error('接口参数必须为对象')
 const params=p as any;const id=String(params.playlistId??params.id??'')
 switch(method){
  case 'app.flushReady':{const pending=pendingFlush;if(pending&&pending.token===params.token&&pending.windowId===senderId){pending.resolve();return true}return false}
   case 'library.load':return library.get()
  case 'library.save':{const current=library.get();const supplied=params.state??params;const next=await library.save({...current,...supplied,downloads:current.downloads,scripts:current.scripts,editedLyrics:current.editedLyrics});await api.configure(next.settings);await sync.configure(next.settings);desktop.apply(next.settings);return next}
  case 'settings.update':return updateSettings(params.settings??params.patch??params)
  case 'theme.importImage':{const [file]=await chooseOpen([{name:'背景图片',extensions:['png','jpg','jpeg','webp','gif']}]);if(!file)return null;const info=await stat(file);if(info.size>8*1024*1024)throw new Error('背景图片不能超过 8 MB');const bytes=await readFile(file);const mime:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};return {name:basename(file),data:`data:${mime[extname(file).toLowerCase()]};base64,${bytes.toString('base64')}`}}
   case 'audio.importImpulse':{const [file]=await chooseOpen([{name:'混响脉冲响应',extensions:['wav','flac','ogg','mp3']}]);if(!file)return null;const info=await stat(file);if(info.size>10*1024*1024)throw new Error('脉冲响应文件不能超过 10 MB');const bytes=await readFile(file);return {name:basename(file),data:bytes.toString('base64')}}
   case 'files.import':return importFiles(params)
  case 'playlists.create':{const list=await library.create(params.name);if(params.source&&params.sourceListId){await library.mutate(state=>{const created=state.playlists.find(item=>item.id===list.id)!;created.source=source(params.source);created.sourceListId=String(params.sourceListId);created.locationUpdateTime=Date.now()})}return library.get().playlists.find(item=>item.id===list.id)}
  case 'playlists.rename':return library.rename(id,params.name)
  case 'playlists.remove':return library.remove(id)
  case 'playlists.add':if(!Array.isArray(params.tracks))throw new Error('请提供歌曲列表');return library.add(id,params.tracks)
  case 'playlists.removeTracks':if(!Array.isArray(params.trackIds??params.ids))throw new Error('请提供歌曲 ID 列表');return library.removeTracks(id,params.trackIds??params.ids)
  case 'playlists.reorder':if(!Array.isArray(params.trackIds??params.ids))throw new Error('请提供排序后的歌曲 ID 列表');return library.reorder(id,params.trackIds??params.ids)
  case 'playlists.transfer':if(!Array.isArray(params.trackIds))throw new Error('请提供歌曲 ID');return library.transfer(String(params.from),String(params.to),params.trackIds,!!params.move)
   case 'playlists.order':if(!Array.isArray(params.ids))throw new Error('请提供歌单顺序');return library.order(params.ids)
   case 'playlists.refresh':{
    const list=library.get().playlists.find(list=>list.id===id);if(!list?.source||!list.sourceListId)throw new Error('此歌单未关联在线歌单')
    providers.clearProviderCache();const detail=await providers.getPlaylist(list.source,list.sourceListId);await library.mutate(state=>{const target=state.playlists.find(list=>list.id===id)!;target.tracks=detail.tracks;target.locationUpdateTime=Date.now()});return library.get().playlists.find(list=>list.id===id)
   }
   case 'playlists.sort':return library.mutate(state=>{const list=state.playlists.find(item=>item.id===(params.playlistId??params.id));if(!list)throw new Error('歌单不存在');list.tracks=sortTracks(list.tracks,params.field,params.direction??'asc');return list})
   case 'playlists.dedupe':return library.dedupe(id)
  case 'backup.exportText':{
    const state=library.get();if(params.format==='txt')return state.playlists.map(list=>`${list.name}\n${list.tracks.map(track=>`${track.name} - ${track.singer}`).join('\n')}`).join('\n\n')
    if(params.format==='csv'){const cell=(value:unknown)=>`"${String(value||'').replaceAll('"','""')}"`;return '\uFEFF歌单,歌名,歌手,专辑,来源\r\n'+state.playlists.flatMap(list=>list.tracks.map(track=>[list.name,track.name,track.singer,track.meta.albumName,track.source].map(cell).join(','))).join('\r\n')}
    return exportBackupText(state)
   }
  case 'backup.importLegacyDirectory':{
    const selected=await dialog.showOpenDialog(mainWindow!,{title:'选择 LX Music 数据目录',properties:['openDirectory']});if(selected.canceled)return null
    const state=await importLegacyDirectory(selected.filePaths[0]);await exportBackup(join(app.getPath('userData'),`before-import-${Date.now()}.cjmc`),library.get())
    downloads.dispose();downloadGeneration++;await runtime.dispose();await library.save(state);runtime=createSourceRuntime();downloads=createDownloadManager();await sync.configure(state.settings);await api.configure(state.settings);await sync.configure(state.settings);desktop.apply(state.settings);return library.get()
   }
   case 'backup.export':{
    const state=library.get();const lx=params.format==='lx';const options:Electron.SaveDialogOptions={defaultPath:`琛瑾音乐-${params.scope || 'all'}-${Date.now()}.${lx?'lxmc':'cjmc'}`};const result=await dialog.showSaveDialog(mainWindow!,options);if(result.canceled||!result.filePath)return null
    if(lx){const lists=state.playlists.map(({tracks,...info})=>({...info,list:tracks}));const data:any=params.scope==='settings'?{type:'setting_v2',data:state.settings}:params.scope==='playlist'?{type:'playListPart_v2',data:lists.find(list=>list.id===params.playlistId)}:{type:'allData_v2',setting:state.settings,playList:lists};if(params.scope==='playlist'&&!data.data)throw new Error('歌单不存在');await writeFile(result.filePath,gzipSync(JSON.stringify(data)));return result.filePath}
    if(params.scope==='settings'||params.scope==='playlist'){const data=params.scope==='settings'?{settings:state.settings}:{playlists:state.playlists.filter(list=>list.id===params.playlistId)};await writeFile(result.filePath,gzipSync(JSON.stringify({format:'chenjin-music',version:1,scope:params.scope,exportedAt:new Date().toISOString(),data})));return result.filePath}
    return exportBackup(result.filePath,state,true)
   }
  case 'backup.import':{const [path]=await chooseOpen([{name:'音乐库备份',extensions:['gz','json','lxmc','cjm','bak']}]);if(!path)return null;const bytes=await readFile(path);const state=restoreBackup(bytes,library.get(),!!params.merge);await exportBackup(join(app.getPath('userData'),`before-restore-${Date.now()}.cjmc`),library.get());downloads.dispose();downloadGeneration++;await runtime.dispose();runtime=createSourceRuntime();await library.save(state);downloads=createDownloadManager();await api.configure(state.settings);await sync.configure(state.settings);desktop.apply(state.settings);const active=state.scripts.find(x=>x.enabled);if(active)await runtime.activate(active);return library.get()}
  case 'sources.importURL':{const url=String(params.url||'');if(!allowedURL(url))throw new Error('音源地址必须为 HTTP 或 HTTPS');const raw=await fetchText(url);if(raw.length>9_000_000)throw new Error('音源脚本过大');const script=await runtime.importScript(raw);await library.mutate(state=>{const index=state.scripts.findIndex(item=>item.id===script.id);if(index<0)state.scripts.push(script);else state.scripts[index]=script});emit('sources.updated',library.get().scripts);return script}
   case 'sources.import':{let raw=params.raw??params.script;if(typeof raw!=='string'){const [path]=await chooseOpen([{name:'音源脚本',extensions:['js']}]);if(!path)return null;raw=await readFile(path,'utf8')}const script=await runtime.importScript(raw);await library.mutate(s=>{const old=s.scripts.findIndex(x=>x.id===script.id);if(old<0)s.scripts.push(script);else s.scripts[old]=script});emit('sources.updated',library.get().scripts);return script}
  case 'sources.activate':{const script=library.get().scripts.find(x=>x.id===params.id);if(!script)throw new Error('音源脚本不存在');if(params.enabled===false){if(script.enabled){await runtime.dispose();runtime=createSourceRuntime()}await library.mutate(s=>{const target=s.scripts.find(x=>x.id===script.id)!;target.enabled=false;target.status='未启用'});emit('sources.updated',library.get().scripts);return library.get().scripts.find(x=>x.id===script.id)}await runtime.activate(script);await library.mutate(s=>{s.scripts=s.scripts.map(x=>({...x,enabled:x.id===script.id,status:x.id===script.id?'已启用':'未启用'}))});emit('sources.updated',library.get().scripts);return library.get().scripts.find(x=>x.id===script.id)}
  case 'sources.remove':{const script=library.get().scripts.find(x=>x.id===params.id);if(!script)throw new Error('音源脚本不存在');if(script.enabled){await runtime.dispose();runtime=createSourceRuntime()}await library.mutate(s=>{s.scripts=s.scripts.filter(x=>x.id!==params.id)});emit('sources.updated',library.get().scripts);return true}
  case 'search':{const keyword=String(params.keyword??'').trim().slice(0,300);if(!keyword)throw new Error('请输入搜索关键词');const src=params.source==='all'?'all':source(params.source);const limit=Math.min(100,Math.max(1,Math.floor(Number(params.limit)||30)));const currentPage=page(params.page);if(library.get().settings.searchHistory)await library.mutate(s=>{s.searchHistory=[keyword,...s.searchHistory.filter(x=>x!==keyword)].slice(0,100)});if(src==='local'){const pool=new Map<string,Track>();for(const list of library.get().playlists)for(const track of list.tracks)if(track.source==='local')pool.set(track.id,track);for(const track of importedTracks.values())pool.set(track.id,track);const term=keyword.toLocaleLowerCase();const matches=[...pool.values()].filter(t=>`${t.name} ${t.singer} ${t.meta.albumName}`.toLocaleLowerCase().includes(term));return {list:matches.slice((currentPage-1)*limit,currentPage*limit),total:matches.length,page:currentPage,limit,source:src}}return cached(`search:${src}:${keyword}:${currentPage}:${limit}`,()=>providers.search(src,keyword,currentPage,limit))}
  case 'discovery.tags':return providers.getPlaylistTags(source(params.source))
   case 'search.playlists':return providers.searchPlaylists(String(params.source||'all'),String(params.keyword||''),page(params.page),Number(params.limit)||20)
   case 'metadata.detail':{const track=normalizeTrack(params.track??params);if(track.source==='local'){
     const filename=track.meta.filePath,state=library.get();if(!filename||(!localFiles.has(filename)&&!state.playlists.some(list=>list.tracks.some(item=>item.source==='local'&&item.meta.filePath===filename))&&!state.player?.queue.some(item=>item.source==='local'&&item.meta.filePath===filename)))throw new Error('请先导入授权本地歌曲')
     if(!track.meta.picUrl)try{track.meta.picUrl=await runtime.pic(track)}catch{}
     if(!track.meta.picUrl&&track.singer&&!track.singer.includes('未知'))try{const result=await providers.search('all',`${track.name} ${track.singer}`,1,10);const match=rankAlternativeTracks(track,result.list).find(item=>item.meta.picUrl);if(match)track.meta.picUrl=match.meta.picUrl}catch{}
     return track
    }return providers.getTrackDetails(track)}
   case 'discovery.album':return providers.getAlbum(source(params.source),String(params.id),page(params.page),Number(params.limit)||100)
   case 'discovery.singer':return providers.getSinger(source(params.source),String(params.id),page(params.page),Number(params.limit)||100)
   case 'discovery.playlists':return cached(`playlists:${JSON.stringify(params)}`,()=>providers.getPlaylists(source(params.source),page(params.page),params.tag,params.sort??'hot'))
  case 'discovery.playlist':return cached(`playlist:${JSON.stringify(params)}`,()=>providers.getPlaylist(source(params.source),String(params.id)))
  case 'discovery.boards':return cached(`boards:${params.source}`,()=>providers.getBoards(source(params.source)))
  case 'discovery.board':return cached(`board:${JSON.stringify(params)}`,()=>providers.getBoardTracks(source(params.source),String(params.id),page(params.page)))
  case 'lyrics.save':{const track=normalizeTrack(params.track);const fields=['lyric','tlyric','rlyric','lxlyric'] as const;const lyrics:any={};for(const field of fields){const value=params.lyrics?.[field];if(value!=null&&typeof value!=='string')throw new Error('歌词字段必须是文本');if(typeof value==='string'&&value.length>2_000_000)throw new Error('歌词文本过大');lyrics[field]=value||null}lyrics.lyric=lyrics.lyric||'';await library.mutate(state=>{state.editedLyrics={...state.editedLyrics,[track.id]:lyrics}});await editedLyrics.set(track,lyrics,true);return lyrics}
   case 'lyrics':{
    const track=normalizeTrack(params.track??params)
    if(params.resetEdited){await editedLyrics.remove(track);await library.mutate(state=>{if(state.editedLyrics)delete state.editedLyrics[track.id]})}
    else {const edited=library.get().editedLyrics?.[track.id]??await editedLyrics.get(track);if(edited)return edited}
    if(!params.refresh){const saved=await lyricCache.get(track);if(saved)return saved}
    if(track.source==='local'){
     const filename=track.meta.filePath;const state=library.get();const authorized=!!filename&&(localFiles.has(filename)||state.playlists.some(list=>list.tracks.some(item=>item.source==='local'&&item.meta.filePath===filename))||state.player?.queue.some(item=>item.source==='local'&&item.meta.filePath===filename))
     if(!authorized)throw new Error('请先导入授权本地歌曲')
     const local=await readLocalLyrics(track);if(local){await lyricCache.set(track,local);return local}
    }
    let result={lyric:''};let failure:unknown;try{result=await providers.getLyrics(track);if(result.lyric){await lyricCache.set(track,result);return result}}catch(error){failure=error}
    const script=library.get().scripts.find(x=>x.enabled);if(script?.sources?.[track.source]?.actions.includes('lyric')){const lyrics=await runtime.lyrics(track);await lyricCache.set(track,lyrics);return lyrics}
    if(track.source==='local'){
     const alternatives=await providers.search('all',`${track.name} ${track.singer}`,1,10)
     for(const candidate of rankAlternativeTracks(track,alternatives.list).slice(0,5))try{const lyrics=await providers.getLyrics(candidate);if(lyrics.lyric||lyrics.lxlyric){await lyricCache.set(track,lyrics);return lyrics}}catch{}
    }
    if(failure)throw failure;return result
   }
  case 'comments':{const kind=params.kind??'normal';if(!['normal','hot','reply'].includes(kind))throw new Error('评论分类无效');return providers.getComments(normalizeTrack(params.track),page(params.page),kind,params.rootId)}
  case 'search.hot':{if(params.source==='local')return [];const src=source(params.source==='all'?'wy':params.source);return cached(`hot:${src}`,()=>providers.getHotSearch(src))}
  case 'search.suggest':{if(params.source==='local')return [...new Set(library.get().playlists.flatMap(p=>p.tracks).filter(t=>t.source==='local'&&t.name.toLocaleLowerCase().includes(String(params.keyword??'').toLocaleLowerCase())).map(t=>t.name))].slice(0,8);return providers.getSuggestions(source(params.source==='all'?'wy':params.source),String(params.keyword??''))}
  case 'playback.alternatives':{const track=normalizeTrack(params.track);const results=await providers.search('all',`${track.name} ${track.singer}`,1,10);return rankAlternativeTracks(track,results.list)}
   case 'playback.resolve':{const q=quality(params.quality??library.get().settings.quality);return resolveTrack(params.track,q)}
  case 'playback.status':{if(senderId!==mainWindow?.webContents.id)throw new Error('播放状态只能由主窗口提供');const raw=params.status&&typeof params.status==='object'?params.status:params;const next={...status};if(Array.isArray(raw.spectrum)&&raw.spectrum.length===16&&raw.spectrum.every((value:unknown)=>typeof value==='number'&&Number.isFinite(value)))next.spectrum=raw.spectrum.map((value:number)=>Math.max(0,Math.min(1,value)));else delete next.spectrum;for(const key of Object.keys(initialPlayerStatus) as (keyof PlayerStatus)[]){if(typeof raw[key]===typeof initialPlayerStatus[key])(next as any)[key]=raw[key]}if(!['playing','paused','stoped','loading','error'].includes(next.status))throw new Error('播放状态无效');status=next;if(Date.now()-lastProgressSave>5000){lastProgressSave=Date.now();savePlaybackProgress()}api.publish(status);desktop.status(status,library.get().settings);emit('player.status',status);emit('lyric.status',status);return true}
  case 'playback.command':{if(!['toggle','play','pause','stop','next','prev','previous','seek','volume','mute','collect','rate','mode'].includes(params.action))throw new Error('播放控制命令无效');mainWindow?.webContents.send('player.command',{action:params.action,value:params.value});return true}
  case 'downloads.add':if(!Array.isArray(params.tracks))throw new Error('请提供下载歌曲列表');return downloads.add(params.tracks,quality(params.quality??library.get().settings.quality),typeof params.playlistName==='string'?params.playlistName:params.playlistId?library.get().playlists.find(list=>list.id===params.playlistId)?.name:undefined)
  case 'downloads.action':return downloads.action(params.id,params.action)
  case 'desktop.lyric':await updateSettings({desktopLyric:!!params.enabled});return !!params.enabled
  case 'desktop.lock':return desktop.setLock(!!params.enabled)
  case 'desktop.top':return desktop.setTop(!!params.enabled)
  case 'app.selectDirectory':{const selected=await dialog.showOpenDialog(mainWindow!,{properties:['openDirectory','createDirectory']});return selected.canceled?null:selected.filePaths[0]}
   case 'app.info':return {name:app.getName(),version:app.getVersion(),platform:process.platform,userData:app.getPath('userData'),storage:'sqlite-worker',openAPI:{enabled:library.get().settings.openAPI,port:library.get().settings.openAPIPort}}
  case 'app.openExternal':{const url=new URL(String(params.url??''));if(!['http:','https:'].includes(url.protocol)||url.href.length>2048)throw new Error('仅支持 HTTP(S) 外部链接');await shell.openExternal(url.href);return true}
   case 'app.openPath':{const path=String(params.path??library.get().settings.downloadPath??'');if(!path)throw new Error('尚未设置下载目录');const info=await stat(path).catch(()=>{throw new Error('路径不存在')});if(info.isFile()){shell.showItemInFolder(path);return true}if(!info.isDirectory())throw new Error('只能打开文件或文件夹');const error=await shell.openPath(path);if(error)throw new Error(`无法打开路径：${error}`);return true}
  case 'cache.stats':return {online:cache.count(),lyrics:await lyricCache.count(),edited:await editedLyrics.count(Object.keys(library.get().editedLyrics||{}))}
   case 'cache.clear':{const scope=params.scope??'all';if(!['all','online','lyrics','edited'].includes(scope))throw new Error('缓存范围无效');if(scope==='edited'){if(params.confirm!==true)throw new Error('请确认清除已编辑歌词');await library.mutate(state=>{state.editedLyrics={}});await editedLyrics.clear()}else {if(scope==='all'||scope==='online'){cache.clear();providers.clearProviderCache()}if(scope==='all'||scope==='lyrics')await lyricCache.clear()}return true}
  case 'sync.status':return sync.getStatus()
   case 'sync.auth':return sync.authenticate(String(params.code || ''))
   case 'sync.mode':sync.chooseMode(params.mode as SyncMode);return sync.getStatus()
   case 'sync.device.remove':await sync.removeDevice(String(params.id));return sync.getStatus()
   case 'update.check':return updates.check(library.get().settings.updateURL)
   case 'update.download':return updates.download()
   case 'update.cancel':return updates.cancel()
   case 'update.install':return updates.install()
 }
}
let pendingDeepLinks:string[]=[]
function handleDeepLink(raw:string) {
 if(!mainWindow||mainWindow.webContents.isLoading()){pendingDeepLinks.push(raw);return}
 void (async()=>{
  const parsed=parseDeepLink(raw,!!library.get().settings.associateLegacyScheme)
  mainWindow?.show();mainWindow?.focus()
  if(parsed.type==='player'){const map:Record<string,string>={skipNext:'next',skipPrev:'prev',togglePlay:'toggle'};command(map[parsed.action]||parsed.action);return}
  if(parsed.type==='search'){mainWindow?.webContents.send('app.deeplink',{action:'search',source:parsed.source||'all',keyword:parsed.keyword});return}
  if(parsed.type==='music'){
   if(parsed.action==='play'){mainWindow?.webContents.send('app.deeplink',{action:'priorityPlay',tracks:parsed.tracks});return}
   const result=await providers.search('all',`${parsed.name} ${parsed.singer}`,1,20);const target:Track={id:'link',source:'local',name:parsed.name,singer:parsed.singer,interval:parsed.interval,meta:{songId:'',albumName:parsed.albumName}}
   const candidates=parsed.singer?rankAlternativeTracks(target,result.list):result.list.filter(track=>track.name.trim()===parsed.name.trim())
   if(!candidates.length)throw new Error('未找到匹配的歌曲');mainWindow?.webContents.send('app.deeplink',{action:parsed.playLater?'priorityLater':'priorityPlay',tracks:[candidates[0]]});return
  }
  const result=await providers.getPlaylist(parsed.source,parsed.link)
  if(parsed.action==='open')mainWindow?.webContents.send('app.deeplink',{action:'openOnline',source:parsed.source,id:result.info.id})
  else mainWindow?.webContents.send('app.deeplink',{action:'playList',tracks:result.tracks,index:Math.max(0,Math.min(result.tracks.length-1,(parsed.index||1)-1))})
 })().catch(error=>emit('app.error',{message:`链接打开失败：${error instanceof Error?error.message:String(error)}`}))
}
async function handleStartupArgs(args:string[]){
 const options=parseStartup(args)
 for(const link of options.links)handleDeepLink(link)
 if(options.search)handleDeepLink(`chenjinmusic://search?source=all&keyword=${encodeURIComponent(options.search)}`)
 if(options.play){const launch=parsePlaylistLaunch(options.play);if(launch)try{let tracks:Track[]=[]
  if(launch.source==='myList')tracks=library.get().playlists.find(list=>list.name===launch.name)?.tracks || []
  else if(launch.link)tracks=(await providers.getPlaylist(source(launch.source),launch.link)).tracks
  if(tracks.length){const index=Math.min(tracks.length-1,launch.index);mainWindow?.webContents.send('app.deeplink',{action:'playList',tracks,index})}
 }catch(error){emit('app.error',{message:`启动播放失败：${error}`})}}
}
let listRefreshTimer:ReturnType<typeof setInterval>|undefined
let refreshingLists=false
async function refreshAssociatedLists(){
 if(refreshingLists||!library.get().settings.autoUpdateLists)return
 refreshingLists=true
 try{for(const list of library.get().playlists){if(!list.source||!list.sourceListId||Date.now()-(list.locationUpdateTime||0)<3600000)continue;try{const result=await providers.getPlaylist(list.source,list.sourceListId);await library.mutate(state=>{const target=state.playlists.find(item=>item.id===list.id);if(target&&target.sourceListId===list.sourceListId){target.tracks=result.tracks;target.locationUpdateTime=Date.now()}})}catch(error){console.warn(`关联歌单 ${list.name} 更新失败`,String(error))}}}finally{refreshingLists=false}
}
let downloadGeneration=0
function createDownloadManager() {
 const generation=++downloadGeneration
 return new DownloadManager(()=>library.get(),async (state:LibraryState)=>{if(generation===downloadGeneration)await library.save(state)},(track,q)=>resolveTrack(track,q,false),(event:string,data:unknown)=>{if(generation===downloadGeneration)emit(event,data)})
}
function createSourceRuntime() {
 return new SourceRuntime(script=>{void library.mutate(s=>{const index=s.scripts.findIndex(x=>x.id===script.id);if(index>=0)s.scripts[index]=script}).then(()=>emit('sources.updated',library.get().scripts)).catch(error=>emit('app.error',{message:String(error)}))})
}
async function start() {
 library=new LibraryStore(join(app.getPath('userData'),'chenjin.data.db'),state=>{emit('library.updated',state);sync?.notifyLocalChange(state)});await library.load();if(startup.hidden&&!library.get().settings.tray)await library.settings({tray:true})
  sync=new SyncService(()=>library.get(),async patch=>{await library.mutate(state=>{if(patch.playlists)state.playlists=patch.playlists;if(patch.dislikes)state.dislikes=patch.dislikes})},emit,join(app.getPath('userData'),'sync'))
  updates=new UpdateService(emit)
  lyricCache=new LyricCache(join(app.getPath('userData'),'lyric-cache'))
  editedLyrics=new LyricCache(join(app.getPath('userData'),'lyrics-edited'))
  await configureProxy(library.get().settings.proxy)
 runtime=createSourceRuntime()
 downloads=createDownloadManager()
 desktop=new DesktopService(()=>mainWindow,()=>createWindow(true),command,{},async patch=>{await library.settings(patch)})
 api=new OpenAPIService(()=>status,command)
 await registerMedia()
 ipcMain.handle('chenjin:invoke',async(event,method,params)=>{try{assertSender(event);return await invoke(method,params,event.sender.id)}catch(error){throw new Error(error instanceof Error?`操作失败：${error.message}`:'操作失败，请重试')}})
 ipcMain.on('chenjin:window',(event,action)=>{try{assertSender(event);const win=BrowserWindow.fromWebContents(event.sender)!;switch(action){case 'minimize':win.minimize();break;case 'maximize':win.isMaximized()?win.unmaximize():win.maximize();break;case 'close':win.close();break;case 'fullscreen':win.setFullScreen(!win.isFullScreen());break}}catch{}})
 Menu.setApplicationMenu(null);if(app.isPackaged){app.setAsDefaultProtocolClient('chenjinmusic');if(library.get().settings.associateLegacyScheme)app.setAsDefaultProtocolClient('lxmusic')}mainWindow=createWindow();mainWindow.webContents.once('did-finish-load',()=>{setTimeout(()=>void handleStartupArgs(process.argv),500);if(startup.openDevTools)mainWindow?.webContents.openDevTools({mode:'detach'})});desktop.apply(library.get().settings);desktop.registerHotkeys()
 try{await api.configure(library.get().settings);await sync.configure(library.get().settings)}catch(error){emit('app.error',{message:String(error)})}
 listRefreshTimer=setInterval(()=>void refreshAssociatedLists(),300000);listRefreshTimer.unref()
 const active=library.get().scripts.find(x=>x.enabled);if(active)try{await runtime.activate(active)}catch(error){emit('app.error',{message:`音源初始化失败：${error}`})}
}
if(!app.requestSingleInstanceLock())app.quit()
else {
 app.on('open-url',(event,url)=>{event.preventDefault();handleDeepLink(url)})
 app.on('second-instance',(_event,args)=>{const options=parseStartup(args);if(!options.hidden){mainWindow?.show();mainWindow?.focus()}void handleStartupArgs(args)})
 void app.whenReady().then(start).catch(error=>{dialog.showErrorBox('琛瑾音乐启动失败',String(error));app.quit()})
 app.on('activate',()=>{if(!mainWindow)mainWindow=createWindow();else mainWindow.show()})
 app.on('window-all-closed',()=>{if(process.platform!=='darwin'&&!library?.get().settings.tray)app.quit()})
 let cleanupComplete=false,cleanupStarted=false
 app.on('before-quit',event=>{if(cleanupComplete)return;event.preventDefault();if(cleanupStarted)return;cleanupStarted=true;quitting=true;if(listRefreshTimer)clearInterval(listRefreshTimer);void (async()=>{await flushRenderer();desktop?.dispose();downloads?.dispose();runtime?.dispose();savePlaybackProgress();await Promise.all([library?.close(),api?.dispose(),sync?.dispose()])})().catch(error=>console.error('退出清理失败',error)).finally(()=>{cleanupComplete=true;app.quit()})})
}
