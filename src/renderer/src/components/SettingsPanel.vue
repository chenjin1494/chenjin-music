<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings } from '../../../shared/types'
import { useMusic, invoke, bridge } from '../store'
import {t} from '../i18n'
import Icon from './Icon.vue'
import ThemeSettings from './ThemeSettings.vue'
import AudioSettings from './AudioSettings.vue'
import LyricSettings from './LyricSettings.vue'
import ShortcutSettings from './ShortcutSettings.vue'
import SyncPanel from './SyncPanel.vue'
import UpdatePanel from './UpdatePanel.vue'
import BackupPanel from './BackupPanel.vue'
import DislikePanel from './DislikePanel.vue'

const music = useMusic()
const group = ref('appearance')
const info = ref<Record<string, unknown>>({})
const cacheStats=ref<{online:number;lyrics:number;edited:number}>(),clearEditedConfirm=ref(false)
async function readCache():Promise<void>{if(bridge)await music.task(async()=>cacheStats.value=await invoke('cache.stats'))}
async function clearEdited():Promise<void>{await music.task(async()=>{await invoke('cache.clear',{scope:'edited',confirm:true});await readCache()});clearEditedConfirm.value=false}
const groups = [
  { id: 'appearance', icon: 'Palette', name: '外观与体验' },
  { id: 'playback', icon: 'Headphones', name: '播放与音效' },
  { id: 'lyrics', icon: 'Captions', name: '歌词' },
  { id: 'shortcuts', icon: 'Keyboard', name: '快捷键' },
  { id: 'downloads', icon: 'Download', name: '下载' },
  { id: 'desktop', icon: 'Monitor', name: '桌面与网络' },
  { id: 'sync', icon: 'RefreshCw', name: '设备同步' },
  { id: 'backup', icon: 'FolderOpen', name: '备份与迁移' },
  { id: 'dislikes', icon: 'ListFilter', name: '不喜欢的音乐' },
  { id: 'about', icon: 'Info', name: '关于与更新' },
]
const toggles: Record<string, [keyof Settings, string, string][]> = {
  appearance: [['animation', '界面动效', '遵循系统减少动态效果偏好']],
  playback: [
    ['preservesPitch', '保持音调', '调整速度时尽量保持原有音高'],
    ['startupAutoPlay', '启动后继续播放', '恢复上一次的播放队列'],
    ['savePlayTime', '记住播放进度', '下次继续未听完的内容'],
    ['autoCleanPlayed','自动清理已播放记录','随机播放一轮后重新开始，关闭时播完即停止'],
    ['pauseOnDeviceRemoved','输出设备移除时暂停','避免设备断开后从其他扬声器继续播放'],
    ['autoSkip', '自动跳过不可用歌曲', '播放失败时继续队列'],
    ['autoSwitchSource', '自动切换播放来源', '当前来源不可用时寻找匹配歌曲'],
    ['playDownloaded', '优先播放已下载歌曲', '下载完成且文件存在时直接播放本地文件'],
    ['clickPlayList', '点击歌曲播放整个列表', '关闭时只播放选中的单首歌曲'],
    ['autoUpdateLists', '自动更新关联歌单', '由桌面客户端更新收藏的在线歌单'],
    ['visualization', '频谱可视化', '在播放器中显示实时音频频谱'],
  ],
  lyrics: [['lyricTranslation', '显示翻译', '歌曲有翻译时展示'], ['lyricRoma', '显示罗马音', '歌曲有罗马音时展示'], ['swapLyric', '交换翻译与罗马音位置', '将罗马音显示在翻译之前']],
  downloads: [
    ['downloadEnabled', '启用下载', '由音源提供可用下载地址'],
    ['downloadLyrics', '下载歌词', '保存歌曲对应的歌词文件'],
    ['downloadTranslation', '下载翻译歌词', '保存平台提供的歌词翻译'],
    ['downloadRoman', '下载罗马音歌词', '保存平台提供的罗马音'],
    ['downloadWordLyrics', '下载逐字歌词', '保留平台提供的逐字时间标记'],
    ['downloadGroupByList', '按歌单建立下载目录', '每张歌单使用独立的子目录'],
    ['downloadOtherSource', '下载时尝试其他来源', '当前下载来源失败时查找匹配歌曲'],
    ['embedCover', '嵌入封面', '将专辑图片写入支持的文件'],
    ['embedLyrics', '嵌入歌词', '将歌词写入支持的文件'],
    ['embedTranslation','嵌入翻译歌词','将翻译追加到音频歌词标签'],
    ['embedRoman','嵌入罗马音歌词','将罗马音追加到音频歌词标签'],
    ['embedWordLyrics','嵌入逐字歌词','将逐字时间标记写入音频歌词标签'],
    ['skipExisting', '跳过已有文件', '避免重复下载'],
  ],
  desktop: [
    ['associateLegacyScheme', '关联旧 LX 链接', '启用后由琛瑾音乐打开 LX 分享链接'],
    ['tray', '系统托盘', '从托盘快速控制播放'],
    ['closeToTray', '关闭窗口时最小化', '音乐继续在后台播放'],
    ['preventSleep', '播放时防止休眠', '保持持续聆听'],
    ['searchHistory', '记录搜索历史', '保存最近搜索关键词'],
    ['hotSearch', '显示热门搜索', '从所选平台获取真实热搜'],
    ['openAPI', '启用 Open API', '允许外部程序控制播放'],
    ['openAPILan', '允许局域网 API', '与同网络设备连接'],
  ],
}
function value(key: keyof Settings, event: Event, kind = 'string'): void {
  const target = event.target as HTMLInputElement
  void music.updateSettings({ [key]: kind === 'boolean' ? target.checked : kind === 'number' ? Number(target.value) : target.value })
}
onMounted(async () => { if (bridge) await music.task(async () => info.value = await invoke('app.info')) })
</script>

