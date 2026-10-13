import { BrowserWindow, ipcMain, net, app } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID, createCipheriv, publicEncrypt, constants, randomBytes, createHash, createPublicKey } from 'node:crypto'
import { inflateSync, deflateSync, gzipSync, gunzipSync } from 'node:zlib'
import type { SourceScript, Track, Quality, Lyrics } from '../../../src/shared/types'
import { toScriptTrack } from '../../../src/shared/compat'

const MAX_BYTES=16_000_000
const PRELOAD=String.raw`
const {contextBridge,ipcRenderer}=require('electron');
let handler,initialized=false,alerted=false;
const EVENTS={request:'request',inited:'inited',updateAlert:'updateAlert'};
function tool(name,args){const result=ipcRenderer.sendSync('cj-source:tool',{name,args});if(!result||!result.ok)throw new Error(result?.error||'Tool failed');return result.value}
const api={version:'2.0.0',env:'desktop',EVENT_NAMES:EVENTS,currentScriptInfo:SCRIPT_INFO,
 on(event,fn){if(event!=='request'||typeof fn!=='function')return Promise.reject(new Error('The event is not supported: '+event));handler=fn;return Promise.resolve()},
 send(event,data){
  if(event==='inited'){if(initialized)return Promise.reject(new Error('Script is inited'));initialized=true;if(!data||typeof data.sources!=='object')return Promise.reject(new Error('Missing init sources'))}
  else if(event==='updateAlert'){if(alerted)return Promise.reject(new Error('The update alert can only be called once.'));alerted=true;if(!data||typeof data.log!=='string'||!data.log)return Promise.reject(new Error('log is required.'))}
  else return Promise.reject(new Error('The event is not supported: '+event));
  ipcRenderer.send('cj-source:send',{event,data});return Promise.resolve()
 },
 request(url,options,callback){
  if(typeof options==='function'){callback=options;options={}}if(typeof callback!=='function')throw new Error('Request callback is required');
  const id=Date.now()+':'+Math.random();let done=false;
  ipcRenderer.invoke('cj-source:http',{id,url,options:options||{}}).then(r=>{if(done)return;done=true;callback(null,r,r.body)},e=>{if(done)return;done=true;callback(new Error(e.message),null,null)});
  return()=>{if(done)return;ipcRenderer.send('cj-source:cancel',id)}
 },
 utils:{crypto:{aesEncrypt:(...a)=>tool('aes',a),rsaEncrypt:(...a)=>tool('rsa',a),randomBytes:(...a)=>tool('random',a),md5:(...a)=>tool('md5',a),sha256:(...a)=>tool('sha256',a)},buffer:{from:(...a)=>tool('buffer',a),bufToString:(...a)=>tool('string',a),concat:(...a)=>tool('concat',a)},zlib:{inflate:(...a)=>Promise.resolve().then(()=>tool('inflate',a)),deflate:(...a)=>Promise.resolve().then(()=>tool('deflate',a)),gzip:(...a)=>Promise.resolve().then(()=>tool('gzip',a)),gunzip:(...a)=>Promise.resolve().then(()=>tool('gunzip',a))}}
};
ipcRenderer.on('cj-source:request',async(_,data)=>{try{if(!handler)throw new Error('Request event is not defined');const value=await handler.call(api,{source:data.source,action:data.action,info:data.info});ipcRenderer.send('cj-source:response',{id:data.id,value})}catch(e){ipcRenderer.send('cj-source:response',{id:data.id,error:e?.message||String(e)})}});
contextBridge.exposeInMainWorld('lx',api);
`

