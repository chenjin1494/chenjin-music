const {_electron:electron,expect}=require('@playwright/test'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os')
async function main(){
 const linux=process.platform==='linux',temp=await fs.mkdtemp(path.join(os.tmpdir(),'chenjin-package-')),env={...process.env,PORTABLE_EXECUTABLE_DIR:temp};delete env.ELECTRON_RUN_AS_NODE
 const binary=path.resolve(linux?'release/linux-unpacked/chenjin-music':'release/win-unpacked/琛瑾音乐.exe'),report={checks:[],errors:[]};let app
 try{
  app=await electron.launch({executablePath:binary,env,timeout:45000});const win=await app.firstWindow();win.on('pageerror',error=>report.errors.push(error.message));await win.waitForLoadState('domcontentloaded')
  const call=(method,params)=>win.evaluate(({method,params})=>window.chenjin.invoke(method,params),{method,params})
  const info=await call('app.info');if(info.userData!==path.join(temp,'data')||info.storage!=='sqlite-worker')throw new Error('打包便携数据路径/存储不匹配');report.info=info;report.checks.push('原生打包 ASAR 内 SQLite worker 及独立便携路径')
  const list=await call('playlists.create',{name:'打包持久化验证'});const state=await call('library.load');if(!state.playlists.some(p=>p.id===list.id))throw new Error('打包持久化失败');report.checks.push('打包桥/数据库事务/真实窗口')
  const filename=path.join(temp,'打包音频.mp3');await fs.copyFile(path.resolve('tests/fixtures/sine.mp3'),filename);await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},filename)
  const tracks=await call('files.import',{playlistId:'default'});if(tracks.length!==1)throw new Error('打包本地导入失败')
  await win.evaluate(track=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').play(track,[track]),tracks[0])
  await expect.poll(async()=>win.evaluate(()=>{const music=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music');return music.playing&&music.progress>.1&&music.duration>11}),{timeout:15000}).toBe(true)
  report.audio=await win.evaluate(()=>{const music=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music');return {playing:music.playing,progress:music.progress,duration:music.duration,filters:music.service.filters.length,context:music.service.context?.state,worklet:music.service.capabilities.worklet,error:music.error}})
  if(report.audio.filters!==10||!report.audio.worklet||report.audio.context!=='running'||report.audio.error)throw new Error('打包音效或 AudioWorklet 失败：'+JSON.stringify(report.audio));report.checks.push('打包 MP3 实际播放/进度/十段EQ/AudioWorklet')
  await win.getByRole('button',{name:'设置',exact:true}).click();await expect(win.locator('.appearance-studio .component-options button')).toHaveCount(41)
   await win.evaluate(()=>{const music=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music');return music.updateSettings({appearance:{format:'chenjin-appearance',version:1,name:'打包外观',global:{radius:14,gap:12,shadow:'soft'},components:{sidebar:{width:260},player:{height:120},icon:{strokeWidth:2}}}})})
   await expect.poll(()=>win.locator('.sidebar').evaluate(element=>parseFloat(getComputedStyle(element).width))).toBe(260);await expect.poll(()=>win.locator('.player-bar').evaluate(element=>parseFloat(getComputedStyle(element).height))).toBe(120);report.checks.push('打包40组件编辑器与侧栏/播放器实际网格尺寸')
   await win.screenshot({path:linux?'artifacts/chenjin-linux-packaged.png':'artifacts/chenjin-packaged.png'});if(report.errors.length)throw new Error(report.errors.join('\n'))
 }finally{
  await app?.close();await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(linux?'artifacts/linux-package-report.json':'artifacts/package-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
  if(path.dirname(path.resolve(temp))===path.resolve(os.tmpdir())&&path.basename(temp).startsWith('chenjin-package-'))await fs.rm(temp,{recursive:true,force:true})
 }
}
main().catch(error=>{console.error(error);process.exitCode=1})
