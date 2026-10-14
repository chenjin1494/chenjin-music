<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMusic } from '../store'
import { convertLyric, ensureLyricConversion } from '../domain/lyric-text'
import { wordProgress } from '../domain/lyrics'
import Icon from './Icon.vue'
import LyricEditor from './LyricEditor.vue'
const editing=ref(false)

const emit = defineEmits<{ close: [] }>()
const music = useMusic()
const container = ref<HTMLElement>()
const smoothTime = ref(0)
const spectrum = ref<number[]>(Array.from({length:32},()=>0.035))
const spectrumTargets = new Float32Array(32)
let frame = 0, lastFrame = 0, frequencyData = new Uint8Array(0)
const preferences = computed(() => music.preferences)
const conversionVersion = ref(0)
const display = (text: string) => { void conversionVersion.value; return convertLyric(text, preferences.value.lyricScript) }
watch(() => preferences.value.lyricScript, async script => {
  await ensureLyricConversion(script)
  conversionVersion.value++
}, { immediate: true })
const style = computed(() => ({
  '--lyric-size': `${preferences.value.lyricFontSize}px`,
  '--lyric-height': preferences.value.lyricLineHeight,
  '--lyric-color': preferences.value.lyricColor,
  '--lyric-active': preferences.value.lyricActiveColor,
  '--lyric-weight': preferences.value.lyricBold ? '650' : '400',
  ...(preferences.value.lyricBackground ? { background: preferences.value.lyricBackground } : {}),
  ...(preferences.value.lyricFont ? { fontFamily: preferences.value.lyricFont } : {}),
}))

function animate(now: number): void {
  const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 60
  lastFrame = now
  smoothTime.value = music.service.audio.currentTime + music.settings.lyricOffset / 1000

  const analyser = music.service.analyser
  if (analyser) {
    if (frequencyData.length !== analyser.frequencyBinCount) frequencyData = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(frequencyData)
    for (let index = 0; index < spectrumTargets.length; index++) {
      const start = Math.floor(index * frequencyData.length / spectrumTargets.length)
      const end = Math.max(start + 1, Math.floor((index + 1) * frequencyData.length / spectrumTargets.length))
      let sum = 0
      for (let bin = start; bin < end; bin++) sum += frequencyData[bin] || 0
      spectrumTargets[index] = Math.max(0.035, (sum / (end - start) / 255) ** 0.8)
    }
  } else {
    spectrumTargets.fill(0.035)
  }

  const levels = spectrum.value
  for (let index = 0; index < spectrumTargets.length; index++) {
    const target = spectrumTargets[index]
    const timeConstant = target > levels[index] ? 0.045 : 0.14
    const blend = 1 - Math.exp(-delta / timeConstant)
    levels[index] += (target - levels[index]) * blend
  }
  frame = requestAnimationFrame(animate)
}
watch(() => music.activeLine, async () => {
  await nextTick()
  const line = container.value?.querySelector<HTMLElement>('.lyric-line.active')
  if (line && container.value) container.value.scrollTo({
    top: line.offsetTop - container.value.offsetTop - container.value.clientHeight / 2 + line.clientHeight / 2,
    behavior: music.settings.animation && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
  })
})
onMounted(() => { frame = requestAnimationFrame(animate) })
onUnmounted(() => cancelAnimationFrame(frame))
</script>

