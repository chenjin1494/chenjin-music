<script setup lang="ts">
import type { Track } from '../../../shared/types'
import { sourceNames } from '../../../shared/defaults'
import Icon from './Icon.vue'

const props = defineProps<{ track: Track; loading?: boolean }>()
const emit = defineEmits<{ close: []; action: [action: string, tracks: Track[]] }>()
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section class="modal track-details" role="dialog" aria-modal="true" aria-label="歌曲资料" @keydown.esc="emit('close')">
      <div class="section-title"><h2>歌曲资料</h2><button class="icon-button" aria-label="关闭歌曲资料" @click="emit('close')"><Icon name="X" /></button></div>
      <div v-if="loading" class="details-loading"><span class="spinner" />正在读取平台资料…</div>
      <div class="details-heading"><div class="details-cover"><img v-if="track.meta.picUrl" :src="track.meta.picUrl" alt="" /><Icon v-else name="Music2" :size="45" /></div><div data-i18n-ignore><h3>{{ track.name }}</h3><p>{{ track.singer || '未知艺人' }}</p><small>{{ track.meta.albumName }}</small></div></div>
      <dl class="details-grid"><dt>来源</dt><dd>{{ sourceNames[track.source] }}</dd><dt>时长</dt><dd data-i18n-ignore>{{ track.interval || '—' }}</dd><dt>歌曲编号</dt><dd data-i18n-ignore>{{ track.meta.songId }}</dd><dt>专辑</dt><dd data-i18n-ignore>{{ track.meta.albumName || '—' }}</dd><template v-if="track.meta.filePath"><dt>文件位置</dt><dd data-i18n-ignore>{{ track.meta.filePath }}</dd></template><template v-if="track.meta.ext"><dt>文件格式</dt><dd data-i18n-ignore>{{ track.meta.ext }}</dd></template><template v-if="track.meta.qualitys?.length"><dt>可用音质</dt><dd class="details-qualities" data-i18n-ignore><span v-for="quality in track.meta.qualitys" :key="quality.type">{{ quality.type }}{{ quality.size ? ` · ${quality.size}` : '' }}</span></dd></template></dl>
      <div class="button-row"><button @click="emit('action', 'album', [track])"><Icon name="Disc3" :size="15" />打开专辑</button><button @click="emit('action', 'singer', [track])"><Icon name="Mic2" :size="15" />打开艺人</button><button @click="emit('action', 'collect', [track])"><Icon name="ListMusic" :size="15" />添加到歌单</button></div>
      <p v-if="!track.meta.picUrl" class="details-note">当前资料没有封面。平台资料请求不会生成虚构的图片。</p>
    </section>
  </div>
</template>

<style scoped>.track-details{width:550px}.details-heading{display:flex;align-items:center;gap:20px;margin:25px 0}.details-cover{width:110px;height:110px;flex-shrink:0;border-radius:12px;background:var(--surface-hover);display:flex;align-items:center;justify-content:center;color:var(--accent);overflow:hidden}.details-cover img{height:100%;width:100%}.details-heading h3{font-size:20px;line-height:1.5}.details-heading p{margin:10px 0;color:var(--muted);font-size:12px}.details-heading small{font-size:11px}.details-grid{display:grid;grid-template-columns:75px minmax(0,1fr);gap:15px 20px;margin:25px 0;font-size:11px;line-height:1.8}.details-grid dt{color:var(--muted)}.details-grid dd{margin:0;overflow-wrap:anywhere}.details-qualities{display:flex;gap:7px;flex-wrap:wrap}.details-qualities span{padding:2px 7px;border:1px solid var(--border);border-radius:4px}.details-loading{display:flex;gap:10px;align-items:center;font-size:11px;color:var(--muted);margin:15px 0}.details-note{font-size:10px!important;color:var(--muted);margin-top:15px!important}@media(max-width:640px){.details-cover{width:85px;height:85px}.details-heading{gap:15px}.details-heading h3{font-size:17px}}
</style>
