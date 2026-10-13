<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMusic, invoke, bridge } from '../store'
import Icon from './Icon.vue'

interface SyncDevice { clientId: string; deviceName: string; connected: boolean; lastConnectDate?: string | number }
interface PendingMode { deviceName: string; feature: 'list' | 'dislike'; modes: string[] }
interface SyncStatus {
  enabled: boolean
  mode: 'server' | 'client'
  status: string
  state: string
  message: string
  address: string[]
  code: string
  devices: SyncDevice[]
  pendingMode?: PendingMode
}
const music = useMusic()
const status = ref<SyncStatus>()
const pending = ref<PendingMode>()
const code = ref('')
const busy = ref(false)
const failure = ref('')
const unsubscribers: (() => void)[] = []
const modes = [
  { id: 'merge_local_remote', name: '合并 · 本地 → 远端', description: '合并两个设备的内容，以本地为主。' },
  { id: 'merge_remote_local', name: '合并 · 远端 → 本地', description: '合并两个设备的内容，以远端为主。' },
  { id: 'overwrite_local_remote', name: '覆盖 · 本地 → 远端', description: '用本地内容替换远端同名列表；保留远端额外歌单。' },
  { id: 'overwrite_remote_local', name: '覆盖 · 远端 → 本地', description: '用远端内容替换本地对应列表；保留本地额外歌单。' },
  { id: 'overwrite_local_remote_full', name: '完整镜像 · 本地 → 远端', description: '完整按本地内容同步远端，包括删除内容。' },
  { id: 'overwrite_remote_local_full', name: '完整镜像 · 远端 → 本地', description: '完整按远端内容同步本地，包括删除内容。' },
]

function apply(next: SyncStatus): void { status.value = next; pending.value = next.pendingMode }
async function call(method: string, params?: unknown): Promise<void> {
  busy.value = true; failure.value = ''
  try { apply(await invoke<SyncStatus>(method, params)) }
  catch (error) { failure.value = error instanceof Error ? error.message : String(error) }
  finally { busy.value = false }
}
async function configure(partial: Record<string, unknown>): Promise<void> {
  await music.updateSettings(partial)
  await call('sync.status')
}
onMounted(() => {
  if (!bridge) return
  unsubscribers.push(bridge.on('sync.status', (next: SyncStatus) => apply(next)))
  unsubscribers.push(bridge.on('sync.mode', (next: PendingMode | null) => pending.value = next || undefined))
  void call('sync.status')
})
onUnmounted(() => unsubscribers.forEach(unsubscribe => unsubscribe()))
</script>

