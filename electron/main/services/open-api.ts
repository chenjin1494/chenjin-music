import { createServer, type Server, type ServerResponse } from 'node:http'
import type { PlayerStatus, Settings } from '../../../src/shared/types'
export const initialPlayerStatus:PlayerStatus={status:'stoped',name:'',singer:'',albumName:'',picUrl:'',duration:0,progress:0,playbackRate:1,lyricLineText:'',lyricLineAllText:'',lyric:'',tlyric:'',rlyric:'',lxlyric:'',collect:false,volume:.75,mute:false}
const fields=Object.keys(initialPlayerStatus) as (keyof PlayerStatus)[]
const defaults:(keyof PlayerStatus)[]=['status','name','singer','albumName','lyricLineText','duration','progress','playbackRate']
const selection=(filter?:string)=>{const selected=filter?fields.filter(key=>filter.split(',').includes(key)):[];return selected.length?selected:defaults}
export function filteredStatus(status:PlayerStatus,filter?:string):Partial<PlayerStatus>{return Object.fromEntries(selection(filter).map(key=>[key,status[key]]))}
export class OpenAPIService {
 private server?:Server
 private subscribers=new Map<ServerResponse,Set<keyof PlayerStatus>>()
 private heartbeat?:ReturnType<typeof setInterval>
 private address=''
 private previous:PlayerStatus={...initialPlayerStatus}
 constructor(private getStatus:()=>PlayerStatus,private command:(action:string,value?:unknown)=>void){}
 async configure(settings:Settings):Promise<void>{
  const address=settings.openAPI?`${settings.openAPILan?'0.0.0.0':'127.0.0.1'}:${settings.openAPIPort}`:''
  if(address===this.address)return
  await this.dispose();if(!address)return
  const server=createServer((req,res)=>{
   res.setHeader('Access-Control-Allow-Origin','*')
   const text=(code:number,value:string)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(value)}
   const json=(data:unknown)=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
   if(req.method==='OPTIONS'){text(204,'');return}
   if(req.method!=='GET'){text(405,'Method not allowed');return}
   const url=new URL(req.url||'/','http://localhost');const route=`/${url.pathname.split('/').at(-1) || ''}`
   const state=this.getStatus()
   if(route==='/status'){json(filteredStatus(state,url.searchParams.get('filter')||undefined));return}
   if(route==='/lyric'){text(200,state.lyric);return}
   if(route==='/lyric-all'){json({lyric:state.lyric,tlyric:state.tlyric,rlyric:state.rlyric,lxlyric:state.lxlyric});return}
   if(route==='/subscribe-player-status'){
    const keys=new Set(selection(url.searchParams.get('filter')||undefined))
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.flushHeaders()
    for(const key of keys)res.write(`event: ${key}\ndata: ${JSON.stringify(state[key])}\n\n`)
    this.subscribers.set(res,keys);res.on('close',()=>this.subscribers.delete(res));return
   }
   if(route==='/seek'){
    const value=parseFloat(url.searchParams.get('offset')||'')
    if(!Number.isFinite(value)||value<0||value>state.duration){text(400,'Invalid offset');return}
    this.command('seek',Number(value.toFixed(3)));text(200,'OK');return
   }
   if(route==='/volume'){
    const value=parseInt(url.searchParams.get('volume')||'',10)
    if(!Number.isFinite(value)||value<0||value>100){text(400,'Invalid volume');return}
    this.command('volume',value/100);text(200,'OK');return
   }
   if(route==='/mute'){
    const value=url.searchParams.get('mute')
    if(value!=='true'&&value!=='false'){text(400,'Invalid mute value');return}
    this.command('mute',value==='true');text(200,'OK');return
   }
   const commands:Record<string,string>={'/play':'play','/pause':'pause','/skip-next':'next','/skip-prev':'prev','/collect':'collect','/uncollect':'uncollect'}
   if(commands[route]){this.command(commands[route]);text(200,'OK');return}
   text(401,'Forbidden')
  })
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(settings.openAPIPort,settings.openAPILan?'0.0.0.0':'127.0.0.1',()=>{server.removeListener('error',reject);resolve()})}).catch(error=>{server.close();throw new Error(`OpenAPI 启动失败：${error.message}`)})
  this.server=server;this.address=address;this.previous={...this.getStatus()}
  this.heartbeat=setInterval(()=>{for(const client of this.subscribers.keys())client.write(': heartbeat\n\n')},15000);this.heartbeat.unref()
 }
 publish(status:PlayerStatus){for(const [client,keys] of this.subscribers)for(const key of keys)if(status[key]!==this.previous[key])client.write(`event: ${key}\ndata: ${JSON.stringify(status[key])}\n\n`);this.previous={...status}}
 async dispose(){if(this.heartbeat)clearInterval(this.heartbeat);this.heartbeat=undefined;for(const client of this.subscribers.keys())client.end();this.subscribers.clear();const server=this.server;this.server=undefined;this.address='';if(server)await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections()})}
}
