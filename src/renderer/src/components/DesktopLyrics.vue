<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PlayerStatus, Settings } from '../../../shared/types'
import { useMusic, invoke, bridge } from '../store'
import { mergeLyrics, lyricIndex, wordProgress } from '../domain/lyrics'
import { convertLyric, ensureLyricConversion } from '../domain/lyric-text'
import Icon from './Icon.vue'
import {t} from '../i18n'
const ui=(text:string)=>t(text,music.settings.language)

const music = useMusic()
const status = ref<PlayerStatus>()
const conversionVersion = ref(0)
const extrapolated = ref(0)
const receivedAt = ref(performance.now())
let frame = 0
const unsubscribers: (() => void)[] = []
const locked = computed(() => !!music.settings.desktopLyricLock)
const top = computed(() => music.settings.desktopLyricTop !== false)
const lines = computed(() => mergeLyrics(status.value?.lyric || '', status.value?.tlyric, status.value?.rlyric, status.value?.lxlyric))
const index = computed(() => lyricIndex(lines.value, extrapolated.value + music.settings.lyricOffset / 1000))
const line = computed(() => lines.value[index.value])
const display = (text: string) => { void conversionVersion.value; return convertLyric(text, music.preferences.lyricScript) }
const colors = computed(() => ({
  '--desktop-played': String(music.settings.desktopLyricPlayedColor || music.settings.desktopLyricColor || music.preferences.lyricActiveColor),
  '--desktop-unplayed': String(music.settings.desktopLyricUnplayColor || music.preferences.lyricColor),
}))
const style = computed(() => ({
  ...colors.value,
  fontFamily: String(music.settings.desktopLyricFont || music.preferences.lyricFont || 'Microsoft YaHei'),
  fontSize: `${Number(music.settings.desktopLyricFontSize) || music.preferences.lyricFontSize + 8}px`,
  opacity: Math.max(0, Math.min(1, Number(music.settings.desktopLyricOpacity ?? 1))),
  fontWeight: music.preferences.lyricBold ? '700' : '400',
  writingMode: music.settings.desktopLyricDirection === 'vertical' ? 'vertical-rl' as const : 'horizontal-tb' as const,
}))
watch(() => music.preferences.lyricScript, async script => { await ensureLyricConversion(script); conversionVersion.value++ }, { immediate: true })
function animate(): void {
  const elapsed = status.value?.status === 'playing' ? Math.min(1, (performance.now() - receivedAt.value) / 1000) * (status.value.playbackRate || 1) : 0
  extrapolated.value = (status.value?.progress || 0) + elapsed
  frame = requestAnimationFrame(animate)
}
async function toggleLock(): Promise<void> { await music.task(() => invoke('desktop.lock', { enabled: !locked.value })) }
async function toggleTop(): Promise<void> { await music.task(() => invoke('desktop.top', { enabled: !top.value })) }
onMounted(async () => {
  document.body.classList.add('desktop-lyric-body')
  if (bridge) {
    unsubscribers.push(bridge.on('lyric.status', (next: PlayerStatus) => { status.value = next; receivedAt.value = performance.now() }))
    unsubscribers.push(bridge.on('desktop.preferences', (next: Settings) => { Object.assign(music.library.settings, next) }))
    await music.task(async () => music.library = await invoke('library.load'))
  }
  animate()
})
onUnmounted(() => { cancelAnimationFrame(frame); unsubscribers.forEach(unsubscribe => unsubscribe()); document.body.classList.remove('desktop-lyric-body') })
</script>

<template>
  <div class="desktop-lyric desktop-word-lyric" :class="{ locked, vertical: music.settings.desktopLyricDirection === 'vertical' }" data-i18n-ignore>
    <div class="desktop-lyric-controls">
      <button class="icon-button" :aria-label="ui('上一首')" @click="music.task(() => invoke('playback.command', { action: 'previous' }))"><Icon name="SkipBack" /></button>
      <button class="icon-button" :aria-label="ui('播放或暂停')" @click="music.task(() => invoke('playback.command', { action: 'toggle' }))"><Icon :name="status?.status === 'playing' ? 'Pause' : 'Play'" /></button>
      <button class="icon-button" :aria-label="ui('下一首')" @click="music.task(() => invoke('playback.command', { action: 'next' }))"><Icon name="SkipForward" /></button>
      <button class="icon-button" :aria-label="ui(locked ? '解锁歌词' : '锁定歌词')" @click="toggleLock"><Icon :name="locked ? 'Lock' : 'Unlock'" /></button>
      <button class="icon-button" :aria-label="ui('置顶歌词')" @click="toggleTop"><Icon name="Pin" /></button>
      <button class="icon-button" :aria-label="ui('关闭桌面歌词')" @click="music.task(() => invoke('desktop.lyric', { enabled: false }))"><Icon name="X" /></button>
    </div>
    <div v-if="music.settings.desktopLyricVisualization" class="desktop-spectrum" :aria-label="ui('桌面歌词频谱')"><span v-for="(value,index) in status?.spectrum||[]" :key="index" :style="{height:`${Math.max(0,Math.min(1,value))*30}px`,background:colors['--desktop-played']}"/></div>
    <div class="desktop-word-content" :style="style">
      <p v-if="line?.words?.length && music.preferences.lyricWordHighlight" class="desktop-main-line"><span v-for="(word, wordIndex) in line.words" :key="wordIndex" class="desktop-word" :style="{ '--word-progress': `${wordProgress(word, extrapolated + music.settings.lyricOffset / 1000) * 100}%` }">{{ display(word.text) }}</span></p>
      <p v-else class="desktop-main-line">{{ display(line?.text || status?.lyricLineText || status?.name || ui('琛瑾音乐 · 等待播放')) }}</p>
      <p v-for="(extra,extraIndex) in (music.settings.swapLyric ? [music.settings.lyricRoma ? line?.roman : '', music.settings.lyricTranslation ? line?.translation : ''] : [music.settings.lyricTranslation ? line?.translation : '', music.settings.lyricRoma ? line?.roman : '']).filter(Boolean)" :key="extraIndex" class="desktop-sub-line">{{ display(extra!) }}</p>
    </div>
  </div>
</template>

<style scoped>
.desktop-word-content{max-width:100%;max-height:100%;overflow:hidden;text-align:center;line-height:1.45;padding:8px 18px;color:var(--desktop-played);text-shadow:0 2px 5px #000,0 0 10px #0008;-webkit-text-stroke:.4px #30233d}.desktop-word-content p{font-size:inherit;margin:0;padding:0;color:inherit;font-weight:inherit;max-height:none;overflow:visible;line-height:inherit;-webkit-text-stroke:inherit}.desktop-word-content .desktop-sub-line{font-size:.58em;margin-top:6px;opacity:.8}.desktop-word{background:linear-gradient(to right,var(--desktop-played) var(--word-progress),var(--desktop-unplayed) var(--word-progress));background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;filter:drop-shadow(0 2px 2px #000);white-space:pre-wrap}.desktop-word-lyric.vertical .desktop-word-content{height:100%;width:auto}.desktop-word-lyric.vertical .desktop-lyric-controls{writing-mode:horizontal-tb;z-index:2}
.desktop-spectrum{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);height:30px;display:flex;align-items:flex-end;gap:3px;opacity:.45;pointer-events:none}.desktop-spectrum span{width:4px;transition:height .22s linear;border-radius:2px}
</style>
