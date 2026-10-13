import { defineStore } from 'pinia'
import { computed, markRaw, ref, watch } from 'vue'
import { emptyLibrary } from '../../shared/defaults'
import type { LibraryState, Track, Settings, Lyrics, PlayerStatus } from '../../shared/types'
import { audioService, chooseNext, randomUnplayedIndex, trackKey, appendPriority, moveItem, type AudioCapabilities } from './domain/player'
import { isDisliked, dislikeRule } from '../../shared/dislike'
import { mergeLyrics, lyricIndex } from './domain/lyrics'
import { createSystemMediaSession } from './domain/system-media-session'
import { rendererPreferences } from './domain/preferences'

export const bridge = typeof window !== 'undefined' ? window.chenjin : undefined
export async function invoke<T>(method: string, params?: unknown): Promise<T> {
  if (!bridge) throw new Error('此功能需要在琛瑾音乐桌面客户端中使用')
  // Electron's structured clone cannot transfer Vue Proxy objects.
  // Every documented renderer RPC uses JSON data, so detach proxies once here.
  const payload = params === undefined ? undefined : JSON.parse(JSON.stringify(params))
  return bridge.invoke<T>(method, payload)
}

export interface PlayerSnapshot {
  queue: Track[]
  currentId?: string
  progress: number
  priorityQueue?: Track[]
  priorityCurrent?: Track
  resumeIndex?: number
}

function detachTrackReactivity(state:LibraryState):LibraryState{
 for(const list of state.playlists)for(const track of list.tracks)markRaw(track)
 for(const download of state.downloads)markRaw(download.track)
 const player=(state as LibraryState&{player?:PlayerSnapshot}).player
 for(const track of player?.queue||[])markRaw(track)
 for(const track of player?.priorityQueue||[])markRaw(track)
 if(player?.priorityCurrent)markRaw(player.priorityCurrent)
 return state
}

