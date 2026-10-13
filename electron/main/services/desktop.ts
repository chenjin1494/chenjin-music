import { BrowserWindow, globalShortcut, Menu, nativeImage, nativeTheme, powerSaveBlocker, screen, Tray } from 'electron'
import { deflateSync } from 'node:zlib'
import type { PlayerStatus, Settings } from '../../../src/shared/types'

function icon(kind:'music'|'prev'|'play'|'pause'|'next',tone?:'black'|'white') {
 const width=32,raw=Buffer.alloc((width*4+1)*width)
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const music=kind==='music'
  const waveHeights=[4,8,12,17,21,14,9,5],bar=Math.floor((x-4)/3),wave=bar>=0&&bar<8&&(x-4)%3<2&&Math.abs(y-16)<=waveHeights[bar]/2
  const mark=tone&&music?wave:music ? ((x>=17&&x<=20&&y>=7&&y<=23)||(x>=10&&x<=20&&y>=7&&y<=10)||((x-14)**2+(y-23)**2<20)) : kind==='pause' ? (y>7&&y<25&&((x>9&&x<14)||(x>18&&x<23))) : kind==='prev' ? ((x>7&&x<10&&y>7&&y<25)||(x>=10&&x<=23&&Math.abs(y-16)<(x-9)*.65)) : kind==='next' ? ((x>23&&x<26&&y>7&&y<25)||(x>=9&&x<=23&&Math.abs(y-16)<(24-x)*.65)) : (x>=10&&x<=24&&Math.abs(y-16)<(25-x)*.65)
  const offset=y*(width*4+1)+1+x*4
  const channel=tone==='black'?0:255
  raw[offset]=tone?channel:mark?255:167;raw[offset+1]=tone?channel:mark?255:139;raw[offset+2]=tone?channel:mark?255:250;raw[offset+3]=tone?mark?255:0:music?255:mark?255:0
 }
 const crc=(buffer:Buffer)=>{let value=0xffffffff;for(const byte of buffer){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0)}return (value^0xffffffff)>>>0}
 const chunk=(name:string,data:Buffer)=>{const type=Buffer.from(name);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const check=Buffer.alloc(4);check.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([length,type,data,check])}
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(width,4);header[8]=8;header[9]=6
 return nativeImage.createFromBuffer(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]))
}
const icons={music:icon('music'),black:icon('music','black'),white:icon('music','white'),prev:icon('prev'),next:icon('next'),play:icon('play'),pause:icon('pause')}
export function trayAppearance(settings:Settings,dark:boolean):'black'|'white'|'music' {
 const preference=settings.trayTheme??settings.trayThemeId??settings['tray.themeId']??0
 if(preference==='black'||preference===2)return 'black'
 if(preference==='white')return 'white'
 if(preference==='brand'||preference==='original'||preference===1)return 'music'
 return dark?'white':'black'
}
const finite=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback
export function clampLyricBounds(bounds:Electron.Rectangle,areas:Electron.Rectangle[]):Electron.Rectangle {
 if(!areas.length)return {x:Math.round(finite(bounds.x,0)),y:Math.round(finite(bounds.y,0)),width:Math.max(38,Math.round(finite(bounds.width,900))),height:Math.max(38,Math.round(finite(bounds.height,180)))}
 const x=finite(bounds.x,areas[0].x),y=finite(bounds.y,areas[0].y),width=Math.max(38,finite(bounds.width,900)),height=Math.max(38,finite(bounds.height,180))
 let best=areas[0],score=-Infinity
 for(const area of areas){const overlap=Math.max(0,Math.min(x+width,area.x+area.width)-Math.max(x,area.x))*Math.max(0,Math.min(y+height,area.y+area.height)-Math.max(y,area.y));const dx=Math.max(area.x-(x+width),x-(area.x+area.width),0),dy=Math.max(area.y-(y+height),y-(area.y+area.height),0);const value=overlap>0?overlap:-(dx*dx+dy*dy);if(value>score){score=value;best=area}}
 const w=Math.round(Math.min(width,best.width)),h=Math.round(Math.min(height,best.height))
 return {x:Math.round(Math.max(best.x,Math.min(x,best.x+best.width-w))),y:Math.round(Math.max(best.y,Math.min(y,best.y+best.height-h))),width:w,height:h}
}
export function lyricShouldShow(input:{enabled:boolean;hasContent:boolean;playing:boolean;pauseHide:boolean;fullscreen:boolean;fullscreenHide:boolean;locked:boolean;hovered:boolean;hoverHide:boolean}):boolean {
 return input.enabled&&input.hasContent&&!(input.pauseHide&&!input.playing)&&!(input.fullscreenHide&&input.fullscreen)&&!(input.locked&&input.hoverHide&&input.hovered)
}
export interface DesktopOptions {pollMs?:number}
export class DesktopService {
 private tray?:Tray
 private lyric?:BrowserWindow
 private blocker?:number
 private locked=false
 private onTop=true
 private playing=false
 private hasContent=false
 private enabled=false
 private settings?:Settings
 private hotkeySignature=''
 private keys=new Set<string>()
 private timer?:NodeJS.Timeout
 private boundsTimer?:NodeJS.Timeout
 private fullscreen=false
 private boundMain?:BrowserWindow
 private disposed=false
 private applyingBounds=false
 private fullscreenEnter=()=>{this.fullscreen=true;this.refreshVisibility()}
 private fullscreenLeave=()=>{this.fullscreen=false;this.refreshVisibility()}
 private lastStatus?:PlayerStatus
 private displayIds=new Set<number>()
 private trayTone?:'black'|'white'|'music'
 private themeChanged=()=>this.updateTrayImage()
 private displayChanged=()=>{const displays=screen.getAllDisplays(),removed=[...this.displayIds].some(id=>!displays.some(display=>display.id===id));this.displayIds=new Set(displays.map(display=>display.id));if(this.lyric&&!this.lyric.isDestroyed()){this.place(this.lyric.getBounds(),removed);this.queueBoundsSave()}this.refreshVisibility()}
 constructor(private main:()=>BrowserWindow|undefined,private createLyric:()=>BrowserWindow,private command:(command:string,value?:unknown)=>void,private options:DesktopOptions={},private onSettingChange?:(patch:Partial<Settings>)=>void|Promise<void>){
  this.displayIds=new Set(screen.getAllDisplays().map(display=>display.id));nativeTheme.on('updated',this.themeChanged)
  screen.on('display-added',this.displayChanged);screen.on('display-removed',this.displayChanged);screen.on('display-metrics-changed',this.displayChanged)
 }
 private save(patch:Partial<Settings>){if(!this.settings)return;const changes=Object.fromEntries(Object.entries(patch).filter(([key,value])=>this.settings![key]!==value));if(!Object.keys(changes).length)return;Object.assign(this.settings,changes);try{void Promise.resolve(this.onSettingChange?.(changes)).catch(()=>{})}catch{}}
 private bindMain(){const main=this.main();if(main===this.boundMain)return;this.boundMain?.removeListener('enter-full-screen',this.fullscreenEnter);this.boundMain?.removeListener('leave-full-screen',this.fullscreenLeave);this.boundMain=main;this.fullscreen=main?.isFullScreen()??false;main?.on('enter-full-screen',this.fullscreenEnter);main?.on('leave-full-screen',this.fullscreenLeave)}
 private areas(){return screen.getAllDisplays().map(display=>display.workArea)}
 private checkedBounds(bounds:Electron.Rectangle,force=false){
  const areas=this.areas(),valid=['x','y','width','height'].every(key=>Number.isFinite((bounds as any)[key]))&&bounds.width>=38&&bounds.height>=38
  const intersects=areas.some(area=>bounds.x+bounds.width>area.x&&bounds.x<area.x+area.width&&bounds.y+bounds.height>area.y&&bounds.y<area.y+area.height)
  return !force&&this.settings?.desktopLyricScreenLock===false&&valid&&intersects?bounds:clampLyricBounds(bounds,areas)
 }
 private desiredBounds(){
  const s=this.settings!,vertical=s.desktopLyricDirection==='vertical',area=screen.getPrimaryDisplay().workArea
  const width=finite(s.desktopLyricWidth,vertical?180:900),height=finite(s.desktopLyricHeight,vertical?900:180)
  return this.checkedBounds({x:finite(s.desktopLyricX,area.x+(area.width-width)/2),y:finite(s.desktopLyricY,area.y+area.height-height),width,height})
 }
 private place(bounds:Electron.Rectangle,force=false){if(!this.lyric||this.lyric.isDestroyed())return;const next=this.checkedBounds(bounds,force),old=this.lyric.getBounds();if(['x','y','width','height'].every(key=>(old as any)[key]===(next as any)[key]))return;this.applyingBounds=true;try{this.lyric.setBounds(next)}finally{this.applyingBounds=false}}
 private queueBoundsSave(){if(this.disposed||this.applyingBounds||!this.lyric||this.lyric.isDestroyed())return;if(this.boundsTimer)clearTimeout(this.boundsTimer);this.boundsTimer=setTimeout(()=>{this.boundsTimer=undefined;if(!this.lyric||this.lyric.isDestroyed())return;this.place(this.lyric.getBounds());const b=this.lyric.getBounds();this.save({desktopLyricX:b.x,desktopLyricY:b.y,desktopLyricWidth:b.width,desktopLyricHeight:b.height})},250);this.boundsTimer.unref()}
 apply(settings:Settings){
  if(this.disposed)return
  this.settings=structuredClone(settings);this.bindMain();this.registerHotkeys(settings)
  this.locked=!!settings.desktopLyricLock;this.onTop=settings.desktopLyricTop!==false
  if(settings.tray&&!this.tray){
   this.tray=new Tray(icons.music);this.tray.setToolTip('琛瑾音乐');this.tray.on('double-click',()=>{this.main()?.show();this.main()?.focus()})
  }else if(!settings.tray&&this.tray){this.tray.destroy();this.tray=undefined;this.trayTone=undefined}
  this.tray?.setContextMenu(Menu.buildFromTemplate([{label:'显示琛瑾音乐',click:()=>{this.main()?.show();this.main()?.focus()}},{label:'播放 / 暂停',click:()=>this.command('toggle')},{label:'上一首',click:()=>this.command('prev')},{label:'下一首',click:()=>this.command('next')},{type:'separator'},{label:'桌面歌词',type:'checkbox',checked:!!settings.desktopLyric,click:()=>this.setLyric(!this.enabled)},{label:'退出',click:()=>this.command('quit')}]))
  this.updateTrayImage();this.updateStatusText()
  this.setLyric(settings.desktopLyric,false)
  if(this.lyric){this.place(this.desiredBounds());this.setLock(this.locked,false);this.setTop(this.onTop,false);this.lyric.setSkipTaskbar(!settings.desktopLyricTaskbar);this.lyric.setOpacity(Math.max(0,Math.min(1,finite(settings.desktopLyricOpacity,1))));this.lyric.setResizable(!this.locked);this.queueBoundsSave();this.sendStyle()}
  this.refreshVisibility();this.updateBlocker(settings)
 }
 private sendStyle(){if(this.lyric&&!this.lyric.isDestroyed())this.lyric.webContents.send('desktop.preferences',structuredClone(this.settings))}
 registerHotkeys(settings=this.settings){
  const defaults:Record<string,string>={toggle:'CommandOrControl+Alt+Space',prev:'MediaPreviousTrack',next:'MediaNextTrack'}
  const configured=settings?.globalHotkeys&&typeof settings.globalHotkeys==='object'?settings.globalHotkeys as Record<string,string>:defaults
  const signature=JSON.stringify({configured,mediaKeys:settings?.mediaKeys!==false});if(signature===this.hotkeySignature)return;this.hotkeySignature=signature
  for(const key of this.keys)globalShortcut.unregister(key);this.keys.clear()
  const register=(key:string,callback:()=>void)=>{if(process.platform==='win32'&&/^Media(?:PlayPause|PreviousTrack|NextTrack|Stop)$/i.test(key))return;if(this.keys.has(key))return;try{if(globalShortcut.register(key,callback))this.keys.add(key)}catch{}}
  if(settings?.mediaKeys!==false){register('MediaPlayPause',()=>this.command('toggle'));register('MediaPreviousTrack',()=>this.command('prev'));register('MediaNextTrack',()=>this.command('next'))}
  for(const [action,key]of Object.entries(configured)){if(typeof key!=='string'||!key||(settings?.mediaKeys===false&&key.startsWith('Media'))||!['toggle','play','pause','stop','next','prev','collect','uncollect','dislike','mute','volumeUp','volumeDown','seekForward','seekBackward','seekBack','lyric','lyricLock','lyricTop','desktopLyric','desktopLock','desktopTop','windowMinimize','windowToggleMin','windowToggleHide','windowClose','show','search'].includes(action))continue;register(key,()=>{if(action==='lyric'){this.setLyric(!this.enabled);return}if(action==='lyricLock'){this.setLock(!this.locked);return}if(action==='lyricTop'){this.setTop(!this.onTop);return}if(action==='show'){this.main()?.show();this.main()?.focus();return}this.command(action)})}
 }
 setLyric(enabled:boolean,persist=true){
  if(this.disposed)return false
  this.enabled=enabled;if(persist)this.save({desktopLyric:enabled})
  if(enabled&&(!this.lyric||this.lyric.isDestroyed())){
   const win=this.createLyric();this.lyric=win;win.setMinimumSize(38,38);win.setMaximizable(false);win.setFullScreenable(false);win.setHasShadow(false);this.place(this.settings?this.desiredBounds():win.getBounds());win.setAlwaysOnTop(this.onTop,'floating');win.setIgnoreMouseEvents(this.locked,{forward:true});win.setResizable(!this.locked)
   win.on('move',()=>this.queueBoundsSave());win.on('resize',()=>this.queueBoundsSave());win.on('closed',()=>{if(this.lyric===win)this.lyric=undefined});win.webContents.on('did-finish-load',()=>{if(this.lyric===win){this.sendStyle();this.refreshVisibility()}})
  }
  if(enabled&&!this.timer){this.timer=setInterval(()=>this.refreshVisibility(),Math.max(50,this.options.pollMs??100));this.timer.unref()}
  if(!enabled&&this.timer){clearInterval(this.timer);this.timer=undefined}
  this.refreshVisibility();return enabled
 }
 setLock(enabled:boolean,persist=true){this.locked=enabled;this.lyric?.setIgnoreMouseEvents(enabled,{forward:true});this.lyric?.setResizable(!enabled);if(persist)this.save({desktopLyricLock:enabled});this.refreshVisibility();return enabled}
 setTop(enabled:boolean,persist=true){this.onTop=enabled;this.lyric?.setAlwaysOnTop(enabled,'floating');if(persist)this.save({desktopLyricTop:enabled});return enabled}
 private refreshVisibility(){
  if(!this.lyric||this.lyric.isDestroyed()||!this.settings)return
  if(this.enabled&&this.onTop&&this.settings.desktopLyricTopLoop===true)this.lyric.setAlwaysOnTop(true,'floating')
  const b=this.lyric.getBounds(),point=screen.getCursorScreenPoint(),hovered=point.x>=b.x&&point.x<b.x+b.width&&point.y>=b.y&&point.y<b.y+b.height
  const visible=lyricShouldShow({enabled:this.enabled,hasContent:this.hasContent,playing:this.playing,pauseHide:!!this.settings.desktopLyricPauseHide,fullscreen:this.fullscreen,fullscreenHide:!!this.settings.desktopLyricFullscreenHide,locked:this.locked,hovered,hoverHide:!!this.settings.desktopLyricHoverHide})
  if(visible&&!this.lyric.isVisible())this.lyric.showInactive();else if(!visible&&this.lyric.isVisible())this.lyric.hide()
 }
 private updateTrayImage(){if(!this.tray||!this.settings)return;const tone=trayAppearance(this.settings,nativeTheme.shouldUseDarkColors);if(tone!==this.trayTone){this.tray.setImage(icons[tone]);this.trayTone=tone}}
 private updateStatusText(){
  const status=this.lastStatus,song=status?.name?[status.name,status.singer].filter(Boolean).join(' - '):'',line=this.settings?.statusBarLyric?status?.lyricLineText||'':''
  this.tray?.setTitle(line.slice(0,200));this.tray?.setToolTip(['琛瑾音乐',song,line].filter(Boolean).join('\n').slice(0,120))
  this.main()?.setTitle(['琛瑾音乐',song,line].filter(Boolean).join(' · ').slice(0,300))
 }
 private updateBlocker(settings:Settings){if(settings.preventSleep&&this.playing&&this.blocker===undefined)this.blocker=powerSaveBlocker.start('prevent-app-suspension');if((!settings.preventSleep||!this.playing)&&this.blocker!==undefined){powerSaveBlocker.stop(this.blocker);this.blocker=undefined}}
 status(status:PlayerStatus,settings:Settings){
  if(this.disposed)return;this.lastStatus={...status};this.playing=status.status==='playing';this.hasContent=!!(status.name||status.lyricLineText||status.lyric);this.settings=structuredClone(settings);this.bindMain();this.refreshVisibility()
  this.main()?.setProgressBar(this.playing&&status.duration>0?Math.max(0,Math.min(1,status.progress/status.duration)):-1);this.updateStatusText();this.updateTrayImage()
  if(process.platform==='win32')this.main()?.setThumbarButtons([{tooltip:'上一首',icon:icons.prev,click:()=>this.command('prev')},{tooltip:this.playing?'暂停':'播放',icon:this.playing?icons.pause:icons.play,click:()=>this.command('toggle')},{tooltip:'下一首',icon:icons.next,click:()=>this.command('next')}]);this.updateBlocker(settings)
 }
 dispose(){if(this.disposed)return;if(this.boundsTimer&&this.lyric&&!this.lyric.isDestroyed()){const b=this.lyric.getBounds();this.save({desktopLyricX:b.x,desktopLyricY:b.y,desktopLyricWidth:b.width,desktopLyricHeight:b.height})}this.disposed=true;if(this.timer)clearInterval(this.timer);if(this.boundsTimer)clearTimeout(this.boundsTimer);for(const key of this.keys)globalShortcut.unregister(key);this.keys.clear();this.boundMain?.removeListener('enter-full-screen',this.fullscreenEnter);this.boundMain?.removeListener('leave-full-screen',this.fullscreenLeave);screen.removeListener('display-added',this.displayChanged);screen.removeListener('display-removed',this.displayChanged);screen.removeListener('display-metrics-changed',this.displayChanged);nativeTheme.removeListener('updated',this.themeChanged);this.tray?.destroy();this.tray=undefined;this.trayTone=undefined;this.lyric?.destroy();this.lyric=undefined;if(this.blocker!==undefined){powerSaveBlocker.stop(this.blocker);this.blocker=undefined}}
}
