import type { PlayerStatus } from '../../../shared/types'

const fallback='"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif'
/** A lyric font always has Chinese-capable fallbacks; symbol-only fonts are unsuitable. */
export function desktopFont(font:unknown):string {
 const value=typeof font==='string'?font.trim():''
 if(!value||/^(?:wingdings(?:\s*[123])?|webdings|symbol|marlett)$/i.test(value))return fallback
 return `${value.replace(/[;{}<>\r\n]/g,'').slice(0,200)}, ${fallback}`
}
/** Elapsed time is capped so an interrupted renderer cannot invent minutes of playback. */
export function desktopProgress(status:PlayerStatus|undefined,receivedAt:number,now:number):number {
 if(!status)return 0
 const base=Number.isFinite(status.progress)?Math.max(0,status.progress):0
 const rate=Number.isFinite(status.playbackRate)&&status.playbackRate>0?status.playbackRate:1
 const elapsed=status.status==='playing'?Math.max(0,Math.min(1,(now-receivedAt)/1000))*rate:0
 return status.duration>0?Math.min(status.duration,base+elapsed):base+elapsed
}
/** Strip only non-display C0 controls, without altering ZWJ, accents, or surrogate pairs. */
export function displayLyric(text:string):string{return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uFEFF]/g,'')}
export function untimedLyric(text:string):string {
 if(/\[\d+(?:[:,])\d+/.test(text))return ''
 return text.split(/\r?\n/).map(line=>displayLyric(line.replace(/\[[a-z]+:[^\]]*\]/gi,'')).trim()).find(Boolean)||''
}
