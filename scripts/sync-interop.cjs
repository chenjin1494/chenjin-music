'use strict'
// Run with node scripts/sync-interop.cjs --upstream <isolated LX server checkout> --base http://127.0.0.1:port --password <test password> --output <isolated evidence.json>
// The upstream server is started separately as a managed job. No child processes or upstream source edits.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict')
const args=Object.fromEntries(process.argv.slice(2).reduce((items,value,i,all)=>{if(value.startsWith('--'))items.push([value.slice(2),all[i+1]]);return items},[]))
if(!args.upstream||!args.base||!args.password||!args.output)throw new Error('Required --upstream --base --password --output')
const {createMsg2call}=require(path.join(args.upstream,'node_modules/message2call'))
const WebSocket=require(path.join(args.upstream,'node_modules/ws'))
assert.equal(require(path.join(args.upstream,'node_modules/message2call/package.json')).version,'0.1.3')
const root=path.resolve(__dirname,'..'),work=fs.mkdtempSync(path.join(os.tmpdir(),'chenjin-real-interop-'))
const viteRequire=require('node:module').createRequire(require.resolve(path.join(root,'node_modules/vite/package.json')))
viteRequire('esbuild').buildSync({entryPoints:[path.join(root,'electron/main/services/sync/index.ts')],outfile:path.join(work,'service.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external'})
// Resolve the project's installed ws when loading the isolated compiled service.
const Module=require('node:module'),originalResolve=Module._resolveFilename
Module._resolveFilename=function(request,parent,...rest){if(request==='ws')return require.resolve(path.join(root,'node_modules/ws'));return originalResolve.call(this,request,parent,...rest)}
const {SyncService}=require(path.join(work,'service.cjs'))
const initial=()=>({version:1,settings:{syncEnabled:false,syncMode:'server',syncPort:0,syncHost:''},playlists:[{id:'default',name:'试听列表',tracks:[],createdAt:1},{id:'love',name:'喜欢',tracks:[],createdAt:1}],dislikes:[],scripts:[],downloads:[],searchHistory:[]})
const song=(id,extra='')=>({id,name:`互通${id}${extra}`,singer:'测试歌手',source:'kw',interval:'03:00',meta:{songId:id,albumName:'互通专辑'}})
const hash=text=>crypto.createHash('md5').update(text).digest('hex')
const codeKey=code=>Buffer.from(hash(code).slice(0,16))
const encrypt=(text,key)=>{const c=crypto.createCipheriv('aes-128-ecb',Buffer.isBuffer(key)?key:Buffer.from(key,'base64'),null);return Buffer.concat([c.update(text),c.final()]).toString('base64')}
const decode=text=>JSON.parse(text.startsWith('cg_')?zlib.gunzipSync(Buffer.from(text.slice(3),'base64')).toString():text)
const encode=value=>{const text=JSON.stringify(value);return text.length>1024?'cg_'+zlib.gzipSync(text).toString('base64'):text}
const listFrom=state=>({defaultList:state.playlists[0].tracks,loveList:state.playlists[1].tracks,userList:state.playlists.slice(2).map(p=>({id:p.id,name:p.name,locationUpdateTime:null,list:p.tracks}))})
async function wait(check,label,timeout=20000){const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw new Error('Timed out: '+label);await new Promise(r=>setTimeout(r,20))}}
const services=[],refs=[],evidence={upstream:{version:'2.1.2',commit:'d47aca4284a7c4d9ef755df1f44fb0b0a5b2af36',message2call:'0.1.3',base:args.base},checks:[],wire:[],started:new Date().toISOString()}
const record=(name,details)=>{evidence.checks.push({name,passed:true,details:structuredClone(details)});console.log('PASS',name)}
function newService(state,name){let service;service=new SyncService(()=>structuredClone(state),async patch=>{Object.assign(state,patch);service.notifyLocalChange(state)},(event,data)=>{if(event==='sync.mode'&&data)setImmediate(()=>service.chooseMode('merge_local_remote'))},path.join(work,name));services.push(service);return service}
async function auth(base,password,credential){
  if(!credential){const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}}),key=pair.publicKey.replace(/-----[^\n]+-----|\s/g,'');const response=await fetch(base+'/ah',{headers:{m:encrypt(`lx-music auth::\n${key}\nOriginal-library-reference\nlx_music_desktop`,codeKey(password))}});assert.equal(response.status,200);return JSON.parse(crypto.privateDecrypt({key:pair.privateKey,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(await response.text(),'base64')).toString())}
  const response=await fetch(base+'/ah',{headers:{i:credential.clientId,m:encrypt('lx-music auth::Reference resumed',credential.key)}});assert.equal(response.status,200);return credential
}
async function reference(base,password,state,credential){
  credential=await auth(base,password,credential)
  const ws=new WebSocket(base.replace(/^http/,'ws')+`/socket?i=${encodeURIComponent(credential.clientId)}&t=${encodeURIComponent(encrypt('lx-music connect',credential.key))}`),ref={ws,credential,state,ready:false,rpc:null}
  const funcs={getEnabledFeatures:(type,versions)=>{assert.deepEqual(versions,{list:1,dislike:1});return {list:{skipSnapshot:false},dislike:{skipSnapshot:false}}},finished:()=>{ref.ready=true},onListSyncAction:action=>{if(action.action==='list_data_overwrite'){state.list=action.data;return}throw new Error('Fixture receives only overwrite')},onDislikeSyncAction:action=>{if(action.action==='dislike_data_overwrite')state.rules=action.data;else if(action.action==='dislike_music_add')state.rules+=[...action.data].map(x=>`\n${x.name}@${x.singer}`).join('');else if(action.action==='dislike_music_clear')state.rules='';else throw new Error('Invalid fixture dislike action')}}
  for(const feature of ['list','dislike']){funcs[`${feature}_sync_get_md5`]=()=>hash(feature==='list'?JSON.stringify(state.list):state.rules.trim());funcs[`${feature}_sync_get_list_data`]=()=>feature==='list'?state.list:state.rules;funcs[`${feature}_sync_set_list_data`]=data=>{if(feature==='list')state.list=data;else state.rules=data};funcs[`${feature}_sync_get_sync_mode`]=()=> 'merge_local_remote';funcs[`${feature}_sync_finished`]=()=>{}}
  ref.rpc=createMsg2call({funcsObj:funcs,timeout:10000,sendMessage:packet=>ws.send(encode(packet))})
  ws.on('message',bytes=>{if(bytes.toString()==='ping')return;const packet=decode(bytes.toString());if(evidence.wire.length<80)evidence.wire.push({direction:'upstream/reference',method:packet.path?.join('.'),response:!packet.path,error:packet.error??null,compressed:bytes.toString().startsWith('cg_')});ref.rpc.message(packet)})
  ws.on('close',()=>ref.rpc.destroy());ws.on('error',()=>{})
  refs.push(ref);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});await wait(()=>ref.ready,'reference finished');return ref
}
(async()=>{
  try{
    assert.equal(await (await fetch(args.base+'/hello')).text(),'Hello~::^-^::~v4~')
    const state=initial();state.playlists[0].tracks=[song('initial')];state.playlists.push({id:'interop-list',name:'原服务验证',tracks:[song('compressed','长'.repeat(1800))],createdAt:1});state.dislikes=['互通歌曲@测试歌手']
    let client=newService(state,'client');await client.configure({...state.settings,syncEnabled:true,syncMode:'client',syncHost:args.base});assert.equal(client.getStatus().state,'authRequired');await client.authenticate(args.password);await wait(()=>client.getStatus().state==='ready','new client to upstream ready');record('real-upstream-auth-features-list-dislike-finished',{tracks:state.playlists[0].tracks.map(t=>t.id),rules:state.dislikes})
    let ref=await reference(args.base,args.password,{list:{defaultList:[],loveList:[],userList:[]},rules:''});assert.equal(ref.state.list.userList[0].list[0].name,state.playlists[2].tracks[0].name);assert.equal(ref.state.rules,state.dislikes.join('\n'));record('upstream-persisted-new-client-data-readable-by-original-library',{userList:ref.state.list.userList.map(p=>p.id),compressedFrames:evidence.wire.filter(p=>p.compressed).length})
    const conflictState=initial();conflictState.playlists[0].tracks=[song('conflict-seed')];conflictState.dislikes=['冲突规则@歌手']
    const conflict=newService(conflictState,'conflict');await conflict.configure({...conflictState.settings,syncEnabled:true,syncMode:'client',syncHost:args.base});await conflict.authenticate(args.password);await wait(()=>conflict.getStatus().state==='ready','original server requests both sync modes');assert(conflictState.playlists[0].tracks.some(t=>t.id==='initial'));assert(conflictState.playlists[0].tracks.some(t=>t.id==='conflict-seed'));assert(conflictState.dislikes.includes('互通歌曲@测试歌手'));record('real-upstream-client-mode-rpc-and-viewpoint-translation',{tracks:conflictState.playlists[0].tracks.map(t=>t.id),rules:conflictState.dislikes});await conflict.dispose()
    await ref.rpc.createQueueRemote('list').onListSyncAction({action:'list_music_add',data:{id:'default',musicInfos:[song('reference-add')],addMusicLocationType:'bottom'}})
    await wait(()=>state.playlists[0].tracks.some(t=>t.id==='reference-add'),'upstream to client action')
    await ref.rpc.createQueueRemote('dislike').onDislikeSyncAction({action:'dislike_music_add',data:[{name:'远端规则',singer:'歌手'}]});await wait(()=>state.dislikes.includes('远端规则@歌手'),'upstream dislike action');record('real-upstream-remote-granular-actions-to-new-client',{tracks:state.playlists[0].tracks.map(t=>t.id),rules:state.dislikes})
    // Refresh reference state from another authenticated device to avoid fixture state drift.
    ref.ws.terminate();ref=await reference(args.base,args.password,{list:{defaultList:[],loveList:[],userList:[]},rules:''})
    state.playlists[0].tracks.push(song('local-notify'));state.dislikes.push('本机规则@歌手');client.notifyLocalChange(state)
    await wait(()=>ref.state.list.defaultList.some(t=>t.id==='local-notify')&&ref.state.rules.includes('本机规则@歌手'),'new client local change through upstream broadcast');record('new-client-local-change-through-real-upstream-broadcast',{})
    await client.dispose();state.playlists[0].tracks=state.playlists[0].tracks.filter(t=>t.id!=='initial');state.playlists[0].tracks.push(song('client-offline'))
    await ref.rpc.createQueueRemote('list').onListSyncAction({action:'list_music_add',data:{id:'default',musicInfos:[song('remote-offline')],addMusicLocationType:'bottom'}})
    client=newService(state,'client');await client.configure({...state.settings,syncEnabled:true,syncMode:'client',syncHost:args.base});await wait(()=>client.getStatus().state==='ready','persistent resume and three way merge');assert(!state.playlists[0].tracks.some(t=>t.id==='initial'));assert(state.playlists[0].tracks.some(t=>t.id==='remote-offline'));assert(state.playlists[0].tracks.some(t=>t.id==='client-offline'));record('real-upstream-token-resume-snapshot-deletion-and-offline-additions',{tracks:state.playlists[0].tracks.map(t=>t.id)})
    const serverState=initial();const server=newService(serverState,'server');await server.configure({...serverState.settings,syncEnabled:true,syncMode:'server',syncPort:0});const base='http://'+server.getStatus().address[0]
    const localRef=await reference(base,server.getStatus().code,{list:{defaultList:[song('old-library-seed')],loveList:[],userList:[{id:'old-user',name:'旧库参考歌单',locationUpdateTime:null,list:[song('large-seed','长'.repeat(1800))]}]},rules:'旧客户端@歌手'})
    assert.equal(serverState.playlists[0].tracks[0].id,'old-library-seed');assert.deepEqual(serverState.dislikes,['旧客户端@歌手']);record('original-message2call-client-to-new-server-auth-features-compression',{})
    await localRef.rpc.createQueueRemote('list').onListSyncAction({action:'list_music_add',data:{id:'default',musicInfos:[song('old-library-add')],addMusicLocationType:'top'}});assert.equal(serverState.playlists[0].tracks[0].id,'old-library-add')
    await localRef.rpc.createQueueRemote('dislike').onDislikeSyncAction({action:'dislike_music_clear'});assert.deepEqual(serverState.dislikes,[]);record('original-library-client-granular-list-dislike-rpc-to-new-server',{})
    serverState.playlists[0].tracks.push(song('new-server-notify'));serverState.dislikes=['服务端更新@歌手'];server.notifyLocalChange(serverState);await wait(()=>localRef.state.list.defaultList.some(t=>t.id==='new-server-notify')&&localRef.state.rules==='服务端更新@歌手','new server notification to old library');record('new-server-overwrite-broadcast-to-original-library-client',{})
    evidence.completed=new Date().toISOString();evidence.success=true
  }catch(error){evidence.success=false;evidence.error=error.stack;console.error(error);process.exitCode=1}
  finally{for(const ref of refs){ref.rpc.destroy();ref.ws.terminate()}await Promise.all(services.map(s=>s.dispose()));fs.writeFileSync(args.output,JSON.stringify(evidence,null,2));console.log('Evidence:',args.output)}
})()
