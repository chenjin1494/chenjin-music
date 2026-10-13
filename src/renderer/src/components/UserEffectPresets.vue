<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMusic } from '../store'
import { captureEffect, effectSettings, parseEffect, type UserEffect } from '../domain/effects'

const music = useMusic()
const name = ref(''), selected = ref(''), fileInput = ref<HTMLInputElement>()
const presets = computed(() => {
  const data = music.settings.effectUserPresets
  return data && typeof data === 'object' ? data as Record<string, UserEffect> : {}
})
async function save(): Promise<void> {
  const label = name.value.trim()
  if (!label) return
  await music.updateSettings({ effectUserPresets: { ...presets.value, [label]: captureEffect(music.settings, label) } })
  selected.value = label; name.value = ''; music.notify('音效预设已保存')
}
async function remove(): Promise<void> { const next = { ...presets.value }; delete next[selected.value]; await music.updateSettings({ effectUserPresets: next }); selected.value = '' }
function exportFile(): void {
  const text = JSON.stringify({ format: 'chenjin-effects', version: 1, presets: presets.value }, null, 2)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a')
  link.href = url; link.download = 'chenjin-effects.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  await music.task(async () => {
    if (file.size > 100_000) throw new Error('预设文件超过 100 KB')
    const data = JSON.parse(await file.text())
    if (data.format !== 'chenjin-effects' || data.version !== 1 || !data.presets || typeof data.presets !== 'object') throw new Error('无效的音效预设文件')
    const next: Record<string, UserEffect> = { ...presets.value }
    for (const [label, value] of Object.entries(data.presets).slice(0, 100)) { const preset = parseEffect(value, label); next[preset.name] = preset }
    await music.updateSettings({ effectUserPresets: next }); music.notify('音效预设已导入')
  })
  input.value = ''
}
</script>

<template>
  <div class="user-effects"><div class="section-title"><strong>我的音效预设</strong><div class="button-row"><button @click="fileInput?.click()">导入预设</button><button :disabled="!Object.keys(presets).length" @click="exportFile">导出预设</button></div></div><form class="button-row" @submit.prevent="save"><input v-model="name" placeholder="为当前音效起一个名字" maxlength="60" aria-label="音效预设名称" /><button :disabled="!name.trim()" type="submit">保存当前音效</button></form><div v-if="Object.keys(presets).length" class="button-row"><select v-model="selected" aria-label="我的音效预设"><option value="">选择预设</option><option v-for="(preset, key) in presets" :key="key" :value="key" data-i18n-ignore>{{ preset.name }}</option></select><button :disabled="!selected" @click="music.updateSettings(effectSettings(parseEffect(presets[selected])))">应用预设</button><button :disabled="!selected" @click="remove">删除预设</button></div><input ref="fileInput" type="file" accept=".json,application/json" hidden aria-label="导入音效预设文件" @change="importFile" /></div>
</template>

<style scoped>.user-effects{border:1px solid var(--border);padding:15px;border-radius:9px;margin:15px 0 20px}.user-effects>.section-title{margin-bottom:15px}.user-effects>.button-row{margin-top:12px}.user-effects input{flex:1;min-width:0;font-size:11px}.user-effects button{font-size:10px;padding:7px 10px}.user-effects select{flex:1;min-width:0;font-size:11px}</style>
