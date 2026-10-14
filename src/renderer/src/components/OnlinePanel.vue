<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Track, SourceId, SearchResult, OnlinePlaylist, Playlist } from '../../../shared/types'
import { sourceNames } from '../../../shared/defaults'
import { useMusic, invoke, bridge } from '../store'
import { parsePlaylistAddress, type OnlineTarget } from '../domain/online'
import {readSearchSession,saveSearchSession} from '../domain/search-session'
import Icon from './Icon.vue'
import TrackList from './TrackList.vue'

interface Tag { id: string; name: string; group?: string }
interface PlaylistSearch { list: OnlinePlaylist[]; total: number; page: number; limit: number; source: string; failures?: unknown }
interface MetadataResult { info: { id: string; name: string; cover: string; description?: string; author?: string }; list: Track[]; total: number; page: number; limit: number; source: string }
interface PlaylistDetail { info: OnlinePlaylist; tracks: Track[] }
const props = defineProps<{ view: 'discovery' | 'search' | 'metadata'; source: SourceId | 'all'; keyword?: string; target?: OnlineTarget; importAddress?: string }>()
const emit = defineEmits<{ action: [action: string, tracks: Track[]]; source: [source: SourceId | 'all']; back: [] }>()
const music = useMusic()
const selectedSource = ref<SourceId | 'all'>(props.source)
const tab = ref('songs')
const discoveryTab = ref('playlists')
const sort = ref('hot'), tag = ref('')
const tags = ref<Tag[]>([]), playlists = ref<OnlinePlaylist[]>([])
const boards = ref<{ id: string; name: string }[]>([]), board = ref('')
const tracks = ref<Track[]>([]), total = ref(0), page = ref(1), limit = 30
const discoveryPlaylistLimit = 25
const busy = ref(false), error = ref(''), failures = ref('')
const detail = ref<PlaylistDetail>()
const metadata = ref<MetadataResult>()
const filter = ref(''), address = ref(''), importing = ref(false), creating = ref(false)
let request = 0
const sources = Object.keys(sourceNames).filter(source => source !== 'local') as SourceId[]
const visibleTracks = computed(() => {
  const pool = detail.value?.tracks || tracks.value
  const query = filter.value.trim().toLowerCase()
  return query ? pool.filter(track => `${track.name} ${track.singer} ${track.meta.albumName}`.toLowerCase().includes(query)) : pool
})
const groups = computed(() => [...new Set(tags.value.map(item => item.group || '分类'))])
const hasNext = computed(() => props.view === 'discovery' ? (discoveryTab.value === 'playlists' ? playlists.value.length >= discoveryPlaylistLimit : tracks.value.length >= limit) : page.value * limit < total.value)
const label = computed(() => selectedSource.value === 'all' ? '全部平台' : sourceNames[selectedSource.value])
const playlistView = computed(() => props.view === 'discovery' && discoveryTab.value === 'playlists' || props.view === 'search' && tab.value === 'playlists')

