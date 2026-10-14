<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useMusic, invoke, bridge } from '../store'
import { formatTime } from '../../../shared/defaults'
import { trackKey } from '../domain/player'
import Icon from './Icon.vue'
const emit=defineEmits<{queue:[];lyrics:[];addPlaylist:[]}>(), music=useMusic(), canvas=ref<HTMLCanvasElement>(), frame=ref(0)
const volumeHover=ref(false),volumeFocus=ref(false),volumePointer=ref<number>()
const isLoved=computed(()=>{const track=music.current;return !!track&&!!music.library.playlists.find(list=>list.id==='love')?.tracks.some(item=>trackKey(item)===trackKey(track))})
const volumePercent=computed(()=>{const value=Number(music.settings.volume);return Math.round(Math.max(0,Math.min(1,Number.isFinite(value)?value:0))*100)})
const showVolume=computed(()=>volumeHover.value||volumeFocus.value||volumePointer.value!==undefined)
function stopVolumeDrag():void{volumePointer.value=undefined;window.removeEventListener('pointerup',finishVolumeDrag,true);window.removeEventListener('pointercancel',finishVolumeDrag,true)}
function finishVolumeDrag(event:PointerEvent):void{if(event.pointerId===volumePointer.value)stopVolumeDrag()}
function beginVolumeDrag(event:PointerEvent):void{if(event.button!==0||!event.isPrimary)return;volumePointer.value=event.pointerId;window.addEventListener('pointerup',finishVolumeDrag,true);window.addEventListener('pointercancel',finishVolumeDrag,true)}
function blurVolumeWindow():void{volumeHover.value=false;volumeFocus.value=false;stopVolumeDrag()}
function setVolume(event:Event):void{const value=Number((event.target as HTMLInputElement).value);void music.updateSettings({volume:Math.max(0,Math.min(1,Number.isFinite(value)?value:0))})}
const modes=['listLoop','random','order','singleLoop','none'] as const, modeNames={listLoop:'列表循环',random:'随机播放',order:'顺序播放',singleLoop:'单曲循环',none:'不循环'}
function mode(){void music.updateSettings({playMode:modes[(modes.indexOf(music.settings.playMode)+1)%modes.length]})}
function draw(){const c=canvas.value,a=music.service.analyser;if(c&&a&&music.settings.visualization){const data=new Uint8Array(a.frequencyBinCount);a.getByteFrequencyData(data);const ctx=c.getContext('2d');if(ctx){ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=getComputedStyle(c).getPropertyValue('--accent').trim()||music.settings.accent;for(let i=0;i<48;i++){const h=data[i]/255*25;ctx.fillRect(i*4,30-h,2,h)}}}frame.value=requestAnimationFrame(draw)}
onMounted(()=>{draw();window.addEventListener('blur',blurVolumeWindow)});onUnmounted(()=>{cancelAnimationFrame(frame.value);stopVolumeDrag();window.removeEventListener('blur',blurVolumeWindow)})
async function desktopLyric(){const enabled=!music.settings.desktopLyric;await music.task(async()=>{await invoke('desktop.lyric',{enabled});await music.updateSettings({desktopLyric:enabled})})}
async function toggleLove(){const track=music.current;if(!track)return;await music.task(()=>invoke(isLoved.value?'playlists.removeTracks':'playlists.add',isLoved.value?{playlistId:'love',trackIds:[track.id]}:{playlistId:'love',tracks:[track]}))}
</script>
<template><footer class="player-bar" aria-label="音乐播放器">
 <div class="now-playing"><button class="cover player-cover" aria-label="打开歌词" @click="emit('lyrics')"><img v-if="music.current?.meta.picUrl" :src="music.current.meta.picUrl" alt=""/><Icon v-else name="Music2" :size="26"/></button><div><strong>{{music.current?.name||'此刻，留给音乐'}}</strong><small>{{music.current?.singer||'选择一首歌曲开始聆听'}}</small></div><div class="player-track-actions"><button class="icon-button favorite-button" :aria-label="isLoved?'移出收藏':'加入收藏'" :title="isLoved?'移出收藏':'加入收藏'" :aria-pressed="isLoved" :disabled="!music.current" @click="toggleLove"><Icon name="Heart" :size="18"/></button><button class="icon-button add-playlist-button" aria-label="添加到歌单" title="添加到歌单" :disabled="!music.current" @click="emit('addPlaylist')"><Icon name="ListMusic" :size="18"/></button></div></div>
 <div class="transport"><div class="transport-buttons"><button class="icon-button" :aria-label="modeNames[music.settings.playMode]" :title="modeNames[music.settings.playMode]" @click="mode"><Icon :name="music.settings.playMode==='random'?'Shuffle':music.settings.playMode==='singleLoop'?'Repeat1':'Repeat'" :size="18"/></button><button class="icon-button" aria-label="上一首" @click="music.previous"><Icon name="SkipBack" :size="19"/></button><button class="play-button" :aria-label="music.playing?'暂停':'播放'" :disabled="music.resolving" @click="music.toggle"><span v-if="music.resolving" class="spinner"/><Icon v-else :name="music.playing?'Pause':'Play'" :size="22"/></button><button class="icon-button" aria-label="下一首" @click="music.next()"><Icon name="SkipForward" :size="19"/></button><button class="icon-button lyric-toggle" aria-label="打开完整歌词" @click="emit('lyrics')"><Icon name="Captions" :size="19"/></button></div><div class="progress-row"><time>{{formatTime(music.progress)}}</time><input aria-label="播放进度" type="range" min="0" :max="music.duration||1" step="0.1" :value="music.progress" :disabled="!music.duration" @input="music.service.seek(Number(($event.target as HTMLInputElement).value))"/><time>{{formatTime(music.duration)}}</time></div></div>
 <div class="player-tools"><canvas v-if="music.settings.visualization" ref="canvas" width="192" height="32" class="waveform" aria-hidden="true"/><button class="icon-button" :aria-label="music.settings.muted?'取消静音':'静音'" @click="music.updateSettings({muted:!music.settings.muted})"><Icon :name="music.settings.muted?'VolumeX':'Volume2'" :size="19"/></button><div class="volume-control" @pointerenter="volumeHover=true" @pointerleave="volumeHover=false"><input class="volume-slider" aria-label="音量" :aria-valuetext="`${volumePercent} / 100`" type="range" min="0" max="1" step="0.01" :value="music.settings.volume" @input="setVolume" @focus="volumeFocus=true" @blur="volumeFocus=false" @pointerdown="beginVolumeDrag"/><span v-if="showVolume" class="volume-value" aria-hidden="true">{{volumePercent}}</span></div><button class="icon-button" aria-label="桌面歌词" :disabled="!bridge" @click="desktopLyric"><Icon name="PanelTop" :size="18"/></button><button class="icon-button queue-button" aria-label="打开播放队列" @click="emit('queue')"><Icon name="ListMusic" :size="21"/><small>{{music.queue.length+music.priorityQueue.length}}</small></button></div>
</footer></template>
<style scoped>
.volume-control{position:relative;display:inline-flex;align-items:center;min-width:0;flex:0 1 auto}
.player-track-actions{display:flex;align-items:center;gap:2px;margin-left:auto;flex-shrink:0}
.player-track-actions .icon-button{width:30px;height:30px}
.favorite-button[aria-pressed="true"]{color:var(--accent)}
.favorite-button[aria-pressed="true"] :deep(svg){fill:currentColor}
.volume-value{position:absolute;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);min-width:34px;padding:6px 9px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);box-shadow:0 6px 20px color-mix(in srgb,var(--text) 10%,transparent);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1;text-align:center;white-space:nowrap;pointer-events:none;user-select:none;z-index:2}
@media(max-width:860px){.volume-control{display:none}}
@container music-shell (max-width:760px){.volume-control{display:none}}
</style>
