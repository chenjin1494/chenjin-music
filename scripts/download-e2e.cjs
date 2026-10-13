const {_electron:electron}=require('@playwright/test')
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),os=require('node:os')
async function main(){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'chenjin-download-')),env={...process.env,CHENJIN_TEST_USER_DATA:path.join(directory,'userdata')};delete env.ELECTRON_RUN_AS_NODE
 const mp3=await fs.readFile('tests/fixtures/sine.mp3'),flac=await fs.readFile('tests/fixtures/sine.flac');let ranges=[]
 const server=http.createServer((req,res)=>{const bytes=req.url.includes('flac')?flac:mp3;const start=Number(req.headers.range?.match(/bytes=(\d+)-/)?.[1] || 0);if(start)ranges.push(start);res.writeHead(start?206:200,{'Content-Length':bytes.length-start,'Content-Type':req.url.includes('flac')?'audio/flac':'audio/mpeg','Accept-Ranges':'bytes',...(start?{'Content-Range':`bytes ${start}-${bytes.length-1}/${bytes.length}`}:{})});let offset=start;const timer=setInterval(()=>{if(offset>=bytes.length){clearInterval(timer);res.end();return}res.write(bytes.subarray(offset,offset+8192));offset+=8192},50);res.on('close',()=>clearInterval(timer))})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port
 const app=await electron.launch({args:[path.resolve('.')],env,timeout:30000}),report={checks:[],errors:[],ranges}
 try{
  const win=await app.firstWindow();await win.waitForLoadState('domcontentloaded');const call=(method,params)=>win.evaluate(({method,params})=>window.chenjin.invoke(method,params),{method,params});win.on('pageerror',e=>report.errors.push(e.message))
  await call('settings.update',{downloadEnabled:true,downloadPath:directory,downloadLyrics:false,embedLyrics:false,embedCover:false,hotSearch:false,downloadConcurrency:1})
  const raw=`/** @name Download Regression\n * @version 1.0.0 */\nlx.on(lx.EVENT_NAMES.request,async({info})=>'http://127.0.0.1:${port}/sine.'+(info.type==='flac'?'flac':'mp3'));lx.send(lx.EVENT_NAMES.inited,{sources:{wy:{type:'music',actions:['musicUrl'],qualitys:['128k','flac']}}});`
  const script=await call('sources.import',{raw});await call('sources.activate',{id:script.id})
  const track={id:'wy_download',source:'wy',name:'原创测试',singer:'琛瑾',interval:'00:12',meta:{songId:1,albumName:'验证专辑',qualitys:[{type:'128k',size:null},{type:'flac',size:null}]}}
  const [task]=await call('downloads.add',{tracks:[track],quality:'128k'})
  await win.waitForFunction(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').library.downloads.some(t=>t.received>10000),{},{timeout:15000})
  await call('downloads.action',{id:task.id,action:'pause'});await win.waitForTimeout(150);let state=await call('library.load');if(state.downloads.find(t=>t.id===task.id).status!=='paused')throw new Error('暂停状态失效')
  await call('downloads.action',{id:task.id,action:'resume'})
  await win.waitForFunction(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').library.downloads.some(t=>t.status==='completed'),{},{timeout:15000})
  if(!ranges.length)throw new Error('恢复未使用真实 Range');state=await call('library.load');const saved=state.downloads.find(t=>t.id===task.id);const {parseFile}=await import('music-metadata');const metadata=await parseFile(saved.path);if(metadata.common.title!==track.name||metadata.common.artist!==track.singer||metadata.format.duration<11)throw new Error('MP3 标签/音频帧失败');report.checks.push('MP3断点暂停恢复/真实Range/ID3标签/音频时长')
  await call('downloads.add',{tracks:[{...track,id:'wy_flac'}],quality:'flac'})
  await win.waitForFunction(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').library.downloads.filter(t=>t.status==='completed').length===2,{},{timeout:15000})
  state=await call('library.load');const second=state.downloads.find(t=>t.quality==='flac');const tags=await parseFile(second.path);if(tags.common.title!==track.name||tags.format.duration<11)throw new Error('FLAC标签/音频失败');report.checks.push('FLAC标签及完整音频时长')
  await call('sources.remove',{id:script.id});await win.evaluate(track=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').play(track,[track]),track);await win.waitForTimeout(700);const playback=await win.evaluate(()=>{const s=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music');return {playing:s.playing,progress:s.progress,duration:s.duration}});if(!playback.playing||playback.progress<=0||playback.duration<11)throw new Error('已下载离线播放失败：'+JSON.stringify(playback));report.checks.push('移除音源后的已下载文件离线播放')
  if(report.errors.length)throw new Error(report.errors.join('\n'))
 }finally{await app.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile('artifacts/download-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
}
main().catch(e=>{console.error(e);process.exitCode=1})
