import { net, session } from 'electron'
import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import { ProxyAgent } from 'proxy-agent'

export const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36'
export type NetworkOptions=RequestInit & {timeout?:number;transport?:'fetch'|'kugou-share'}
let proxyUpdates:Promise<void>=Promise.resolve()
export function configureProxy(proxy:string):Promise<void> {
 const value=String(proxy??'').trim()
 let config:Electron.ProxyConfig={mode:'system'}
 if(value&&value!=='system'){
  let url:URL;try{url=new URL(value)}catch{throw new Error('代理地址格式无效，请使用 http://host:port 或 socks5://host:port')}
  if(!['http:','https:','socks4:','socks5:'].includes(url.protocol)||!url.hostname||value.length>2048||/[\r\n;]/.test(value))throw new Error('代理地址仅支持 HTTP、HTTPS、SOCKS4 或 SOCKS5')
  if(url.username||url.password)throw new Error('此代理需要认证，请使用系统已配置的认证代理')
  config={mode:'fixed_servers',proxyRules:`${url.protocol}//${url.host}`,proxyBypassRules:'<local>;127.0.0.1;localhost;[::1]'}
 }
 const operation=proxyUpdates.catch(()=>{}).then(async()=>{await session.defaultSession.setProxy(config);await session.defaultSession.closeAllConnections()})
 proxyUpdates=operation;return operation.catch(error=>{throw new Error(`代理设置失败：${error instanceof Error?error.message:String(error)}`)})
}
export function normalizeResolvedProxy(value:string):string {
 const first=value.split(';')[0].trim();if(first==='DIRECT')return ''
 const match=/^(PROXY|HTTP|HTTPS|SOCKS|SOCKS4|SOCKS5)\s+([^\s]+)$/i.exec(first);if(!match)throw new Error('此系统代理格式不受支持')
 const scheme=({PROXY:'http',HTTP:'http',HTTPS:'https',SOCKS:'socks5',SOCKS4:'socks4',SOCKS5:'socks5'} as Record<string,string>)[match[1].toUpperCase()]
 return `${scheme}://${match[2]}`
}
function allowedKugouShare(url:URL):boolean {
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return false
 const paths:Record<string,string[]>={
  'mobiles.kugou.com':['/api/v5/special/info_v2','/api/v5/special/song_v2'],
  'm3ws.kugou.com':['/v2/zlist/list','/zlist/list'],
  't.kugou.com':['/command/','/v1/songlist/batch_decode'],
  'gateway.kugou.com':['/v2/album_audio/audio'],
  'www2.kugou.kugou.com':['/apps/kucodeAndShare/app/'],
  'm.kugou.com':['/schain/transfer']
 }
 return paths[url.hostname]?.includes(url.pathname)??((url.hostname==='www.kugou.com'||url.hostname==='m.kugou.com')&&/^\/share\/(?:[\w-]+\.html)?$/.test(url.pathname))
}
// Successful KG share responses are blocked by Chromium's response filtering
// in this Electron version. This narrow transport keeps TLS validation and
// the proxy selected by Electron; it is never used for ordinary API requests.
async function kugouShareBytes(url:string,init:NetworkOptions,limit:number,signal:AbortSignal,redirects=0):Promise<{bytes:Buffer;url:string;charset:string}>{
 const address=new URL(url);if(!allowedKugouShare(address))throw new Error('此端点不支持酷狗分享传输');if(redirects>5)throw new Error('酷狗分享跳转超过限制')
 if(signal.aborted)throw new Error('网络请求已取消')
 const proxy=normalizeResolvedProxy(await session.defaultSession.resolveProxy(url));const agent=new ProxyAgent({getProxyForUrl:()=>proxy})
 try{return await new Promise((resolve,reject)=>{
  const headers=new Headers(init.headers);if(!headers.has('user-agent'))headers.set('user-agent',USER_AGENT);headers.set('accept-encoding','identity')
  let settled=false;const fail=(error:Error)=>{if(settled)return;settled=true;request.destroy();reject(error)}
  const request=(address.protocol==='https:'?httpsRequest:httpRequest)(address,{method:init.method??'GET',headers:Object.fromEntries(headers.entries()),agent,signal},response=>{
   const status=response.statusCode??0,location=response.headers.location
   if(status>=300&&status<400&&location){response.resume();settled=true;const redirected=new URL(location,address);if(address.protocol==='https:'&&redirected.protocol!=='https:'){reject(new Error('酷狗分享跳转到非HTTPS地址'));return}const nextHeaders=new Headers(headers);if(redirected.origin!==address.origin){nextHeaders.delete('cookie');nextHeaders.delete('authorization')}const nextInit={...init,headers:nextHeaders,...(status===303?{method:'GET',body:undefined}:{})};kugouShareBytes(redirected.toString(),nextInit,limit,signal,redirects+1).then(resolve,reject);return}
   if(status<200||status>=300){response.resume();fail(new Error(`平台返回 HTTP ${status}（${address.hostname}）`));return}
   if(Number(response.headers['content-length'])>limit){response.destroy();fail(new Error('平台响应超过大小限制'));return}
   const pieces:Buffer[]=[];let total=0
   response.on('data',(chunk:Buffer)=>{total+=chunk.length;if(total>limit){response.destroy();fail(new Error('平台响应超过大小限制'));return}pieces.push(chunk)})
   response.on('error',fail);response.on('aborted',()=>fail(new Error('平台响应不完整')))
   response.on('end',()=>{if(settled)return;settled=true;const type=String(response.headers['content-type']??'');resolve({bytes:Buffer.concat(pieces),url:address.toString(),charset:type.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]??'utf-8'})})
  })
  request.on('error',fail)
  if(init.body!=null){if(typeof init.body==='string'||init.body instanceof URLSearchParams)request.write(init.body.toString());else{fail(new Error('酷狗分享请求仅支持文本请求体'));return}}
  request.end()
 })}finally{agent.destroy()}
}
export async function fetchBytes(url:string,init:NetworkOptions={},limit=16_000_000):Promise<{bytes:Buffer;url:string;charset:string}> {
 let parsed:URL;try{parsed=new URL(url)}catch{throw new Error('网络地址格式无效')}
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('不支持的网络地址')
 const controller=new AbortController(),cancel=()=>controller.abort(init.signal?.reason)
 if(init.signal?.aborted)cancel();else init.signal?.addEventListener('abort',cancel,{once:true})
 const timeout=Math.max(1000,Math.min(60000,Number(init.timeout)||20000))
 const timer=setTimeout(()=>controller.abort(new Error('timeout')),timeout)
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
 try{
  const headers=new Headers(init.headers);if(!headers.has('user-agent'))headers.set('user-agent',USER_AGENT)
  const {timeout:_timeout,transport,...request}=init
   if(transport==='kugou-share')return await kugouShareBytes(parsed.toString(),init,limit,controller.signal)
  const response=await net.fetch(parsed.toString(),{...request,headers,signal:controller.signal})
  if(!response.ok){await response.body?.cancel();throw new Error(`平台返回 HTTP ${response.status}（${parsed.hostname}）`)}
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw new Error('平台响应超过大小限制')}
  reader=response.body?.getReader();if(!reader)return {bytes:Buffer.alloc(0),url:response.url||parsed.toString(),charset:'utf-8'}
  const pieces:Uint8Array[]=[];let total=0
  while(true){const result=await reader.read();if(result.done)break;total+=result.value.length;if(total>limit){await reader.cancel();throw new Error('平台响应超过大小限制')}pieces.push(result.value)}
  const bytes=Buffer.concat(pieces.map(piece=>Buffer.from(piece)))
  const charset=response.headers.get('content-type')?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]??'utf-8'
  return {bytes,url:response.url||parsed.toString(),charset}
 }catch(error){if(controller.signal.aborted)throw new Error(init.signal?.aborted?'网络请求已取消':'网络请求超时');throw error}
 finally{clearTimeout(timer);init.signal?.removeEventListener('abort',cancel);reader?.releaseLock()}
}
export async function fetchText(url:string,init:NetworkOptions={},limit=16_000_000):Promise<string>{const {bytes,charset}=await fetchBytes(url,init,limit);try{return new TextDecoder(/^(gbk|gb2312)$/i.test(charset)?'gb18030':charset).decode(bytes)}catch{return bytes.toString('utf8')}}
export function parseJSONResponse(text:string):any {
 const value=text.trim().replace(/^\uFEFF/,'')
 try{return JSON.parse(value)}catch{
  const match=value.match(/^[\w.$]+\s*\(([\s\S]*)\)\s*;?$/)
  if(match){try{return JSON.parse(match[1])}catch{}}
  if(/^[{[]/.test(value)&&value.includes("'")){try{let output='',i=0;while(i<value.length){const quote=value[i];if(quote!=='"'&&quote!=="'"){output+=quote;i++;continue}let text='';i++;let closed=false;for(;i<value.length;i++){const char=value[i];if(char===quote){closed=true;i++;break}if(char==='\\'){const next=value[++i];if(next===quote||next==='"'||next==="'"||next==='/'||next==='\\')text+=next;else if(next==='u'){const code=value.slice(i+1,i+5);if(!/^[\da-f]{4}$/i.test(code))throw new Error('invalid');text+=String.fromCharCode(parseInt(code,16));i+=4}else if(next==='n')text+='\n';else if(next==='r')text+='\r';else if(next==='t')text+='\t';else throw new Error('invalid')}else text+=char}if(!closed)throw new Error('invalid');output+=JSON.stringify(text)}return JSON.parse(output)}catch{}}
  throw new Error('平台返回了无法识别的数据，接口可能暂时不可用')
 }
}
export async function fetchJSON(url:string,init?:NetworkOptions):Promise<any>{return parseJSONResponse(await fetchText(url,init))}
export function queryURL(base:string,params:Record<string,unknown>):string{const url=new URL(base);for(const [key,value]of Object.entries(params))if(value!=null)url.searchParams.set(key,String(value));return url.toString()}
export function decodeText(value:unknown):string {
 return String(value??'').replace(/<\/?(?:em|font|b|span)(?:\s[^>]*)?>/gi,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0*39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(all,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):all}).trim()
}