<template>
  <div class="lyrics-layer">
    <section class="full-lyrics" :class="`lyric-style-${preferences.lyricStyle}`" :style="style" aria-label="完整歌词">
    <button class="icon-button lyrics-close" aria-label="关闭歌词" @click="emit('close')"><Icon name="ChevronDown" :size="26" /></button>
    <div class="lyrics-art">
      <div class="large-cover"><img v-if="music.current?.meta.picUrl" :src="music.current.meta.picUrl" alt="" /><Icon v-else name="Disc3" :size="100" /></div>
      <div class="lyrics-spectrum" role="img" aria-label="播放音频可视化"><span v-for="(level,index) in spectrum" :key="index" :style="{transform:`scaleY(${Math.max(0.07,level)})`}"/></div>
      <h2>{{ music.current?.name || '让音乐慢慢响起' }}</h2>
      <p>{{ music.current?.singer || '选择一首歌，开启聆听' }}</p>
      <small>{{ music.current?.meta.albumName }}</small>
      <div class="chips">
        <button :disabled="!music.current" @click="editing=true">编辑歌词</button>
        <button :class="{ active: music.settings.lyricTranslation }" @click="music.updateSettings({ lyricTranslation: !music.settings.lyricTranslation })">译</button>
        <button :class="{ active: music.settings.lyricRoma }" @click="music.updateSettings({ lyricRoma: !music.settings.lyricRoma })">音</button>
        <button @click="music.updateSettings({ lyricOffset: music.settings.lyricOffset - 500 })">−0.5s</button>
        <button @click="music.updateSettings({ lyricOffset: music.settings.lyricOffset + 500 })">+0.5s</button>
      </div>
          </div>
    <div class="lyrics-scroll-pane">
       <small class="lyrics-status">歌词偏移 {{ music.settings.lyricOffset }} ms · {{ music.lines.some(line => line.words?.length) ? '逐字歌词' : '逐行歌词' }}</small>
       <div ref="container" class="lyric-scroll">
      <div v-if="!music.lines.length" class="empty-state"><Icon name="Captions" :size="32" /><p>{{ display(music.lyric.lyric || '暂无可用歌词，静静享受音乐。') }}</p></div>
      <button v-for="(line, index) in music.lines" :key="`${line.time}-${index}`" class="lyric-line" :class="{ active: index === music.activeLine }" @click="music.service.seek(Math.max(0, line.time - music.settings.lyricOffset / 1000))">
        <span v-if="line.words?.length && preferences.lyricWordHighlight" class="word-line" :aria-label="display(line.text)">
          <span v-for="(word, wordIndex) in line.words" :key="wordIndex" class="lyric-word" :style="{ '--word-progress': `${wordProgress(word, smoothTime) * 100}%` }" aria-hidden="true">{{ display(word.text) }}</span>
        </span>
        <span v-else>{{ display(line.text || '♪') }}</span>
        <small v-for="(extra,extraIndex) in (music.settings.swapLyric ? [music.settings.lyricRoma ? line.roman : '', music.settings.lyricTranslation ? line.translation : ''] : [music.settings.lyricTranslation ? line.translation : '', music.settings.lyricRoma ? line.roman : '']).filter(Boolean)" :key="extraIndex">{{ display(extra!) }}</small>
      </button>
    </div>
  </div>
   </section>
    <LyricEditor v-if="editing&&music.current" :track="music.current" :lyrics="music.lyric" @close="editing=false" @saved="music.lyric=$event"/>
  </div>
</template>

<style scoped>
.lyrics-scroll-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.lyrics-status { align-self: flex-end; flex: 0 0 auto; margin: 0 0 12px; padding: 2px 4px 9px; border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent); color: var(--muted); font-size: 11px; line-height: 1.4; }
.lyrics-scroll-pane .lyric-scroll { flex: 1 1 auto; min-height: 0; }
.lyrics-spectrum { width: min(100%, 300px); height: 46px; margin: 18px auto 12px; display: flex; align-items: center; justify-content: center; gap: 4px; overflow: hidden; pointer-events: none; }
.lyrics-spectrum span { flex: 1 1 3px; max-width: 6px; min-width: 2px; height: 42px; border-radius: 999px; background: linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 48%, var(--md-primary-container, white))); box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 24%, transparent); transform-origin: center; }
.lyrics-close { position: absolute; top: 16px; left: 18px; right: auto; z-index: 1; }
.lyric-line { font-size: var(--lyric-size); line-height: var(--lyric-height); font-weight: var(--lyric-weight); color: var(--lyric-color); }
.lyric-line.active { color: var(--lyric-active); }
.lyric-style-left .lyric-scroll, .lyric-style-left .lyric-line { text-align: left; }
.lyric-style-karaoke .lyric-line { opacity: .35; }
.lyric-style-karaoke .lyric-line.active { opacity: 1; transform: scale(1.08); }
.word-line { white-space: pre-wrap; }
.lyric-word { background: linear-gradient(to right, var(--lyric-active) var(--word-progress), var(--lyric-color) var(--word-progress)); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
@media (max-width: 640px) { .lyric-line { font-size: min(var(--lyric-size), 24px); } }
</style>
