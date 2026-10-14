<script setup lang="ts">
import { ref } from 'vue'
import { useMusic } from '../store'
import { trackKey } from '../domain/player'
import Icon from './Icon.vue'
import { normalizeAppearance } from '../../../shared/appearance'
import { useVirtualRows } from '../composables/useVirtualRows'
import { t } from '../i18n'

const emit = defineEmits<{ close: [] }>()
const music = useMusic()
const dragging = ref<{ index: number; priority: boolean }>()
const targetIndex = ref(-1)
const ui=(text:string)=>t(text,music.settings.language)
const queueHeight=()=>normalizeAppearance(music.settings.appearance).components.queue?.rowHeight??65
const {viewport:priorityViewport,enabled:priorityVirtual,rows:priorityRows,topPadding:priorityTop,bottomPadding:priorityBottom,onScroll:priorityScroll}=useVirtualRows(()=>music.priorityQueue,queueHeight)
const {viewport:queueViewport,enabled:queueVirtual,rows:queueRows,topPadding:queueTop,bottomPadding:queueBottom,onScroll:queueScroll}=useVirtualRows(()=>music.queue,queueHeight)

function drag(event: DragEvent, index: number, priority: boolean): void {
  dragging.value = { index, priority }
  event.dataTransfer?.setData('text/plain', `chenjin:${priority ? 'priority' : 'queue'}:${index}`)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function drop(index: number, priority: boolean): void {
  if (dragging.value?.priority === priority) music.reorderQueue(dragging.value.index, index, priority)
  dragging.value = undefined
  targetIndex.value = -1
}
function endDrag(): void { dragging.value = undefined; targetIndex.value = -1 }
</script>

<template>
  <div class="overlay queue-overlay" @click.self="emit('close')">
    <aside class="queue-drawer" aria-label="播放队列">
      <div class="section-title"><div><h2>接下来播放</h2><small>{{ music.queue.length + music.priorityQueue.length }} 首歌曲</small></div><button class="icon-button" aria-label="关闭播放队列" @click="emit('close')"><Icon name="X" /></button></div>
      <div class="queue-actions"><span>{{ { listLoop: '列表循环', random: '随机播放', order: '顺序播放', singleLoop: '单曲循环', none:'不循环' }[music.settings.playMode] }}</span><button @click="music.clearQueue">清空队列</button></div>
      <template v-if="music.priorityCurrent || music.priorityQueue.length">
        <div class="queue-section-title"><strong>稍后播放</strong><small>优先播放，然后返回原列表</small></div>
        <div v-if="music.priorityCurrent" class="queue-track active"><Icon name="AudioLines" :size="18" /><div class="priority-current"><strong>{{ music.priorityCurrent.name }}</strong><small>正在优先播放 · {{ music.priorityCurrent.singer }}</small></div></div>
        <div ref="priorityViewport" class="queue-body priority-body" :class="{virtual:priorityVirtual}" @scroll.passive="priorityScroll">
        <div v-if="priorityTop" :style="{height:`${priorityTop}px`}" aria-hidden="true"/>
        <div v-for="{item:track,index} in priorityRows" :key="`priority:${trackKey(track)}`" class="queue-track" :class="{ 'drag-target': dragging?.priority && targetIndex === index }" draggable="true" @dragstart="drag($event, index, true)" @dragover.prevent="targetIndex = index" @drop.prevent="drop(index, true)" @dragend="endDrag">
          <Icon class="drag-handle" name="GripVertical" :size="14" />
          <button class="queue-track-name" @click="music.playPriority(index)"><span class="cover queue-cover"><img v-if="track.meta.picUrl" :src="track.meta.picUrl" alt="" loading="lazy"/><Icon v-else name="Music2" :size="16"/></span><div><strong>{{ track.name }}</strong><small>{{ track.singer }}</small></div></button>
          <button class="icon-button" :disabled="index === 0" :aria-label="`向上移动 ${track.name}`" @click="music.reorderQueue(index, index - 1, true)"><Icon name="ChevronUp" :size="14" /></button>
          <button class="icon-button" :disabled="index === music.priorityQueue.length - 1" :aria-label="`向下移动 ${track.name}`" @click="music.reorderQueue(index, index + 1, true)"><Icon name="ChevronDown" :size="14" /></button>
          <button class="icon-button" :aria-label="`移除 ${track.name}`" @click="music.priorityQueue.splice(index, 1)"><Icon name="X" :size="16" /></button>
        </div>
        <div v-if="priorityBottom" :style="{height:`${priorityBottom}px`}" aria-hidden="true"/>
        </div>
      </template>
      <div class="queue-section-title"><strong>播放列表</strong><small>拖动歌曲调整顺序</small></div>
      <div v-if="!music.queue.length" class="empty-state"><Icon name="ListMusic" :size="30" /><p>队列空空，先选一首喜欢的歌。</p></div>
      <div ref="queueViewport" class="queue-body" :class="{virtual:queueVirtual}" @scroll.passive="queueScroll">
      <div v-if="queueTop" :style="{height:`${queueTop}px`}" aria-hidden="true"/>
      <div v-for="{item:track,index} in queueRows" :key="`${trackKey(track)}-${index}`" class="queue-track" :class="{ active: index === music.currentIndex && !music.priorityCurrent, 'drag-target': !dragging?.priority && targetIndex === index }" draggable="true" @dragstart="drag($event, index, false)" @dragover.prevent="targetIndex = index" @drop.prevent="drop(index, false)" @dragend="endDrag">
        <Icon class="drag-handle" name="GripVertical" :size="14" />
        <button class="queue-track-name" @click="music.play(track)"><span class="cover queue-cover"><img v-if="track.meta.picUrl" :src="track.meta.picUrl" alt="" loading="lazy"/><Icon v-else name="Music2" :size="16"/></span><Icon v-if="index === music.currentIndex && !music.priorityCurrent" name="AudioLines" :size="18" /><span v-else>{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ track.name }}</strong><small>{{ track.singer }}</small></div></button>
        <button class="icon-button" :disabled="index === 0" :aria-label="`向上移动 ${track.name}`" @click="music.reorderQueue(index, index - 1)"><Icon name="ChevronUp" :size="14" /></button>
        <button class="icon-button" :disabled="index === music.queue.length - 1" :aria-label="`向下移动 ${track.name}`" @click="music.reorderQueue(index, index + 1)"><Icon name="ChevronDown" :size="14" /></button>
        <button class="icon-button" :aria-label="`移除 ${track.name}`" @click="music.removeQueue(index)"><Icon name="X" :size="16" /></button>
      </div>
      <div v-if="queueBottom" :style="{height:`${queueBottom}px`}" aria-hidden="true"/>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.queue-section-title { display: flex; flex-direction: column; gap: 5px; padding: 20px 0 10px; font-size: 12px; }
.queue-section-title small { font-size: 10px; }
.drag-handle { color: var(--muted); opacity: .4; cursor: grab; margin-right: 4px; flex-shrink: 0; }
.queue-track .icon-button { width: 24px; }
.queue-track { gap: 2px; }
.drag-target { box-shadow: inset 0 2px var(--accent); background: var(--surface-hover); }
.priority-current { padding: 10px; min-width: 0; }
.queue-body.virtual{height:min(45vh,500px);min-height:195px;overflow:auto;overscroll-behavior:contain}.queue-body.priority-body.virtual{height:min(28vh,260px)}.queue-body .queue-track{height:65px;min-height:65px}.queue-body .queue-track-name{overflow:hidden}.queue-body .queue-track-name>div{min-width:0}
</style>