function failureText(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : typeof item === 'object' && item ? String((item as Record<string, unknown>).message || (item as Record<string, unknown>).error || '') : '').filter(Boolean).join(' · ')
  if (typeof value === 'object') return Object.entries(value).map(([source, reason]) => `${source}: ${String(reason)}`).join(' · ')
  return String(value)
}
async function load(): Promise<void> {
  if (!bridge) return
  const token = ++request
  busy.value = true; error.value = ''; failures.value = ''; filter.value = ''
  try {
    if (props.view === 'search') {
      if (!props.keyword?.trim()) return
      const cacheKey=JSON.stringify([selectedSource.value,props.keyword,tab.value,page.value])
      const cached=readSearchSession<PlaylistSearch|SearchResult>(cacheKey)
      if(cached){if(tab.value==='playlists')playlists.value=(cached as PlaylistSearch).list;else tracks.value=(cached as SearchResult).list;total.value=cached.total;return}
      if (tab.value === 'playlists') {
        const result = await invoke<PlaylistSearch>('search.playlists', { source: selectedSource.value, keyword: props.keyword, page: page.value, limit })
        if (token !== request) return
        saveSearchSession(cacheKey,result)
        playlists.value = result.list; total.value = result.total; failures.value = failureText(result.failures)
      } else {
        const result = await invoke<SearchResult & { failures?: unknown }>('search', { source: selectedSource.value, keyword: props.keyword, page: page.value, limit })
        if (token !== request) return
        saveSearchSession(cacheKey,result)
        tracks.value = result.list; total.value = result.total; failures.value = failureText(result.failures)
      }
    } else if (props.view === 'metadata' && props.target) {
      const result = await invoke<MetadataResult>(`discovery.${props.target.kind}`, { source: props.target.source, id: props.target.id, page: page.value, limit })
      if (token !== request) return
      metadata.value = result; tracks.value = result.list; total.value = result.total
    } else if (discoveryTab.value === 'playlists') {
      const result = await invoke<OnlinePlaylist[]>('discovery.playlists', { source: selectedSource.value, page: page.value, tag: tag.value || undefined, sort: sort.value, limit: discoveryPlaylistLimit })
      if (token !== request) return
      playlists.value = result.slice(0, discoveryPlaylistLimit)
    } else if (board.value) {
      const result = await invoke<SearchResult>('discovery.board', { source: selectedSource.value, id: board.value, page: page.value })
      if (token !== request) return
      tracks.value = result.list; total.value = result.total
    }
  } catch (failure) {
    if (token !== request) return
    error.value = failure instanceof Error ? failure.message : String(failure)
    tracks.value = []; playlists.value = []
  } finally { if (token === request) busy.value = false }
}
async function loadDiscoveryOptions(): Promise<void> {
  if (!bridge || props.view !== 'discovery') return
  const current = selectedSource.value
  if (current === 'all' || current === 'local') { selectedSource.value = 'wy'; emit('source', 'wy'); return }
  try {
    const [newTags, newBoards] = await Promise.all([
      invoke<Tag[]>('discovery.tags', { source: current }).catch(() => []),
      invoke<{ id: string; name: string }[]>('discovery.boards', { source: current }).catch(() => []),
    ])
    if (current !== selectedSource.value) return
    tags.value = newTags; boards.value = newBoards; board.value = newBoards[0]?.id || ''
  } finally { await load() }
}
function changeTab(value: string): void { tab.value = value; page.value = 1; detail.value = undefined; void load() }
function changeSource(): void {
  page.value = 1; tag.value = ''; detail.value = undefined; emit('source', selectedSource.value)
  if (props.view === 'discovery') void loadDiscoveryOptions()
  else void load()
}
function paginate(delta: number): void { page.value = Math.max(1, page.value + delta); void load() }
async function openPlaylist(item: OnlinePlaylist): Promise<void> {
  busy.value = true; error.value = ''; filter.value = ''
  const token = ++request
  try {
    const result = await invoke<PlaylistDetail>('discovery.playlist', { source: item.source, id: item.id })
    if (token === request) detail.value = result
  } catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  finally { if (token === request) busy.value = false }
}
async function importAddress(): Promise<void> {
  importing.value = true; error.value = ''
  try {
    const result = parsePlaylistAddress(address.value, selectedSource.value === 'all' || selectedSource.value === 'local' ? 'wy' : selectedSource.value)
    await openPlaylist({ ...result, name: '', cover: '' })
  } catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  finally { importing.value = false }
}
async function collectLinked(): Promise<void> {
  if (!detail.value || creating.value) return
  creating.value = true
  await music.task(async () => {
    const { info, tracks } = detail.value!
    let list = music.library.playlists.find(item => item.source === info.source && item.sourceListId === info.id)
    if (!list) list = await invoke<Playlist>('playlists.create', { name: info.name, source: info.source, sourceListId: info.id })
    await invoke('playlists.add', { playlistId: list.id, tracks })
    music.notify('在线歌单已收藏，可在我的歌单中手动更新')
  })
  creating.value = false
}
watch(() => props.source, value => { if (value !== selectedSource.value) { selectedSource.value = value; changeSource() } })
watch(() => [props.view, props.keyword, props.target?.id], () => {
  detail.value = undefined; metadata.value = undefined; page.value = 1; tracks.value = []; playlists.value = []
  if (props.view === 'discovery') void loadDiscoveryOptions()
  else void load()
})
watch(()=>props.importAddress,value=>{if(value){address.value=value;void importAddress()}},{immediate:true})
onUnmounted(()=>request++)
onMounted(() => props.importAddress ? undefined : props.view === 'discovery' ? void loadDiscoveryOptions() : void load())
</script>

