<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMusic, invoke, bridge } from '../store'
import Icon from './Icon.vue'

interface UpdateInfo { available: boolean; supported?: boolean; version?: string; releaseNotes?: string; message?: string; currentVersion?: string }
interface UpdateProgress { received: number; total: number; progress: number }
const music = useMusic()
const info = ref<UpdateInfo>()
const progress = ref<UpdateProgress>()
const ready = ref<{ path: string; version: string }>()
const checking = ref(false), downloading = ref(false), error = ref('')
const unsubscribers: (() => void)[] = []
async function check(): Promise<void> {
  checking.value = true; error.value = ''
  try { info.value = await invoke<UpdateInfo>('update.check') }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  finally { checking.value = false }
}
async function download(): Promise<void> {
  downloading.value = true; error.value = ''; progress.value = undefined
  try { await invoke('update.download') }
  catch (failure) { downloading.value = false; error.value = failure instanceof Error ? failure.message : String(failure) }
}
async function cancel(): Promise<void> { await music.task(() => invoke('update.cancel')); downloading.value = false }
function percentage(): number { if (!progress.value) return 0; const amount = progress.value.total > 0 ? progress.value.received / progress.value.total : progress.value.progress > 1 ? progress.value.progress / 100 : progress.value.progress; return Math.round(Math.max(0, Math.min(1, amount)) * 100) }
onMounted(() => {
  if (!bridge) return
  unsubscribers.push(bridge.on('update.progress', (next: UpdateProgress) => { progress.value = next; downloading.value = true }))
  unsubscribers.push(bridge.on('update.ready', (next: { path: string; version: string }) => { ready.value = next; downloading.value = false }))
})
onUnmounted(() => unsubscribers.forEach(unsubscribe => unsubscribe()))
</script>

<template>
  <div class="update-panel">
    <div class="section-title"><div><h3>应用更新</h3><small>{{ info?.currentVersion ? `当前版本 ${info.currentVersion}` : '从配置的更新服务检查新版本' }}</small></div><button :disabled="checking || downloading || !bridge" @click="check"><Icon name="RefreshCw" :size="14" />{{ checking ? '正在检查…' : '检查更新' }}</button></div>
    <p v-if="info" class="update-message">{{ info.message || (info.available ? `发现新版本 ${info.version || ''}` : '已是最新版本') }}</p>
    <p v-if="info?.supported === false" class="update-message">当前安装形式不支持应用内安装，可从发布渠道获取更新。</p>
    <pre v-if="info?.releaseNotes" class="release-notes">{{ info.releaseNotes }}</pre>
    <div v-if="downloading" class="update-download" role="status"><div><span>正在下载更新</span><span>{{ percentage() }}%</span></div><progress :value="percentage()" max="100" aria-label="更新下载进度" /><small v-if="progress">{{ (progress.received / 1048576).toFixed(1) }} / {{ (progress.total / 1048576).toFixed(1) }} MB</small><button @click="cancel">取消下载</button></div>
    <div v-if="ready" class="update-ready"><Icon name="CheckCircle2" :size="19" /><span>{{ ready.version }} 已下载，安装会重新启动应用。</span><button class="primary-button" @click="music.task(() => invoke('update.install'))">安装并重启</button></div>
    <button v-else-if="info?.available && info.supported !== false && !downloading" class="primary-button" @click="download"><Icon name="Download" :size="15" />下载新版本</button>
    <p v-if="error" class="danger update-message" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>.update-panel { border-top: 1px solid var(--border); margin-top: 25px; padding-top: 25px; }.update-panel h3 { margin-bottom: 8px; }.update-panel small { font-size: 10px; }.update-message { font-size: 11px; color: var(--muted); line-height: 1.9; margin: 18px 0; }.release-notes { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 11px; line-height: 1.9; padding: 15px; background: var(--bg); border-radius: 8px; max-height: 250px; overflow: auto; }.update-download { margin: 20px 0; font-size: 11px; }.update-download div { display: flex; justify-content: space-between; }.update-download small { display: block; margin: 10px 0; }.update-ready { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--accent); padding: 20px 0; }.update-ready button { margin-left: auto; }</style>
