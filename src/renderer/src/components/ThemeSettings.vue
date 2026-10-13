<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMusic,invoke,bridge } from '../store'
import { exportTheme, parseTheme,validThemeBackground,type ThemeFile } from '../domain/theme'
import AppearanceSettings from './AppearanceSettings.vue'
import Icon from './Icon.vue'

const music = useMusic()
const fileInput = ref<HTMLInputElement>()
const themeName=ref(''),chosenTheme=ref('')
const themes=computed(()=>music.settings.userThemes&&typeof music.settings.userThemes==='object'?music.settings.userThemes as Record<string,ThemeFile>:{})
async function applyTheme(theme:ThemeFile):Promise<void>{await music.updateSettings({theme:theme.theme,accent:theme.accent,font:theme.font,themeColors:theme.colors,themeBackground:theme.background||'',themeBackgroundOpacity:theme.backgroundOpacity??.25})}
async function saveTheme():Promise<void>{if(!themeName.value.trim())return;const name=themeName.value.trim();await music.updateSettings({userThemes:{...themes.value,[name]:exportTheme(music.settings)}});chosenTheme.value=name;themeName.value=''}
async function deleteTheme():Promise<void>{const next={...themes.value};delete next[chosenTheme.value];await music.updateSettings({userThemes:next});chosenTheme.value=''}
async function importImage():Promise<void>{await music.task(async()=>{const image=await invoke<{name:string;data:string}|null>('theme.importImage');if(image&&validThemeBackground(image.data))await music.updateSettings({themeBackground:image.data,themeBackgroundOpacity:Number(music.settings.themeBackgroundOpacity??.25)})})}
async function setBackground(event:Event):Promise<void>{const value=(event.target as HTMLInputElement).value.trim();await music.task(async()=>{if(!validThemeBackground(value))throw new Error('主题背景地址无效');await music.updateSettings({themeBackground:value})})}
const colors = { bg: '主背景', sidebar: '侧栏背景', surface: '卡片背景', text: '正文颜色', muted: '辅助文字' }
const fallback = { bg: '#15131d', sidebar: '#100f17', surface: '#1c1926', text: '#f1eef8', muted: '#92909f' }
function color(key: string): string { return (music.settings.themeColors as Record<string, string> | undefined)?.[key] || fallback[key as keyof typeof fallback] }
function setColor(key: string, event: Event): void {
  void music.updateSettings({ themeColors: { ...(music.settings.themeColors as object || {}), [key]: (event.target as HTMLInputElement).value } })
}
function download(): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportTheme(music.settings), null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = '琛瑾音乐主题.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await music.task(async () => {
    if (file.size > 12_000_000) throw new Error('主题文件超过 12 MB')
    const theme = parseTheme(JSON.parse(await file.text()))
    await applyTheme(theme)
    music.notify('主题已应用')
  })
  input.value = ''
}
</script>

