<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PlayerStatus, Settings } from '../../../shared/types'
import { useMusic, invoke, bridge } from '../store'
import { mergeLyrics, lyricIndex, wordProgress, type LyricLine } from '../domain/lyrics'
import { convertLyric, ensureLyricConversion } from '../domain/lyric-text'
import { desktopFont, desktopProgress, displayLyric, untimedLyric } from '../domain/desktop-lyrics'
import Icon from './Icon.vue'
import { t } from '../i18n'

const music=useMusic(),ui=(text:string)=>t(text,music.settings.language)
const status=ref<PlayerStatus>(),conversionVersion=ref(0),extrapolated=ref(0),receivedAt=ref(performance.now())
const lines=ref<LyricLine[]>([]),content=ref<HTMLElement>(),width=ref(900),height=ref(180),fitSize=ref(32)
let frame=0,observer:ResizeObserver|undefined,statusSequence=0,disposed=false
const unsubscribers:(()=>void)[]=[]
const locked=computed(()=>!!music.settings.desktopLyricLock)
const top=computed(()=>music.settings.desktopLyricTop!==false)
const vertical=computed(()=>music.settings.desktopLyricDirection==='vertical')
const alignment=computed<'left'|'center'|'right'>(()=>music.settings.desktopLyricAlign==='left'||music.settings.desktopLyricAlign==='right'?music.settings.desktopLyricAlign:'center')
const index=computed(()=>lyricIndex(lines.value,extrapolated.value+music.settings.lyricOffset/1000))
const line=computed(()=>lines.value[index.value])
const display=(text:string)=>{void conversionVersion.value;return displayLyric(convertLyric(text,music.preferences.lyricScript))}
const mainText=computed(()=>display(line.value?.text||status.value?.lyricLineText||untimedLyric(status.value?.lyric||'')||status.value?.name||ui('琛瑾音乐 · 等待播放')))
const extras=computed(()=>{const l=line.value;if(!l)return []
 const translation=music.settings.lyricTranslation?l.translation:'',roman=music.settings.lyricRoma?l.roman:''
 return (music.settings.swapLyric?[roman,translation]:[translation,roman]).filter((text):text is string=>!!text).map(display)
})
const preview=computed(()=>music.settings.desktopLyricNextLine!==false&&height.value>=130&&!vertical.value?display(lines.value[index.value+1]?.text||''):'')
const colors=computed(()=>({'--desktop-played':String(music.settings.desktopLyricPlayedColor||music.settings.desktopLyricColor||music.preferences.lyricActiveColor),'--desktop-unplayed':String(music.settings.desktopLyricUnplayColor||music.preferences.lyricColor)}))
const size=computed(()=>Math.min(96,Math.max(12,Number(music.settings.desktopLyricFontSize)||music.preferences.lyricFontSize+8)))
const style=computed(()=>({...colors.value,fontFamily:desktopFont(music.settings.desktopLyricFont||music.preferences.lyricFont),fontSize:`${size.value}px`,fontWeight:music.preferences.lyricBold?'700':'500',writingMode:vertical.value?'vertical-rl' as const:'horizontal-tb' as const,textAlign:alignment.value}))
function receive(next:PlayerStatus):void{statusSequence++;status.value=next;receivedAt.value=performance.now();extrapolated.value=desktopProgress(next,receivedAt.value,receivedAt.value)}
// Parse only changed lyric strings rather than the entire lyric on every progress event.
watch(()=>[status.value?.lyric,status.value?.tlyric,status.value?.rlyric,status.value?.lxlyric],(next,previous)=>{
 if(previous&&next.every((value,index)=>value===previous[index]))return
 lines.value=mergeLyrics(next[0]||'',next[1],next[2],next[3])
})
watch(()=>music.preferences.lyricScript,async script=>{await ensureLyricConversion(script);conversionVersion.value++},{immediate:true})
async function fit():Promise<void>{await nextTick();if(disposed||!content.value)return
 const node=content.value,computedStyle=getComputedStyle(node),font=parseFloat(computedStyle.fontSize)||size.value
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)return
 context.font=`${computedStyle.fontWeight} ${font}px ${computedStyle.fontFamily}`
 const available=vertical.value?Math.max(12,node.clientHeight-16):Math.max(12,node.clientWidth-36)
 const textWidth=vertical.value?Array.from(mainText.value).length*font:context.measureText(mainText.value).width
 const extraWidth=vertical.value?0:Math.max(0,...extras.value.map(text=>context.measureText(text).width*.58),context.measureText(preview.value).width*.5)
 const rows=1.3+extras.value.length*.83+(preview.value ? .7 : 0)
 const capacity=vertical.value?Math.max(12,(node.clientWidth-24)/rows):Math.max(12,(node.clientHeight-16)/rows)
 fitSize.value=Math.max(12,Math.min(font,capacity,font*available/Math.max(1,textWidth,extraWidth)))
}
watch([mainText,extras,preview,style,width,height,conversionVersion],()=>void fit(),{flush:'post'})
function animate():void{extrapolated.value=desktopProgress(status.value,receivedAt.value,performance.now());frame=requestAnimationFrame(animate)}
let gesturePointer:number|undefined
function startGesture(event:PointerEvent,kind:'move'|'resize'):void{if(locked.value||event.button!==0||gesturePointer!==undefined)return;const node=event.currentTarget as HTMLElement;event.preventDefault();node.setPointerCapture(event.pointerId);gesturePointer=event.pointerId;void music.task(()=>invoke('desktop.gesture',{action:kind}))}
function endGesture(event?:PointerEvent):void{if(gesturePointer===undefined||event&&event.pointerId!==gesturePointer)return;gesturePointer=undefined;void music.task(()=>invoke('desktop.gesture',{action:'end'}))}
async function toggleLock():Promise<void>{await music.task(()=>invoke('desktop.lock',{enabled:!locked.value}))}
async function toggleTop():Promise<void>{await music.task(()=>invoke('desktop.top',{enabled:!top.value}))}
async function changeSize(delta:number):Promise<void>{await music.updateSettings({desktopLyricFontSize:Math.max(12,Math.min(96,size.value+delta))})}
onMounted(async()=>{
 document.body.classList.add('desktop-lyric-body')
 observer=new ResizeObserver(()=>{if(content.value){width.value=content.value.clientWidth;height.value=content.value.clientHeight;void fit()}})
 if(content.value)observer.observe(content.value)
 if(bridge){
  unsubscribers.push(bridge.on('lyric.status',receive))
  unsubscribers.push(bridge.on('desktop.preferences',(next:Settings)=>{Object.assign(music.library.settings,next)}))
  await music.task(async()=>{music.library=await invoke('library.load');const sequence=statusSequence;const snapshot=await invoke<PlayerStatus>('playback.snapshot');if(statusSequence===sequence)receive(snapshot)})
 }
 if(disposed)return
 void document.fonts.ready.then(()=>fit());animate()
})
onUnmounted(()=>{endGesture();disposed=true;cancelAnimationFrame(frame);observer?.disconnect();unsubscribers.forEach(unsubscribe=>unsubscribe());document.body.classList.remove('desktop-lyric-body')})
</script>

