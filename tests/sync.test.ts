import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { constants, generateKeyPairSync, privateDecrypt, randomBytes } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { emptyLibrary } from '../src/shared/defaults'
import type { LibraryState, Track } from '../src/shared/types'
import { SyncService } from '../electron/main/services/sync'
import { AUTH, CONNECT, HELLO, ID_PREFIX, MAX_MESSAGE, SyncRpc, aesDecrypt, aesEncrypt, codeKey, decodeMessage, encodeMessage } from '../electron/main/services/sync/protocol'
import { applyListAction, mergeListData, resolveListConflict, toListData, mergeRules, type ListData } from '../electron/main/services/sync/data'
const track=(id:string,name=id):Track=>({id,name,singer:'artist',source:'kw',interval:'03:00',meta:{songId:id,albumName:''}})
const lists=(ids:string[],user:string[]=[]):ListData=>({defaultList:ids.map(x=>track(x)),loveList:[],userList:user.map(id=>({id,name:id,locationUpdateTime:null,list:[track(id)]}))})
async function until(check:()=>boolean, timeout=5000) { const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw new Error('Condition timed out');await new Promise(resolve=>setTimeout(resolve,10))} }
const services:SyncService[]=[]
const temporary:string[]=[]
afterEach(async()=>{await Promise.all(services.splice(0).map(s=>s.dispose()));await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})))})
async function makeService(state:LibraryState=emptyLibrary(), onEvent?:(name:string,data:any)=>void,dataPath?:string) {
  const service=new SyncService(()=>structuredClone(state),async patch=>{Object.assign(state,patch);service.notifyLocalChange(structuredClone(state))},(event,data)=>onEvent?.(event,data),dataPath);services.push(service);return {service,state}
}
async function server() {const value=await makeService();await value.service.configure({...value.state.settings,syncEnabled:true,syncPort:0,syncMode:'server'});const address=value.service.getStatus().address[0];return {...value,base:`http://${address}`}}
async function pair(base:string,code:string) {
  const keyPair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{format:'pem',type:'spki'},privateKeyEncoding:{format:'pem',type:'pkcs8'}})
  const publicKey=keyPair.publicKey.replace(/-----[^\n]+-----|\s/g,'')
  const response=await fetch(`${base}/ah`,{headers:{m:aesEncrypt(`${AUTH}\n${publicKey}\nProtocol fixture\nlx_music_desktop`,codeKey(code))}})
  expect(response.status).toBe(200)
  return JSON.parse(privateDecrypt({key:keyPair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(await response.text(),'base64')).toString()) as {clientId:string;key:string;serverName:string}
}

describe('LX v4 encoding and message2call 0.1.3 wire contract',()=>{
  it('uses the MD5 ASCII prefix key and AES128ECB PKCS7 authentication',()=>{
    expect(codeKey('123456')).toBe(Buffer.from('e10adc3949ba59ab').toString('base64'))
    const key=randomBytes(16).toString('base64');expect(aesDecrypt(aesEncrypt(CONNECT,key),key)).toBe(CONNECT)
    expect(()=>aesDecrypt(aesEncrypt(CONNECT,key),randomBytes(16).toString('base64'))).toThrow()
  })
  it('round trips cg_ gzip while bounding inflated input',()=>{
    const packet={name:'get__12',path:['list_sync_set_list_data'],data:[{text:'歌'.repeat(2000)}]}
    const encoded=encodeMessage(packet);expect(encoded.startsWith('cg_')).toBe(true);expect(decodeMessage(encoded)).toEqual(packet)
    expect(()=>decodeMessage('cg_'+gzipSync(Buffer.alloc(MAX_MESSAGE+1)).toString('base64'))).toThrow()
    expect(()=>decodeMessage('{bad')).toThrow()
  })
  it('accepts original library envelopes including error and property calls without args',async()=>{
    const sent:any[]=[];const rpc=new SyncRpc(packet=>sent.push(packet),{getValue:()=>42,fail:()=>{throw new Error('failure')}})
    await rpc.message({name:'getValue__1234',path:['getValue']})
    expect(sent.shift()).toEqual({name:'getValue__1234',error:null,data:42})
    await rpc.message({name:'fail__1234',path:['fail'],data:[]});expect(sent.shift()).toEqual({name:'fail__1234',error:'failure'})
    await rpc.message({name:'missing__1',path:['missing'],data:[]});expect(sent.shift().error).toBe('missing is not defined')
    const pending=rpc.call('remoteFunction',[1,2]);const request=sent.shift();expect(request).toMatchObject({path:['remoteFunction'],data:[1,2]})
    await rpc.message({name:request.name,error:null,data:'answer'});expect(await pending).toBe('answer');rpc.destroy()
  })
  it('rejects outstanding calls on disconnect and serializes named queue groups',async()=>{
    const sent:any[]=[];const rpc=new SyncRpc(packet=>sent.push(packet),{})
    const first=rpc.call('operation',[1],'list'),second=rpc.call('operation',[2],'list');await Promise.resolve();expect(sent).toHaveLength(1)
    await rpc.message({name:sent[0].name,error:null,data:1});expect(await first).toBe(1);await Promise.resolve();await Promise.resolve();expect(sent).toHaveLength(2)
    const rejection=expect(second).rejects.toThrow('Disconnected');rpc.destroy();await rejection
  })
})

