<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMusic, invoke } from '../store'
import Icon from './Icon.vue'

const music = useMusic()
const filter = ref('all'), selected = ref(new Set<string>()), clearConfirm = ref(false)
const tasks = computed(() => music.library.downloads.filter(task => filter.value === 'all' || task.status === filter.value))
const statuses = { queued: '等待中', running: '下载中', paused: '已暂停', completed: '已完成', failed: '下载失败', cancelled: '已取消' }
function select(id: string): void { const next = new Set(selected.value); next.has(id) ? next.delete(id) : next.add(id); selected.value = next }
function all(): void { selected.value = selected.value.size === tasks.value.length ? new Set() : new Set(tasks.value.map(task => task.id)) }
async function action(name: string, ids?: string[]): Promise<void> {
  await music.task(async () => {
    for (const id of ids || ['all']) await invoke('downloads.action', { id, action: name })
    if (name === 'remove') selected.value = new Set()
  })
}
</script>

<template>
  <div class="page-heading"><div><p class="eyebrow">TAKE YOUR MUSIC WITH YOU</p><h1>下载管理</h1><p>{{ music.library.downloads.filter(task => task.status === 'completed').length }} 首已完成 · {{ music.library.downloads.filter(task => task.status === 'running').length }} 首正在下载</p></div><button @click="music.task(() => invoke('app.openPath', { path: music.settings.downloadPath }))"><Icon name="FolderOpen" :size="16" />打开目录</button></div>
  <div class="download-toolbar"><label><input type="checkbox" aria-label="选择全部下载任务" :checked="!!tasks.length && selected.size === tasks.length" @change="all" /><span>选择全部</span></label><select v-model="filter" aria-label="筛选下载任务" @change="selected = new Set()"><option value="all">全部任务</option><option v-for="(label, status) in statuses" :key="status" :value="status">{{ label }}</option></select><div class="button-row"><button @click="action('pause')">全部暂停</button><button @click="action('resume')">全部继续</button><button @click="clearConfirm = !clearConfirm">清空任务</button></div></div>
  <div v-if="clearConfirm" class="download-clear"><span>确认清空下载任务？已下载的音频文件会保留。</span><button class="danger-button" @click="action('remove'); clearConfirm = false">确认清空</button><button @click="clearConfirm = false">取消</button></div>
  <div v-if="selected.size" class="selection-bar"><span>已选择 {{ selected.size }} 个任务</span><button @click="action('pause', [...selected])">暂停</button><button @click="action('resume', [...selected])">继续</button><button @click="action('remove', [...selected])">移除任务</button><button @click="selected = new Set()">取消</button></div>
  <div v-if="!tasks.length" class="empty-state"><div class="empty-icon"><Icon name="Download" :size="35" /></div><h3>把喜欢的音乐带在身边</h3><p>在歌曲菜单选择下载，任务与进度会显示在这里。</p></div>
  <article v-for="task in tasks" :key="task.id" class="download-card"><input type="checkbox" :aria-label="`选择下载任务 ${task.track.name}`" :checked="selected.has(task.id)" @change="select(task.id)" /><div class="cover small-cover"><img v-if="task.track.meta.picUrl" :src="task.track.meta.picUrl" alt="" /><Icon v-else name="Music2" :size="22" /></div><div class="download-info"><strong data-i18n-ignore>{{ task.track.name }}</strong><small><span data-i18n-ignore>{{ task.track.singer }} · {{ task.quality }}</span> · <span data-i18n>{{ statuses[task.status] }}</span> {{ task.status === 'running' ? `${(task.speed / 1024).toFixed(0)} KB/s` : '' }}</small><progress :value="task.progress" max="1" :aria-label="`${task.track.name} 下载进度`" /><small v-if="task.error" class="danger" data-i18n-ignore>{{ task.error }}</small></div><span>{{ Math.round(task.progress * 100) }}%</span><div class="button-row"><button v-if="task.status === 'completed'" class="icon-button" aria-label="播放已下载歌曲" @click="music.play(task.track)"><Icon name="Play" :size="18" /></button><button v-if="task.status === 'running' || task.status === 'queued'" class="icon-button" aria-label="暂停下载" @click="action('pause', [task.id])"><Icon name="Pause" :size="18" /></button><button v-if="task.status === 'paused' || task.status === 'failed'" class="icon-button" aria-label="继续下载" @click="action('resume', [task.id])"><Icon name="Play" :size="18" /></button><button v-if="task.path" class="icon-button" aria-label="打开文件" @click="music.task(() => invoke('app.openPath', { path: task.path }))"><Icon name="FolderOpen" :size="18" /></button><button class="icon-button" aria-label="移除下载任务" @click="action('remove', [task.id])"><Icon name="X" :size="18" /></button></div></article>
</template>

<style scoped>.download-toolbar{display:flex;align-items:center;gap:15px;margin-bottom:25px;flex-wrap:wrap}.download-toolbar>label{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px}.download-toolbar>select{font-size:11px}.download-toolbar .button-row{margin-left:auto}.download-toolbar button{font-size:10px;padding:7px 9px}.download-clear{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;padding:15px;background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-bottom:20px}.download-clear span{flex:1}.download-card>input{flex-shrink:0}.download-card .download-info>small span{font-size:inherit}</style>
