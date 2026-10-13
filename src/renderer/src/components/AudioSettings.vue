<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMusic, invoke, bridge } from '../store'
import UserEffectPresets from './UserEffectPresets.vue'
import { effectPresets } from '../domain/preferences'

const music = useMusic()
const clock = ref('23:00')
const timerMode = ref('off')
const waitForEnd = ref(false)
const channels = computed(() => [...new Set([1, 2, music.audioCapabilities.maxChannels])].filter(count => count <= music.audioCapabilities.maxChannels))
function numeric(key: string, event: Event): void { void music.updateSettings({ [key]: Number((event.target as HTMLInputElement).value) }) }
async function importImpulse():Promise<void>{await music.task(async()=>{const response=await invoke<{name:string;data:string}|null>('audio.importImpulse');if(response)await music.updateSettings({impulseResponseName:response.name,impulseResponseBase64:response.data})})}
function timer(): void {
  if (timerMode.value === 'track') { music.setSleep(0); music.sleepAfterTrack = true }
  else if (timerMode.value === 'clock') music.setSleepClock(clock.value, waitForEnd.value)
  else music.setSleep(Number(timerMode.value) || 0, waitForEnd.value)
}
</script>

<template>
  <label class="setting-row"><span>默认音质</span><select :value="music.settings.quality" @change="music.updateSettings({ quality: ($event.target as HTMLSelectElement).value as typeof music.settings.quality })"><option value="128k">标准 · 128k</option><option value="320k">高品质 · 320k</option><option value="flac">无损 · FLAC</option><option value="flac24bit">Hi-Res · 24bit</option></select></label>
  <label class="setting-row"><span>播放速度</span><select :value="music.settings.playbackRate" @change="numeric('playbackRate', $event)"><option v-for="rate in [.5, .75, 1, 1.25, 1.5, 2]" :key="rate" :value="rate">{{ rate }}×</option></select></label>
  <label class="setting-row"><span>输出设备 <small>移除设备时自动回到系统默认</small></span><select :value="music.settings.outputDevice" @focus="music.service.refreshDevices" @change="music.updateSettings({ outputDevice: ($event.target as HTMLSelectElement).value })"><option value="default">系统默认</option><option v-for="device in music.audioCapabilities.devices.filter(item => item.deviceId !== 'default')" :key="device.deviceId" :value="device.deviceId">{{ device.label || '音频输出设备' }}</option></select></label>
  <label class="setting-row"><span>输出通道 <small>设备最多 {{ music.audioCapabilities.maxChannels }} 通道；立体声内容保持原有声道</small></span><select :value="music.preferences.outputChannels" @change="numeric('outputChannels', $event)"><option v-for="count in channels" :key="count" :value="count">{{ count === 1 ? '单声道' : count === 2 ? '立体声' : `${count} 通道（设备最大）` }}</option></select></label>
  <p v-if="music.audioCapabilities.error" class="audio-status" role="status">{{ music.audioCapabilities.error }}</p>
  <div class="equalizer">
    <div class="section-title"><strong>音效预设</strong><button @click="music.updateSettings({ ...effectPresets.flat, reverbDecay: 1.8, pannerSpeed: .12 })">重置全部音效</button></div>
    <div class="chips"><button v-for="(preset, id) in effectPresets" :key="id" @click="music.updateSettings({ eq: [...preset.eq], reverb: preset.reverb, pitch: preset.pitch, panner: preset.panner, reverbDecay: id === 'hall' ? 2.8 : 1.8 })">{{ preset.name }}</button></div>
    <div class="section-title"><strong>十段均衡器</strong><button @click="music.updateSettings({ eq: Array(10).fill(0) })">归零</button></div>
    <div class="eq-sliders"><label v-for="(gain, index) in music.settings.eq" :key="index"><span>{{ gain > 0 ? '+' : '' }}{{ gain }}</span><input type="range" min="-15" max="15" step="1" :value="gain" :aria-label="`${[32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000][index]}Hz 增益`" @input="music.updateSettings({ eq: music.settings.eq.map((value, i) => i === index ? Number(($event.target as HTMLInputElement).value) : value) })" /><small>{{ ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'][index] }}</small></label></div>
  </div>
  <UserEffectPresets />
  <label class="setting-row"><span>自定义卷积响应 <small data-i18n-ignore>{{ music.settings.impulseResponseName || '' }}</small></span><div class="button-row"><button :disabled="!bridge" @click="importImpulse">导入 WAV 响应</button><button :disabled="!music.settings.impulseResponseBase64" @click="music.updateSettings({impulseResponseBase64:'',impulseResponseName:''})">恢复生成混响</button></div></label>
  <label v-for="control in [{key:'reverbDryGain',name:'原声增益'},{key:'reverbWetGain',name:'混响增益'}]" :key="control.key" class="setting-row"><span>{{control.name}}</span><div class="effect-control"><input type="range" min="0" max="2" step=".05" :value="music.settings[control.key]??1" :aria-label="control.name" @input="numeric(control.key,$event)"/><output>{{Number(music.settings[control.key]??1).toFixed(2)}}×</output></div></label>
  <label class="setting-row"><span>独立变调 <small>双读头 AudioWorklet · 约 40 ms 窗口 · 保持播放速度</small></span><div class="effect-control"><input type="range" min="-12" max="12" step="1" :value="music.settings.pitch" :disabled="!music.audioCapabilities.worklet" aria-label="变调半音" @input="numeric('pitch', $event)" /><output>{{ music.settings.pitch > 0 ? '+' : '' }}{{ music.settings.pitch }} 半音</output></div></label>
  <p v-if="!music.audioCapabilities.worklet" class="settings-help">首次播放后会初始化音频线程；初始化失败会保留原声播放，并显示原因。</p>
  <label class="setting-row"><span>卷积混响 <small>0% 原声 · 100% 纯混响</small></span><div class="effect-control"><input type="range" min="0" max="1" step=".01" :value="music.settings.reverb" aria-label="混响干湿混合" @input="numeric('reverb', $event)" /><output>{{ Math.round(music.settings.reverb * 100) }}%</output></div></label>
  <label class="setting-row"><span>混响尾音</span><div class="effect-control"><input type="range" min=".2" max="8" step=".1" :value="music.preferences.reverbDecay" aria-label="混响尾音秒数" @change="numeric('reverbDecay', $event)" /><output>{{ music.preferences.reverbDecay.toFixed(1) }} s</output></div></label>
  <label class="setting-row"><span>旋转声场 <small>低频振荡器平滑控制左右声像</small></span><input type="checkbox" class="switch" :checked="music.settings.panner" @change="music.updateSettings({ panner: ($event.target as HTMLInputElement).checked })" /></label>
  <label v-if="music.settings.panner" class="setting-row"><span>声场转速</span><div class="effect-control"><input type="range" min=".02" max="1" step=".01" :value="music.preferences.pannerSpeed" aria-label="声场转速" @input="numeric('pannerSpeed', $event)" /><output>{{ music.preferences.pannerSpeed.toFixed(2) }} Hz</output></div></label>
  <div class="setting-row"><span>定时停止 <small v-if="music.sleepAt">{{ new Date(music.sleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}{{ music.sleepWaitForEnd ? ' 起，等当前歌曲结束' : ' 停止' }}</small><small v-else-if="music.sleepAfterTrack">当前歌曲结束后停止</small></span><select v-model="timerMode" @change="timer"><option value="off">关闭</option><option value="track">当前歌曲结束</option><option v-for="minutes in [15, 30, 45, 60, 90]" :key="minutes" :value="String(minutes)">{{ minutes }} 分钟后</option><option value="clock">指定时间</option></select></div>
  <label v-if="timerMode === 'clock'" class="setting-row"><span>停止时间 <small>若已过，将在明天这个时间停止</small></span><input v-model="clock" type="time" @change="timer" /></label>
  <label v-if="timerMode !== 'off' && timerMode !== 'track'" class="setting-row"><span>到时等当前歌曲播完</span><input v-model="waitForEnd" type="checkbox" class="switch" @change="timer" /></label>
</template>

<style scoped>.effect-control { display: flex; gap: 14px; align-items: center; }.effect-control input { width: 130px; }.effect-control output { width: 60px; text-align: right; font-size: 11px; color: var(--accent); }.settings-help, .audio-status { font-size: 10px; line-height: 1.8; margin: 10px 0; color: var(--muted); }.audio-status { color: #dc9baa; }@media(max-width:640px){.effect-control input{width:95px}}</style>
