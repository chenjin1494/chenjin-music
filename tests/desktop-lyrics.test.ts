import { describe,it,expect } from 'vitest'
import { desktopFont,desktopProgress,displayLyric,untimedLyric } from '../src/renderer/src/domain/desktop-lyrics'
import type { PlayerStatus } from '../src/shared/types'
const initialPlayerStatus:PlayerStatus={status:'stoped',name:'',singer:'',albumName:'',picUrl:'',duration:0,progress:0,playbackRate:1,lyricLineText:'',lyricLineAllText:'',lyric:'',tlyric:'',rlyric:'',lxlyric:'',collect:false,volume:1,mute:false}

describe('desktop lyric rendering and time synchronization',()=>{
 it('appends Chinese capable fallback fonts and rejects symbol-only fonts',()=>{expect(desktopFont('Custom Font')).toContain('Custom Font, "Microsoft YaHei UI"');expect(desktopFont('Wingdings')).toBe(desktopFont(''));expect(desktopFont('Webdings')).toBe(desktopFont(undefined));expect(desktopFont('Noto Serif CJK SC')).toContain('Noto Serif CJK SC')})
 it('preserves accented text, supplementary Chinese, emoji and joiners while removing invisible C0 controls',()=>{expect(displayLyric('\uFEFF中文𠀀👩‍💻 café\u0000\u0007')).toBe('中文𠀀👩‍💻 café')})
 it('shows the first visible untimed lyric and never leaks LRC or timed metadata as display text',()=>{expect(untimedLyric('[ar:歌手]\n\n中文歌词\n第二行')).toBe('中文歌词');expect(untimedLyric('[00:02.10]中文')).toBe('');expect(untimedLyric('[2000,1000]<0,100>中')).toBe('')})
 it('extrapolates with playback speed but caps gaps and duration',()=>{const s={...initialPlayerStatus,status:'playing' as const,progress:2,duration:12,playbackRate:1.5};expect(desktopProgress(s,1000,1200)).toBeCloseTo(2.3);expect(desktopProgress(s,1000,20000)).toBe(3.5);expect(desktopProgress({...s,progress:11.8},1000,20000)).toBe(12)})
 it('keeps pause stationary, clamps negative clocks and handles initial empty state',()=>{const s={...initialPlayerStatus,status:'paused' as const,progress:4};expect(desktopProgress(s,1000,20000)).toBe(4);expect(desktopProgress({...s,status:'playing'},1000,500)).toBe(4);expect(desktopProgress(undefined,1000,20000)).toBe(0)})
})