describe('LX v4 list and dislike conflict semantics',()=>{
  it('distinguishes all six modes and retains target-only lists for non-full overwrite',()=>{
    const local=lists(['a'],['local','shared']),remote=lists(['b'],['remote','shared'])
    expect(resolveListConflict(local,remote,'merge_local_remote').defaultList.map(t=>t.id)).toEqual(['a','b'])
    expect(resolveListConflict(local,remote,'merge_remote_local').defaultList.map(t=>t.id)).toEqual(['b','a'])
    expect(resolveListConflict(local,remote,'overwrite_local_remote').userList.map(p=>p.id)).toEqual(['local','shared','remote'])
    expect(resolveListConflict(local,remote,'overwrite_remote_local').userList.map(p=>p.id)).toEqual(['remote','shared','local'])
    expect(resolveListConflict(local,remote,'overwrite_local_remote_full')).toEqual(local)
    expect(resolveListConflict(local,remote,'overwrite_remote_local_full')).toEqual(remote)
    expect(()=>resolveListConflict(local,remote,'cancel')).toThrow('cancel')
  })
  it('honors offline song/list deletions and changed metadata against shared snapshots',()=>{
    const base=lists(['old'],['removed','renamed']),local=lists(['old','new'],['renamed']),remote=lists([],['removed','renamed'])
    remote.userList[1].name='remote rename'
    const merged=mergeListData(local,remote,base)
    expect(merged.defaultList.map(t=>t.id)).toEqual(['new']);expect(merged.userList.map(p=>p.id)).toEqual(['renamed']);expect(merged.userList[0].name).toBe('remote rename')
    expect(mergeRules('old@artist\nnew@artist','other@artist','old@artist')).toBe('new@artist\nother@artist')
  })
  it('applies LX action shapes for creates, updates, moves, order, clear and rejects unknowns',()=>{
    let value=lists(['a','b'],['user'])
    value=applyListAction(value,{action:'list_create',data:{position:0,listInfos:[{id:'new',name:'new'}]}})
    value=applyListAction(value,{action:'list_update',data:[{id:'new',name:'renamed'}]});expect(value.userList[0].name).toBe('renamed')
    value=applyListAction(value,{action:'list_music_move',data:{fromId:'default',toId:'new',musicInfos:[track('a')],addMusicLocationType:'top'}})
    expect(value.defaultList.map(t=>t.id)).toEqual(['b']);expect(value.userList[0].list.map(t=>t.id)).toEqual(['a'])
    value=applyListAction(value,{action:'list_music_update',data:[{id:'new',musicInfo:track('a','updated')}]});expect(value.userList[0].list[0].name).toBe('updated')
    value=applyListAction(value,{action:'list_update_position',data:{position:0,ids:['user']}});expect(value.userList[0].id).toBe('user')
    value=applyListAction(value,{action:'list_music_clear',data:['new']});expect(value.userList[1].list).toEqual([])
    expect(()=>applyListAction(value,{action:'made_up'})).toThrow('Unknown')
  })
})