<template>
 <div class="desktop-lyric desktop-word-lyric" :class="{locked,vertical}" :data-playback="status?.status||'stoped'" @pointerup="endGesture" @pointercancel="endGesture" @lostpointercapture="endGesture" data-i18n-ignore>
  <div class="desktop-lyric-controls" role="toolbar" :aria-label="ui('桌面歌词工具栏')">
   <span class="desktop-drag-handle" @pointerdown="startGesture($event,'move')" :title="ui('拖动移动歌词')"><Icon name="GripHorizontal" :size="16" /></span>
   <button class="icon-button" :aria-label="ui('显示主窗口')" :title="ui('显示主窗口')" @click="music.task(()=>invoke('desktop.showMain'))"><Icon name="PanelTop" :size="16" /></button>
   <button class="icon-button" :aria-label="ui('上一首')" :title="ui('上一首')" @click="music.task(()=>invoke('playback.command',{action:'previous'}))"><Icon name="SkipBack" :size="16" /></button>
   <button class="icon-button" :aria-label="ui('播放或暂停')" :title="ui('播放或暂停')" @click="music.task(()=>invoke('playback.command',{action:'toggle'}))"><Icon :name="status?.status==='playing'?'Pause':'Play'" :size="16" /></button>
   <button class="icon-button" :aria-label="ui('下一首')" :title="ui('下一首')" @click="music.task(()=>invoke('playback.command',{action:'next'}))"><Icon name="SkipForward" :size="16" /></button>
   <button class="icon-button desktop-size-control" :aria-label="ui('缩小歌词')" :title="ui('缩小歌词')" :disabled="size<=12" @click="changeSize(-2)"><Icon name="Minus" :size="16" /></button>
   <button class="icon-button desktop-size-control" :aria-label="ui('放大歌词')" :title="ui('放大歌词')" :disabled="size>=96" @click="changeSize(2)"><Icon name="Plus" :size="16" /></button>
   <button class="icon-button" :aria-label="ui(locked?'解锁歌词':'锁定歌词')" :title="ui('锁定后从托盘或设置解锁')" @click="toggleLock"><Icon :name="locked?'Lock':'Unlock'" :size="16" /></button>
   <button class="icon-button" :aria-label="ui('置顶歌词')" :title="ui('置顶歌词')" :aria-pressed="top" @click="toggleTop"><Icon name="Pin" :size="16" /></button>
   <button class="icon-button" :aria-label="ui('关闭桌面歌词')" :title="ui('关闭桌面歌词')" @click="music.task(()=>invoke('desktop.lyric',{enabled:false}))"><Icon name="X" :size="16" /></button>
  </div>
  <div ref="content" class="desktop-word-content" @pointerdown="startGesture($event,'move')" :style="{...style,'--desktop-fit-size':`${fitSize}px`}" role="status" aria-live="off">
   <div class="desktop-lines" :class="{'has-preview':preview}">
    <p v-if="line?.words?.length&&music.preferences.lyricWordHighlight" class="desktop-main-line"><span v-for="(word,wordIndex) in line.words" :key="wordIndex" class="desktop-word" :style="{'--word-progress':`${wordProgress(word,extrapolated+music.settings.lyricOffset/1000)*100}%`}">{{display(word.text)}}</span></p>
    <p v-else class="desktop-main-line">{{mainText}}</p>
    <p v-for="(extra,extraIndex) in extras" :key="extraIndex" class="desktop-sub-line">{{extra}}</p>
    <p v-if="preview" class="desktop-next-line">{{preview}}</p>
   </div>
  </div>
  <span v-if="!locked" class="desktop-resize-handle" :title="ui('调整歌词窗口大小')" @pointerdown="startGesture($event,'resize')"><Icon name="GripHorizontal" :size="12" /></span>
  <div v-if="music.settings.desktopLyricVisualization" class="desktop-spectrum" :aria-label="ui('桌面歌词频谱')"><span v-for="(value,index) in status?.spectrum||[]" :key="index" :style="{height:`${Math.max(0,Math.min(1,value))*24}px`,background:colors['--desktop-played']}" /></div>
 </div>
