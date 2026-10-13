<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Track } from '../../../shared/types'
import { sourceNames } from '../../../shared/defaults'
import { useMusic, invoke } from '../store'
import Icon from './Icon.vue'

const props = defineProps<{ track: Track }>()
const emit = defineEmits<{ close: [] }>()
const music = useMusic()
const tracks = ref<Track[]>([]), loading = ref(true), error = ref('')
async function load(): Promise<void> {
  loading.value = true; error.value = ''
  try { tracks.value = await invoke<Track[]>('playback.alternatives', { track: props.track }) }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')"><section class="modal alternatives-modal" role="dialog" aria-modal="true" aria-label="切换歌曲来源" @keydown.esc="emit('close')"><div class="section-title"><h2>切换歌曲来源</h2><button class="icon-button" aria-label="关闭来源选择" @click="emit('close')"><Icon name="X" /></button></div><p class="alternatives-track" data-i18n-ignore>{{ track.name }} · {{ track.singer }}</p><p class="alternatives-help">仅显示歌名、艺人与时长匹配的真实候选。播放地址仍由启用的音源提供。</p><div v-if="loading" class="empty-state"><span class="spinner" /><p>正在寻找其他来源…</p></div><div v-else-if="error" class="error-banner" role="alert"><span>{{ error }}</span><button @click="load">重试</button></div><div v-else-if="!tracks.length" class="empty-state"><Icon name="Radio" :size="30" /><p>暂未找到匹配的其他来源。</p></div><button v-for="candidate in tracks" :key="`${candidate.source}:${candidate.id}`" class="alternative-choice" @click="music.play(candidate); emit('close')"><div class="cover small-cover"><img v-if="candidate.meta.picUrl" :src="candidate.meta.picUrl" alt="" /><Icon v-else name="Music2" :size="18" /></div><div data-i18n-ignore><strong>{{ candidate.name }}</strong><small>{{ candidate.singer }} · {{ candidate.meta.albumName }}</small></div><span>{{ sourceNames[candidate.source] }}</span><Icon name="Play" :size="17" /></button></section></div>
</template>

<style scoped>.alternatives-modal{width:540px}.alternatives-track{font-size:13px!important}.alternatives-help{font-size:11px!important;color:var(--muted);margin-top:12px!important}.alternative-choice{width:100%;background:transparent;border:0;border-bottom:1px solid var(--border);border-radius:0;padding:15px 0;justify-content:flex-start;text-align:left;gap:13px}.alternative-choice>div:nth-child(2){flex:1;min-width:0}.alternative-choice strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.alternative-choice small{display:block;font-size:10px;color:var(--muted);margin-top:6px}.alternative-choice>span{font-size:10px;color:var(--accent)}</style>
