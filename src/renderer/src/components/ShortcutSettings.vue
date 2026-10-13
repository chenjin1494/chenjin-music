<script setup lang="ts">
import { ref } from 'vue'
import { useMusic } from '../store'
import { rendererDefaults } from '../domain/preferences'
import { shortcutFromEvent, shortcutLabel } from '../domain/shortcuts'

const music = useMusic()
const error = ref('')
const extraActions={seekBack:'后退五秒',seekForward:'前进五秒',collect:'收藏当前歌曲',uncollect:'取消收藏当前歌曲',dislike:'不喜欢当前歌曲',desktopLyric:'切换桌面歌词',desktopLock:'切换桌面歌词锁定',desktopTop:'切换桌面歌词置顶',windowMinimize:'最小化窗口',windowToggleMin:'最小化或恢复窗口',windowToggleHide:'隐藏或显示窗口',windowClose:'关闭窗口'}
const actions = { ...extraActions,toggle: '播放 / 暂停', next: '下一首', previous: '上一首', search: '搜索音乐', volumeUp: '提高音量', volumeDown: '降低音量', mute: '静音', lyrics: '完整歌词', queue: '播放队列' }

const globalActions = { ...extraActions,search:'搜索音乐',toggle: '播放 / 暂停', next: '下一首', prev: '上一首', mute: '静音', volumeUp: '提高音量', volumeDown: '降低音量' }
const globalDefaults: Record<string, string> = { toggle: 'MediaPlayPause', next: 'MediaNextTrack', prev: 'MediaPreviousTrack' }
function globalShortcut(action: string): string { return (music.settings.globalHotkeys as Record<string, string> | undefined)?.[action] ?? globalDefaults[action] ?? '' }
function updateGlobal(action: string, event: Event): void {
  void music.updateSettings({ globalHotkeys: { ...globalDefaults, ...(music.settings.globalHotkeys as object || {}), [action]: (event.target as HTMLInputElement).value.trim() } })
}
function capture(action: string, event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const shortcut = event.key === 'Backspace' || event.key === 'Delete' ? '' : shortcutFromEvent(event)
  if (!shortcut && event.key !== 'Backspace' && event.key !== 'Delete') return
  const conflict = Object.entries(music.preferences.shortcuts).find(([key, value]) => key !== action && value === shortcut && shortcut)
  if (conflict) { error.value = `这个组合已用于「${actions[conflict[0] as keyof typeof actions]}」`; return }
  error.value = ''
  void music.updateSettings({ shortcuts: { ...music.preferences.shortcuts, [action]: shortcut } })
}
</script>

<template>
  <p class="settings-help">点击输入框后按下新的组合键。Delete 清除。快捷键在应用窗口内生效，编辑文本时暂停匹配。</p>
  <p v-if="error" class="danger settings-help" role="alert">{{ error }}</p>
  <label v-for="(name, action) in actions" :key="action" class="setting-row"><span>{{ name }}</span><input class="shortcut-input" readonly :value="shortcutLabel(music.preferences.shortcuts[action] || '')" placeholder="未设置" :aria-label="`${name}快捷键`" @keydown="capture(action, $event)" /></label>
  <button class="settings-reset" @click="music.updateSettings({ shortcuts: { ...rendererDefaults.shortcuts } }); error = ''">恢复默认快捷键</button>
  <h3 class="global-heading">全局快捷键</h3>
  <p class="settings-help">由桌面服务注册，应用在后台时也可使用。输入 Electron 组合键，例如 CommandOrControl+Alt+Space；媒体键可以使用 MediaPlayPause。留空停用该动作。</p>
  <label v-for="(name, action) in globalActions" :key="action" class="setting-row"><span>{{ name }}</span><input :value="globalShortcut(action)" placeholder="未设置" :aria-label="`${name}全局快捷键`" @change="updateGlobal(action, $event)" /></label>
</template>

<style scoped>.settings-help { color: var(--muted); font-size: 11px; line-height: 1.9; margin: 18px 0; }.shortcut-input { text-align: center; cursor: pointer; max-width: 190px; }.settings-reset { margin-top: 20px; }.global-heading { margin-top: 35px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 14px; }</style>
