import type { SourceId, Track } from '../../../shared/types'

export interface OnlineTarget { kind: 'album' | 'singer'; source: SourceId; id: string; name?: string }

export function parsePlaylistAddress(input: string, fallback: SourceId): { source: SourceId; id: string } {
  const value = input.trim()
  if (!value || value.length > 2048) throw new Error('请输入歌单 ID 或有效的在线歌单链接')
  if (/^[\w-]{1,128}(?:###[\w-]{1,512})?$/.test(value)) return { source: fallback, id: value }
  let url: URL
  try { url = new URL(value) } catch { throw new Error('请输入歌单 ID 或有效的在线歌单链接') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('歌单链接必须为 HTTP 或 HTTPS')
  const host = url.hostname.toLowerCase()
  const domain = (base:string) => host === base || host.endsWith(`.${base}`)
  const source: SourceId = domain('music.163.com') || host === '163cn.tv' ? 'wy'
    : domain('qq.com') ? 'tx'
    : domain('kugou.com') ? 'kg'
    : domain('kuwo.cn') ? 'kw'
    : domain('migu.cn') ? 'mg'
    : fallback
  return {source,id:value}
}

export function trackMetadataTarget(track: Track, kind: 'album' | 'singer'): OnlineTarget | undefined {
  const id = kind === 'album' ? track.meta.albumId ?? track.meta.albumMid : (() => {
    const singers = track.meta.singerIds ?? track.meta.singerId ?? track.meta.artists ?? track.meta.singers
    const first = Array.isArray(singers) ? singers[0] : singers
    return first && typeof first === 'object' ? (first as Record<string, unknown>).id ?? (first as Record<string, unknown>).mid : first
  })()
  if (id === undefined || id === null || id === '') return undefined
  return { kind, source: track.source, id: String(id), name: kind === 'album' ? track.meta.albumName : track.singer }
}
