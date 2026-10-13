import { createServer, request as httpRequest, type Server } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { constants, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { hostname, networkInterfaces } from 'node:os'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import WebSocket, { WebSocketServer } from 'ws'
import type { LibraryState, Playlist, Settings } from '../../../../src/shared/types'
import { AUTH, CONNECT, HELLO, ID_PREFIX, MAX_MESSAGE, SyncRpc, aesDecrypt, aesEncrypt, codeKey, decodeMessage, encodeMessage, md5 } from './protocol'
import { SYNC_MODES, applyDislikeAction, applyListAction, fromListData, mergeListData, mergeRules, resolveListConflict, rulesToArray, toListData, validateListData, type ListData, type SyncAction, type SyncMode } from './data'
export { SYNC_MODES, type SyncMode } from './data'

type Feature = 'list' | 'dislike'
interface Credential { clientId:string; key:string; serverName?:string; deviceName?:string; lastConnectDate?:number }
interface Snapshot { list?:ListData; dislike?:string }
interface Storage { serverId:string; devices:Record<string,Credential>; auth:Record<string,Credential>; snapshots:Record<string,Snapshot> }
interface Peer { ws:WebSocket; rpc:SyncRpc; id:string; name:string; ready:Record<Feature,boolean>; alive:boolean; feature:Partial<Record<Feature,{skipSnapshot?:boolean}>> }
export interface SyncStatus {
  enabled:boolean; mode:'server'|'client'; status:boolean; state:'disabled'|'listening'|'connecting'|'authRequired'|'syncing'|'ready'|'error'; message:string; address:string[]; code:string; devices:Array<{clientId:string;deviceName:string;connected:boolean;lastConnectDate?:number}>; pendingMode?:{deviceName:string;feature:Feature;modes:SyncMode[]}
}
/** v4 sync implementation. No filesystem is touched unless an explicit application-owned dataPath is provided. */
export class SyncService {
  private settings?:Settings
  private storage:Storage={serverId:randomUUID(),devices:{},auth:{},snapshots:{}}
  private loaded=false
  private writes:Promise<void>=Promise.resolve()
  private mutations:Promise<unknown>=Promise.resolve()
  private outbound:Promise<unknown>=Promise.resolve()
  private transitions:Promise<unknown>=Promise.resolve()
  private server?:Server
  private wss?:WebSocketServer
  private peers=new Set<Peer>()
  private heartbeat?:NodeJS.Timeout
  private rotate?:NodeJS.Timeout
  private retry?:NodeJS.Timeout
  private retryCount=0
  private generation=0
  private last?:Snapshot
  private applying=false
  private modeWait?:{resolve:(mode:SyncMode)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout;peer:Peer}
  private status:SyncStatus={enabled:false,mode:'server',status:false,state:'disabled',message:'',address:[],code:'',devices:[]}
  constructor(private getState:()=>LibraryState, private apply:(patch:{playlists?:Playlist[];dislikes?:string[]})=>Promise<void>, private emit:(event:string,data:unknown)=>void, private dataPath?:string) {}
  getStatus():SyncStatus { return structuredClone(this.status) }
  private publish(patch:Partial<SyncStatus>={}) { Object.assign(this.status,patch); this.status.devices=Object.values(this.storage.devices).map(d=>({clientId:d.clientId,deviceName:d.deviceName ?? 'Unknown',lastConnectDate:d.lastConnectDate,connected:[...this.peers].some(p=>p.id===d.clientId)})); this.emit('sync.status',this.getStatus()) }
  private current(feature:Feature):ListData|string { const state=this.getState(); return feature==='list'?toListData(state):state.dislikes.join('\n') }
  private snapshot():Snapshot { return {list:toListData(this.getState()),dislike:this.getState().dislikes.join('\n')} }
  private async load() {
    if(this.loaded)return; this.loaded=true
    if(!this.dataPath)return
    try {
      const raw=JSON.parse(await readFile(join(this.dataPath,'state.json'),'utf8')) as Storage
      if(typeof raw.serverId!=='string'||!raw.devices||!raw.auth||!raw.snapshots)throw new Error('Invalid sync storage')
      for(const d of [...Object.values(raw.devices),...Object.values(raw.auth)])if(typeof d.clientId!=='string'||Buffer.from(d.key,'base64').length!==16)throw new Error('Invalid sync credential')
      this.storage=raw
    } catch(error:any) { if(error.code!=='ENOENT')this.publish({message:`Sync storage could not be loaded: ${error.message}`}) }
  }
  private persist():Promise<void> {
    if(!this.dataPath)return Promise.resolve()
    const text=JSON.stringify(this.storage), path=join(this.dataPath,'state.json')
    const op=this.writes.catch(()=>{}).then(async()=>{await mkdir(this.dataPath!,{recursive:true}); const temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,text,{encoding:'utf8',mode:0o600});await rename(temp,path)})
    this.writes=op;return op
  }
  configure(settings:Settings):Promise<void> {
    const op=this.transitions.catch(()=>{}).then(async()=>{
      const same=this.settings && ['syncEnabled','syncMode','syncPort','syncHost'].every(k=>this.settings![k]===settings[k])
      this.settings=structuredClone(settings)
      if(same)return
      await this.stop();await this.load();this.last=this.snapshot()
      this.publish({enabled:settings.syncEnabled,mode:settings.syncMode,state:settings.syncEnabled?'connecting':'disabled',status:false,message:'',code:'',address:[]})
      if(!settings.syncEnabled)return
      try { if(settings.syncMode==='server')await this.startServer();else await this.connectClient() } catch(error:any){
        const needsAuth=settings.syncMode==='client'&&error.message.startsWith('Auth failed')
        this.publish({state:needsAuth?'authRequired':'error',status:false,message:error.message})
        if(settings.syncMode==='client'&&!needsAuth&&!['Unknown service address','Invalid service address','Incompatible sync service (v4 required)'].includes(error.message))this.scheduleRetry()
      }
    })
    this.transitions=op;return op
  }
  private clientUrl():URL {
    const host=this.settings?.syncHost.trim();if(!host)throw new Error('Unknown service address')
    const url=new URL(/^https?:\/\//.test(host)?host:`http://${host}`)
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid service address')
    if(!url.port)url.port=String(this.settings!.syncPort)
    url.pathname=url.pathname.replace(/\/$/,'');url.search='';url.hash='';return url
  }
  private async request(url:URL,headers:Record<string,string>={}):Promise<string> {
    return new Promise((resolve,reject)=>{
      const deadline=setTimeout(()=>req.destroy(new Error('HTTP request timeout')),10_000)
      const done=(error?:Error,value?:string)=>{clearTimeout(deadline);if(error)reject(error);else resolve(value!)}
      const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{headers,timeout:10_000},res=>{
        let size=0;const chunks:Buffer[]=[]
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>32_768){res.destroy(new Error('HTTP response exceeds limit'));return}chunks.push(chunk)})
        res.on('error',done);res.on('end',()=>{const text=Buffer.concat(chunks).toString();if(res.statusCode!==200)done(new Error(res.statusCode===403?'Blocked IP':`Auth failed (${res.statusCode})`));else done(undefined,text)})
      });req.on('timeout',()=>req.destroy(new Error('HTTP request timeout')));req.on('error',done);req.end()
    })
  }
  private endpoint(base:URL,path:string):URL { return new URL(`${base.href.replace(/\/$/,'')}/${path}`) }
  private async connectClient(code?:string):Promise<void> {
    const generation=this.generation, base=this.clientUrl()
    this.publish({state:'connecting',status:false,message:'Connecting...'})
    if(await this.request(this.endpoint(base,'hello'))!==HELLO)throw new Error('Incompatible sync service (v4 required)')
    const identity=await this.request(this.endpoint(base,'id'));if(!identity.startsWith(ID_PREFIX)||identity.length>ID_PREFIX.length+512)throw new Error('Get service id failed')
    const serverId=identity.slice(ID_PREFIX.length);let credential=this.storage.auth[serverId]
    if(code) {
      if(typeof code!=='string'||!code.length||code.length>1024)throw new Error('请输入有效连接码或服务密码')
      const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}})
      const key=pair.publicKey.replace(/-----[^\n]+-----|\s/g,'')
      const msg=aesEncrypt(`${AUTH}\n${key}\n${hostname()}\nlx_music_desktop`,codeKey(code))
      const response=await this.request(this.endpoint(base,'ah'),{m:msg})
      credential=JSON.parse(privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(response,'base64')).toString()) as Credential
      if(typeof credential.clientId!=='string'||Buffer.from(credential.key,'base64').length!==16)throw new Error('Invalid authentication response')
      this.storage.auth[serverId]=credential;await this.persist()
    } else if(credential) {
      const response=await this.request(this.endpoint(base,'ah'),{i:credential.clientId,m:aesEncrypt(AUTH+hostname(),credential.key)})
      if(aesDecrypt(response,credential.key)!==HELLO)throw new Error('Auth failed')
    } else {this.publish({state:'authRequired',message:'请输入服务端连接码'});return}
    if(generation!==this.generation)return
    const socketUrl=this.endpoint(base,'socket');socketUrl.protocol=base.protocol==='https:'?'wss:':'ws:';socketUrl.searchParams.set('i',credential.clientId);socketUrl.searchParams.set('t',aesEncrypt(CONNECT,credential.key))
    const ws=new WebSocket(socketUrl,{maxPayload:MAX_MESSAGE,handshakeTimeout:10_000})
    const peer=this.attach(ws,credential.clientId,credential.serverName ?? 'LX Music')
    ws.on('open',()=>{if(generation!==this.generation)return;this.publish({state:'syncing',message:'Wait syncing...'});this.startHeartbeat()})
    ws.on('close',(closeCode)=>{
      if(this.generation!==generation||!this.settings?.syncEnabled)return
      this.publish({state:closeCode===4100?'error':'connecting',status:false,message:closeCode===4100?'Sync failed':'Disconnected'})
      if(closeCode===1000||closeCode===4100)return
      this.scheduleRetry(generation)
    })
    ws.on('error',error=>{if(generation===this.generation)this.publish({state:'error',status:false,message:error.message})})
    await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)})
    if(generation!==this.generation){peer.ws.terminate();return}
  }
  private scheduleRetry(generation=this.generation):void {
    if(this.retry||generation!==this.generation||!this.settings?.syncEnabled||this.settings.syncMode!=='client')return
    this.retry=setTimeout(()=>{
      this.retry=undefined
      void this.connectClient().catch((error:Error)=>{
        if(generation!==this.generation)return
        const needsAuth=error.message.startsWith('Auth failed')||error.message==='Blocked IP'
        this.publish({state:needsAuth?'authRequired':'error',status:false,message:error.message})
        if(!needsAuth)this.scheduleRetry(generation)
      })
    },Math.min(2000*++this.retryCount,15000));this.retry.unref()
  }
  async authenticate(code:string):Promise<SyncStatus> {
    if(!this.settings?.syncEnabled||this.settings.syncMode!=='client')throw new Error('Sync client is not enabled')
    const op=this.transitions.catch(()=>{}).then(async()=>{await this.stop();try{await this.connectClient(code)}catch(error:any){this.publish({state:'error',message:error.message});throw error}})
    this.transitions=op;await op;return this.getStatus()
  }
  private async startServer():Promise<void> {
    const failures=new Map<string,{count:number;expires:number}>()
    const blocked=(ip:string)=>{const item=failures.get(ip);if(item&&item.expires<Date.now()){failures.delete(ip);return false}return !!item&&item.count>=10}
    const fail=(ip:string)=>{if(failures.size>1024)failures.clear();const item=failures.get(ip);failures.set(ip,{count:(item?.count??0)+1,expires:Date.now()+180_000})}
    this.status.code=String(randomInt(0,1_000_000)).padStart(6,'0')
    const server=createServer({maxHeaderSize:16_384},(req,res)=>{
      const finish=(code:number,text:string)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(text)}
      if(req.method!=='GET'){finish(405,'Method not allowed');return}
      const path=new URL(req.url??'/','http://localhost').pathname.split('/').at(-1)
      if(path==='hello'){finish(200,HELLO);return}
      if(path==='id'){finish(200,ID_PREFIX+this.storage.serverId);return}
      if(path!=='ah'){finish(401,'Forbidden');return}
      const ip=req.socket.remoteAddress??'unknown';if(blocked(ip)){finish(403,'Blocked IP');return}
      try {
        const m=req.headers.m,i=req.headers.i;if(typeof m!=='string')throw new Error('Auth failed')
        if(typeof i==='string') {
          const device=this.storage.devices[i];if(!device)throw new Error('Auth failed')
          const plain=aesDecrypt(m,device.key);if(!plain.startsWith(AUTH))throw new Error('Auth failed')
          device.deviceName=plain.slice(AUTH.length).slice(0,512)||'Unknown'
          void this.persist().catch(error=>this.publish({message:error.message}));finish(200,aesEncrypt(HELLO,device.key));return
        }
        const lines=aesDecrypt(m,codeKey(this.status.code)).split('\n')
        if(lines[0]!==AUTH||!lines[1]||lines[1].length>4096)throw new Error('Auth failed')
        if(Object.keys(this.storage.devices).length>=1000)throw new Error('Device limit')
        const credential:Credential={clientId:randomUUID(),key:randomBytes(16).toString('base64'),deviceName:lines[2]?.slice(0,512)||'Unknown'}
        const cipher=publicEncrypt({key:`-----BEGIN PUBLIC KEY-----\n${lines[1]}\n-----END PUBLIC KEY-----`,padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(JSON.stringify({clientId:credential.clientId,key:credential.key,serverName:hostname()}))).toString('base64')
        this.storage.devices[credential.clientId]=credential
        void this.persist().catch(error=>this.publish({message:error.message}));this.publish();finish(200,cipher)
      } catch {fail(ip);finish(401,'Auth failed')}
    })
    server.requestTimeout=10_000;server.headersTimeout=10_000;server.keepAliveTimeout=1000
    const wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE});this.server=server;this.wss=wss
    server.on('upgrade',(req,socket,head)=>{
      try {
        const url=new URL(req.url??'/','http://localhost'),id=url.searchParams.get('i'),token=url.searchParams.get('t'),ip=req.socket.remoteAddress??'unknown'
        if(!url.pathname.endsWith('/socket')||!id||!token||blocked(ip))throw new Error('Unauthorized')
        const device=this.storage.devices[id];if(!device||aesDecrypt(token,device.key)!==CONNECT){fail(ip);throw new Error('Unauthorized')}
        for(const peer of this.peers)if(peer.id===id)peer.ws.close(1000,'Duplicate device')
        wss.handleUpgrade(req,socket,head,ws=>{
          device.lastConnectDate=Date.now();const peer=this.attach(ws,id,device.deviceName??'Unknown');this.publish();void this.initialSync(peer).catch(error=>{this.publish({message:error.message});ws.close(4100,'Sync failed')})
        })
      }catch{socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')}
    })
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(this.settings!.syncPort,'0.0.0.0',()=>{server.off('error',reject);resolve()})})
    server.on('error',error=>this.publish({state:'error',message:error.message,status:false}))
    const address=server.address(),port=typeof address==='object'&&address?address.port:this.settings!.syncPort
    this.publish({state:'listening',status:true,message:'',address:[`127.0.0.1:${port}`,...Object.values(networkInterfaces()).flatMap(items=>(items??[]).filter(i=>i.family==='IPv4'&&!i.internal).map(i=>`${i.address}:${port}`))]})
    this.rotate=setInterval(()=>this.publish({code:String(randomInt(0,1_000_000)).padStart(6,'0')}),180_000);this.rotate.unref();this.startHeartbeat()
  }
  private startHeartbeat() {
    if(this.heartbeat)return
    this.heartbeat=setInterval(()=>{for(const peer of this.peers){if(!peer.alive){peer.ws.terminate();continue}peer.alive=false;if(peer.ws.readyState===WebSocket.OPEN)peer.ws.ping()}},30_000);this.heartbeat.unref()
  }
  private attach(ws:WebSocket,id:string,name:string):Peer {
    const peer:Peer={ws,id,name,ready:{list:false,dislike:false},alive:true,feature:{},rpc:null!}
    const handlers:Record<string,(...args:any[])=>unknown>={
      getEnabledFeatures:(_type:string,versions:Record<string,number>)=>{const features:Peer['feature']={};for(const feature of ['list','dislike'] as const)if(versions?.[feature]===1)features[feature]={skipSnapshot:false};peer.feature=features;return features},
      finished:()=>{this.retryCount=0;this.publish({status:true,state:'ready',message:''})},
      onListSyncAction:(action:SyncAction)=>this.remoteAction(peer,'list',action),
      onDislikeSyncAction:(action:SyncAction)=>this.remoteAction(peer,'dislike',action),
    }
    for(const feature of ['list','dislike'] as const) {
      handlers[`${feature}_sync_get_md5`]=()=>this.digest(feature,this.current(feature))
      handlers[`${feature}_sync_get_list_data`]=()=>this.current(feature)
      handlers[`${feature}_sync_set_list_data`]=(data:unknown)=>this.mutate(()=>this.setData(feature,data))
      handlers[`${feature}_sync_get_sync_mode`]=()=>this.selectMode(peer,feature)
      handlers[`${feature}_sync_finished`]=()=>{peer.ready[feature]=true;return undefined}
    }
    peer.rpc=new SyncRpc(packet=>{if(ws.readyState!==WebSocket.OPEN)throw new Error('Disconnected');if(ws.bufferedAmount>MAX_MESSAGE)throw new Error('Send buffer exceeds limit');ws.send(encodeMessage(packet))},handlers)
    this.peers.add(peer)
    ws.on('pong',()=>{peer.alive=true});ws.on('ping',()=>{peer.alive=true})
    ws.on('message',(bytes,isBinary)=>{
      if(isBinary){ws.close(4100,'Text frames required');return}
      const text=bytes.toString();if(text==='ping'){peer.alive=true;return}
      try{const packet=decodeMessage(text);void peer.rpc.message(packet).catch(()=>ws.close(4100,'Invalid RPC'))}catch{ws.close(4100,'Invalid message')}
    })
    ws.on('error',()=>{})
    ws.on('close',()=>{
      peer.rpc.destroy();this.peers.delete(peer)
      if(this.modeWait?.peer===peer){clearTimeout(this.modeWait.timer);this.modeWait.reject(new Error('Disconnected'));this.modeWait=undefined;this.publish({pendingMode:undefined});this.emit('sync.mode',null)}
      this.publish()
    })
    return peer
  }
  private digest(feature:Feature,data:ListData|string):string {return md5(feature==='list'?JSON.stringify(data):String(data).trim())}
  private mutate<T>(operation:()=>Promise<T>):Promise<T> {const next=this.mutations.catch(()=>{}).then(operation);this.mutations=next;return next}
  private async setData(feature:Feature,raw:unknown):Promise<void> {
    const state=this.getState();this.applying=true
    try{if(feature==='list')await this.apply({playlists:fromListData(validateListData(raw),state.playlists)});else await this.apply({dislikes:rulesToArray(raw)})}finally{this.applying=false;this.last=this.snapshot()}
  }
  private selectMode(peer:Peer,feature:Feature):Promise<SyncMode> {
    if(this.modeWait)return Promise.reject(new Error('Another conflict is awaiting a mode'))
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.modeWait=undefined;this.publish({pendingMode:undefined});this.emit('sync.mode',null);reject(new Error('Mode selection timeout'))},120_000)
      this.modeWait={resolve,reject,timer,peer};const pendingMode={deviceName:peer.name,feature,modes:SYNC_MODES};this.publish({pendingMode});this.emit('sync.mode',pendingMode)
    })
  }
  chooseMode(mode:SyncMode):SyncStatus {
    if(!SYNC_MODES.includes(mode))throw new Error('Invalid sync mode')
    if(!this.modeWait)throw new Error('No sync mode is pending')
    const wait=this.modeWait;this.modeWait=undefined;clearTimeout(wait.timer);this.publish({pendingMode:undefined});this.emit('sync.mode',null);wait.resolve(mode);return this.getStatus()
  }
  private async initialSync(peer:Peer):Promise<void> {
    peer.feature=await peer.rpc.call('getEnabledFeatures',['desktop-app',{list:1,dislike:1}])
    for(const feature of ['list','dislike'] as const) {
      const options=peer.feature?.[feature];if(!options)continue
      await this.mutate(async()=>{
        const local=this.current(feature), remoteDigest=await peer.rpc.call(`${feature}_sync_get_md5`,[],feature)
        let result=local
        if(remoteDigest!==this.digest(feature,local)) {
          const raw=await peer.rpc.call(`${feature}_sync_get_list_data`,[],feature)
          const remote=feature==='list'?validateListData(raw):rulesToArray(raw).join('\n')
          const base=options.skipSnapshot?undefined:this.storage.snapshots[peer.id]?.[feature]
          if(base!==undefined)result=feature==='list'?mergeListData(local as ListData,remote as ListData,base as ListData):mergeRules(local as string,remote as string,base as string)
          else {
            const nonempty=(value:ListData|string)=>typeof value==='string'?!!value.trim():!!(value.defaultList.length||value.loveList.length||value.userList.length)
            if(!nonempty(local))result=remote
            else if(nonempty(remote)) {
              const mode=await this.selectMode(peer,feature);if(mode==='cancel')throw new Error('cancel')
              result=feature==='list'?resolveListConflict(local as ListData,remote as ListData,mode):mode.startsWith('merge')?(mode==='merge_remote_local'?mergeRules(remote as string,local as string):mergeRules(local as string,remote as string)):(mode.includes('remote_local')?remote:local)
            }
          }
          await this.setData(feature,result)
          await peer.rpc.call(`${feature}_sync_set_list_data`,[result],feature)
          await this.broadcast(feature,{action:feature==='list'?'list_data_overwrite':'dislike_data_overwrite',data:result},peer)
        }
        this.storage.snapshots[peer.id]??={};(this.storage.snapshots[peer.id] as any)[feature]=structuredClone(result);await this.persist()
        await peer.rpc.call(`${feature}_sync_finished`,[],feature);peer.ready[feature]=true
      })
    }
    await peer.rpc.call('finished');this.publish()
  }
  private remoteAction(peer:Peer,feature:Feature,action:SyncAction):Promise<void> {
    if(!peer.ready[feature])return Promise.reject(new Error('Sync module is not ready'))
    return this.mutate(async()=>{
      const current=this.current(feature), next=feature==='list'?applyListAction(current as ListData,action):applyDislikeAction(current as string,action)
      await this.setData(feature,next)
      if(this.settings?.syncMode==='server') {
        this.storage.snapshots[peer.id]??={};(this.storage.snapshots[peer.id] as any)[feature]=structuredClone(next)
        await this.broadcast(feature,action,peer);await this.persist()
      }
    })
  }
  private async broadcast(feature:Feature,action:SyncAction,exclude?:Peer):Promise<void> {
    await Promise.all([...this.peers].filter(peer=>peer!==exclude&&peer.ready[feature]).map(async peer=>{
      try {
        await peer.rpc.call(feature==='list'?'onListSyncAction':'onDislikeSyncAction',[action],feature)
        if(this.settings?.syncMode==='server'){this.storage.snapshots[peer.id]??={};const previous=this.storage.snapshots[peer.id][feature];(this.storage.snapshots[peer.id] as any)[feature]=structuredClone(action.action.endsWith('_data_overwrite')?action.data:previous===undefined?this.current(feature):feature==='list'?applyListAction(previous as ListData,action):applyDislikeAction(previous as string,action))}
      }catch(error:any){this.publish({message:error.message});peer.ws.close(4100,'Sync failed')}
    }))
  }
  notifyLocalChange(state:LibraryState):void {
    const next:Snapshot={list:toListData(state),dislike:state.dislikes.join('\n')},previous=this.last;this.last=next
    if(this.applying||!this.settings?.syncEnabled||!previous)return
    for(const feature of ['list','dislike'] as const)if(JSON.stringify(previous[feature])!==JSON.stringify(next[feature])) {
      // LibraryStore exposes state changes, so send the protocol's lossless overwrite operation.
      const value=structuredClone(next[feature]);this.outbound=this.outbound.catch(()=>{}).then(async()=>{await this.broadcast(feature,{action:feature==='list'?'list_data_overwrite':'dislike_data_overwrite',data:value});await this.persist()}).catch(error=>this.publish({message:error.message}))
    }
  }
  async removeDevice(id:string):Promise<void> {for(const peer of this.peers)if(peer.id===id)peer.ws.close(1000,'Device removed');delete this.storage.devices[id];delete this.storage.snapshots[id];await this.persist();this.publish()}
  private async stop():Promise<void> {
    ++this.generation
    if(this.retry)clearTimeout(this.retry);if(this.rotate)clearInterval(this.rotate);if(this.heartbeat)clearInterval(this.heartbeat);this.retry=undefined;this.rotate=undefined;this.heartbeat=undefined
    if(this.modeWait){clearTimeout(this.modeWait.timer);this.modeWait.reject(new Error('Disconnected'));this.modeWait=undefined;this.status.pendingMode=undefined}
    for(const peer of this.peers){peer.rpc.destroy();peer.ws.terminate()}this.peers.clear()
    this.wss?.close();this.wss=undefined
    const server=this.server;this.server=undefined
    if(server)await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections()})
    await this.mutations.catch(()=>{});await this.outbound.catch(()=>{});await this.writes.catch(()=>{})
  }
  async dispose():Promise<void> {const op=this.transitions.catch(()=>{}).then(async()=>{await this.stop();this.settings=undefined;this.publish({enabled:false,status:false,state:'disabled',message:'',address:[],code:''})});this.transitions=op;await op}
}
