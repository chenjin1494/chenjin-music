import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge } from '../../src/shared/types'
const methods = new Set(['library.load','app.flushReady','library.save','settings.update','files.import','audio.importImpulse','theme.importImage','playlists.create','playlists.rename','playlists.remove','playlists.add','playlists.removeTracks','playlists.reorder','playlists.sort','playlists.dedupe','playlists.transfer','playlists.order','playlists.refresh','discovery.tags','search.playlists','metadata.detail','discovery.album','discovery.singer','backup.import','backup.importLegacyDirectory','backup.export','backup.exportText','sources.importURL','sources.import','sources.activate','sources.remove','search','discovery.playlists','discovery.playlist','discovery.boards','discovery.board','lyrics','lyrics.save','comments','search.hot','search.suggest','playback.resolve','playback.alternatives','playback.status','playback.snapshot','playback.command','downloads.add','downloads.action','desktop.lyric','desktop.showMain','desktop.resetPosition','desktop.lock','desktop.top','app.info','app.openExternal','app.openPath','app.selectDirectory','update.check','update.download','update.cancel','update.install','sync.status','sync.auth','sync.mode','sync.device.remove','cache.clear','cache.stats'])
const events = new Set(['library.updated','app.flush','downloads.updated','sources.updated','player.command','player.status','lyric.status','desktop.preferences','app.error','app.deeplink','sync.status','sync.mode','update.progress','update.ready'])
const bridge: DesktopBridge = {
 platform: process.platform,
 invoke<T>(method: string, params?: unknown): Promise<T> {if(!methods.has(method))return Promise.reject(new Error('不允许调用此接口'));return ipcRenderer.invoke('chenjin:invoke',method,params)},
 on(event,listener) {if(!events.has(event))throw new Error('不允许订阅此事件');const handler=(_event:Electron.IpcRendererEvent,data:unknown)=>listener(data);ipcRenderer.on(event,handler);return ()=>ipcRenderer.removeListener(event,handler)},
 window(action) {if(['minimize','maximize','close','fullscreen'].includes(action))ipcRenderer.send('chenjin:window',action)}
}
contextBridge.exposeInMainWorld('chenjin',bridge)
contextBridge.exposeInMainWorld('electronAPI',bridge)