describe('real HTTP authentication and WebSocket v4 peers',()=>{
  it('serves hello/id, pairs through RSA OAEP, resumes AES key auth and rejects forged token',async()=>{
    const {service,base}=await server()
    expect(await (await fetch(`${base}/hello`)).text()).toBe(HELLO);expect(await (await fetch(`${base}/id`)).text()).toMatch(new RegExp(`^${ID_PREFIX}`))
    const credential=await pair(base,service.getStatus().code)
    const resume=await fetch(`${base}/ah`,{headers:{i:credential.clientId,m:aesEncrypt(AUTH+'Renamed device',credential.key)}})
    expect(aesDecrypt(await resume.text(),credential.key)).toBe(HELLO)
    expect((await fetch(`${base}/ah`,{headers:{i:credential.clientId,m:'bad'}})).status).toBe(401)
    const forged=new WebSocket(base.replace('http:','ws:')+`/socket?i=${credential.clientId}&t=bad`)
    await new Promise<void>(resolve=>{forged.once('unexpected-response',(_req,res)=>{expect(res.statusCode).toBe(401);res.resume();forged.terminate();resolve()});forged.on('error',()=>{})})
  })
  it('bounds HTTP responses and refuses removed devices',async()=>{
    const fake=createServer((_req,res)=>{res.end('x'.repeat(40_000))})
    await new Promise<void>(resolve=>fake.listen(0,'127.0.0.1',resolve))
    const address=fake.address();if(!address||typeof address==='string')throw new Error('No address')
    const client=await makeService()
    try {
      await client.service.configure({...client.state.settings,syncEnabled:true,syncMode:'client',syncHost:`http://127.0.0.1:${address.port}`,syncPort:0})
      expect(client.service.getStatus().state).toBe('error');expect(client.service.getStatus().message).toContain('exceeds limit')
    }finally{await client.service.dispose();await new Promise<void>(resolve=>fake.close(()=>resolve()))}
    const {service,base}=await server(),credential=await pair(base,service.getStatus().code)
    await service.removeDevice(credential.clientId)
    expect(service.getStatus().devices).toEqual([])
    const response=await fetch(`${base}/ah`,{headers:{i:credential.clientId,m:aesEncrypt(AUTH+'fixture',credential.key)}});expect(response.status).toBe(401)
  })
  it('closes invalid compressed messages with LX failed code',async()=>{
    const {service,base}=await server(),credential=await pair(base,service.getStatus().code)
    const ws=new WebSocket(base.replace('http:','ws:')+`/socket?i=${credential.clientId}&t=${encodeURIComponent(aesEncrypt(CONNECT,credential.key))}`)
    ws.on('error',()=>{})
    const closed=new Promise<number>(resolve=>ws.once('close',code=>resolve(code)))
    await new Promise<void>(resolve=>ws.once('open',resolve));ws.send('cg_not-gzip')
    expect(await closed).toBe(4100)
  })
  it('interoperates with original message2call envelopes from an independently driven LX client fixture',async()=>{
    const {service,state,base}=await server(),credential=await pair(base,service.getStatus().code)
    const token=encodeURIComponent(aesEncrypt(CONNECT,credential.key));const ws=new WebSocket(base.replace('http:','ws:')+`/socket?i=${credential.clientId}&t=${token}`)
    const received:any[]=[]
    ws.on('message',data=>{
      const packet=decodeMessage(data.toString()) as any;received.push(packet)
      if(!packet.path)return
      let result:unknown
      switch(packet.path[0]){
        case 'getEnabledFeatures': result={list:{skipSnapshot:false},dislike:{skipSnapshot:false}};break
        case 'list_sync_get_md5':result='mismatch';break
        case 'list_sync_get_list_data':result=lists(['fixture']);break
        case 'dislike_sync_get_md5':result='mismatch';break
        case 'dislike_sync_get_list_data':result='song@artist';break
      }
      ws.send(encodeMessage({name:packet.name,error:null,data:result}))
    })
    await until(()=>received.some(p=>p.path?.[0]==='finished'))
    expect(state.playlists[0].tracks[0].id).toBe('fixture');expect(state.dislikes).toEqual(['song@artist'])
    const response=new Promise<any>(resolve=>{ws.on('message',bytes=>{const p=decodeMessage(bytes.toString()) as any;if(p.name==='onListSyncAction__009')resolve(p)})})
    ws.send(encodeMessage({name:'onListSyncAction__009',path:['onListSyncAction'],data:[{action:'list_music_add',data:{id:'default',musicInfos:[track('added')],addMusicLocationType:'bottom'}}]}))
    expect(await response).toMatchObject({name:'onListSyncAction__009',error:null});expect(state.playlists[0].tracks.map(t=>t.id)).toEqual(['fixture','added'])
    ws.terminate();await until(()=>!service.getStatus().devices.some(d=>d.connected))
  })
  it('persists auth and snapshots across restarts, merging offline changes without reviving deletions',async()=>{
    const root=await mkdtemp(join(tmpdir(),'chenjin-sync-'));temporary.push(root)
    const sState=emptyLibrary(),cState=emptyLibrary();sState.playlists[0].tracks=[track('baseline')]
    let s=await makeService(sState,undefined,join(root,'server')),c=await makeService(cState,undefined,join(root,'client'))
    await s.service.configure({...sState.settings,syncEnabled:true,syncMode:'server',syncPort:0})
    let base=`http://${s.service.getStatus().address[0]}`
    await c.service.configure({...cState.settings,syncEnabled:true,syncMode:'client',syncHost:base,syncPort:0});await c.service.authenticate(s.service.getStatus().code)
    await until(()=>c.service.getStatus().state==='ready');expect(cState.playlists[0].tracks.map(t=>t.id)).toEqual(['baseline'])
    await c.service.dispose();await s.service.dispose()
    cState.playlists[0].tracks=[track('client-offline')];sState.playlists[0].tracks.push(track('server-offline'))
    s=await makeService(sState,undefined,join(root,'server'));c=await makeService(cState,undefined,join(root,'client'))
    await s.service.configure({...sState.settings,syncEnabled:true,syncMode:'server',syncPort:0});base=`http://${s.service.getStatus().address[0]}`
    await c.service.configure({...cState.settings,syncEnabled:true,syncMode:'client',syncHost:base,syncPort:0})
    await until(()=>c.service.getStatus().state==='ready')
    expect(s.service.getStatus().pendingMode).toBeUndefined();expect(cState.playlists[0].tracks.map(t=>t.id)).toEqual(['server-offline','client-offline'])
    expect(sState.playlists[0].tracks.map(t=>t.id)).toEqual(['server-offline','client-offline'])
  })
  it('runs both service roles, mode selection and subsequent local notifications',async()=>{
    const s=await server();s.state.playlists[0].tracks=[track('server')];s.service.notifyLocalChange(s.state)
    const clientState=emptyLibrary();clientState.playlists[0].tracks=[track('client')]
    const c=await makeService(clientState)
    await c.service.configure({...clientState.settings,syncEnabled:true,syncMode:'client',syncHost:s.base,syncPort:0});expect(c.service.getStatus().state).toBe('authRequired')
    await c.service.authenticate(s.service.getStatus().code)
    await until(()=>!!s.service.getStatus().pendingMode);s.service.chooseMode('merge_remote_local')
    await until(()=>c.service.getStatus().state==='ready')
    expect(c.state.playlists[0].tracks.map(t=>t.id)).toEqual(['client','server']);expect(s.state.playlists[0].tracks.map(t=>t.id)).toEqual(['client','server'])
    c.state.dislikes=['song@artist'];c.service.notifyLocalChange(c.state);await until(()=>s.state.dislikes.includes('song@artist'))
  })
})