export const useMusic = defineStore('music', () => {
  const library = ref<LibraryState>(emptyLibrary())
  const hydrated = ref(false), loading = ref(false), error = ref(''), notice = ref('')
  const queue = ref<Track[]>([]), priorityQueue = ref<Track[]>([]), priorityCurrent = ref<Track>()
  const currentIndex = ref(-1), progress = ref(0), duration = ref(0)
  const playing = ref(false), resolving = ref(false), lyric = ref<Lyrics>({ lyric: '' })
  const history = ref<Track[]>([]), sleepAt = ref(0), sleepAfterTrack = ref(false), sleepWaitForEnd = ref(false)
  const playbackState = ref<PlayerStatus['status']>('stoped')
  const settings = computed(() => library.value.settings)
  const preferences = computed(() => rendererPreferences(settings.value))
  const current = computed(() => priorityCurrent.value || queue.value[currentIndex.value])
  const lines = computed(() => mergeLyrics(lyric.value.lyric, lyric.value.tlyric, lyric.value.rlyric, lyric.value.lxlyric || (lyric.value as Lyrics & { yrc?: string }).yrc))
  const activeLine = computed(() => lyricIndex(lines.value, progress.value + settings.value.lyricOffset / 1000))
  const service = markRaw(audioService())
  const audioCapabilities = ref<AudioCapabilities>({ ...service.capabilities })
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let statusTimer: ReturnType<typeof setTimeout> | undefined
  let ticket = 0, failures = 0, applying = false

  service.events.addEventListener('capabilities', event => {
    audioCapabilities.value = { ...(event as CustomEvent<AudioCapabilities>).detail }
  })
  service.events.addEventListener('device-removed', () => {
    void updateSettings({ outputDevice: 'default' })
    if(settings.value.pauseOnDeviceRemoved??settings.value.deviceRemovedStop){service.audio.pause();notify('输出设备已移除，播放已暂停')}
    else notify('输出设备已移除，已切换到系统默认设备')
  })

  function notify(text: string): void {
    notice.value = text
    setTimeout(() => { if (notice.value === text) notice.value = '' }, 4000)
  }

  async function task<T>(action: () => Promise<T>): Promise<T | undefined> {
    try { error.value = ''; return await action() }
    catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  }

  function status(): PlayerStatus {
    const track = current.value
    const line = lines.value[activeLine.value]
    let spectrum:number[]|undefined
    if(settings.value.desktopLyricVisualization&&service.analyser){const bins=new Uint8Array(service.analyser.frequencyBinCount);service.analyser.getByteFrequencyData(bins);spectrum=Array.from({length:16},(_,index)=>{const begin=Math.floor(index*bins.length/16),end=Math.floor((index+1)*bins.length/16);let value=0;for(let bin=begin;bin<end;bin++)value+=bins[bin];return playing.value?value/Math.max(1,end-begin)/255:0})}
    return {
      spectrum,
      status: playbackState.value,
      name: track?.name || '', singer: track?.singer || '', albumName: track?.meta.albumName || '', picUrl: track?.meta.picUrl || '',
      duration: duration.value, progress: progress.value, playbackRate: settings.value.playbackRate,
      lyricLineText: line?.text || '',
      lyricLineAllText: [line?.text, settings.value.lyricTranslation ? line?.translation : '', settings.value.lyricRoma ? line?.roman : ''].filter(Boolean).join('\n'),
      lyric: lyric.value.lyric, tlyric: lyric.value.tlyric || '', rlyric: lyric.value.rlyric || '', lxlyric: lyric.value.lxlyric || '',
      collect: !!track && !!library.value.playlists.find(list => list.id === 'love')?.tracks.some(other => trackKey(other) === trackKey(track)),
      volume: settings.value.volume, mute: settings.value.muted,
    }
  }

  async function startTrack(track: Track, restore = 0): Promise<void> {
    if (isDisliked(track, library.value.dislikes)) { await next(false); return }
    const request = ++ticket
    service.audio.pause()
    playing.value = false
    resolving.value = true
    playbackState.value = 'loading'
    lyric.value = { lyric: '' }
    progress.value = 0
    let failed = false
    await task(async () => {
      try {
        const url = await invoke<string>('playback.resolve', { track, quality: settings.value.quality })
        if (request !== ticket) return
        await service.setup(settings.value)
        service.audio.src = url
        service.audio.load()
        if (restore) service.audio.addEventListener('loadedmetadata', () => {
          if (request === ticket) service.seek(restore)
        }, { once: true })
        await service.audio.play()
        failures = 0
        history.value.push(track)
        if(history.value.length>500)history.value.splice(0,history.value.length-500)
        const played=Array.isArray(settings.value.playedTrackKeys)?settings.value.playedTrackKeys as string[]:[]
        if(!priorityCurrent.value&&!played.includes(trackKey(track)))settings.value.playedTrackKeys=[...played,trackKey(track)].slice(-10000)
        void invoke<Lyrics>('lyrics', { track }).then(result => {
          if (request === ticket) lyric.value = result
        }).catch(() => {})
      } catch (failure) { failed = true; throw failure }
    })
    if (request !== ticket) return
    resolving.value = false
    if (failed) {
      playbackState.value = 'error'
      failures++
      if (settings.value.autoSkip && failures < queue.value.length + priorityQueue.value.length + 1) void next(false)
    }
  }

  async function play(track: Track, tracks?: Track[], restore = 0): Promise<void> {
    if (isDisliked(track, library.value.dislikes)) { notify('这首歌曲已设为不喜欢，请在设置中移除规则后播放'); return }
    priorityCurrent.value = undefined
    if (tracks) { queue.value = tracks.map(track=>markRaw(track)); failures = 0 }
    let index = queue.value.findIndex(other => trackKey(other) === trackKey(track))
    if (index < 0) { queue.value.push(markRaw(track)); index = queue.value.length - 1 }
    currentIndex.value = index
    await startTrack(track, restore)
  }

  async function toggle(): Promise<void> {
    if (!current.value) {
      if (priorityQueue.value.length) await next()
      else if (queue.value[0]) await play(queue.value[0])
      return
    }
    if (playing.value) service.audio.pause()
    else if (!service.audio.src || playbackState.value === 'error') await startTrack(current.value, progress.value)
    else await task(() => service.audio.play())
  }

  function stop(): void {
    ++ticket
    service.audio.pause()
    service.seek(0)
    resolving.value = false
    playbackState.value = 'stoped'
  }

  async function next(ended = false): Promise<void> {
    if (ended && sleepAfterTrack.value) {
      sleepAfterTrack.value = false; sleepAt.value = 0
      service.audio.pause(); playbackState.value = 'stoped'
      notify('定时停止已完成')
      return
    }
    const selection = chooseNext(queue.value, currentIndex.value, priorityQueue.value, settings.value.playMode, ended, !!priorityCurrent.value, library.value.dislikes)
    priorityQueue.value = selection.remaining
    priorityCurrent.value = selection.priority
    if (selection.priority) { await startTrack(selection.priority); return }
    let index = selection.index
    if(settings.value.playMode==='random'){
      const played=Array.isArray(settings.value.playedTrackKeys)?settings.value.playedTrackKeys as string[]:[]
      const result=randomUnplayedIndex(queue.value,currentIndex.value,played,library.value.dislikes,settings.value.autoCleanPlayed!==false)
      index=result.index
      if(result.reset)settings.value.playedTrackKeys=[]
    }
    if (index < 0) { service.audio.pause(); playbackState.value = 'stoped'; return }
    currentIndex.value = index
    await startTrack(queue.value[index])
  }

  async function previous(): Promise<void> {
    if (progress.value > 3) { service.seek(0); return }
    const previousTrack = history.value.length > 1 ? history.value[history.value.length - 2] : queue.value[Math.max(0, currentIndex.value - 1)]
    if (!previousTrack) return
    history.value.splice(-2)
    const index = queue.value.findIndex(track => trackKey(track) === trackKey(previousTrack))
    priorityCurrent.value = index < 0 ? previousTrack : undefined
    if (index >= 0) currentIndex.value = index
    await startTrack(previousTrack)
  }

  function later(tracks: Track[]): void {
    priorityQueue.value = appendPriority(priorityQueue.value, tracks.map(track=>markRaw(track)))
    notify(`已加入稍后播放 · ${priorityQueue.value.length} 首`)
  }
  function playNext(tracks: Track[]): void {
    priorityQueue.value = appendPriority(tracks.map(track=>markRaw(track)), priorityQueue.value)
    notify('已设为下一首播放')
  }
  async function playPriority(index: number): Promise<void> {
    const [track] = priorityQueue.value.splice(index, 1)
    if (!track) return
    priorityCurrent.value = track
    await startTrack(track)
  }
  function removeQueue(index: number): void {
    if (index === currentIndex.value && !priorityCurrent.value) { stop(); currentIndex.value = -1 }
    else if (index < currentIndex.value) currentIndex.value--
    queue.value.splice(index, 1)
  }
  function reorderQueue(from: number, to: number, priority = false): void {
    if (priority) { priorityQueue.value = moveItem(priorityQueue.value, from, to); return }
    const selected = queue.value[currentIndex.value]
    queue.value = moveItem(queue.value, from, to)
    currentIndex.value = selected ? queue.value.findIndex(track => trackKey(track) === trackKey(selected)) : -1
  }
  function clearQueue(): void {
    stop(); queue.value = []; priorityQueue.value = []; priorityCurrent.value = undefined; currentIndex.value = -1
  }
  function setSleep(minutes: number, waitForEnd = false): void {
    sleepAt.value = minutes > 0 ? Date.now() + minutes * 60000 : 0
    sleepAfterTrack.value = false
    sleepWaitForEnd.value = waitForEnd
  }
  function setSleepClock(time: string, waitForEnd = false): void {
    const [hours, minutes] = time.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1)
    sleepAt.value = date.getTime()
    sleepAfterTrack.value = false
    sleepWaitForEnd.value = waitForEnd
  }

  async function updateSettings(partial: Partial<Settings>): Promise<boolean> {
    Object.assign(settings.value, partial)
    service.apply(settings.value)
    if (!bridge)return true
    return await task(async () => {
      const result = await invoke<Settings>('settings.update', partial)
      Object.assign(settings.value, result)
      service.apply(settings.value)
      return true
    })===true
  }

  async function refresh(): Promise<void> {
    if (!bridge) { hydrated.value = true; return }
    loading.value = true
    await task(async () => {
      const state = await invoke<LibraryState>('library.load')
      const player = state.player as PlayerSnapshot | undefined
      applying = true
      library.value = detachTrackReactivity(state)
      queue.value = player?.queue || []
      priorityQueue.value = player?.priorityQueue || []
      priorityCurrent.value = player?.priorityCurrent
      currentIndex.value = player?.resumeIndex ?? queue.value.findIndex(track => track.id === player?.currentId)
      progress.value = player?.progress || 0
      applying = false
      hydrated.value = true
      if (settings.value.startupAutoPlay && current.value) void startTrack(current.value, progress.value)
    })
    loading.value = false
  }

  async function flushState():Promise<void>{
    clearTimeout(saveTimer)
    if(!hydrated.value||!bridge)return
    const player:PlayerSnapshot={queue:queue.value,priorityQueue:priorityQueue.value,priorityCurrent:priorityCurrent.value,currentId:current.value?.id,resumeIndex:currentIndex.value,progress:settings.value.savePlayTime?progress.value:0}
    await invoke('library.save',{...library.value,player})
  }
  bridge?.on('app.flush',async({token}:{token:string})=>{
    try{await flushState()}catch(failure){error.value=String(failure)}
    finally{await invoke('app.flushReady',{token}).catch(()=>{})}
  })
  watch([library, queue, priorityQueue, priorityCurrent, currentIndex], () => {
    if (!hydrated.value || applying || !bridge) return
    clearTimeout(saveTimer)
    saveTimer=setTimeout(()=>void flushState().catch(failure=>error.value=String(failure)),600)
  }, { deep: true, flush: 'sync' })

  service.audio.addEventListener('timeupdate', () => {
    progress.value = service.audio.currentTime
    duration.value = Number.isFinite(service.audio.duration) ? service.audio.duration : 0
    if (bridge) void invoke('playback.status', status()).catch(() => {})
  })
  service.audio.addEventListener('loadedmetadata', () => duration.value = Number.isFinite(service.audio.duration) ? service.audio.duration : 0)
  service.audio.addEventListener('play', () => { playing.value = true; playbackState.value = 'playing' })
  service.audio.addEventListener('pause', () => {
    playing.value = false
    if (playbackState.value !== 'loading' && playbackState.value !== 'stoped') playbackState.value = 'paused'
  })
  service.audio.addEventListener('ended', () => void next(true))
  service.audio.addEventListener('error', () => {
    error.value = '音频无法播放，请检查文件、音源或网络'
    playing.value = false
    playbackState.value = 'error'
    if(!resolving.value&&settings.value.autoSkip){
      const failedTicket=ticket
      failures++
      if(failures<queue.value.length+priorityQueue.value.length+1)setTimeout(()=>{if(ticket===failedTicket&&playbackState.value==='error')void next(false)},0)
    }
  })
  setInterval(() => {
    if (!sleepAt.value || Date.now() < sleepAt.value) return
    sleepAt.value = 0
    if (sleepWaitForEnd.value && playing.value) sleepAfterTrack.value = true
    else { service.audio.pause(); notify('定时停止已完成') }
  }, 1000)
  watch([playbackState, current, lyric, settings], () => {
    if (!bridge || !hydrated.value) return
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => void invoke('playback.status', status()).catch(() => {}), 100)
  }, { deep: true })

  bridge?.on('library.updated', (state: LibraryState) => { applying = true; library.value = detachTrackReactivity(state); applying = false })
  bridge?.on('downloads.updated', (tasks: LibraryState['downloads']) => library.value.downloads = tasks)
  bridge?.on('sources.updated', (scripts: LibraryState['scripts']) => library.value.scripts = scripts)
  bridge?.on('player.command', ({ action, value }: { action: string; value?: unknown }) => {
    if (action === 'toggle') void toggle()
    if (action === 'play' && !playing.value) void toggle()
    if (action === 'pause') service.audio.pause()
    if (action === 'next') void next()
    if (action === 'previous' || action === 'prev') void previous()
    if (action === 'seek') service.seek(Number(value))
    if (action === 'volumeUp') void updateSettings({ volume: Math.min(1, settings.value.volume + .05) })
    if (action === 'volumeDown') void updateSettings({ volume: Math.max(0, settings.value.volume - .05) })
    if (action === 'volume') void updateSettings({ volume: Math.max(0, Math.min(1, Number(value))) })
    if (action === 'mute') void updateSettings({ muted: typeof value === 'boolean' ? value : !settings.value.muted })
    if (action === 'rate') void updateSettings({ playbackRate: Number(value) || 1 })
    if (action === 'mode' && ['listLoop', 'random', 'order', 'singleLoop','none'].includes(String(value))) void updateSettings({ playMode: value as Settings['playMode'] })
    if(action==='dislike'&&current.value){const rule=dislikeRule(current.value);void task(async()=>{await invoke('dislikes.add',{rules:[rule]});await next(false)})}
    if (action === 'stop') stop()
    if ((action === 'collect' || action === 'uncollect') && current.value) {
      const remove = action === 'uncollect' || value === false
      void task(() => invoke(remove ? 'playlists.removeTracks' : 'playlists.add', remove
        ? { playlistId: 'love', trackIds: [current.value!.id] }
        : { playlistId: 'love', tracks: [current.value] }))
    }
  })

  const systemMedia=bridge?.platform!=='win32'||new URLSearchParams(location.search).get('lyric')==='1'?undefined:createSystemMediaSession({
    play:async()=>{if(!playing.value)await toggle()},pause:()=>service.audio.pause(),stop,next:()=>next(),previous,seek:position=>service.seek(position),position:()=>service.audio.currentTime,duration:()=>duration.value,
  })
  watch([current,playbackState,duration,progress,()=>settings.value.playbackRate],()=>systemMedia?.update({track:current.value,state:playbackState.value,duration:duration.value,position:progress.value,rate:settings.value.playbackRate}),{immediate:true})
  window.addEventListener('pagehide',()=>systemMedia?.dispose(),{once:true})

  return {
    library, hydrated, loading, error, notice, queue, priorityQueue, priorityCurrent, currentIndex, current,
    progress, duration, playing, resolving, lyric, lines, activeLine, settings, preferences, audioCapabilities,
    sleepAt, sleepAfterTrack, sleepWaitForEnd, history, service,
    task, notify, play, toggle, stop, next, previous, later, playNext, playPriority, removeQueue, reorderQueue, clearQueue,
    setSleep, setSleepClock, updateSettings, refresh,
  }
})
