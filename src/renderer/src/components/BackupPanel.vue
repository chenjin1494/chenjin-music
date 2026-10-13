<script setup lang="ts">
import { ref } from 'vue'
import { useMusic, invoke, bridge } from '../store'
import type { LibraryState } from '../../../shared/types'
import Icon from './Icon.vue'

const music = useMusic()
const scope = ref('all')
const playlistId = ref(music.library.playlists[0]?.id || 'default')
const format = ref('default')
const merge = ref(false)
const busy = ref(false)
async function exportBackup(): Promise<void> {
  busy.value = true
  await music.task(async () => {
    const result = await invoke('backup.export', { scope: scope.value, playlistId: scope.value === 'playlist' ? playlistId.value : undefined, format: format.value === 'lx' ? 'lx' : undefined })
    if (result) music.notify('备份已导出')
  })
  busy.value = false
}
async function importBackup(legacy = false): Promise<void> {
  busy.value = true
  await music.task(async () => {
    const result = await invoke<LibraryState | null>(legacy ? 'backup.importLegacyDirectory' : 'backup.import', legacy ? undefined : { merge: merge.value })
    if (result) { await music.refresh(); music.notify('资料库已导入') }
  })
  busy.value = false
}
async function text(format: 'txt' | 'csv'): Promise<void> {
  await music.task(async () => {
    const result = await invoke<string>('backup.exportText', { format, scope: scope.value, playlistId: scope.value === 'playlist' ? playlistId.value : undefined })
    const url = URL.createObjectURL(new Blob([format === 'csv' ? '\ufeff' + result : result], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `琛瑾音乐歌单-${new Date().toISOString().slice(0, 10)}.${format}`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    music.notify('歌曲列表已导出')
  })
}
</script>

<template>
  <p class="backup-help">为歌单与设置留一份备份。导入旧 LX 目录时，桌面服务会读取兼容数据；音乐文件不会被复制。</p>
  <label class="setting-row"><span>导出范围</span><select v-model="scope"><option value="all">完整资料库</option><option value="settings">仅设置</option><option value="playlist">指定歌单</option></select></label>
  <label v-if="scope === 'playlist'" class="setting-row"><span>选择歌单</span><select v-model="playlistId"><option v-for="list in music.library.playlists" :key="list.id" :value="list.id">{{ list.name }}</option></select></label>
  <label class="setting-row"><span>备份格式</span><select v-model="format"><option value="default">琛瑾音乐备份</option><option value="lx">LX 兼容 JSON</option></select></label>
  <div class="setting-row"><span>保存备份</span><button class="primary-button" :disabled="busy || !bridge" @click="exportBackup"><Icon name="Download" :size="15" />导出备份</button></div>
  <div v-if="scope !== 'settings'" class="setting-row"><span>歌曲清单 <small>方便阅读、整理或在表格软件中打开</small></span><div class="button-row"><button :disabled="!bridge" @click="text('txt')">TXT</button><button :disabled="!bridge" @click="text('csv')">CSV</button></div></div>
  <label class="setting-row"><span>导入时合并歌单 <small>关闭则按备份恢复资料库</small></span><input v-model="merge" type="checkbox" class="switch" /></label>
  <div class="setting-row"><span>导入备份文件</span><button :disabled="busy || !bridge" @click="importBackup()"><Icon name="Upload" :size="15" />选择备份</button></div>
  <div class="setting-row"><span>导入旧 LX 数据目录 <small>选择旧应用的数据文件夹</small></span><button :disabled="busy || !bridge" @click="importBackup(true)"><Icon name="FolderOpen" :size="15" />选择目录</button></div>
</template>

<style scoped>.backup-help{font-size:11px;color:var(--muted);line-height:1.9;margin:20px 0}</style>
