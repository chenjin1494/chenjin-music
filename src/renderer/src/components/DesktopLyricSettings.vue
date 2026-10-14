<script setup lang="ts">
import { useMusic, invoke, bridge } from '../store'

const music = useMusic()
const rules = [
  {key:'desktopLyricNextLine',name:'下一句预览',detail:'横向且窗口高度足够时显示下一句歌词'},
  {key:'desktopLyricVisualization',name:'桌面歌词频谱',detail:'显示当前播放音频的真实频谱'},
  {key:'desktopLyricScreenLock',name:'限制在屏幕内',detail:'由桌面服务保持歌词窗口位于可见屏幕'},
  {key:'desktopLyricTopLoop',name:'持续保持置顶',detail:'定期恢复已启用的歌词置顶状态'},
  {key:'statusBarLyric',name:'托盘显示歌词',detail:'将当前歌词显示在托盘提示中'},
  { key: 'desktopLyricPauseHide', name: '暂停时隐藏', detail: '暂停播放时由桌面服务隐藏窗口' },
  { key: 'desktopLyricFullscreenHide', name: '应用全屏时隐藏', detail: '应用进入全屏时由桌面服务隐藏窗口' },
  { key: 'desktopLyricHoverHide', name: '鼠标经过时隐藏', detail: '仅锁定时生效，避免歌词遮挡操作' },
  { key: 'desktopLyricTaskbar', name: '显示在任务栏', detail: '允许从任务栏切换到桌面歌词' },
]
function text(key: string, event: Event): void { void music.updateSettings({ [key]: (event.target as HTMLInputElement).value }) }
function numeric(key: string, event: Event): void { void music.updateSettings({ [key]: Number((event.target as HTMLInputElement).value) }) }
</script>

<template>
  <h3 class="desktop-settings-title">桌面歌词外观与行为</h3>
  <div class="setting-row"><span>恢复歌词窗口 <small>找回移出屏幕或尺寸过小的歌词窗口</small></span><button :disabled="!bridge" @click="music.task(()=>invoke('desktop.resetPosition'))">重置歌词位置</button></div>
  <label class="setting-row"><span>独立字体 <small>留空跟随完整歌词字体</small></span><input :value="music.settings.desktopLyricFont || ''" placeholder="跟随歌词字体" @change="text('desktopLyricFont', $event)" /></label>
  <label class="setting-row"><span>独立字号</span><input type="number" min="12" max="96" :value="music.settings.desktopLyricFontSize || 32" @change="numeric('desktopLyricFontSize', $event)" /></label>
  <label class="setting-row"><span>排列方向</span><select :value="music.settings.desktopLyricDirection || 'horizontal'" @change="text('desktopLyricDirection', $event)"><option value="horizontal">横向</option><option value="vertical">纵向</option></select></label>
  <label class="setting-row"><span>水平对齐 <small>仅横向排列时生效</small></span><select :value="music.settings.desktopLyricAlign || 'center'" :disabled="music.settings.desktopLyricDirection === 'vertical'" @change="text('desktopLyricAlign', $event)"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
  <label class="setting-row"><span>已唱歌词颜色</span><input type="color" :value="music.settings.desktopLyricPlayedColor || music.preferences.lyricActiveColor" @input="text('desktopLyricPlayedColor', $event)" /></label>
  <label class="setting-row"><span>未唱歌词颜色</span><input type="color" :value="music.settings.desktopLyricUnplayColor || music.preferences.lyricColor" @input="text('desktopLyricUnplayColor', $event)" /></label>
  <label class="setting-row"><span>不透明度</span><div class="opacity-control"><input type="range" min="0" max="1" step=".05" :value="music.settings.desktopLyricOpacity ?? 1" aria-label="桌面歌词不透明度" @input="numeric('desktopLyricOpacity', $event)" /><output>{{ Math.round(Number(music.settings.desktopLyricOpacity ?? 1) * 100) }}%</output></div></label>
  <label class="setting-row"><span>锁定歌词 <small>锁定后鼠标可穿透，解锁请回到此设置</small></span><input class="switch" type="checkbox" :disabled="!bridge" :checked="!!music.settings.desktopLyricLock" @change="music.task(() => invoke('desktop.lock', { enabled: ($event.target as HTMLInputElement).checked }))" /></label>
  <label class="setting-row"><span>始终置顶</span><input class="switch" type="checkbox" :disabled="!bridge" :checked="music.settings.desktopLyricTop !== false" @change="music.task(() => invoke('desktop.top', { enabled: ($event.target as HTMLInputElement).checked }))" /></label>
  <label v-for="rule in rules" :key="rule.key" class="setting-row"><span><strong>{{ rule.name }}</strong><small>{{ rule.detail }}</small></span><input class="switch" type="checkbox" :checked="!!music.settings[rule.key]" @change="music.updateSettings({ [rule.key]: ($event.target as HTMLInputElement).checked })" /></label>
</template>

<style scoped>.desktop-settings-title{margin-top:30px;padding-top:25px;border-top:1px solid var(--border);font-size:14px}.opacity-control{display:flex;gap:15px;align-items:center}.opacity-control input{width:130px}.opacity-control output{width:40px;color:var(--accent);font-size:11px;text-align:right}</style>