export function runSourceTool(name:string,args:any[]):unknown {
 if(!Array.isArray(args)||Buffer.byteLength(JSON.stringify(args))>8_000_000)throw new Error('工具输入过大')
 const bytes=(value:any,encoding?:BufferEncoding)=>{const b=typeof value==='string'?Buffer.from(value,encoding):Buffer.from(value);if(b.length>MAX_BYTES)throw new Error('工具输入过大');return b}
 switch(name){
  case 'aes':{if(!/^aes-(128|192|256)-(ecb|cbc|ctr|cfb|ofb)$/.test(args[1]))throw new Error('Unsupported AES mode');const c=createCipheriv(args[1],bytes(args[2]),args[3]==null?null:bytes(args[3]));return Buffer.concat([c.update(bytes(args[0])),c.final()])}
  case 'rsa':{const key=createPublicKey(args[1]),length=Math.ceil((key.asymmetricKeyDetails?.modulusLength??1024)/8),data=bytes(args[0]);if(length!==128||data.length>length)throw new Error('LX RSA requires a 1024-bit public key and at most 128 input bytes');return publicEncrypt({key,padding:constants.RSA_NO_PADDING},Buffer.concat([Buffer.alloc(length-data.length),data]))}
  case 'random':if(!Number.isInteger(args[0])||args[0]<0||args[0]>65536)throw new Error('Invalid random size');return randomBytes(args[0])
  case 'md5':case 'sha256':return createHash(name).update(bytes(args[0])).digest('hex')
  case 'buffer':{if(args[0] instanceof ArrayBuffer){if(args[0].byteLength>MAX_BYTES)throw new Error('工具输入过大');return Buffer.from(args[0],args[1],args[2])}return bytes(args[0],args[1])}
  case 'string':return bytes(args[0],typeof args[0]==='string'?'binary':undefined).toString(args[1]||'utf8')
  case 'concat':{if(!Array.isArray(args[0]))throw new Error('Invalid buffer list');if(args[1]!=null&&(!Number.isInteger(args[1])||args[1]<0||args[1]>MAX_BYTES))throw new Error('Invalid buffer output size');const values=args[0].map((v:any)=>bytes(v));if(values.reduce((n:number,b:Buffer)=>n+b.length,0)>MAX_BYTES)throw new Error('工具输入过大');return Buffer.concat(values,args[1])}
  case 'inflate':return inflateSync(bytes(args[0]),{maxOutputLength:MAX_BYTES})
  case 'deflate':return deflateSync(bytes(args[0]))
  case 'gzip':return gzipSync(bytes(args[0]))
  case 'gunzip':return gunzipSync(bytes(args[0]),{maxOutputLength:MAX_BYTES})
  default:throw new Error('Unsupported source tool')
 }
}
const getMetadata=(raw:string,key:string)=>raw.match(new RegExp('^[ \\t]*\\*?\\s*@'+key+'\\s+([^\\r\\n]+)','mi'))?.[1]?.trim()||''
export function parseSource(raw:string):SourceScript {
 if(raw.length>9_000_000)throw new Error('音源文件超过大小限制');if(!raw.trim())throw new Error('音源文件为空')
 return {id:randomUUID(),name:getMetadata(raw,'name')||'未命名音源',description:getMetadata(raw,'description'),version:getMetadata(raw,'version')||'1.0.0',author:getMetadata(raw,'author')||'未知作者',homepage:getMetadata(raw,'homepage'),script:raw,enabled:false,status:'未启用'}
}
export class SourceRuntime {
 private win?:BrowserWindow
 private current?:SourceScript
 private pending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>()
 private requests=new Map<string,AbortController>()
 private init?:{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}
 private destroyed=false
 private generation=0
 constructor(private onUpdate:(script:SourceScript)=>void,private deadlines:{initTimeout?:number;requestTimeout?:number}={}){
  ipcMain.on('cj-source:send',this.onSend);ipcMain.on('cj-source:response',this.onResponse);ipcMain.on('cj-source:cancel',this.onCancel);ipcMain.on('cj-source:tool',this.onTool);ipcMain.handle('cj-source:http',this.onHTTP)
 }
 private owns=(event:Electron.IpcMainEvent|Electron.IpcMainInvokeEvent)=>!!this.win&&!this.win.isDestroyed()&&event.sender.id===this.win.webContents.id&&event.senderFrame===this.win.webContents.mainFrame
 private update(){if(this.current)this.onUpdate(structuredClone(this.current))}
 private onSend=(event:Electron.IpcMainEvent,message:any)=>{
  if(!this.owns(event)||!this.current)return
  if(message?.event==='inited'){
   if(!this.init)return
   try{
    const sources:NonNullable<SourceScript['sources']>={}
    for(const [id,capability]of Object.entries(message.data?.sources||{})){
     const cap=capability as any;if(!['kw','kg','tx','wy','mg','local'].includes(id)||cap?.type!=='music')continue
     if(!Array.isArray(cap.actions)||!Array.isArray(cap.qualitys))throw new Error('音源能力格式错误')
     const allowed=id==='local'?['musicUrl','lyric','pic']:['musicUrl']
     sources[id]={type:'music',actions:allowed.filter(v=>cap.actions.includes(v)),qualitys:id==='local'?[]:['128k','320k','flac','flac24bit'].filter(v=>cap.qualitys.includes(v)) as Quality[]}
    }
    if(!Object.keys(sources).length)throw new Error('音源没有提供有效的平台能力')
    this.current.sources=sources;this.current.enabled=true;this.current.status='已就绪';this.update();clearTimeout(this.init.timer);this.init.resolve();this.init=undefined
    if(message.data.openDevTools===true)this.win?.webContents.openDevTools({mode:'detach'})
   }catch(error:any){this.fail(error.message);this.win?.destroy();this.win=undefined}
  }else if(message?.event==='updateAlert'){
   if(typeof message.data?.log!=='string'||!message.data.log)return
   this.current.updateLog=message.data.log.slice(0,4096);this.current.updateURL=undefined
   try{const url=new URL(message.data.updateUrl);if(['http:','https:'].includes(url.protocol)&&url.href.length<=2048)this.current.updateURL=url.href}catch{}
   this.current.status=`音源更新：${message.data.log.slice(0,1024)}`;this.update()
  }
 }
 private onResponse=(event:Electron.IpcMainEvent,message:any)=>{
  if(!this.owns(event))return;const pending=this.pending.get(message?.id);if(!pending)return
  clearTimeout(pending.timer);this.pending.delete(message.id);if(message.error)pending.reject(new Error(String(message.error)));else pending.resolve(message.value)
 }
 private onCancel=(event:Electron.IpcMainEvent,id:string)=>{if(this.owns(event))this.requests.get(id)?.abort(new Error('Request cancelled'))}
 private onTool=(event:Electron.IpcMainEvent,input:any)=>{
  if(!this.owns(event)){event.returnValue={ok:false,error:'非法音源调用'};return}
  try{event.returnValue={ok:true,value:runSourceTool(input.name,input.args)}}catch(error:any){event.returnValue={ok:false,error:error.message}}
 }
 private onHTTP=async(event:Electron.IpcMainInvokeEvent,input:any)=>{
  if(!this.owns(event))throw new Error('非法音源调用')
  if(typeof input.url!=='string'||!/^https?:\/\//i.test(input.url)||input.url.length>8192)throw new Error('仅支持 HTTP/HTTPS 音源请求')
  if(typeof input.id!=='string'||this.requests.has(input.id)||this.requests.size>=64)throw new Error('音源请求过多')
  const options=input.options||{},controller=new AbortController();this.requests.set(input.id,controller)
  const duration=typeof options.timeout==='number'&&options.timeout>0?Math.min(60_000,options.timeout):60_000
  const timer=setTimeout(()=>controller.abort(new Error('Request timeout')),duration)
  try{
   const headers=new Headers(options.headers||{});let body:any=options.body
   if(body==null&&options.form){body=new URLSearchParams(Object.entries(options.form).flatMap(([key,value])=>Array.isArray(value)?value.map(v=>[key,String(v)]):[[key,String(value)]])).toString();if(!headers.has('content-type'))headers.set('content-type','application/x-www-form-urlencoded')}
   if(body==null&&options.formData){const form=new FormData();for(const [key,value]of Object.entries(options.formData)){if(value&&typeof value==='object'&&'buffer'in value){const item=value as any;form.append(key,new Blob([new Uint8Array(item.buffer)],{type:item.content_type||'application/octet-stream'}),item.filename||'upload.bin')}else form.append(key,String(value))}body=form}
   if(body&&typeof body==='object'&&!(body instanceof Uint8Array)&&!(body instanceof FormData)){body=JSON.stringify(body);if(!headers.has('content-type'))headers.set('content-type','application/json')}
   if(body instanceof Uint8Array||typeof body==='string')if(Buffer.byteLength(body)>MAX_BYTES)throw new Error('音源请求超过大小限制')
   const method=String(options.method||'GET').toUpperCase(),response=await net.fetch(input.url,{method,headers,body:['GET','HEAD'].includes(method)?undefined:body,signal:controller.signal})
   const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let size=0
   if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('音源响应超过大小限制')}chunks.push(part.value)}
   const raw=Buffer.concat(chunks.map(c=>Buffer.from(c))),text=raw.toString();let value:unknown=text;try{value=JSON.parse(text)}catch{}
   return {statusCode:response.status,statusMessage:response.statusText,headers:Object.fromEntries(response.headers),bytes:raw.length,raw,body:value}
  }finally{clearTimeout(timer);if(this.requests.get(input.id)===controller)this.requests.delete(input.id)}
 }
 private fail(message:string){
  if(this.current){this.current.enabled=false;this.current.status=message;this.update()}
  if(this.init){clearTimeout(this.init.timer);this.init.reject(new Error(message));this.init=undefined}
  for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(message))}this.pending.clear()
 }
 private close(){const win=this.win;this.win=undefined;win?.destroy();for(const request of this.requests.values())request.abort();this.requests.clear()}
 async importScript(raw:string):Promise<SourceScript>{return parseSource(raw)}
 async activate(script:SourceScript):Promise<void>{
  if(this.destroyed)throw new Error('音源运行器已关闭')
  const generation=++this.generation;this.fail('音源已切换');this.close();this.current=structuredClone(script);this.current.enabled=false;this.current.status='正在初始化';this.update()
  const initialized=new Promise<void>((resolve,reject)=>{this.init={resolve,reject,timer:setTimeout(()=>{if(generation!==this.generation)return;this.fail('音源初始化超时');this.close()},this.deadlines.initTimeout??15_000)}});void initialized.catch(()=>{})
  try{
   const directory=path.join(app.getPath('userData'),'runtime');await mkdir(directory,{recursive:true})
   const preload=path.join(directory,`source-${generation}.cjs`),info={name:script.name,description:script.description,version:script.version,author:script.author,homepage:script.homepage,rawScript:script.script}
   await writeFile(preload,PRELOAD.replace('SCRIPT_INFO',JSON.stringify(info)),'utf8')
   if(generation!==this.generation||this.destroyed){await initialized;return}
   const win=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true,partition:`chenjin-source-${generation}`}});this.win=win
   win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.on('will-attach-webview',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false))
   win.webContents.on('render-process-gone',()=>{if(generation===this.generation){this.fail('音源执行进程已退出，请重新启用');this.close()}})
   await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-eval\' \'unsafe-inline\'"><title>琛瑾音乐音源执行器</title>'))
   if(generation!==this.generation||win.isDestroyed()){await initialized;return}
   void win.webContents.executeJavaScript(script.script).catch(error=>{if(generation===this.generation&&!win.isDestroyed()){this.fail(`音源初始化失败：${error.message}`);this.close()}})
   await initialized
  }catch(error:any){if(generation===this.generation){this.fail(error.message);this.close()}throw error}
 }
 private async call(track:Track,action:string,quality?:Quality):Promise<any>{
  if(!this.win||!this.current?.enabled)throw new Error('请先在设置中导入并启用自定义音源')
  const capability=this.current.sources?.[track.source];if(!capability?.actions.includes(action))throw new Error('当前音源不支持该平台或功能');if(quality&&capability.qualitys.length&&!capability.qualitys.includes(quality))throw new Error('当前音源不支持所选音质')
  if(this.pending.size>=128)throw new Error('音源请求过多')
  const id=randomUUID(),generation=this.generation
  return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,timer:setTimeout(()=>{if(generation!==this.generation)return;this.fail('音源请求超时');this.close()},this.deadlines.requestTimeout??60_000)});this.win!.webContents.send('cj-source:request',{id,source:track.source,action,info:{type:quality,musicInfo:toScriptTrack(track)}})})
 }
 async request(track:Track,quality:Quality):Promise<string>{const value=await this.call(track,'musicUrl',track.source==='local'?undefined:quality);if(typeof value!=='string'||value.length>2048||!/^https?:\/\//i.test(value))throw new Error('音源返回了无效的音频链接');return value}
 async lyrics(track:Track):Promise<Lyrics>{const value=await this.call(track,'lyric');if(!value||typeof value.lyric!=='string'||value.lyric.length>51200)throw new Error('音源返回了无效歌词');return {lyric:value.lyric,tlyric:typeof value.tlyric==='string'&&value.tlyric.length<5120?value.tlyric:null,rlyric:typeof value.rlyric==='string'&&value.rlyric.length<5120?value.rlyric:null,lxlyric:typeof value.lxlyric==='string'&&value.lxlyric.length<8192?value.lxlyric:null}}
 async pic(track:Track):Promise<string>{const value=await this.call(track,'pic');if(typeof value!=='string'||value.length>2048||!/^https?:\/\//i.test(value))throw new Error('音源返回了无效图片链接');return value}
 dispose(){if(this.destroyed)return;this.destroyed=true;++this.generation;this.fail('音源已关闭');this.close();ipcMain.removeListener('cj-source:send',this.onSend);ipcMain.removeListener('cj-source:response',this.onResponse);ipcMain.removeListener('cj-source:cancel',this.onCancel);ipcMain.removeListener('cj-source:tool',this.onTool);ipcMain.removeHandler('cj-source:http')}
}
