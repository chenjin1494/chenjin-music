import type { AppearanceConfig } from './appearance'
export type SourceId = 'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'local'
export type Quality = '128k' | '320k' | 'flac' | 'flac24bit'
export interface Track {
 id: string; name: string; singer: string; source: SourceId; interval: string | null
 meta: { songId: string | number; albumName: string; picUrl?: string | null; filePath?: string; ext?: string; qualitys?: {type: Quality; size: string | null; hash?: string}[]; _qualitys?: Record<string, unknown>; [key: string]: unknown }
}
export interface Playlist { id: string; name: string; source?: SourceId; sourceListId?: string; locationUpdateTime?: number | null; tracks: Track[]; createdAt: number }
export interface Lyrics { lyric: string; tlyric?: string | null; rlyric?: string | null; lxlyric?: string | null }
export interface SourceScript { id: string; name: string; description: string; version: string; author: string; homepage?: string; updateURL?:string; updateLog?:string; script: string; enabled: boolean; status: string; sources?: Record<string, {type: 'music'; actions: string[]; qualitys: Quality[]}> }
export interface DownloadTask { id: string; track: Track; quality: Quality; status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'; progress: number; received: number; total: number; speed: number; path?: string; playlistName?: string; error?: string; url?: string }
export interface Settings {
 appearance?:AppearanceConfig
 theme: 'dark' | 'light' | 'system'; accent: string; font: string; language: string; animation: boolean
 volume: number; muted: boolean; playbackRate: number; preservesPitch: boolean; quality: Quality
 playMode: 'listLoop' | 'random' | 'order' | 'singleLoop' | 'none'; startupAutoPlay: boolean; savePlayTime: boolean; autoSkip: boolean
 desktopLyric: boolean; desktopLyricNextLine?: boolean; lyricTranslation: boolean; lyricRoma: boolean; lyricOffset: number
 tray: boolean; closeToTray: boolean; closeBehavior?: 'ask' | 'tray' | 'quit'; preventSleep: boolean; downloadEnabled: boolean; downloadPath: string
 downloadConcurrency: number; downloadFileName: string; downloadLyrics: boolean; embedCover: boolean; embedLyrics: boolean; skipExisting: boolean
 searchHistory: boolean; hotSearch: boolean; proxy: string; openAPI: boolean; openAPIPort: number; openAPILan: boolean
 syncEnabled: boolean; syncMode: 'server' | 'client'; syncPort: number; syncHost: string; updateURL: string
 eq: number[]; reverb: number; panner: boolean; pitch: number; outputDevice: string; visualization: boolean
 [key: string]: unknown
}
export interface LibraryState { version: number; playlists: Playlist[]; settings: Settings; scripts: SourceScript[]; downloads: DownloadTask[]; searchHistory: string[]; dislikes: string[]; editedLyrics?:Record<string,Lyrics>; player?: {queue: Track[]; currentId?: string; progress: number; priorityQueue?: Track[]; priorityCurrent?: Track; resumeIndex?: number} }
export interface PlayerStatus { status: 'playing' | 'paused' | 'stoped' | 'loading' | 'error'; name: string; singer: string; albumName: string; picUrl: string; duration: number; progress: number; playbackRate: number; lyricLineText: string; lyricLineAllText: string; lyric: string; tlyric: string; rlyric: string; lxlyric: string; collect: boolean; volume: number; mute: boolean; spectrum?:number[] }
export interface SearchResult { list: Track[]; total: number; page: number; limit: number; source: string }
export interface OnlinePlaylist { id: string; name: string; source: SourceId; cover: string; author?: string; description?: string; playCount?: number }
export interface Comment { id: string; author: string; avatar?: string; text: string; time: string; likes: number; images?:string[]; reply?:Comment[]; rootId?:string; replyCount?:number; location?:string }
export interface ApiResult<T = unknown> { ok: boolean; data?: T; error?: string }
export interface DesktopBridge {
 invoke<T = unknown>(method: string, params?: unknown): Promise<T>
 on(event: string, listener: (data: any) => void): () => void
 window(action: 'minimize' | 'maximize' | 'close' | 'fullscreen'): void
 platform: string
}
