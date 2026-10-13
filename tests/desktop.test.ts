import {describe,expect,it,vi,afterEach,beforeEach}from 'vitest'
import {EventEmitter}from 'node:events'
import {inflateSync}from 'node:zlib'
const mocked=vi.hoisted(()=>({theme:undefined as any,screen:undefined as any,trays:[] as any[],images:[] as Buffer[],displays:[{id:1,workArea:{x:0,y:0,width:1920,height:1040}}]}))
vi.mock('electron',async()=>{
 const {EventEmitter}=await import('node:events')
 mocked.theme=Object.assign(new EventEmitter(),{shouldUseDarkColors:false})
 mocked.screen=Object.assign(new EventEmitter(),{getAllDisplays:()=>mocked.displays,getPrimaryDisplay:()=>mocked.displays[0],getCursorScreenPoint:()=>({x:-100,y:-100})})
 class MockTray extends EventEmitter{setToolTip=vi.fn();setTitle=vi.fn();setImage=vi.fn();setContextMenu=vi.fn();destroy=vi.fn();constructor(public image:unknown){super();mocked.trays.push(this)}}
 return {nativeImage:{createFromBuffer:(bytes:Buffer)=>{mocked.images.push(bytes);return bytes}},nativeTheme:mocked.theme,screen:mocked.screen,BrowserWindow:vi.fn(),globalShortcut:{register:()=>false,unregister:vi.fn()},Menu:{buildFromTemplate:(template:unknown)=>template},powerSaveBlocker:{start:()=>1,stop:vi.fn()},Tray:MockTray}
})
import {clampLyricBounds,lyricShouldShow,DesktopService,trayAppearance}from '../electron/main/services/desktop'
import {defaultSettings}from '../src/shared/defaults'
import type {PlayerStatus}from '../src/shared/types'
describe('desktop lyric work areas',()=>{
 it('keeps negative-origin secondary displays and clamps all edges',()=>{
  const areas=[{x:0,y:0,width:1920,height:1040},{x:-1280,y:-200,width:1280,height:1024}]
  expect(clampLyricBounds({x:-1200,y:-180,width:500,height:180},areas)).toEqual({x:-1200,y:-180,width:500,height:180})
  expect(clampLyricBounds({x:-1500,y:-300,width:500,height:180},areas)).toEqual({x:-1280,y:-200,width:500,height:180})
  expect(clampLyricBounds({x:1800,y:1000,width:500,height:180},areas)).toEqual({x:1420,y:860,width:500,height:180})
 })
 it('recovers disconnected displays and bounds oversized or corrupt dimensions',()=>{
  const area={x:100,y:50,width:800,height:600}
  expect(clampLyricBounds({x:-2000,y:10,width:1000,height:700},[area])).toEqual({x:100,y:50,width:800,height:600})
  expect(clampLyricBounds({x:NaN,y:Infinity,width:0,height:-1},[area])).toEqual({x:100,y:50,width:38,height:38})
 })
 it('hides for enabled independent rules and only hover hides while locked',()=>{
  const base={enabled:true,hasContent:true,playing:true,pauseHide:false,fullscreen:false,fullscreenHide:true,locked:true,hovered:false,hoverHide:true}
  expect(lyricShouldShow(base)).toBe(true);expect(lyricShouldShow({...base,hasContent:false})).toBe(false)
  expect(lyricShouldShow({...base,playing:false,pauseHide:true})).toBe(false);expect(lyricShouldShow({...base,fullscreen:true})).toBe(false)
  expect(lyricShouldShow({...base,hovered:true})).toBe(false);expect(lyricShouldShow({...base,hovered:true,locked:false})).toBe(true);expect(lyricShouldShow({...base,enabled:false})).toBe(false)
 })
})
class MockWindow extends EventEmitter{
 webContents=new EventEmitter() as EventEmitter&{send:ReturnType<typeof vi.fn>}
 bounds={x:20,y:20,width:400,height:180};visible=false;destroyed=false
 setAlwaysOnTop=vi.fn();setIgnoreMouseEvents=vi.fn();setResizable=vi.fn();setMinimumSize=vi.fn();setMaximizable=vi.fn();setFullScreenable=vi.fn();setHasShadow=vi.fn();setSkipTaskbar=vi.fn();setOpacity=vi.fn();setProgressBar=vi.fn();setThumbarButtons=vi.fn();setTitle=vi.fn();show=vi.fn();focus=vi.fn()
 constructor(){super();this.webContents.send=vi.fn()}
 getBounds(){return {...this.bounds}}setBounds(bounds:typeof this.bounds){this.bounds={...bounds};this.emit('move')}
 isDestroyed(){return this.destroyed}isVisible(){return this.visible}isFullScreen(){return false}
 showInactive(){this.visible=true}hide(){this.visible=false}destroy(){this.destroyed=true;this.emit('closed')}
}
const services:DesktopService[]=[]
function create(){const main=new MockWindow(),lyric=new MockWindow(),service=new DesktopService(()=>main as any,()=>lyric as any,()=>{});services.push(service);return {main,lyric,service}}
beforeEach(()=>{vi.useFakeTimers();mocked.displays=[{id:1,workArea:{x:0,y:0,width:1920,height:1040}}];mocked.theme.shouldUseDarkColors=false;mocked.trays.length=0})
afterEach(()=>{for(const service of services.splice(0))service.dispose();vi.useRealTimers()})
describe('desktop native feature lifecycle',()=>{
 it('reasserts on-top every 100ms only while enabled and on-top, stopping on disposal',()=>{
  const {service,lyric}=create(),settings={...defaultSettings,tray:false,desktopLyric:true,desktopLyricTopLoop:true}
  service.apply(settings);lyric.setAlwaysOnTop.mockClear();vi.advanceTimersByTime(300);expect(lyric.setAlwaysOnTop).toHaveBeenCalledTimes(3)
  service.setTop(false);lyric.setAlwaysOnTop.mockClear();vi.advanceTimersByTime(300);expect(lyric.setAlwaysOnTop).not.toHaveBeenCalled()
  service.setTop(true);service.setLyric(false);lyric.setAlwaysOnTop.mockClear();vi.advanceTimersByTime(300);expect(lyric.setAlwaysOnTop).not.toHaveBeenCalled()
  service.dispose();expect(vi.getTimerCount()).toBe(0)
 })
 it('updates actual lyric titles and clears lyrics immediately when the preference is disabled',()=>{
  const {service,main}=create(),settings={...defaultSettings,tray:true,desktopLyric:false,statusBarLyric:true}
  service.apply(settings);const tray=mocked.trays[0]
  service.status({status:'paused',name:'播放设置',singer:'原艺人',lyricLineText:'你好 <b>原文字</b>',duration:60,progress:10}as PlayerStatus,settings)
  expect(tray.setTitle).toHaveBeenLastCalledWith('你好 <b>原文字</b>');expect(tray.setToolTip).toHaveBeenLastCalledWith('琛瑾音乐\n播放设置 - 原艺人\n你好 <b>原文字</b>');expect(main.setTitle).toHaveBeenLastCalledWith('琛瑾音乐 · 播放设置 - 原艺人 · 你好 <b>原文字</b>')
  service.apply({...settings,statusBarLyric:false});expect(tray.setTitle).toHaveBeenLastCalledWith('');expect(main.setTitle).toHaveBeenLastCalledWith('琛瑾音乐 · 播放设置 - 原艺人')
 })
 it('selects native-theme contrast, preserves legacy 1=brand/2=black, and cleans only its listener',()=>{
  const outside=vi.fn();mocked.theme.on('updated',outside)
  const {service}=create(),settings={...defaultSettings,tray:true,desktopLyric:false,trayTheme:'auto'};service.apply(settings)
  const tray=mocked.trays[0],black=tray.setImage.mock.lastCall?.[0];mocked.theme.shouldUseDarkColors=true;mocked.theme.emit('updated');const white=tray.setImage.mock.lastCall?.[0];expect(white).not.toEqual(black)
  service.apply({...settings,trayTheme:'black'});expect(tray.setImage).toHaveBeenLastCalledWith(black)
  expect(trayAppearance({...defaultSettings,trayTheme:1},true)).toBe('music');expect(trayAppearance({...defaultSettings,trayTheme:2},true)).toBe('black')
  service.apply({...settings,tray:false});service.apply(settings);expect(mocked.trays[1].setImage).toHaveBeenCalled()
  service.dispose();expect(mocked.theme.listeners('updated')).toContain(outside);expect(mocked.theme.listeners('updated')).toHaveLength(1);mocked.theme.removeListener('updated',outside)
 })
 it('generates monochrome PNG pixels with transparent backgrounds and visible original waveform marks',()=>{
  for(const image of mocked.images.slice(1,3)){
   let offset=8;const chunks:Buffer[]=[]
   while(offset<image.length){const size=image.readUInt32BE(offset),name=image.subarray(offset+4,offset+8).toString();if(name==='IDAT')chunks.push(image.subarray(offset+8,offset+8+size));offset+=size+12}
   const pixels=inflateSync(Buffer.concat(chunks)),alpha:number[]=[];for(let y=0;y<32;y++)for(let x=0;x<32;x++)alpha.push(pixels[y*129+1+x*4+3])
   expect(alpha).toContain(0);expect(alpha).toContain(255);expect(alpha.filter(value=>value===255).length).toBeLessThan(400)
  }
 })
 it('permits partial off-screen placement when unlocked but recovers after a monitor disconnect',()=>{
  mocked.displays=[{id:1,workArea:{x:0,y:0,width:1920,height:1040}},{id:2,workArea:{x:-1280,y:0,width:1280,height:1024}}]
  const {service,lyric}=create(),settings={...defaultSettings,tray:false,desktopLyric:true,desktopLyricScreenLock:false,desktopLyricX:-1450,desktopLyricY:0,desktopLyricWidth:500,desktopLyricHeight:180}
  service.apply(settings);expect(lyric.getBounds().x).toBe(-1450)
  mocked.displays=[mocked.displays[0]];mocked.screen.emit('display-removed');expect(lyric.getBounds().x).toBe(0)
  service.apply({...settings,desktopLyricX:1800,desktopLyricScreenLock:true});expect(lyric.getBounds().x).toBe(1420)
 })
})