<template>
  <div v-if="detail" class="online-detail">
    <button class="text-button online-back" @click="detail = undefined; error = ''"><Icon name="ChevronLeft" :size="16" />返回列表</button>
    <div class="playlist-heading"><div class="playlist-heading-art"><img v-if="detail.info.cover" :src="detail.info.cover" alt="" /><Icon v-else name="Disc3" :size="45" /></div><div><p class="eyebrow">ONLINE COLLECTION</p><h1 data-i18n-ignore>{{ detail.info.name }}</h1><p class="online-description" data-i18n-ignore>{{ detail.info.description || detail.info.author || sourceNames[detail.info.source] }}</p><div class="button-row"><button class="primary-button" :disabled="!visibleTracks.length" @click="music.play(visibleTracks[0], visibleTracks)"><Icon name="Play" :size="16" />播放全部</button><button :disabled="creating" @click="collectLinked"><Icon name="Heart" :size="16" />{{ creating ? '正在收藏…' : '收藏关联歌单' }}</button><button :disabled="!visibleTracks.length" @click="emit('action', 'collect', visibleTracks)">复制到歌单</button></div></div></div>
  </div>
  <div v-else-if="view === 'metadata'" class="playlist-heading"><div class="playlist-heading-art"><img v-if="metadata?.info.cover" :src="metadata.info.cover" alt="" /><Icon v-else :name="target?.kind === 'album' ? 'Disc3' : 'Mic2'" :size="45" /></div><div><p class="eyebrow">{{ target?.kind === 'album' ? 'ALBUM' : 'ARTIST' }}</p><h1 data-i18n-ignore>{{ metadata?.info.name || target?.name || '正在读取资料' }}</h1><p data-i18n-ignore>{{ metadata?.info.description || metadata?.info.author }}</p><div class="button-row"><button class="primary-button" :disabled="!visibleTracks.length" @click="music.play(visibleTracks[0], visibleTracks)">播放全部</button><button :disabled="!visibleTracks.length" @click="emit('action', 'collect', visibleTracks)">添加到歌单</button><button @click="emit('back')">返回</button></div></div></div>
  <div v-else class="page-heading"><div><p class="eyebrow">{{ view === 'search' ? 'SEARCH RESULTS' : 'FIND YOUR NEXT FAVORITE' }}</p><h1 v-if="view === 'search'" data-i18n-ignore>「{{ keyword }}」</h1><h1 v-else>发现音乐</h1><p>{{ view === 'search' ? `${total} 个结果 · ${label}` : '从不同的音乐世界，遇见值得循环的声音。' }}</p></div><select v-model="selectedSource" aria-label="音乐平台" @change="changeSource"><template v-if="view === 'search'"><option value="all">全部平台</option><option v-if="tab === 'songs'" value="local">本地音乐</option></template><option v-for="source in sources" :key="source" :value="source">{{ sourceNames[source] }}</option></select></div>
  <div v-if="!detail && view === 'search'" class="tabs"><button :class="{ active: tab === 'songs' }" @click="changeTab('songs')">歌曲</button><button :class="{ active: tab === 'playlists' }" @click="selectedSource === 'local' && (selectedSource = 'all'); changeTab('playlists')">歌单</button></div>
  <template v-if="!detail && view === 'discovery'">
    <div class="tabs"><button :class="{ active: discoveryTab === 'playlists' }" @click="discoveryTab = 'playlists'; page = 1; load()">精选歌单</button><button :class="{ active: discoveryTab === 'boards' }" @click="discoveryTab = 'boards'; page = 1; load()">排行榜</button></div>
    <div v-if="discoveryTab === 'playlists'" class="discovery-filters"><div class="section-title"><strong>歌单分类</strong><select v-model="sort" aria-label="歌单排序" @change="page = 1; load()"><option value="hot">热门</option><option value="new">最新</option></select></div><div class="tag-groups"><div class="tag-group"><span>全部</span><div class="chips"><button :class="{ active: !tag }" @click="tag = ''; page = 1; load()">全部歌单</button></div></div><div v-for="group in groups" :key="group" class="tag-group"><span>{{ group }}</span><div class="chips"><button v-for="item in tags.filter(value => (value.group || '分类') === group)" :key="item.id" :class="{ active: tag === item.id }" @click="tag = item.id; page = 1; load()">{{ item.name }}</button></div></div></div></div>
    <div v-else class="chips"><button v-for="item in boards" :key="item.id" :class="{ active: board === item.id }" @click="board = item.id; page = 1; load()">{{ item.name }}</button></div>
    <form class="online-import" @submit.prevent="importAddress"><label for="playlist-address">打开在线歌单</label><div class="button-row"><input id="playlist-address" v-model="address" placeholder="粘贴歌单链接或输入歌单 ID" maxlength="2048" required /><button type="submit" :disabled="!bridge || importing || !address.trim()">{{ importing ? '正在读取…' : '打开歌单' }}</button></div></form>
  </template>
  <div v-if="error" class="error-banner" role="alert"><Icon name="CircleAlert" :size="18" /><span>{{ error }}</span><button @click="detail ? openPlaylist(detail.info) : load()">重试</button></div>
  <p v-if="failures" class="provider-failures" role="status">部分平台暂不可用：{{ failures }}</p>
  <div v-if="busy" class="empty-state"><span class="spinner" /><p>正在连接音乐平台…</p></div>
  <template v-else-if="!detail && playlistView">
    <div v-if="playlists.length" class="discovery-grid"><button v-for="item in playlists" :key="`${item.source}:${item.id}`" class="playlist-card" @click="openPlaylist(item)"><div class="playlist-art"><img v-if="item.cover" :src="item.cover" alt="" loading="lazy" /><Icon v-else name="Disc3" :size="40" /><span class="card-play"><Icon name="Play" :size="22" /></span></div><strong data-i18n-ignore>{{ item.name }}</strong><small data-i18n-ignore>{{ item.author || sourceNames[item.source] }}{{ item.playCount != null ? ` · ${item.playCount.toLocaleString()} 次播放` : '' }}</small></button></div>
    <div v-else class="empty-state"><div class="empty-icon"><Icon name="Compass" :size="34" /></div><h3>等待一个新的音乐世界</h3><p>{{ bridge ? '当前平台尚无可用内容。切换平台、分类或检查网络后重试。' : '桌面客户端会从你选择的平台获取真实歌单。' }}</p><button :disabled="!bridge" @click="load">重新加载</button></div>
  </template>
  <template v-else>
    <div class="list-toolbar"><strong>歌曲列表 <span class="muted">{{ visibleTracks.length }}</span></strong><label class="filter-input"><Icon name="Search" :size="14" /><input v-model="filter" placeholder="筛选当前列表" aria-label="筛选当前列表" /></label></div>
    <TrackList :tracks="visibleTracks" @action="(action, items) => emit('action', action, items)" />
  </template>
  <div v-if="!detail && (tracks.length || playlists.length)" class="pagination"><button :disabled="page <= 1 || busy" @click="paginate(-1)"><Icon name="ChevronLeft" :size="16" />上一页</button><span>{{ page }}</span><button :disabled="!hasNext || busy" @click="paginate(1)">下一页<Icon name="ChevronRight" :size="16" /></button></div>
