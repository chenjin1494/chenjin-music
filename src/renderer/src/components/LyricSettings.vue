<script setup lang="ts">
import { useMusic, invoke, bridge } from '../store'
import type { LyricScript, LyricStyle } from '../domain/preferences'
import DesktopLyricSettings from './DesktopLyricSettings.vue'

const music = useMusic()
async function desktopLyric(): Promise<void> {
  const enabled = !music.settings.desktopLyric
  await music.task(async () => { await invoke('desktop.lyric', { enabled }); await music.updateSettings({ desktopLyric: enabled }) })
}
const fonts = ['', 'Microsoft YaHei', 'SimSun', 'KaiTi', 'Segoe UI']
function numeric(key: string, event: Event): void { void music.updateSettings({ [key]: Number((event.target as HTMLInputElement).value) }) }
</script>

<template>
  <label class="setting-row"><span>歌词样式</span><select :value="music.preferences.lyricStyle" @change="music.updateSettings({ lyricStyle: ($event.target as HTMLSelectElement).value as LyricStyle })"><option value="center">居中逐行</option><option value="left">左侧对齐</option><option value="karaoke">聚焦 / 卡拉 OK</option></select></label>
  <label class="setting-row"><span>简繁转换 <small>使用完整 OpenCC 字典，按需加载</small></span><select :value="music.preferences.lyricScript" @change="music.updateSettings({ lyricScript: ($event.target as HTMLSelectElement).value as LyricScript })"><option value="original">保持原文</option><option value="simplified">简体中文</option><option value="traditional">繁體中文</option></select></label>
  <label class="setting-row"><span>字体 <small>也可输入本机已安装的字体名称</small></span><input list="lyric-font-list" :value="music.preferences.lyricFont" placeholder="系统默认" @change="music.updateSettings({ lyricFont: ($event.target as HTMLInputElement).value })" /><datalist id="lyric-font-list"><option v-for="font in fonts" :key="font" :value="font" /></datalist></label>
  <label class="setting-row"><span>字号</span><div class="lyric-control"><input type="range" min="14" max="48" step="1" :value="music.preferences.lyricFontSize" aria-label="歌词字号" @input="numeric('lyricFontSize', $event)" /><output>{{ music.preferences.lyricFontSize }} px</output></div></label>
  <label class="setting-row"><span>行高</span><div class="lyric-control"><input type="range" min="1" max="3" step=".1" :value="music.preferences.lyricLineHeight" aria-label="歌词行高" @input="numeric('lyricLineHeight', $event)" /><output>{{ music.preferences.lyricLineHeight.toFixed(1) }}</output></div></label>
  <label class="setting-row"><span>加粗歌词</span><input class="switch" type="checkbox" :checked="music.preferences.lyricBold" @change="music.updateSettings({ lyricBold: ($event.target as HTMLInputElement).checked })" /></label>
  <label class="setting-row"><span>逐字高亮 <small>支持 LX、YRC、KRC、QRC 有时间标记的歌词</small></span><input class="switch" type="checkbox" :checked="music.preferences.lyricWordHighlight" @change="music.updateSettings({ lyricWordHighlight: ($event.target as HTMLInputElement).checked })" /></label>
  <label class="setting-row"><span>普通歌词颜色</span><input type="color" :value="music.preferences.lyricColor" @input="music.updateSettings({ lyricColor: ($event.target as HTMLInputElement).value })" /></label>
  <label class="setting-row"><span>高亮歌词颜色</span><input type="color" :value="music.preferences.lyricActiveColor" @input="music.updateSettings({ lyricActiveColor: ($event.target as HTMLInputElement).value })" /></label>
  <div class="setting-row"><span>歌词背景</span><div class="button-row"><input type="color" aria-label="歌词背景色" :value="music.preferences.lyricBackground || '#15131d'" @input="music.updateSettings({ lyricBackground: ($event.target as HTMLInputElement).value })" /><button @click="music.updateSettings({ lyricBackground: '' })">跟随主题</button></div></div>
  <label class="setting-row"><span>歌词偏移 <small>正值使歌词提前</small></span><div class="lyric-control"><input type="number" step="100" :value="music.settings.lyricOffset" aria-label="歌词偏移毫秒" @change="numeric('lyricOffset', $event)" /><output>毫秒</output></div></label>
  <div class="setting-row"><span>桌面歌词</span><button :disabled="!bridge" @click="desktopLyric">{{ music.settings.desktopLyric ? '关闭' : '打开' }}</button></div>
  <div class="setting-row"><span>桌面歌词锁定 / 置顶</span><div class="button-row"><button :disabled="!bridge" @click="music.task(() => invoke('desktop.lock', { enabled: true }))">锁定</button><button :disabled="!bridge" @click="music.task(() => invoke('desktop.lock', { enabled: false }))">解锁</button><button :disabled="!bridge" @click="music.task(() => invoke('desktop.top', { enabled: true }))">置顶</button></div></div>
  <DesktopLyricSettings />
</template>

<style scoped>.lyric-control { display: flex; align-items: center; gap: 14px; }.lyric-control input[type=range] { width: 130px; }.lyric-control output { font-size: 11px; color: var(--accent); min-width: 40px; text-align: right; }@media(max-width:640px){.lyric-control input[type=range]{width:100px}}</style>