<template>
  <div class="page-heading"><div><p class="eyebrow">MAKE IT YOURS</p><h1>设置</h1><p>让每一次聆听，都更合心意。</p></div></div>
  <div class="settings-layout">
    <nav class="settings-nav" aria-label="设置分类"><button v-for="item in groups" :key="item.id" :class="{ active: group === item.id }" @click="group = item.id"><Icon :name="item.icon" :size="18" />{{ item.name }}</button></nav>
    <div class="settings-content"><section class="settings-card" :data-settings-group="group">
      <h2>{{ groups.find(item => item.id === group)?.name }}</h2>
      <ThemeSettings v-if="group === 'appearance'" />
      <AudioSettings v-else-if="group === 'playback'" />
      <LyricSettings v-else-if="group === 'lyrics'" />
      <ShortcutSettings v-else-if="group === 'shortcuts'" />
      <SyncPanel v-else-if="group === 'sync'" />
      <BackupPanel v-else-if="group === 'backup'" />
      <DislikePanel v-else-if="group === 'dislikes'" />
      <template v-else-if="group === 'downloads'">
        <label class="setting-row"><span>下载目录</span><div class="button-row"><input :value="music.settings.downloadPath" placeholder="系统音乐目录" @change="value('downloadPath', $event)" /><button :disabled="!bridge" @click="music.task(async () => { const path = await invoke<string | null>('app.selectDirectory', { path: music.settings.downloadPath }); if(path) await music.updateSettings({ downloadPath: path }) })"><Icon name="FolderOpen" :size="14" />选择</button></div></label>
        <label class="setting-row"><span>同时下载数量</span><input type="number" min="1" max="10" :value="music.settings.downloadConcurrency" @change="value('downloadConcurrency', $event, 'number')" /></label>
        <label class="setting-row"><span>文件名模板 <small>{name} 歌名 · {singer} 艺人</small></span><input :value="music.settings.downloadFileName" @change="value('downloadFileName', $event)" /></label>
      </template>
      <template v-else-if="group === 'desktop'">
        <label class="setting-row"><span>托盘图标主题</span><select :value="music.settings.trayTheme||'auto'" @change="value('trayTheme',$event)"><option value="auto">跟随系统</option><option value="brand">品牌彩色</option><option value="black">黑色</option><option value="white">白色</option></select></label>
        <label v-for="choice in [{key:'clearSearchInput',name:'离开搜索时清空输入'},{key:'clearSearchResults',name:'离开搜索时清空结果'}]" :key="choice.key" class="setting-row"><span>{{choice.name}}<small>打开搜索歌单详情时保留搜索状态</small></span><input type="checkbox" class="switch" :checked="!!music.settings[choice.key]" @change="music.updateSettings({[choice.key]:($event.target as HTMLInputElement).checked})"/></label>
        <label class="setting-row"><span>网络代理</span><input :value="music.settings.proxy" placeholder="http://127.0.0.1:7890" @change="value('proxy', $event)" /></label>
        <label class="setting-row"><span>API 端口</span><input type="number" min="1" max="65535" :value="music.settings.openAPIPort" @change="value('openAPIPort', $event, 'number')" /></label>
      </template>
      <template v-else-if="group === 'about'">
        <div class="about-brand"><div class="brand-mark"><Icon name="AudioLines" :size="38" /></div><h2>琛瑾音乐</h2><p>为每一次聆听而设计</p><small>{{ info.version ? `版本 ${info.version}` : '浏览器界面预览' }}</small></div>
        <label class="setting-row"><span>更新服务地址</span><input :value="music.settings.updateURL" placeholder="配置你的更新服务" @change="value('updateURL', $event)" /></label>
        <div class="button-row"><button :disabled="!bridge" @click="music.task(() => invoke('app.openPath', { path: music.settings.downloadPath }))">打开下载目录</button></div>
        <UpdatePanel />
      </template>
      <label v-if="group==='playback'" class="setting-row"><span>新歌曲加入位置</span><select :value="music.settings.addMusicLocation||'top'" @change="value('addMusicLocation',$event)"><option value="top">列表顶部</option><option value="bottom">列表底部</option></select></label>
      <label v-if="group==='downloads'" class="setting-row"><span>歌词文件编码</span><select :value="music.settings.lyricEncoding||'utf8'" @change="value('lyricEncoding',$event)"><option value="utf8">UTF-8</option><option value="gbk">GBK</option></select></label>
      <div v-if="group==='desktop'" class="setting-row"><span>播放缓存 <small>清除平台歌词与播放缓存，保留手动编辑的歌词</small></span><button :disabled="!bridge" @click="music.task(async()=>{await invoke('cache.clear');music.notify('播放缓存已清除')})">清除缓存</button></div>
      <template v-if="group==='desktop'"><div class="setting-row"><span>缓存统计 <small v-if="cacheStats">{{music.settings.language==='en-US'?`${cacheStats.online} online items · ${cacheStats.lyrics} lyrics · ${cacheStats.edited} edited tracks`:t('在线资料',music.settings.language)+` ${cacheStats.online} · `+t('歌词',music.settings.language)+` ${cacheStats.lyrics} · `+t('编辑版本',music.settings.language)+` ${cacheStats.edited}`}}</small></span><button :disabled="!bridge" @click="readCache">读取缓存统计</button></div><div class="setting-row"><span>手动编辑的歌词</span><button :disabled="!bridge" @click="clearEditedConfirm=true">清理编辑版本</button></div><div v-if="clearEditedConfirm" class="setting-row"><span>确认删除所有手动编辑的歌词？此操作无法撤销。</span><div class="button-row"><button class="danger-button" @click="clearEdited">确认清理编辑版本</button><button @click="clearEditedConfirm=false">取消</button></div></div></template>
      <label v-for="toggle in toggles[group] || []" :key="toggle[0]" class="setting-row"><span><strong>{{ toggle[1] }}</strong><small>{{ toggle[2] }}</small></span><input class="switch" type="checkbox" :disabled="['embedTranslation','embedRoman','embedWordLyrics'].includes(String(toggle[0]))&&!music.settings.embedLyrics" :checked="!!music.settings[toggle[0]]" @change="value(toggle[0], $event, 'boolean')" /></label>
    </section></div>
  </div>
</template>
