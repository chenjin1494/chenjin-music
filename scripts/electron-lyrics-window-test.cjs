#!/usr/bin/env node
'use strict';
// Integrated Electron renderer + real Win32 compositor/input verification. Never launches the native lyric host.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const {_electron: electron} = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'artifacts');
const reportPath = path.join(artifacts, `electron-lyrics-window${packaged ? '-packaged' : ''}-report.json`);
const bounds = {x:90, y:90, width:900, height:240};
const executable = packaged ? path.join(root, 'release', 'win-unpacked', '琛瑾音乐.exe') : require('electron');
const report = {passed:false, checks:[], errors:[], packaged, version:require('../package.json').version, executable, captures:[], platform:process.platform};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let app, probe;
function check(value, name, details) { report.checks.push({name, passed:!!value, details}); if(!value) throw new Error(`${name}: ${JSON.stringify(details)}`); }
function launchProbe(file) {
  const child = spawn(file, [], {stdio:['pipe','pipe','pipe'], windowsHide:true});
  let buffer='', stderr=''; const queued=[], waiters=[];
  child.stderr.setEncoding('utf8'); child.stderr.on('data', data => stderr += data);
  child.stdout.setEncoding('utf8'); child.stdout.on('data', data => {
    buffer += data; let end;
    while((end=buffer.indexOf('\n'))>=0) {
      const line=buffer.slice(0,end).trim(); buffer=buffer.slice(end+1); if(!line) continue;
      let message; try {message=JSON.parse(line);} catch {stderr += `Invalid probe JSON: ${line}\n`; continue;}
      const index=waiters.findIndex(waiter => message.type==='error'||waiter.predicate(message));
      if(index<0) queued.push(message); else {const waiter=waiters.splice(index,1)[0];clearTimeout(waiter.timer);if(message.type==='error')waiter.reject(new Error(message.message));else waiter.resolve(message);}
    }
  });
  child.on('error', error => {for(const waiter of waiters.splice(0)){clearTimeout(waiter.timer);waiter.reject(error);}});
  child.on('exit', code => {for(const waiter of waiters.splice(0)){clearTimeout(waiter.timer);waiter.reject(new Error(`Probe exited (${code}): ${stderr}`));}});
  function wait(predicate) {const index=queued.findIndex(predicate);if(index>=0)return Promise.resolve(queued.splice(index,1)[0]);return new Promise((resolve,reject)=>{const waiter={predicate,resolve,reject};waiter.timer=setTimeout(()=>{const index=waiters.indexOf(waiter);if(index>=0)waiters.splice(index,1);reject(new Error('Probe timeout: '+stderr));},15000);waiters.push(waiter);});}
  return {child, wait, stderr:()=>stderr, send:message=>child.stdin.write(JSON.stringify(message)+'\n'), async request(message){this.send(message);return wait(next=>next.id===message.id);}};
}
async function rpc(page, method, params) {return page.evaluate(({method,params})=>window.chenjin.invoke(method,params),{method,params});}
async function nativeWindow(page) {
  return app.evaluate(({BrowserWindow},id)=>{const win=BrowserWindow.fromId(id),handle=win.getNativeWindowHandle();return {id,hwnd:(handle.length>=8?handle.readBigUInt64LE(0):BigInt(handle.readUInt32LE(0))).toString(),bounds:win.getBounds(),opacity:win.getOpacity(),visible:win.isVisible(),resizable:win.isResizable()};}, await app.browserWindow(page).then(handle=>handle.evaluate(win=>win.id)));
}
async function capture(name, currentBounds) {
  const result=await probe.request({type:'capture',id:`capture-${name}`,bounds:currentBounds,filename:path.join(artifacts,`electron-lyrics-${name}.png`)});
  report.captures.push(result);
  check(result.interiorTopFourWhitePixels===0&&result.exteriorTopFourWhitePixels===0,`${name}: interior/exterior top four actual screen rows contain no white line`,result);
  check(result.interiorTopFourMismatchedPixels===0&&result.exteriorTopFourMismatchedPixels===0,`${name}: top four interior/exterior rows show controlled backdrop`,result);
  check(result.hasInk,`${name}: OS screenshot contains lyric ink`,result);
  return result;
}
function makeSine(file) {
  const rate=16000, seconds=90, bytes=rate*seconds*2, wav=Buffer.alloc(44+bytes);
  wav.write('RIFF',0);wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
  for(let sample=0;sample<rate*seconds;sample++)wav.writeInt16LE(Math.round(Math.sin(sample/rate*440*Math.PI*2)*1000),44+sample*2);
  fs.writeFileSync(file,wav);fs.writeFileSync(file.replace(/\.wav$/,'.lrc'),'[00:00.00]桌面歌词 Electron steady paused lyrics\n[01:29.00]桌面歌词 Electron steady paused lyrics\n');
}
async function stable(page, name, currentBounds) {
  await probe.request({type:'move',id:`leave-${name}`,x:1050,y:350});
  // Clear toolbar focus so hover/focus CSS transitions are outside the sample region and have settled.
  await page.evaluate(()=>document.activeElement?.blur());await delay(450);
  const result=await probe.request({type:'stable',id:`stable-${name}`,bounds:currentBounds,count:12,interval:250});
  report[`${name}Stability`]=result;
  check(result.allHaveInk,`${name}: lyric ink remains present in all 12 paused OS screenshots`,result);
  check(result.exactPixelsStable,`${name}: actual paused lyric region pixels are identical across 12 samples at 250ms`,result);
}
async function main() {
  if(process.platform!=='win32')throw new Error('Real Electron OS lyric tests require Windows');
  fs.mkdirSync(artifacts,{recursive:true});
  report.executableSHA256=hash(executable);
  if(packaged)report.appAsarSHA256=hash(path.join(path.dirname(executable),'resources','app.asar'));
  const isolated=fs.mkdtempSync(path.join(artifacts,'electron-lyrics-user-data-'));
  report.userData=isolated;
  const sine=path.join(isolated,'steady-sine.wav');makeSine(sine);
  const probeExe=path.join(root,'out','native','ChenjinLyricsWindowProbe.exe');fs.mkdirSync(path.dirname(probeExe),{recursive:true});
  const csc=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  const compiled=spawnSync(csc,['/nologo','/target:exe','/platform:x64','/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll',`/out:${probeExe}`,path.join(root,'native','desktop-lyrics','WindowProbe.cs')],{cwd:root,stdio:'inherit',windowsHide:true});
  check(compiled.status===0,'test-only Win32 probe compiles',{status:compiled.status,error:compiled.error?.message});
  probe=launchProbe(probeExe);const backdrop=await probe.wait(message=>message.type==='ready');report.backdropHwnd=backdrop.hwnd;
  const env={...process.env, CHENJIN_TEST_USER_DATA:isolated, PORTABLE_EXECUTABLE_DIR:isolated};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:packaged?[]:[root],cwd:root,env,timeout:30000});
  report.actualUserData=await app.evaluate(({app})=>app.getPath('userData'));
  const relativeUserData=path.relative(isolated,report.actualUserData);
  check(!relativeUserData.startsWith('..')&&!path.isAbsolute(relativeUserData),'test app user data stays inside its isolated directory',report.actualUserData);
  const main=await app.firstWindow();await main.waitForFunction(()=>!!window.chenjin&&!!document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('music')?.hydrated);
  await main.evaluate(async file=>{
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const music=pinia._s.get('music');if(!music)throw new Error('Main renderer music store is unavailable');
    await music.updateSettings({desktopLyric:false,desktopLyricLock:false,desktopLyricX:90,desktopLyricY:90,desktopLyricWidth:900,desktopLyricHeight:240,desktopLyricTop:true,desktopLyricTaskbar:false,desktopLyricOpacity:1,desktopLyricFontSize:40,desktopLyricPlayedColor:'#ffffff',desktopLyricUnplayColor:'#ffffff',desktopLyricPauseHide:false,desktopLyricHoverHide:false,desktopLyricFullscreenHide:false,desktopLyricVisualization:false,desktopLyricNextLine:false,desktopLyricTopLoop:true,desktopLyricScreenLock:false,lyricWordHighlight:false,muted:true,volume:0,closeBehavior:'quit',closeToTray:false,startupAutoPlay:false});
    const track={id:'electron-os-steady',name:'Electron steady paused lyrics',singer:'OS test',source:'local',interval:'01:30',meta:{songId:'electron-os-steady',albumName:'Test',filePath:file}};
    await window.chenjin.invoke('playlists.add',{playlistId:'default',tracks:[track]});
    await music.play(track,[track]);
  },sine);
  await main.waitForFunction(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').lyric.lyric.includes('steady paused lyrics'));
  await rpc(main,'playback.command',{action:'pause'});
  await main.waitForFunction(async()=>{const music=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music');return music.service.audio.paused&&!music.playing&&(await window.chenjin.invoke('playback.snapshot')).status==='paused';});
  await rpc(main,'desktop.lyric',{enabled:true});
  let lyric;
  const deadline=Date.now()+15000;
  while(Date.now()<deadline&&!lyric){lyric=app.windows().find(page=>new URL(page.url()).searchParams.get('lyric')==='1');if(!lyric)await delay(100);}
  if(!lyric)throw new Error('Integrated application did not create an Electron lyric BrowserWindow');
  await lyric.waitForSelector('.desktop-main-line');await lyric.waitForFunction(()=>document.querySelector('.desktop-main-line').textContent.includes('steady paused lyrics')&&document.querySelector('.desktop-lyric').dataset.playback==='paused');
  report.version=await app.evaluate(({app})=>app.getVersion());
  check(report.version===require('../package.json').version,'running application keeps the requested fixed version',report.version);
  report.applicationWindows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(win=>({id:win.id,url:win.webContents.getURL()})));
  report.displays=await app.evaluate(({screen})=>screen.getAllDisplays().map(display=>({id:display.id,bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor,primary:display.id===screen.getPrimaryDisplay().id})));
  await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).hide(),await app.browserWindow(main).then(handle=>handle.evaluate(win=>win.id)));
  await probe.request({type:'move',id:'initial-leave',x:1050,y:350});
  const staleLibrary=await rpc(main,'library.load');
  check(staleLibrary.settings.desktopLyricLock===false,'stale renderer library snapshot starts unlocked',staleLibrary.settings.desktopLyricLock);
  await rpc(main,'desktop.lock',{enabled:true});
  await rpc(main,'library.save',{state:staleLibrary});await delay(600);
  const preservedLock=(await rpc(main,'library.load')).settings.desktopLyricLock;
  check(preservedLock===true,'saving stale renderer library snapshot preserves authoritative lock setting',preservedLock);
  await lyric.waitForFunction(()=>document.querySelector('.desktop-lyric').classList.contains('locked'));
  const win=await nativeWindow(lyric);report.lyricWindow=win;
  report.fixtureSettings=(await rpc(main,'library.load')).settings;
  report.fixtureComputed=await lyric.evaluate(()=>['html','body','#app','.desktop-lyric','.desktop-word-content','.desktop-main-line'].map(selector=>{const node=document.querySelector(selector),style=getComputedStyle(node);return {selector,color:style.color,opacity:style.opacity,background:style.background,font:style.font,filter:style.filter,transform:style.transform,zoom:style.zoom,animationName:style.animationName,played:style.getPropertyValue('--desktop-played'),unplayed:style.getPropertyValue('--desktop-unplayed')};}));
  check(win.visible&&!win.resizable,'integrated app uses a visible fixed Electron lyric BrowserWindow',win);
  check(Object.keys(bounds).every(key=>win.bounds[key]===bounds[key]),'integrated lyric window has controlled bounds',win.bounds);
  const lockedStyle=await probe.request({type:'inspect',id:'locked-style',hwnd:win.hwnd});report.lockedStyle=lockedStyle;
  check((lockedStyle.style&0x00c40000)===0,'actual Electron HWND excludes WS_CAPTION/WS_THICKFRAME/WS_BORDER',lockedStyle);
  check((lockedStyle.exStyle&0x20)!==0,'actual locked HWND enables input transparency before clicking opaque ink',lockedStyle);
  const locked=await capture('locked',bounds);
  check(locked.hasOpaqueInk,'locked screenshot exposes real opaque lyric ink',locked);
  const lockedClick=await probe.request({type:'click',id:'locked-click',...locked.opaqueInkPoint,expectedHwnd:[backdrop.hwnd]});
  check(lockedClick.targetHwnd===backdrop.hwnd&&lockedClick.clicksAfter===lockedClick.clicksBefore+1,'locked OS click on opaque lyric ink passes through to controlled backdrop',lockedClick);
  await stable(lyric,'locked',bounds);
  report.toggleCycles=[];
  for(let cycle=0;cycle<6;cycle++) {
    const mode={desktopLyricTop:cycle%2===0,desktopLyricTaskbar:cycle%2!==0,desktopLyricTopLoop:true};
    await rpc(main,'settings.update',mode);
    for(const enabled of [false,true]) {
      await rpc(main,'desktop.lock',{enabled});
      // Bring only our lyric window above the controlled backdrop when it is not globally topmost.
      if(!mode.desktopLyricTop)await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).moveTop(),win.id);
      await delay(180);
      const style=await probe.request({type:'inspect',id:`cycle-${cycle}-${enabled}-style`,hwnd:win.hwnd});
      check((style.style&0x00c40000)===0,`cycle ${cycle+1} ${enabled?'locked':'unlocked'}: real HWND stays chrome-free`,style);
      const pixels=await capture(`cycle-${cycle+1}-${enabled?'locked':'unlocked'}`,bounds);
      report.toggleCycles.push({cycle:cycle+1,locked:enabled,settings:mode,style,capture:pixels});
    }
  }
  await rpc(main,'settings.update',{desktopLyricTop:true,desktopLyricTaskbar:false,desktopLyricTopLoop:true});
  await rpc(main,'desktop.lock',{enabled:false});await delay(400);
  const unlockedStyle=await probe.request({type:'inspect',id:'unlocked-style',hwnd:win.hwnd});report.unlockedStyle=unlockedStyle;
  check((unlockedStyle.style&0x00c40000)===0,'unlock preserves actual chrome-free HWND',unlockedStyle);
  const unlocked=await capture('unlocked',bounds);
  await probe.request({type:'move',id:'toolbar-hover',...unlocked.inkPoint});await delay(350);
  const button=lyric.locator('button[aria-label="放大歌词"]');const buttonBox=await button.boundingBox();
  check(!!buttonBox,'actual Vue toolbar exposes font-size action',buttonBox);
  const before=await rpc(main,'library.load');
  const toolbarClick=await probe.request({type:'click',id:'toolbar-click',x:bounds.x+Math.round(buttonBox.x+buttonBox.width/2),y:bounds.y+Math.round(buttonBox.y+buttonBox.height/2),expectedHwnd:[win.hwnd]});
  check(toolbarClick.targetHwnd===win.hwnd&&toolbarClick.clicksAfter===toolbarClick.clicksBefore,'unlocked actual toolbar click is captured by Electron HWND',toolbarClick);
  await main.waitForFunction(size=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').settings.desktopLyricFontSize===size,before.settings.desktopLyricFontSize+2);
  check((await rpc(main,'library.load')).settings.desktopLyricFontSize===before.settings.desktopLyricFontSize+2,'real toolbar click updates persisted font-size through app IPC');
  const dragBox=await lyric.locator('.desktop-word-content').boundingBox();
  const start={x:bounds.x+Math.round(dragBox.x+dragBox.width/2),y:bounds.y+Math.round(dragBox.y+dragBox.height/2)};
  await probe.request({type:'drag',id:'electron-drag',...start,toX:start.x+12,toY:start.y+8,expectedHwnd:win.hwnd});await delay(400);
  const moved=(await nativeWindow(lyric)).bounds;
  check(moved.x===bounds.x+12&&moved.y===bounds.y+8&&moved.width===bounds.width&&moved.height===bounds.height,'actual OS pointer drag invokes Vue custom IPC move',moved);
  const grip=await lyric.locator('.desktop-resize-handle').boundingBox();check(!!grip,'Vue resize corner is present',grip);
  const corner={x:moved.x+Math.round(grip.x+grip.width/2),y:moved.y+Math.round(grip.y+grip.height/2)};
  await probe.request({type:'move',id:'resize-hover',...corner});await delay(100);
  await probe.request({type:'drag',id:'electron-resize',...corner,toX:corner.x+12,toY:corner.y+8,expectedHwnd:win.hwnd});await delay(400);
  const resized=(await nativeWindow(lyric)).bounds;
  check(resized.x===moved.x&&resized.y===moved.y&&resized.width===bounds.width+12&&resized.height===bounds.height+8,'actual OS corner drag invokes Vue custom IPC resize',resized);
  const saved=await rpc(main,'library.load');check(saved.settings.desktopLyricX===resized.x&&saved.settings.desktopLyricY===resized.y&&saved.settings.desktopLyricWidth===resized.width&&saved.settings.desktopLyricHeight===resized.height,'actual move/resize bounds persist in isolated app settings',saved.settings);
  await stable(lyric,'unlocked',resized);
  report.offscreenBeforeReset=await app.evaluate(({BrowserWindow},id)=>{const lyric=BrowserWindow.fromId(id);lyric.setBounds({x:-30000,y:-30000,width:900,height:180});return lyric.getBounds();},win.id);
  const offscreenExpected=await rpc(main,'desktop.resetPosition');await delay(400);
  const offscreenActual=await nativeWindow(lyric),offscreenOS=await probe.request({type:'inspect',id:'offscreen-dpi-reset',hwnd:win.hwnd});
  report.offscreenReset={requested:{x:-30000,y:-30000,width:900,height:180},beforeReset:report.offscreenBeforeReset,expected:offscreenExpected,actual:offscreenActual.bounds,native:offscreenOS};
  check(Object.keys(offscreenExpected).every(key=>offscreenActual.bounds[key]===offscreenExpected[key]),'actual offscreen -30000 DPI transition resets to exact requested primary-monitor bounds',report.offscreenReset);
  report.dpiResetChecks=[];
  for(const display of report.displays)for(const direction of ['vertical','horizontal']) {
    const area=display.workArea;
    const requested={x:area.x+10,y:area.y+10,width:Math.min(direction==='vertical'?180:900,area.width-20),height:Math.min(direction==='vertical'?700:180,area.height-20)};
    await rpc(main,'settings.update',{desktopLyricDirection:direction,desktopLyricX:requested.x,desktopLyricY:requested.y,desktopLyricWidth:requested.width,desktopLyricHeight:requested.height});
    await delay(400);
    const migrated=await nativeWindow(lyric);
    const migratedOS=await probe.request({type:'inspect',id:`dpi-${display.id}-${direction}-migrated`,hwnd:win.hwnd});
    const placementTolerance=display.scaleFactor%1!==0?1:0;
    check(Object.keys(requested).every(key=>Math.abs(migrated.bounds[key]-requested[key])<=placementTolerance),`display ${display.id} scale ${display.scaleFactor} ${direction}: real Electron placement stays within ${placementTolerance} DIP pixel-rounding allowance`,{requested,actual:migrated.bounds,placementTolerance,native:migratedOS});
    const expected=await rpc(main,'desktop.resetPosition');await delay(400);
    const actual=await nativeWindow(lyric);
    const native=await probe.request({type:'inspect',id:`dpi-${display.id}-${direction}-reset`,hwnd:win.hwnd});
    check(Object.keys(expected).every(key=>actual.bounds[key]===expected[key]),`display ${display.id} scale ${display.scaleFactor} ${direction}: actual reset preserves requested size and primary-monitor position`,{expected,actual:actual.bounds,native});
    check((native.style&0x00c40000)===0,`display ${display.id} ${direction}: DPI reset keeps actual HWND chrome-free`,native);
    report.dpiResetChecks.push({fromDisplay:display,direction,requested,migrated:migrated.bounds,migratedOS,expected,actual:actual.bounds,native});
  }
  await rpc(main,'settings.update',{desktopLyricDirection:'horizontal',desktopLyricX:resized.x,desktopLyricY:resized.y,desktopLyricWidth:resized.width,desktopLyricHeight:resized.height,desktopLyricLock:false,desktopLyricTop:true,desktopLyricTaskbar:false,desktopLyricTopLoop:true});
  await delay(400);
  report.endState={window:await nativeWindow(lyric),playback:await rpc(main,'playback.snapshot'),settings:(await rpc(main,'library.load')).settings};
  check(Object.keys(resized).every(key=>report.endState.window.bounds[key]===resized[key])&&report.endState.playback.status==='paused'&&!report.endState.settings.desktopLyricLock&&report.endState.settings.desktopLyricTop&&report.endState.settings.desktopLyricTopLoop&&!report.endState.settings.desktopLyricTaskbar,'test ends paused and unlocked with restored controlled bounds/top-loop/taskbar settings',report.endState);
  report.passed=true;
}
main().catch(error=>{report.errors.push(error.stack||String(error));process.exitCode=1;}).finally(async()=>{
  if(app)try{await app.close();}catch(error){report.errors.push('Test app cleanup: '+error);report.passed=false;process.exitCode=1;try{app.process().kill();}catch{}}
  if(probe){
    try{probe.send({type:'quit'});report.restoration=await Promise.race([probe.wait(message=>message.type==='restored'),delay(1500).then(()=>null)]);}catch(error){report.errors.push('Probe restoration: '+error);}
    await Promise.race([new Promise(resolve=>{if(probe.child.exitCode!==null)resolve();else probe.child.once('exit',resolve);}),delay(1500)]);
    if(probe.child.exitCode===null){probe.child.kill();report.errors.push('Probe needed forced termination; cursor restoration may be incomplete');report.passed=false;process.exitCode=1;}
    const restored=report.restoration?.cursorRestored&&report.restoration?.foregroundRestored;
    report.checks.push({name:'test cleanup restores original OS cursor and foreground',passed:!!restored,details:report.restoration});
    if(!restored){report.errors.push('OS cursor/foreground restoration was not confirmed');report.passed=false;process.exitCode=1;}
    report.probeStderr=probe.stderr();if(report.probeStderr){report.errors.push(report.probeStderr);report.passed=false;process.exitCode=1;}
  }
  fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(`Electron OS lyrics test ${report.passed?'PASSED':'FAILED'}: ${reportPath}`);
});
