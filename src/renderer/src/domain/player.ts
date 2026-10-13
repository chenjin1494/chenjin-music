import type { Track, Settings } from '../../../shared/types'
import pitchWorkletURL from '../audio/pitch-worklet.ts?worker&url'
import { rendererPreferences } from './preferences'
import { isDisliked } from '../../../shared/dislike'

export function nextPlayableIndex(queue: Track[], current: number, mode: Settings['playMode'], ended: boolean, rules: string[], random = Math.random): number {
  const available = queue.map((track, index) => ({ track, index })).filter(item => !isDisliked(item.track, rules)).map(item => item.index)
  if (!available.length) return -1
  if (current < 0) return available[0]
  if (mode === 'none' && ended) return -1
  if (mode === 'singleLoop' && ended && available.includes(current)) return current
  if (mode === 'random') {
    const candidates = available.filter(index => index !== current)
    return candidates.length ? candidates[Math.floor(random() * candidates.length)] : available[0]
  }
  const following = available.find(index => index > current)
  if (following !== undefined) return following
  return mode === 'order' || mode === 'none' ? -1 : available[0]
}

export function randomUnplayedIndex(queue:Track[],current:number,played:string[],rules:string[],autoClean=true,random=Math.random):{index:number;reset:boolean}{
 const available=queue.map((track,index)=>({track,index})).filter(item=>!isDisliked(item.track,rules))
 const seen=new Set(played),candidates=available.filter(item=>!seen.has(trackKey(item.track))&&item.index!==current)
 if(candidates.length)return {index:candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))].index,reset:false}
 if(!autoClean)return {index:-1,reset:false}
 const restart=available.filter(item=>item.index!==current)
 const pool=restart.length?restart:available
 return {index:pool.length?pool[Math.min(pool.length-1,Math.floor(random()*pool.length))].index:-1,reset:true}
}

export interface NextSelection {
  priority?: Track
  remaining: Track[]
  index: number
}

export function chooseNext(queue: Track[], current: number, priority: Track[], mode: Settings['playMode'], ended: boolean, wasPriority: boolean, rules: string[] = [], random = Math.random): NextSelection {
  const allowed = priority.filter(track => !isDisliked(track, rules))
  if (allowed.length) return { priority: allowed[0], remaining: allowed.slice(1), index: current }
  return { remaining: [], index: nextPlayableIndex(queue, current, mode, ended && !wasPriority, rules, random) }
}

export type PlayMode = Settings['playMode']
export const trackKey = (track: Track): string => `${track.source}:${track.id}`