</template>

<style scoped>
:global(html), :global(body.desktop-lyric-body), :global(body.desktop-lyric-body #app) { background: transparent !important; background-image: none !important; opacity:1!important; }
.desktop-word-lyric .desktop-word-content,
.desktop-word-lyric .desktop-lines,
.desktop-word-lyric .desktop-main-line,
.desktop-word-lyric .desktop-sub-line,
.desktop-word-lyric .desktop-next-line { background: transparent !important; background-image: none !important; box-shadow: none !important; border-color: transparent !important; }
.desktop-word-lyric{position:fixed;inset:0;width:100vw;height:100vh;min-height:0;display:block;padding:0;background:transparent;border:0;border-radius:14px;overflow:hidden;-webkit-app-region:no-drag;user-select:none;touch-action:none;box-shadow:none;outline:none;opacity:1!important}
.desktop-word-lyric:not(.locked):hover,.desktop-word-lyric:focus-within{background:rgba(20,19,28,.76);box-shadow:none}
.desktop-word-lyric .desktop-lyric-controls{position:absolute;inset:4px 8px auto;display:flex;align-items:center;justify-content:center;gap:2px;height:32px;opacity:0;transition:opacity .15s;z-index:3;-webkit-app-region:no-drag;background:rgba(24,23,30,.9);border-radius:20px;max-width:max-content;margin:auto;padding:0 6px;color:#eee}
.desktop-word-lyric:not(.locked):hover .desktop-lyric-controls,.desktop-word-lyric:focus-within .desktop-lyric-controls{opacity:1}
.desktop-lyric-controls .icon-button{width:30px;height:30px;min-width:30px;min-height:0;border:0;padding:0;background:transparent;color:#eee;border-radius:50%;box-shadow:none;display:grid;place-items:center;-webkit-app-region:no-drag}
.desktop-lyric-controls .icon-button:hover{background:#ffffff24;color:#fff}.desktop-lyric-controls .icon-button:focus-visible{outline:2px solid #d0bcff;outline-offset:-2px}.desktop-lyric-controls .icon-button[aria-pressed=true]{background:#d0bcff24;color:#d0bcff}
.desktop-drag-handle{display:grid;place-items:center;width:22px;height:30px;cursor:grab;-webkit-app-region:no-drag;touch-action:none;color:#bbb}
.desktop-word-lyric .desktop-word-content{position:absolute;inset:38px 0 8px;max-width:100%;max-height:none;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center;line-height:1.3;padding:8px 18px;color:var(--desktop-played);text-shadow:0 1px 3px #000,0 0 6px #000c;-webkit-text-stroke:.35px #17131f;background:transparent}
.desktop-lines{max-width:100%;min-width:0}.desktop-word-lyric:not(.vertical) .desktop-lines{width:100%}.desktop-word-lyric .desktop-word-content p{font-size:var(--desktop-fit-size);margin:0;padding:0;color:inherit;font-weight:inherit;max-height:none;overflow:visible;line-height:1.3;-webkit-text-stroke:inherit;overflow-wrap:anywhere;white-space:pre-wrap}
.desktop-word-lyric .desktop-word-content .desktop-sub-line{font-size:calc(var(--desktop-fit-size)*.58);margin-top:5px;opacity:.92}
.desktop-word-lyric .desktop-word-content .desktop-next-line{font-size:calc(var(--desktop-fit-size)*.5);margin-top:8px;color:var(--desktop-unplayed);opacity:.8}
.desktop-word{background:linear-gradient(to right,var(--desktop-played) var(--word-progress),var(--desktop-unplayed) var(--word-progress));background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;filter:drop-shadow(0 1px 2px #000);white-space:pre-wrap}
.desktop-word-lyric.vertical .desktop-word-content{inset:38px 0 8px;width:auto;height:auto}.desktop-word-lyric.vertical .desktop-lines{max-height:100%;max-width:none}.desktop-word-lyric.vertical .desktop-sub-line{margin:0 6px 0 0}.desktop-word-lyric.vertical .desktop-lyric-controls{writing-mode:horizontal-tb;max-width:calc(100% - 16px);flex-wrap:wrap;height:auto;padding:4px}.desktop-word-lyric.vertical .desktop-word-content{top:76px}
.desktop-word-lyric.locked .desktop-word-content{inset:4px 0 8px}.desktop-word-lyric.locked .desktop-lyric-controls{display:none}
.desktop-resize-handle{position:absolute;right:2px;bottom:2px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.65);cursor:nwse-resize;z-index:3;opacity:.55;touch-action:none;-webkit-app-region:no-drag}.desktop-word-lyric:hover .desktop-resize-handle{opacity:1}.desktop-resize-handle svg{transform:rotate(-45deg)}
.desktop-spectrum{position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:24px;display:flex;align-items:flex-end;gap:3px;opacity:.3;pointer-events:none}.desktop-spectrum span{width:4px;transition:height .22s linear;border-radius:2px}
@media(max-width:420px){.desktop-size-control{display:none!important}.desktop-lyric-controls .desktop-drag-handle{display:none}}
@media(prefers-reduced-motion:reduce){.desktop-word-lyric .desktop-lyric-controls,.desktop-spectrum span{transition:none}}
</style>