<template>
  <p class="sync-help">将歌单与不喜欢的歌曲同步到自己的设备。配置与连接状态来自桌面同步服务。</p>
  <p v-if="!bridge" class="sync-help">浏览器预览未连接桌面同步服务。</p>
  <label class="setting-row"><span>启用同步</span><input type="checkbox" class="switch" :disabled="!bridge" :checked="music.settings.syncEnabled" @change="configure({ syncEnabled: ($event.target as HTMLInputElement).checked })" /></label>
  <label class="setting-row"><span>工作角色</span><select :disabled="!bridge" :value="music.settings.syncMode" @change="configure({ syncMode: ($event.target as HTMLSelectElement).value })"><option value="server">服务端 · 供其他设备连接</option><option value="client">客户端 · 连接另一台设备</option></select></label>
  <label v-if="music.settings.syncMode === 'client'" class="setting-row"><span>服务端地址</span><input :value="music.settings.syncHost" placeholder="192.168.1.100" @change="configure({ syncHost: ($event.target as HTMLInputElement).value })" /></label>
  <label class="setting-row"><span>同步端口</span><input type="number" min="1" max="65535" :value="music.settings.syncPort" @change="configure({ syncPort: Number(($event.target as HTMLInputElement).value) })" /></label>
  <div class="sync-status" role="status"><div class="section-title"><strong>{{ status?.message || (busy ? '正在读取同步状态…' : '尚未连接') }}</strong><button :disabled="busy || !bridge" @click="call('sync.status')"><Icon name="RefreshCw" :size="14" />刷新</button></div><small v-if="status">{{ status.state }} · {{ status.status }}</small><div v-if="status?.address?.length" class="sync-addresses"><code v-for="address in status.address" :key="address">{{ address }}</code></div><div v-if="music.settings.syncMode === 'server' && status?.code" class="connection-code"><span>连接码</span><code>{{ status.code }}</code><small>在另一台设备的客户端输入这个连接码。</small></div></div>
  <form v-if="music.settings.syncMode === 'client'" class="connection-form" @submit.prevent="call('sync.auth', { code })"><label for="sync-code">服务端连接码</label><div class="button-row"><input id="sync-code" v-model="code" autocomplete="off" placeholder="连接码或服务密码" maxlength="512" required /><button class="primary-button" :disabled="busy || !bridge || !code.trim()" type="submit">验证并连接</button></div></form>
  <p v-if="failure" class="danger sync-help" role="alert">{{ failure }}</p>
  <section v-if="pending" class="sync-conflict"><h3>选择这次同步的方式</h3><p>{{ pending.deviceName }} · {{ pending.feature === 'list' ? '歌单' : '不喜欢的歌曲' }}</p><div class="sync-mode-grid"><button v-for="mode in modes.filter(item => pending?.modes.includes(item.id))" :key="mode.id" :disabled="busy" @click="call('sync.mode', { mode: mode.id })"><strong>{{ mode.name }}</strong><small>{{ mode.description }}</small></button></div><button :disabled="busy" @click="call('sync.mode', { mode: 'cancel' })">取消本次同步</button></section>
  <div class="section-title device-heading"><h3>已授权设备</h3><small>{{ status?.devices.length || 0 }} 台</small></div>
  <div v-if="!status?.devices.length" class="sync-help">尚无已授权设备。完成连接后，真实设备状态会显示在这里。</div>
  <article v-for="device in status?.devices || []" :key="device.clientId" class="sync-device"><Icon name="Monitor" :size="23" /><div><strong>{{ device.deviceName }}</strong><small>{{ device.connected ? '已连接' : '离线' }}{{ device.lastConnectDate ? ` · 上次连接 ${new Date(device.lastConnectDate).toLocaleString()}` : '' }}</small></div><button :disabled="busy" @click="call('sync.device.remove', { id: device.clientId })">移除授权</button></article>
</template>

<style scoped>
.sync-help { font-size: 11px; color: var(--muted); line-height: 1.9; margin: 18px 0; }.sync-status { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin: 20px 0; }.sync-status strong { font-size: 12px; }.sync-status small { display: block; font-size: 10px; margin-top: 8px; }.sync-addresses { display: flex; flex-direction: column; gap: 6px; margin-top: 15px; }.sync-addresses code { font-size: 11px; color: var(--accent); overflow-wrap: anywhere; }.connection-code { border-top: 1px solid var(--border); margin-top: 16px; padding-top: 15px; }.connection-code span { display: block; font-size: 10px; color: var(--muted); }.connection-code code { display: block; font-size: 22px; letter-spacing: 4px; color: var(--accent); margin: 10px 0; overflow-wrap: anywhere; }.connection-form { font-size: 12px; }.connection-form label { display: block; margin-bottom: 12px; }.connection-form input { flex: 1; }.device-heading { margin-top: 30px; }.sync-device { display: flex; gap: 15px; align-items: center; padding: 20px 0; border-bottom: 1px solid var(--border); }.sync-device svg { color: var(--accent); }.sync-device div { flex: 1; }.sync-device strong { font-size: 12px; }.sync-device small { display: block; margin-top: 6px; font-size: 10px; }.sync-conflict { border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent); border-radius: 12px; padding: 20px; margin-top: 20px; }.sync-conflict p { font-size: 11px; color: var(--muted); margin: 10px 0 15px; }.sync-mode-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-bottom: 15px; }.sync-mode-grid button { flex-direction: column; text-align: left; align-items: flex-start; padding: 13px; }.sync-mode-grid strong { font-size: 11px; }.sync-mode-grid small { font-size: 9px; line-height: 1.8; }@media(max-width:640px){.sync-mode-grid{grid-template-columns:1fr}.sync-device{gap:10px;flex-wrap:wrap}}
</style>