</template>

<style scoped>
.tabs { margin-block-end: 16px; padding-block-end: 8px; }
.online-back { margin-bottom: 20px; }.online-description { max-height: 70px; overflow: auto; }.discovery-filters { border: 1px solid var(--border); border-radius: 12px; padding: 18px; background: var(--surface); margin-bottom: 20px; }.discovery-filters>.section-title { margin-bottom: 15px; font-size: 12px; }.discovery-filters select { font-size: 10px; padding: 6px 10px; }.tag-groups { max-height: 170px; overflow: auto; }.tag-group { display: flex; gap: 15px; padding: 8px 0; }.tag-group>span { color: var(--muted); font-size: 10px; width: 45px; flex-shrink: 0; padding-top: 7px; }.tag-group .chips { margin: 0; }.online-import { border: 1px solid var(--border); border-radius: 10px; padding: 17px 20px; margin: 20px 0 25px; background: var(--surface); }.online-import>label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 12px; }.online-import input { flex: 1; min-width: 120px; font-size: 11px; }.provider-failures { font-size: 11px; color: var(--muted); line-height: 1.8; margin: 15px 0; }@media(max-width:640px){.discovery-filters{padding:15px}.tag-group{gap:10px}.tag-group>span{width:35px}.online-import{padding:15px}.page-heading select{max-width:110px}}
</style>
