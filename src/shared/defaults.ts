import { DEFAULT_APPEARANCE } from './appearance'
import type { Settings, LibraryState } from './types'
export const defaultSettings: Settings = {
 appearance:structuredClone(DEFAULT_APPEARANCE),
 theme: 'dark', accent: '#a78bfa', font: '', language: 'zh-CN', animation: true,
 volume: .75, muted: false, playbackRate: 1, preservesPitch: true, quality: '128k',
 playMode: 'listLoop', autoUpdateLists:true, playDownloaded:true, autoSwitchSource:true, downloadOtherSource:false, addMusicLocation:'top', startupAutoPlay: false, savePlayTime: true, autoSkip: true,
 desktopLyric: false, desktopLyricNextLine: true, lyricTranslation: false, lyricRoma: false, lyricOffset: 0,
 tray: true, closeToTray: false, closeBehavior: 'ask', preventSleep: true, downloadEnabled: true, downloadPath: '',
 downloadConcurrency: 3, downloadFileName: '{name} - {singer}', downloadLyrics: true,
 embedCover: true, embedLyrics: false, embedWordLyrics:true, embedTranslation:false, embedRoman:false, pauseOnDeviceRemoved:false, skipExisting: true, searchHistory: true, hotSearch: true,
 proxy: '', openAPI: false, openAPIPort: 23330, openAPILan: false,
 syncEnabled: false, syncMode: 'server', syncPort: 23332, syncHost: '', updateURL: '',
 eq: Array(10).fill(0), reverb: 0, reverbDecay:2, pannerSpeed:.15, panner: false, pitch: 0, outputDevice: 'default', visualization: false
}
export function emptyLibrary(): LibraryState {
 return {version: 1, settings: structuredClone(defaultSettings), playlists: [
  {id: 'default', name: '试听列表', tracks: [], createdAt: Date.now()},
  {id: 'love', name: '我喜欢的音乐', tracks: [], createdAt: Date.now()}
 ], scripts: [], downloads: [], searchHistory: [], dislikes: [], editedLyrics:{}}
}
export const sourceNames = {kw: '酷我音乐', kg: '酷狗音乐', tx: 'QQ 音乐', wy: '网易云音乐', mg: '咪咕音乐', local: '本地音乐'}
export const formatTime = (seconds: number) => `${Math.floor((seconds || 0) / 60).toString().padStart(2, '0')}:${Math.floor((seconds || 0) % 60).toString().padStart(2, '0')}`
