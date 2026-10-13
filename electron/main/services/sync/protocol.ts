import { createCipheriv, createDecipheriv, createHash, randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'

export const HELLO = 'Hello~::^-^::~v4~'
export const ID_PREFIX = 'OjppZDo6'
export const AUTH = 'lx-music auth::'
export const CONNECT = 'lx-music connect'
export const MAX_MESSAGE = 16 * 1024 * 1024
export const md5 = (text: string) => createHash('md5').update(text).digest('hex')
export const codeKey = (code: string) => Buffer.from(md5(code).slice(0, 16)).toString('base64')
function aesKey(key: string) { const bytes = Buffer.from(key, 'base64'); if (bytes.length !== 16) throw new Error('Invalid AES key'); return bytes }
export function aesEncrypt(text: string, key: string): string {
  const cipher = createCipheriv('aes-128-ecb', aesKey(key), null)
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64')
}
export function aesDecrypt(text: string, key: string): string {
  if (text.length > MAX_MESSAGE || !/^[\w+/]*={0,2}$/.test(text)) throw new Error('Invalid ciphertext')
  const cipher = createDecipheriv('aes-128-ecb', aesKey(key), null)
  return Buffer.concat([cipher.update(Buffer.from(text, 'base64')), cipher.final()]).toString('utf8')
}
export function encodeMessage(value: unknown): string {
  const text = JSON.stringify(value)
  if (Buffer.byteLength(text) > MAX_MESSAGE) throw new Error('Message exceeds limit')
  return text.length > 1024 ? `cg_${gzipSync(text).toString('base64')}` : text
}
export function decodeMessage(text: string): unknown {
  if (Buffer.byteLength(text) > MAX_MESSAGE) throw new Error('Message exceeds limit')
  const decoded = text.startsWith('cg_') ? gunzipSync(Buffer.from(text.slice(3), 'base64'), { maxOutputLength: MAX_MESSAGE }).toString('utf8') : text
  if (Buffer.byteLength(decoded) > MAX_MESSAGE) throw new Error('Message exceeds limit')
  return JSON.parse(decoded)
}
export interface RpcPacket { name: string; path?: string[]; data?: unknown; error?: string | null }
export type RpcHandler = (...args: any[]) => unknown | Promise<unknown>
/** Independently implemented message2call 0.1.3 wire format; group queues are local, never sent. */
export class SyncRpc {
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()
  private queues = new Map<string, Promise<unknown>>()
  private destroyed = false
  private inbound = 0
  constructor(private send: (packet: RpcPacket) => void, private handlers: Record<string, RpcHandler>, private timeout = 120_000) {}
  call(method: string, args: unknown[] = [], group?: string): Promise<any> {
    const task = () => this.request(method, args)
    if (!group) return task()
    const promise = (this.queues.get(group) ?? Promise.resolve()).then(task)
    this.queues.set(group, promise.catch(() => {}))
    return promise
  }
  private request(method: string, args: unknown[]): Promise<any> {
    if (this.destroyed) return Promise.reject(new Error('Disconnected'))
    if (this.pending.size >= 256) return Promise.reject(new Error('Too many pending calls'))
    const name = `${method}__${randomUUID()}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(name); reject(new Error('RPC timeout')) }, this.timeout)
      this.pending.set(name, { resolve, reject, timer })
      try { this.send({ name, path: [method], data: args }) } catch (error) { clearTimeout(timer); this.pending.delete(name); reject(error as Error) }
    })
  }
  async message(raw: unknown): Promise<void> {
    if (this.destroyed) return
    if (!raw || typeof raw !== 'object') throw new Error('Invalid RPC packet')
    const packet = raw as RpcPacket
    if (typeof packet.name !== 'string' || !packet.name || packet.name.length > 512) throw new Error('Invalid RPC name')
    if (packet.path != null) {
      if (!Array.isArray(packet.path) || packet.path.length !== 1 || typeof packet.path[0] !== 'string' || (packet.data != null && !Array.isArray(packet.data))) throw new Error('Invalid RPC call')
      const method = packet.path[0]
      if (this.inbound >= 256) throw new Error('Too many inbound calls')
      ++this.inbound
      try {
        if (!Object.hasOwn(this.handlers, method)) throw new Error(`${method} is not defined`)
        const data = await this.handlers[method](...((packet.data ?? []) as unknown[]))
        if (!this.destroyed) this.send({ name: packet.name, error: null, data })
      } catch (error) { if (!this.destroyed) this.send({ name: packet.name, error: error instanceof Error ? error.message : 'RPC failed' }) }
      finally { --this.inbound }
      return
    }
    const pending = this.pending.get(packet.name)
    if (!pending) return
    clearTimeout(pending.timer); this.pending.delete(packet.name)
    if (packet.error == null) pending.resolve(packet.data)
    else pending.reject(new Error(String(packet.error)))
  }
  destroy(): void {
    this.destroyed = true
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Disconnected')) }
    this.pending.clear(); this.queues.clear()
  }
}
