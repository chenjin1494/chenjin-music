import { app, net, shell } from 'electron'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

export interface UpdateFile {platform:string;arch:string;url:string;sha512:string;size:number}
export interface UpdateManifest {version:string;releaseNotes?:string;files:UpdateFile[]}
export const MAX_INSTALLER_BYTES=1024*1024*1024
export const MAX_MANIFEST_BYTES=1024*1024
interface Version {core:number[];prerelease:string[]}
function parseVersion(input:string):Version|undefined {
 const match=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(input)
 if(!match)return
 const core=match.slice(1,4).map(Number),prerelease=match[4]?.split('.')??[]
 if(core.some(x=>!Number.isSafeInteger(x))||prerelease.some(x=>/^\d+$/.test(x)&&x.length>1&&x[0]==='0'))return
 return {core,prerelease}
}
export function newerVersion(candidate:string,current:string):boolean {
 const a=parseVersion(candidate),b=parseVersion(current);if(!a||!b)return false
 for(let i=0;i<3;i++)if(a.core[i]!==b.core[i])return a.core[i]>b.core[i]
 if(!a.prerelease.length)return !!b.prerelease.length
 if(!b.prerelease.length)return false
 for(let i=0;i<Math.max(a.prerelease.length,b.prerelease.length);i++){
  const x=a.prerelease[i],y=b.prerelease[i];if(x===y)continue;if(x===undefined)return false;if(y===undefined)return true
  const nx=/^\d+$/.test(x),ny=/^\d+$/.test(y);if(nx&&ny)return BigInt(x)>BigInt(y);if(nx!==ny)return !nx;return x>y
 }
 return false
}
export function permittedUpdateURL(input:string,packaged=app.isPackaged):URL {
 let url:URL;try{url=new URL(input)}catch{throw new Error('更新地址格式无效')}
 if(url.username||url.password||input.length>8192)throw new Error('更新地址不能包含认证凭据或过长内容')
 if(url.protocol==='https:')return url
 if(!packaged&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))return url
 throw new Error('更新服务必须使用 HTTPS；开发测试仅允许本机 HTTP')
}
export function expectedDigest(value:string):Buffer {
 if(typeof value!=='string')throw new Error('安装包缺少 SHA-512 校验信息')
 if(/^[a-f0-9]{128}$/i.test(value))return Buffer.from(value,'hex')
 if(/^[A-Za-z0-9+/]{86}==$/.test(value)){const bytes=Buffer.from(value,'base64');if(bytes.length===64&&bytes.toString('base64')===value)return bytes}
 throw new Error('安装包 SHA-512 必须为128位十六进制或规范Base64')
}
export function validateManifest(raw:unknown,base:string,packaged=app.isPackaged):UpdateManifest {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('版本清单格式无效')
 const input=raw as any
 if(typeof input.version!=='string'||!parseVersion(input.version)||input.version.length>120)throw new Error('版本清单包含无效版本号')
 if(input.releaseNotes!==undefined&&(typeof input.releaseNotes!=='string'||input.releaseNotes.length>100000))throw new Error('版本说明格式无效或过长')
 if(!Array.isArray(input.files)||input.files.length>32)throw new Error('版本清单必须包含有效的安装包列表')
 const pairs=new Set<string>()
 const files=input.files.map((rawFile:any)=>{
  if(!rawFile||typeof rawFile!=='object'||!['win32','darwin','linux'].includes(rawFile.platform)||!['x64','arm64','ia32','armv7l'].includes(rawFile.arch))throw new Error('安装包平台或架构无效')
  if(typeof rawFile.url!=='string'||!Number.isSafeInteger(rawFile.size)||rawFile.size<=0||rawFile.size>MAX_INSTALLER_BYTES)throw new Error('安装包大小或地址无效，最大允许1GB')
  expectedDigest(rawFile.sha512)
  const url=permittedUpdateURL(new URL(rawFile.url,base).toString(),packaged).toString(),key=`${rawFile.platform}:${rawFile.arch}`
  if(pairs.has(key))throw new Error('版本清单包含重复平台安装包');pairs.add(key)
  return {platform:rawFile.platform,arch:rawFile.arch,url,sha512:rawFile.sha512,size:rawFile.size} as UpdateFile
 })
 return {version:input.version,releaseNotes:input.releaseNotes??'',files}
}
interface ReadyInstaller {path:string;version:string;file:UpdateFile}
export class UpdateService {
 private manifest?:UpdateManifest
 private ready?:ReadyInstaller
 private controller?:AbortController
 private checking=false
 private installing=false
 private generation=0
 constructor(private emit:(event:string,data:unknown)=>void){}
 private async fetch(url:string,signal:AbortSignal):Promise<Response>{
  let current=permittedUpdateURL(url).toString()
  for(let redirect=0;redirect<=5;redirect++){
   const response=await net.fetch(current,{signal,redirect:'manual',headers:{'Accept-Encoding':'identity'}}).catch(error=>{if(/redirect/i.test(String(error?.message)))throw new Error('更新服务跳转已拒绝，请提供直接HTTPS地址');throw error})
   if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('更新服务返回无效跳转');current=permittedUpdateURL(new URL(location,current).toString()).toString();continue}
   if(!response.ok){await response.body?.cancel();throw new Error(`更新服务返回 HTTP ${response.status}`)}
   if(response.url)permittedUpdateURL(response.url)
   return response
  }
  throw new Error('更新服务跳转次数过多')
 }
 async check(url:string){
  if(this.checking||this.controller||this.installing)throw new Error('更新操作正在进行，请稍后再试')
  this.checking=true;this.manifest=undefined;this.ready=undefined;const generation=++this.generation
  const controller=new AbortController();this.controller=controller;const timer=setTimeout(()=>controller.abort(),15000)
  try{
   if(!url)return {available:false,message:'尚未配置更新源',currentVersion:app.getVersion()}
   permittedUpdateURL(url)
   const response=await this.fetch(url,controller.signal)
   if(Number(response.headers.get('content-length'))>MAX_MANIFEST_BYTES){await response.body?.cancel();throw new Error('版本清单超过1MB限制')}
   const reader=response.body?.getReader();if(!reader)throw new Error('更新服务返回空清单')
   const chunks:Uint8Array[]=[];let size=0
   try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>MAX_MANIFEST_BYTES){await reader.cancel();throw new Error('版本清单超过1MB限制')}chunks.push(chunk.value)}}finally{reader.releaseLock()}
   let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks.map(c=>Buffer.from(c))).toString('utf8').replace(/^\uFEFF/,''))}catch{throw new Error('更新服务未返回有效JSON清单')}
   const manifest=validateManifest(raw,url)
   if(generation!==this.generation)throw new Error('更新检查已取消')
   this.manifest=manifest;const available=newerVersion(manifest.version,app.getVersion()),artifact=manifest.files.find(f=>f.platform===process.platform&&f.arch===process.arch)
   return {available,version:manifest.version,currentVersion:app.getVersion(),releaseNotes:manifest.releaseNotes??'',supported:!!artifact,message:available?(artifact?'有可用更新':'该平台暂无更新安装包'):'已是最新版本'}
  }catch(error){if(controller.signal.aborted)throw new Error('更新检查超时或已取消');throw error}finally{clearTimeout(timer);this.checking=false;if(this.controller===controller)this.controller=undefined}
 }
 async download(){
  if(this.checking||this.installing||this.controller)throw new Error('更新操作正在进行，请稍后再试')
  const manifest=this.manifest,file=manifest?.files.find(f=>f.platform===process.platform&&f.arch===process.arch)
  if(!manifest||!file||!newerVersion(manifest.version,app.getVersion()))throw new Error('请先检查更新并确认有较新版本的当前平台安装包')
  this.ready=undefined;const generation=++this.generation,controller=new AbortController();this.controller=controller
  let temporary:string|undefined,reader:ReadableStreamDefaultReader<Uint8Array>|undefined,handle:Awaited<ReturnType<typeof open>>|undefined
  let timer:ReturnType<typeof setTimeout>|undefined
  const resetIdle=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('idle timeout')),30000)}
  resetIdle()
  try{
   const response=await this.fetch(file.url,controller.signal)
   const contentLength=response.headers.get('content-length');if(contentLength&&Number(contentLength)!==file.size){await response.body?.cancel();throw new Error('安装包响应大小与清单不一致')}
   reader=response.body?.getReader();if(!reader)throw new Error('安装包响应为空')
   const folder=path.join(app.getPath('userData'),'updates');await mkdir(folder,{recursive:true})
   const extension=path.extname(new URL(file.url).pathname).toLowerCase();const safeExtension=/^\.[a-z0-9]{1,12}$/.test(extension)?extension:'.bin'
   const target=path.join(folder,`chenjin-${manifest.version}-${process.arch}-${randomUUID()}${safeExtension}`)
   temporary=`${target}.part`;handle=await open(temporary,'wx')
   const hash=createHash('sha512');let size=0,last=0
   while(true){const chunk=await reader.read();resetIdle();if(chunk.done)break;const data=Buffer.from(chunk.value);size+=data.length;if(size>file.size||size>MAX_INSTALLER_BYTES)throw new Error('安装包超出声明大小');hash.update(data);let offset=0;while(offset<data.length){const written=await handle.write(data,offset,data.length-offset);if(!written.bytesWritten)throw new Error('安装包写入失败');offset+=written.bytesWritten}const now=Date.now();if(now-last>=300){last=now;this.emit('update.progress',{received:size,total:file.size,progress:size/file.size})}}
   const digest=hash.digest(),expected=expectedDigest(file.sha512)
   if(size!==file.size||!timingSafeEqual(digest,expected))throw new Error('安装包大小或SHA-512校验失败，请重新下载')
   if(controller.signal.aborted||generation!==this.generation)throw new Error('更新下载已取消')
   await handle.sync();await handle.close();handle=undefined;await rename(temporary,target);temporary=undefined
   if(controller.signal.aborted||generation!==this.generation){await rm(target,{force:true});throw new Error('更新下载已取消')}
   this.ready={path:target,version:manifest.version,file};this.emit('update.progress',{received:size,total:file.size,progress:1});this.emit('update.ready',{path:target,version:manifest.version});return {path:target,version:manifest.version}
  }catch(error){this.ready=undefined;if(controller.signal.aborted)throw new Error('更新下载已取消或网络闲置超时');throw error}
  finally{if(timer)clearTimeout(timer);await reader?.cancel().catch(()=>{});reader?.releaseLock();await handle?.close().catch(()=>{});if(temporary)await rm(temporary,{force:true}).catch(()=>{});if(this.controller===controller)this.controller=undefined}
 }
 cancel(){if(this.controller){this.generation++;this.ready=undefined;this.controller.abort()}return true}
 async install(){
  if(this.checking||this.controller||this.installing)throw new Error('更新操作正在进行，请稍后再试')
  const ready=this.ready;if(!ready)throw new Error('尚未下载并校验更新')
  this.installing=true
  try{
   const info=await stat(ready.path);if(!info.isFile()||info.size!==ready.file.size)throw new Error('已下载安装包大小已变化，请重新下载')
   const hash=createHash('sha512');for await(const chunk of createReadStream(ready.path))hash.update(chunk);if(!timingSafeEqual(hash.digest(),expectedDigest(ready.file.sha512)))throw new Error('已下载安装包校验失败，请重新下载')
   const extension=path.extname(ready.path).toLowerCase()
   if(process.platform==='win32'){
    if(extension!=='.exe')throw new Error('Windows更新安装包必须为.exe文件')
    const handle=await open(ready.path,'r');try{const header=Buffer.alloc(64);await handle.read(header,0,64,0);const offset=header.readUInt32LE(60);if(header.toString('ascii',0,2)!=='MZ'||offset<64||offset>info.size-4)throw new Error('安装包不是有效的Windows可执行文件');const signature=Buffer.alloc(4);await handle.read(signature,0,4,offset);if(!signature.equals(Buffer.from([80,69,0,0])))throw new Error('安装包缺少Windows PE文件标识')}finally{await handle.close()}
    await new Promise<void>((resolve,reject)=>{let child:ReturnType<typeof spawn>;try{child=spawn(ready.path,[],{detached:true,stdio:'ignore'})}catch(error){reject(error);return}child.once('error',error=>reject(new Error(`无法启动更新安装程序：${error.message}`)));child.once('spawn',()=>{child.unref();resolve()})})
    app.quit();return true
   }
   if(process.platform==='darwin'&&!['.dmg','.pkg'].includes(extension))throw new Error('macOS更新安装包必须为.dmg或.pkg文件')
   if(process.platform==='linux'&&extension!=='.appimage')throw new Error('Linux自动更新安装包必须为.AppImage文件')
   const error=await shell.openPath(ready.path);if(error)throw new Error(`无法打开更新安装包：${error}`);return true
  }catch(error){this.ready=undefined;throw error}finally{this.installing=false}
 }
}
