import type { Settings, Track } from '../../../shared/types'

export type LyricScript = 'original' | 'simplified' | 'traditional'
export type LyricStyle = 'center' | 'left' | 'karaoke'
export interface RendererPreferences {
  reverbDecay: number
  pannerSpeed: number
  outputChannels: number
  lyricScript: LyricScript
  lyricStyle: LyricStyle
  lyricFontSize: number
  lyricLineHeight: number
  lyricFont: string
  lyricColor: string
  lyricActiveColor: string
  lyricBackground: string
  lyricBold: boolean
  lyricWordHighlight: boolean
  shortcuts: Record<string, string>
  priorityQueue: Track[]
}

export const rendererDefaults: RendererPreferences = {
  reverbDecay: 1.8,
  pannerSpeed: 0.12,
  outputChannels: 2,
  lyricScript: 'original',
  lyricStyle: 'center',
  lyricFontSize: 24,
  lyricLineHeight: 1.8,
  lyricFont: '',
  lyricColor: '#92909f',
  lyricActiveColor: '#a78bfa',
  lyricBackground: '',
  lyricBold: true,
  lyricWordHighlight: true,
  shortcuts: {
    toggle: 'Space',
    next: 'Ctrl+ArrowRight',
    previous: 'Ctrl+ArrowLeft',
    search: 'Ctrl+KeyF',
    volumeUp: 'Ctrl+ArrowUp',
    volumeDown: 'Ctrl+ArrowDown',
    mute: 'Ctrl+KeyM',
    lyrics: 'Ctrl+KeyL',
    queue: 'Ctrl+KeyQ',
    seekBack:'',seekForward:'',collect:'',uncollect:'',dislike:'',desktopLyric:'',desktopLock:'',desktopTop:'',windowMinimize:'',windowToggleMin:'',windowToggleHide:'',windowClose:'',
  },
  priorityQueue: [],
}

export function rendererPreferences(settings: Settings): RendererPreferences {
  return {
    ...rendererDefaults,
    ...Object.fromEntries(Object.keys(rendererDefaults).map(key => [key, settings[key] ?? rendererDefaults[key as keyof RendererPreferences]])),
    shortcuts: { ...rendererDefaults.shortcuts, ...(settings.shortcuts as Record<string, string> | undefined) },
    priorityQueue: Array.isArray(settings.priorityQueue) ? settings.priorityQueue as Track[] : [],
  } as RendererPreferences
}

export const effectPresets = {
  flat: { name: '原声', eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverb: 0, pitch: 0, panner: false },
  warm: { name: '温暖人声', eq: [1, 2, 2, 1, 0, 1, 2, 1, -1, -2], reverb: 0.08, pitch: 0, panner: false },
  bass: { name: '低音增强', eq: [5, 4, 3, 1, 0, 0, 0, 0, 0, 0], reverb: 0, pitch: 0, panner: false },
  hall: { name: '音乐厅', eq: [0, 0, -1, -1, 0, 1, 1, 0, 0, 0], reverb: 0.25, pitch: 0, panner: false },
  spatial: { name: '旋转声场', eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverb: 0.08, pitch: 0, panner: true },
} satisfies Record<string, { name: string; eq: number[]; reverb: number; pitch: number; panner: boolean }>