<template>
  <AppearanceSettings/>
  <div class="setting-row"><div><strong>主题</strong><small>明暗之间，自在切换</small></div><div class="segmented"><button v-for="theme in (['dark', 'light', 'system'] as const)" :key="theme" :class="{ active: music.settings.theme === theme }" @click="music.updateSettings({ theme, themeColors: {} })">{{ { dark: '深色', light: '浅色', system: '跟随系统' }[theme] }}</button></div></div>
  <label class="setting-row"><span>界面语言</span><select :value="music.settings.language" @change="music.updateSettings({language:($event.target as HTMLSelectElement).value})"><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en-US">English</option></select></label>
  <template v-if="music.settings.theme==='system'"><label v-for="choice in [{key:'themeLightId',name:'系统浅色主题'},{key:'themeDarkId',name:'系统深色主题'}]" :key="choice.key" class="setting-row"><span>{{choice.name}}</span><select :value="music.settings[choice.key]||''" @change="music.updateSettings({[choice.key]:($event.target as HTMLSelectElement).value})"><option value="">默认主题</option><option v-for="(_,name) in themes" :key="name" :value="name" data-i18n-ignore>{{name}}</option></select></label></template>
  <label class="setting-row"><span>界面字号 <small>缩放文字与控件，保持页面适配窗口</small></span><input type="number" min="12" max="24" :value="music.settings.interfaceFontSize||16" @change="music.updateSettings({interfaceFontSize:Math.max(12,Math.min(24,Number(($event.target as HTMLInputElement).value)))})"/></label>
  <label class="setting-row"><span>强调色</span><input type="color" :value="music.settings.accent" @input="music.updateSettings({ accent: ($event.target as HTMLInputElement).value })" /></label>
  <label class="setting-row"><span>字体 <small>留空使用系统字体</small></span><input :value="music.settings.font" placeholder="系统默认" @change="music.updateSettings({ font: ($event.target as HTMLInputElement).value })" /></label>
  <details class="palette-details"><summary>自定义主题颜色</summary><label v-for="(name, key) in colors" :key="key" class="setting-row"><span>{{ name }}</span><input type="color" :value="color(key)" @input="setColor(key, $event)" /></label><button @click="music.updateSettings({ themeColors: {} })">恢复主题配色</button></details>
  <div class="setting-row"><span>主题文件 <small>仅包含外观，不包含个人资料库</small></span><div class="button-row"><button @click="fileInput?.click()"><Icon name="Upload" :size="14" />导入</button><button @click="download"><Icon name="Download" :size="14" />导出</button></div></div>
  <label class="setting-row"><span>背景图片</span><div class="button-row"><button :disabled="!bridge" @click="importImage">选择背景图片</button><button @click="music.updateSettings({themeBackground:''})">清除背景</button></div></label>
  <label class="setting-row"><span>背景图片地址</span><input :value="typeof music.settings.themeBackground==='string'&&!music.settings.themeBackground.startsWith('data:')?music.settings.themeBackground:''" placeholder="https://…/background.jpg" @change="setBackground"/></label>
  <label class="setting-row"><span>背景透明度</span><div class="button-row"><input type="range" min="0" max="1" step=".05" :value="music.settings.themeBackgroundOpacity??.25" aria-label="背景透明度" @input="music.updateSettings({themeBackgroundOpacity:Number(($event.target as HTMLInputElement).value)})"/><output>{{Math.round(Number(music.settings.themeBackgroundOpacity??.25)*100)}}%</output></div></label>
  <div class="theme-collection"><h3>我的主题</h3><form class="button-row" @submit.prevent="saveTheme"><input v-model="themeName" placeholder="为当前主题起一个名字" maxlength="60" aria-label="主题名称"/><button type="submit" :disabled="!themeName.trim()">保存当前主题</button></form><div v-if="Object.keys(themes).length" class="button-row"><select v-model="chosenTheme" aria-label="选择已保存主题"><option value="">选择主题</option><option v-for="(_,name) in themes" :key="name" :value="name" data-i18n-ignore>{{name}}</option></select><button :disabled="!chosenTheme" @click="applyTheme(parseTheme(themes[chosenTheme]))">应用主题</button><button :disabled="!chosenTheme" @click="deleteTheme">删除主题</button></div></div>
  <input ref="fileInput" type="file" accept=".json,application/json" class="visually-hidden" aria-label="导入主题文件" @change="importFile" />
</template>

<style scoped>.palette-details { padding: 18px 0; border-bottom: 1px solid var(--border); font-size: 12px; }.palette-details summary { color: var(--muted); cursor: pointer; }.visually-hidden { display: none; }.theme-collection{padding:20px 0;font-size:12px}.theme-collection h3{font-size:12px;margin-bottom:15px}.theme-collection>.button-row{margin-top:12px}.theme-collection input,.theme-collection select{flex:1;min-width:0;font-size:11px}.theme-collection button{font-size:10px}</style>