export function uniqueTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>()
  return tracks.filter(track => {
    const key = trackKey(track)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function nextIndex(length: number, current: number, mode: PlayMode, ended = false, random = Math.random): number {
  if (!length) return -1
  if (current < 0) return 0
  if (mode === 'none' && ended) return -1
  if (mode === 'singleLoop' && ended) return current
  if (mode === 'random') {
    if (length === 1) return 0
    const index = Math.floor(random() * (length - 1))
    return index >= current ? index + 1 : index
  }
  if (current + 1 < length) return current + 1
  return mode === 'order' || mode === 'none' ? -1 : 0
}

/** Legacy insertion helper, retained for callers that explicitly edit the base queue. */
export function insertNext(queue: Track[], current: number, tracks: Track[]): Track[] {
  const added = uniqueTracks(tracks)
  const keys = new Set(added.map(trackKey))
  return [...queue.slice(0, current + 1), ...added, ...queue.slice(current + 1).filter(track => !keys.has(trackKey(track)))]
}

export function appendPriority(priority: Track[], tracks: Track[]): Track[] {
  return uniqueTracks([...priority, ...tracks])
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export interface AudioCapabilities {
  worklet: boolean
  maxChannels: number
  outputChannels: number
  devices: MediaDeviceInfo[]
  error: string
}

type SinkContext = AudioContext & { setSinkId?: (deviceId: string) => Promise<void> }

export class AudioService {
  readonly audio = new Audio()
  readonly events = new EventTarget()
  context?: SinkContext
  gain?: GainNode
  analyser?: AnalyserNode
  filters: BiquadFilterNode[] = []
  capabilities: AudioCapabilities = { worklet: false, maxChannels: 2, outputChannels: 2, devices: [], error: '' }
  private source?: MediaElementAudioSourceNode
  private pitch?: AudioWorkletNode
  private convolver?: ConvolverNode
  private dry?: GainNode
  private wet?: GainNode
  private panner?: StereoPannerNode
  private oscillator?: OscillatorNode
  private rotation?: GainNode
  private impulseDecay = 0
  private customImpulse = ''
  private impulseTicket = 0
  private impulsePending?: Promise<void>
  private sink = ''
  private settings?: Settings
  private setupPromise?: Promise<void>

  constructor() {
    this.audio.preload = 'metadata'
    this.audio.crossOrigin = 'anonymous'
    navigator.mediaDevices?.addEventListener('devicechange', () => void this.refreshDevices())
    void this.refreshDevices()
  }

  private announce(): void {
    this.events.dispatchEvent(new CustomEvent<AudioCapabilities>('capabilities', { detail: { ...this.capabilities } }))
  }

  async refreshDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      this.capabilities.devices = devices.filter(device => device.kind === 'audiooutput')
      if (this.sink && this.sink !== 'default' && !this.capabilities.devices.some(device => device.deviceId === this.sink)) {
        const removed=this.sink
        await this.setDevice('default')
        this.events.dispatchEvent(new CustomEvent('device-removed', { detail: removed }))
      }
      this.announce()
    } catch (error) {
      this.capabilities.error = `无法枚举输出设备：${String(error)}`
      this.announce()
    }
  }

  private async buildGraph(): Promise<void> {
    const context = this.context = new AudioContext() as SinkContext
    this.capabilities.maxChannels = Math.max(1, context.destination.maxChannelCount)
    this.source = context.createMediaElementSource(this.audio)
    let node: AudioNode = this.source
    try {
      await context.audioWorklet.addModule(pitchWorkletURL)
      this.pitch = new AudioWorkletNode(context, 'chenjin-pitch', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
      })
      node.connect(this.pitch)
      node = this.pitch
      this.capabilities.worklet = true
    } catch (error) {
      this.capabilities.error = `独立变调不可用：${String(error)}`
    }

    this.filters = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map(frequency => {
      const filter = context.createBiquadFilter()
      filter.type = 'peaking'
      filter.frequency.value = frequency
      filter.Q.value = 1
      node.connect(filter)
      node = filter
      return filter
    })
    this.dry = context.createGain()
    this.wet = context.createGain()
    this.convolver = context.createConvolver()
    this.panner = context.createStereoPanner()
    this.gain = context.createGain()
    this.analyser = context.createAnalyser()
    this.analyser.fftSize = 256
    node.connect(this.dry)
    node.connect(this.convolver)
    this.convolver.connect(this.wet)
    this.dry.connect(this.panner)
    this.wet.connect(this.panner)
    this.panner.connect(this.gain)
    this.gain.connect(this.analyser)
    this.analyser.connect(context.destination)
    this.oscillator = context.createOscillator()
    this.oscillator.type = 'sine'
    this.rotation = context.createGain()
    this.rotation.gain.value = 0
    this.oscillator.connect(this.rotation)
    this.rotation.connect(this.panner.pan)
    this.oscillator.start()
    this.announce()
  }

  async setup(settings: Settings): Promise<void> {
    this.settings = settings
    if (!this.setupPromise) this.setupPromise = this.buildGraph()
    await this.setupPromise
    if (this.context?.state === 'suspended') await this.context.resume()
    this.apply(settings)
    await this.impulsePending
    await this.setDevice(settings.outputDevice || 'default')
  }

  private setImpulse(seconds: number): void {
    if (!this.context || !this.convolver || this.impulseDecay === seconds) return
    this.impulseDecay = seconds
    const length = Math.ceil(this.context.sampleRate * seconds)
    const impulse = this.context.createBuffer(2, length, this.context.sampleRate)
    // Stable noise avoids a fresh timbre when a preference is applied again.
    let seed = 0x12345678
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
        const noise = (seed >>> 0) / 0xffffffff * 2 - 1
        data[i] = noise * (1 - i / length) ** 3
      }
    }
    this.convolver.buffer = impulse
  }

  private applyImpulse(settings: Settings, seconds: number): void {
    const encoded = typeof settings.impulseResponseBase64 === 'string' ? settings.impulseResponseBase64 : ''
    if (!encoded) {
      if (this.customImpulse) { this.customImpulse = ''; this.impulseTicket++; this.impulseDecay = 0 }
      this.setImpulse(seconds)
      return
    }
    if (!this.context || !this.convolver || this.customImpulse === encoded) return
    this.customImpulse = encoded
    const ticket = ++this.impulseTicket, context = this.context
    this.impulsePending = (async () => {
      try {
        if (encoded.length > 14_000_000) throw new Error('脉冲响应超过 10 MB')
        const binary = atob(encoded), bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
        const buffer = await context.decodeAudioData(bytes.buffer)
        if (ticket !== this.impulseTicket || !this.convolver) return
        this.convolver.buffer = buffer; this.impulseDecay = 0
        this.announce()
      } catch (error) {
        if (ticket !== this.impulseTicket) return
        this.capabilities.error = `卷积响应读取失败：${String(error)}`
        this.impulseDecay = 0; this.setImpulse(seconds); this.announce()
      }
    })()
  }

  async setDevice(deviceId: string): Promise<void> {
    if (deviceId === this.sink) return
    try {
      const sinkId = deviceId === 'default' ? '' : deviceId
      if (this.context?.setSinkId) await this.context.setSinkId(sinkId)
      else if (!this.context) {
        const native = this.audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
        if (native.setSinkId) await native.setSinkId(sinkId)
        else if (deviceId !== 'default') throw new Error('当前环境不支持输出设备切换')
      } else if (deviceId !== 'default') throw new Error('当前 Web Audio 环境不支持输出设备切换')
      this.sink = deviceId
      this.capabilities.error = ''
    } catch (error) {
      this.capabilities.error = `输出设备切换失败：${String(error)}`
    }
    this.announce()
  }

  apply(settings: Settings): void {
    this.settings = settings
    const preferences = rendererPreferences(settings)
    const context = this.context
    this.audio.volume = this.gain ? 1 : Math.max(0, Math.min(1, settings.volume))
    this.audio.muted = settings.muted
    this.audio.playbackRate = Math.max(0.25, Math.min(4, settings.playbackRate))
    this.audio.preservesPitch = settings.preservesPitch
    if (this.gain && context) this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, settings.volume)), context.currentTime, 0.02)
    this.filters.forEach((filter, index) => filter.gain.setTargetAtTime(Math.max(-15, Math.min(15, settings.eq[index] || 0)), context!.currentTime, 0.03))
    if (context && this.dry && this.wet) {
      const mix = Math.max(0, Math.min(1, settings.reverb))
      this.applyImpulse(settings, Math.max(0.2, Math.min(8, preferences.reverbDecay)))
      const dryGain = Math.max(0, Math.min(2, Number(settings.reverbDryGain ?? 1)))
      const wetGain = Math.max(0, Math.min(2, Number(settings.reverbWetGain ?? 1)))
      this.dry.gain.setTargetAtTime(Math.cos(mix * Math.PI / 2) * dryGain, context.currentTime, 0.04)
      this.wet.gain.setTargetAtTime(Math.sin(mix * Math.PI / 2) * wetGain, context.currentTime, 0.04)
      this.rotation!.gain.setTargetAtTime(settings.panner ? 0.95 : 0, context.currentTime, 0.15)
      this.oscillator!.frequency.setTargetAtTime(Math.max(0.02, Math.min(2, preferences.pannerSpeed)), context.currentTime, 0.1)
      const channels = Math.max(1, Math.min(this.capabilities.maxChannels, preferences.outputChannels))
      context.destination.channelCount = channels
      this.capabilities.outputChannels = channels
    }
    this.pitch?.port.postMessage({ semitones: Math.max(-12, Math.min(12, settings.pitch)) })
    void this.setDevice(settings.outputDevice || 'default')
    this.announce()
  }

  seek(seconds: number): void {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, seconds))
  }
}

let singleton: AudioService | undefined
export function audioService(): AudioService { return singleton ||= new AudioService() }
