<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { Track } from '../../../shared/types'
import { sourceNames } from '../../../shared/defaults'
import { trackKey } from '../domain/player'
import { useMusic } from '../store'
import { normalizeAppearance } from '../../../shared/appearance'
import { useVirtualRows } from '../composables/useVirtualRows'
import { t } from '../i18n'
import Icon from './Icon.vue'

const props = defineProps<{ tracks: Track[]; editable?: boolean; loading?: boolean }>()
const emit = defineEmits<{ action: [action: string, tracks: Track[]]; reorder: [from: Track, to: Track] }>()
const music = useMusic()
const selected = ref(new Set<string>())
const dragging = ref<Track>(), dropTarget = ref(''), menuTrack = ref<Track>()
const menuPosition = ref({ left: '0px', top: '0px' })
const anchor = ref(-1)
const { viewport, enabled, rows, topPadding, bottomPadding, onScroll, scrollToIndex } = useVirtualRows(() => props.tracks, ()=>normalizeAppearance(music.settings.appearance).components.trackList?.rowHeight??65)
const downloaded = computed(()=>new Set(music.library.downloads.filter(task=>task.status==='completed').map(task=>task.track.id)))
const lovedKeys = computed(()=>new Set(music.library.playlists.find(list=>list.id==='love')?.tracks.map(trackKey)||[]))
const isLoved = (track:Track):boolean=>lovedKeys.value.has(trackKey(track))
function playTrack(track:Track):void{void music.play(track,music.settings.clickPlayList===false?[track]:props.tracks)}
const chosen = computed(() => props.tracks.filter(track => selected.value.has(trackKey(track))))
const menuIndex = computed(() => menuTrack.value ? props.tracks.findIndex(track => trackKey(track) === trackKey(menuTrack.value!)) : -1)
const ui = (text: string) => t(text, music.settings.language)

function select(track: Track, index: number, event?: MouseEvent | KeyboardEvent): void {
  const next = new Set(selected.value), key = trackKey(track)
  if (event?.shiftKey && anchor.value >= 0) {
    const start = Math.min(anchor.value, index), end = Math.max(anchor.value, index)
    for (const item of props.tracks.slice(start, end + 1)) next.add(trackKey(item))
  } else { next.has(key) ? next.delete(key) : next.add(key); anchor.value = index }
  selected.value = next
}
function all(): void { selected.value = chosen.value.length === props.tracks.length ? new Set() : new Set(props.tracks.map(trackKey)) }
function rowClick(track: Track, index: number, event: MouseEvent): void {
  if ((event.target as HTMLElement).closest('button,input')) return
  if (event.ctrlKey || event.metaKey || event.shiftKey) select(track, index, event)
}
async function rowKey(track: Track, index: number, event: KeyboardEvent): Promise<void> {
  if ((event.target as HTMLElement).closest('button,input')) return
  if (event.code === 'Space') { event.preventDefault(); event.stopPropagation(); select(track, index, event) }
  else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') { event.preventDefault(); all() }
  else if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'Home' || event.code === 'End') {
    event.preventDefault()
    const destination = event.code === 'Home' ? 0 : event.code === 'End' ? props.tracks.length - 1 : Math.max(0, Math.min(props.tracks.length - 1, index + (event.code === 'ArrowUp' ? -1 : 1)))
    if (event.shiftKey) select(props.tracks[destination], destination, event)
    scrollToIndex(destination)
    await nextTick()
    viewport.value?.querySelector<HTMLElement>(`[data-track-index="${destination}"]`)?.focus()
  }
}
function action(name: string, track?: Track): void {
  emit('action', name, track ? [track] : chosen.value)
  menuTrack.value = undefined
  if (name === 'remove' || name === 'move') selected.value = new Set()
}
function startDrag(event: DragEvent, track: Track): void {
  dragging.value = track
  event.dataTransfer?.setData('text/plain', trackKey(track))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function drop(track: Track): void {
  if (dragging.value && trackKey(dragging.value) !== trackKey(track)) emit('reorder', dragging.value, track)
  dragging.value = undefined; dropTarget.value = ''
}
function menu(track: Track, event: MouseEvent): void {
  if (menuTrack.value && trackKey(menuTrack.value) === trackKey(track)) { menuTrack.value = undefined; return }
  const target = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const context = event.type === 'contextmenu'
  menuPosition.value = { left: `${Math.max(12, Math.min(innerWidth - 182, context ? event.clientX : target.right - 170))}px`, top: `${Math.max(15, Math.min(innerHeight - 365, context ? event.clientY : target.bottom + 4))}px` }
  menuTrack.value = track
}
function outside(event: PointerEvent): void { if (!(event.target as HTMLElement).closest('.context-menu,.row-more')) menuTrack.value = undefined }
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div v-if="chosen.length" class="selection-bar"><span>{{ ui(`已选择 ${chosen.length} 首`) }}</span><button @click="music.play(chosen[0], chosen)"><Icon name="Play" :size="15" />{{ ui('播放') }}</button><button @click="music.later(chosen)">{{ ui('稍后播放') }}</button><button @click="action('collect')">{{ ui('添加到歌单') }}</button><button v-if="editable" @click="action('copy')">{{ ui('复制到歌单') }}</button><button v-if="editable" @click="action('move')">{{ ui('移动到歌单') }}</button><button @click="action('download')">{{ ui('下载') }}</button><button v-if="editable" @click="action('remove')">{{ ui('移除') }}</button><button @click="selected = new Set()">{{ ui('取消') }}</button></div>
  <div class="track-table" role="table" :aria-label="ui('歌曲列表')" :aria-rowcount="tracks.length + 1">
    <div class="track-head" role="row"><span><input type="checkbox" :aria-label="ui('选择全部歌曲')" :checked="!!tracks.length && chosen.length === tracks.length" @change="all" /></span><span>{{ ui('歌曲 / 艺人') }}</span><span>{{ ui('专辑') }}</span><span>{{ ui('来源') }}</span><span>{{ ui('时长') }}</span><span></span></div>
    <div v-if="loading" class="empty-state"><span class="spinner" />{{ ui('正在寻找好音乐…') }}</div>
    <div v-else-if="!tracks.length" class="empty-state"><div class="empty-icon"><Icon name="Music2" :size="32" /></div><h3>{{ ui('让音乐从这里开始') }}</h3><p>{{ ui('导入本地歌曲，或在搜索与发现中找到想听的声音。') }}</p></div>
    <div v-else ref="viewport" class="track-body" :class="{ virtual: enabled }" @scroll.passive="onScroll">
      <div v-if="topPadding" :style="{ height: `${topPadding}px` }" aria-hidden="true" />
      <div v-for="{ item: track, index } in rows" :key="`${trackKey(track)}:${index}`" class="track-row" :class="{ active: music.current && trackKey(music.current) === trackKey(track), selected: selected.has(trackKey(track)), 'drag-target': dropTarget === trackKey(track) }" :data-track-index="index" :draggable="editable" role="row" :aria-rowindex="index + 2" :aria-selected="selected.has(trackKey(track))" tabindex="0" @dragstart="startDrag($event, track)" @dragover.prevent="editable && (dropTarget = trackKey(track))" @drop.prevent="editable && drop(track)" @dragend="dragging = undefined; dropTarget = ''" @click="rowClick(track, index, $event)" @keydown="rowKey(track, index, $event)" @dblclick="playTrack(track)" @keydown.enter.self="playTrack(track)" @contextmenu.prevent="menu(track, $event)">
        <div class="track-number"><input type="checkbox" :aria-label="ui(`选择 ${track.name}`)" :checked="selected.has(trackKey(track))" @click.stop="select(track, index, $event)" /><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
        <div class="track-title"><button class="cover small-cover" :aria-label="ui(`播放 ${track.name}`)" @click="playTrack(track)"><img v-if="track.meta.picUrl" :src="track.meta.picUrl" alt="" loading="lazy" /><Icon v-else name="Music2" :size="18" /><span class="cover-play"><Icon name="Play" :size="18" /></span></button><div data-i18n-ignore><strong>{{ track.name }}</strong><small>{{ track.singer || ui('未知艺人') }}</small></div><Icon v-if="downloaded.has(track.id)" name="Download" :size="13" :title="ui('已下载')" class="downloaded-mark"/><span v-if="track.meta.qualitys?.some(quality => quality.type === 'flac' || quality.type === 'flac24bit')" class="quality-tag">HQ</span></div>
        <span class="album text-ellipsis" data-i18n-ignore>{{ track.meta.albumName || '—' }}</span><span class="source-label" data-i18n-ignore>{{ sourceNames[track.source] }}</span><span class="track-time">{{ track.interval || '—' }}</span>
        <div class="row-actions"><button class="icon-button track-favorite" :aria-label="`${ui(isLoved(track) ? '移出收藏' : '加入收藏')}: ${track.name}`" :title="`${ui(isLoved(track) ? '移出收藏' : '加入收藏')}: ${track.name}`" :aria-pressed="isLoved(track)" @click="action(isLoved(track) ? 'unlove' : 'love', track)"><Icon name="Heart" :size="16" /></button><button class="icon-button track-add-playlist" :aria-label="ui('添加到歌单')" :title="ui('添加到歌单')" @click="action('collectCustom', track)"><Icon name="ListMusic" :size="16" /></button><button class="icon-button row-more" :aria-label="ui(`${track.name} 更多操作`)" :aria-expanded="menuTrack && trackKey(menuTrack) === trackKey(track)" @click="menu(track, $event)"><Icon name="MoreHorizontal" :size="18" /></button></div>
      </div>
      <div v-if="bottomPadding" :style="{ height: `${bottomPadding}px` }" aria-hidden="true" />
    </div>
  </div>
  <Teleport to="body"><div v-if="menuTrack" class="context-menu track-context" :style="menuPosition" @keydown.esc="menuTrack = undefined"><button @click="music.playNext([menuTrack]); menuTrack = undefined">{{ ui('下一首播放') }}</button><button @click="music.later([menuTrack]); menuTrack = undefined">{{ ui('稍后播放') }}</button><button @click="action('collect', menuTrack)">{{ ui('添加到歌单') }}</button><button @click="action('download', menuTrack)">{{ ui('下载歌曲') }}</button><button @click="action('alternatives', menuTrack)">{{ ui('切换歌曲来源') }}</button><button @click="action('details', menuTrack)">{{ ui('歌曲资料') }}</button><button @click="action('album', menuTrack)">{{ ui('打开专辑') }}</button><button @click="action('singer', menuTrack)">{{ ui('打开艺人') }}</button><button v-if="editable" @click="action('copy', menuTrack)">{{ ui('复制到歌单') }}</button><button v-if="editable" @click="action('move', menuTrack)">{{ ui('移动到歌单') }}</button><button @click="action('comments', menuTrack)">{{ ui('查看评论') }}</button><button @click="action('dislike', menuTrack)">{{ ui('不喜欢这首歌曲') }}</button><button v-if="editable && menuIndex > 0" @click="action('up', menuTrack)">{{ ui('向上移动') }}</button><button v-if="editable && menuIndex < tracks.length - 1" @click="action('down', menuTrack)">{{ ui('向下移动') }}</button><button v-if="editable" class="danger" @click="action('remove', menuTrack)">{{ ui('从歌单移除') }}</button><button @click="menuTrack = undefined">{{ ui('关闭菜单') }}</button></div></Teleport>
</template>

<style scoped>.track-body.virtual{height:min(60vh,650px);min-height:240px;overflow:auto;overscroll-behavior:contain}.row-actions{gap:2px}.row-actions .icon-button{flex:0 0 auto}.track-favorite[aria-pressed="true"]{color:var(--accent)}.track-favorite[aria-pressed="true"] :deep(svg){fill:currentColor}.track-row{height:65px;min-height:65px}.track-row.drag-target{box-shadow:inset 0 2px var(--accent);background:var(--surface-hover)}.track-row[draggable=true]{cursor:grab}.track-row[draggable=true]:active{cursor:grabbing}.track-context{position:fixed;z-index:95;width:170px;max-height:min(350px,80vh);overflow:auto;right:auto}.downloaded-mark{color:var(--accent);flex-shrink:0}</style>
