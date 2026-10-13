import { inflateSync, constants } from 'node:zlib'
import type { Lyrics } from '../../../src/shared/types'

const LIMIT = 4 * 1024 * 1024
const inflate = (bytes: Uint8Array) => inflateSync(bytes, { maxOutputLength: LIMIT, finishFlush: constants.Z_SYNC_FLUSH }).toString('utf8')
const stamp = (milliseconds: number) => `[${String(Math.floor(milliseconds / 60000)).padStart(2, '0')}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, '0')}.${String(milliseconds % 1000).padStart(3, '0')}]`
const entities = (text: string) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
const empty = (): Lyrics => ({ lyric: '', tlyric: null, rlyric: null, lxlyric: null })

/** A decoded KRC record uses relative word times and optional line-aligned language arrays. */
export function decodeKrc(input: string | Uint8Array): Lyrics {
  const file = typeof input === 'string' ? Buffer.from(input, 'base64') : Buffer.from(input)
  if (file.length < 5 || file.subarray(0, 4).toString() !== 'krc1') throw new Error('无效 KRC 文件头')
  const key = [0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69]
  const packed = file.subarray(4).map((value, index) => value ^ key[index % key.length])
  const text = inflate(packed), result = empty(), plain: string[] = [], timed: string[] = [], translations: string[] = [], romans: string[] = []
  const language = text.match(/\[language:([^\]]+)\]/)?.[1]
  let extras: any[] = []
  if (language) try { extras = JSON.parse(Buffer.from(language, 'base64').toString()).content ?? [] } catch { /* Keep usable original words if an optional language record is broken. */ }
  let lineIndex = 0
  for (const row of text.replace(/\r/g, '').split('\n')) {
    const match = row.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!match) continue
    const tag = stamp(Number(match[1])), body = entities(match[3]).replace(/<(\d+),(\d+),\d+>/g, '<$1,$2>')
    plain.push(tag + body.replace(/<\d+,\d+>/g, '')); if (/<\d+,\d+>/.test(body)) timed.push(tag + body)
    for (const extra of extras) { const value = extra.lyricContent?.[lineIndex]; if (!Array.isArray(value)) continue; if (extra.type === 1) translations.push(tag + entities(value.join(''))); if (extra.type === 0) romans.push(tag + entities(value.join(''))) }
    lineIndex++
  }
  return { ...result, lyric: plain.join('\n'), lxlyric: timed.join('\n') || null, tlyric: translations.join('\n') || null, rlyric: romans.join('\n') || null }
}

/** Convert QQ/Migu absolute word(start,duration) records to the shared LX relative format. */
export function parseAbsoluteWordLyrics(input: string): Lyrics {
  const text = entities(input.match(/LyricContent="([\s\S]*?)"\s*\/?\s*>/)?.[1] ?? input)
  const plain: string[] = [], timed: string[] = []
  for (const row of text.replace(/\r/g, '').split('\n')) {
    const line = row.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!line) { if (/^\[\d+:\d+/.test(row)) plain.push(row); continue }
    const start = Number(line[1]), tag = stamp(start), tokens = [...line[3].matchAll(/([^()]*)\((\d+),(\d+)\)/g)]
    if (!tokens.length) { plain.push(tag + line[3]); continue }
    plain.push(tag + tokens.map(token => token[1]).join(''))
    timed.push(tag + tokens.map(token => `<${Math.max(0, Number(token[2]) - start)},${Number(token[3])}>${token[1]}`).join(''))
  }
  return { ...empty(), lyric: plain.join('\n'), lxlyric: timed.join('\n') || null }
}

/** MRC's wire cipher is corrected-block TEA with signed 64-bit words and UTF-16LE text. */
export function decodeMrc(input: string): Lyrics {
  const text = input.trim()
  if (!/^[\da-f]+$/i.test(text) || text.length < 32) return parseAbsoluteWordLyrics(text)
  if (text.length % 16 || text.length > LIMIT * 2) throw new Error('无效 MRC 密文长度')
  const signed = (value: bigint) => BigInt.asIntN(64, value)
  const key = [27303562373562475n, 18014862372307051n, 22799692160172081n, 34058940340699235n]
  const words = text.match(/.{16}/g)!.map(word => signed(BigInt('0x' + word))), n = words.length
  const delta = 0x9e3779b9n
  let sum = signed(BigInt(6 + Math.floor(52 / n)) * delta), y = words[0]
  const mix = (z: bigint, p: number, e: number) => signed(signed(signed(y ^ sum) + signed(z ^ key[(p & 3) ^ e])) ^ signed(signed((z >> 5n) ^ signed(y << 2n)) + signed((y >> 3n) ^ signed(z << 4n))))
  while (sum !== 0n) {
    const e = Number((sum >> 2n) & 3n)
    for (let p = n - 1; p >= 0; p--) { const z = words[(p - 1 + n) % n]; y = words[p] = signed(words[p] - mix(z, p, e)) }
    sum = signed(sum - delta)
  }
  const bytes = Buffer.alloc(n * 8); words.forEach((word, index) => bytes.writeBigUInt64LE(BigInt.asUintN(64, word), index * 8))
  return parseAbsoluteWordLyrics(bytes.toString('utf16le').replace(/\0+$/, ''))
}

export function decodeKuwo(input: Uint8Array, word = true): Lyrics {
  const file = Buffer.from(input), separator = file.indexOf('\r\n\r\n')
  if (separator < 0 || !/^tp=content/i.test(file.subarray(0, 10).toString())) throw new Error('酷我歌词响应格式无效')
  let text = inflate(file.subarray(separator + 4))
  if (word) { const bytes = Buffer.from(text.trim(), 'base64'), key = Buffer.from('yeelion'); text = bytes.map((byte, index) => byte ^ key[index % key.length]).toString() }
  const code = parseInt(text.match(/\[kuwo:(\d+)/)?.[1] ?? '13', 8), a = Math.trunc(code / 10), b = code % 10
  if (!a || !b) throw new Error('酷我歌词时间密钥无效')
  const records = [...text.replace(/\r/g, '').matchAll(/^\[(\d+:\d+(?:\.\d+)?)\](.*)$/gm)]
  const originals:typeof records=[], translated:Array<{tag:string;body:string}>=[], seen=new Set<string>()
  for(const record of records){if(seen.has(record[1])&&originals.length>=2){const extra=originals.pop()!;translated.push({tag:`[${originals[originals.length-1][1]}]`,body:entities(extra[2]).replace(/<-?\d+,-?\d+(?:,-?\d+)?>/g,'')})}else seen.add(record[1]);originals.push(record)}
  const plain: string[] = [], timed: string[] = [], translation: string[] = translated.map(row=>row.tag+row.body)
  for (const record of originals) {
    const tag = `[${record[1]}]`, body = entities(record[2]), words = [...body.matchAll(/<(-?\d+),(-?\d+)(?:,-?\d+)?>[^<]*/g)]
    if (!words.length) { if (plain.length && records.some(other => other !== record && other[1] === record[1])) translation.push(tag + body); else plain.push(tag + body); continue }
    const values = words.map(token => { const m = /<(-?\d+),(-?\d+)(?:,-?\d+)?>/.exec(token[0])!; const x = Number(m[1]), y = Number(m[2]); return { start: Math.trunc(Math.abs((x + y) / (a * 2))), duration: Math.trunc(Math.abs((x - y) / (b * 2))), text: token[0].slice(m[0].length) } })
    values.forEach((value, index) => { const next = values[index + 1]; if (next && value.start + value.duration > next.start) value.duration = Math.max(0, next.start - value.start) })
    timed.push(tag + values.map(value => `<${value.start},${value.duration}>${value.text}`).join('')); plain.push(tag + values.map(value => value.text).join(''))
  }
  return { ...empty(), lyric: plain.join('\n'), lxlyric: timed.join('\n') || null, tlyric: translation.join('\n') || null }
}

// DES protocol permutation tables are public constants; the QRC S-box contains two wire-format deviations.
const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7]
const FP = Array.from({length:64},(_,i)=>IP.indexOf(i+1)+1)
const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1]
const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25]
const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4]
const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32]
const S = [
[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,15,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,10,13,8,9,4,5,11,12,7,2,14],
[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]]
const permute = (word: bigint, width: number, table: number[]) => table.reduce((out, position) => (out << 1n) | (position>width?0n:((word >> BigInt(width - position)) & 1n)), 0n)
function schedule(key: bigint): bigint[] {
  const selected = permute(key,64,PC1), mask = (1n<<28n)-1n; let c = selected>>28n, d = selected&mask
  return [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1].map(amount => { const shift=BigInt(amount); c=((c<<shift)|(c>>(28n-shift)))&mask; d=((d<<shift)|(d>>(28n-shift)))&mask; return permute((c<<28n)|d,56,PC2.map((position,index)=>index>=24?position+1:position)) })
}
function des(block: bigint, keys: bigint[]): bigint {
  const initial=permute(block,64,IP); let l=initial>>32n, r=initial&0xffffffffn
  for (const key of keys) {
    const expanded=permute(r,32,E)^key; let substituted=0n
    for(let i=0;i<8;i++){const part=Number((expanded>>BigInt(42-i*6))&63n), row=((part&32)>>4)|(part&1), col=(part>>1)&15;substituted=(substituted<<4n)|BigInt(S[i][row*16+col])}
    const next=l^permute(substituted,32,P);l=r;r=next
  }
  return permute((r<<32n)|l,64,FP)
}
// QRC's wire cipher uses DES-family tables but also two nonstandard S-box cells,
// little-endian 32-bit word layout, and a one-bit shift in the right PC2 half.
// Ordinary crypto-library 3DES is therefore not interoperable.
const qrcKey=Buffer.from('!@#)(*$%123ZXC!@!@#)(NHL')
const swapWords=(value:bigint)=>{const bytes=Buffer.alloc(8);bytes.writeBigUInt64BE(value);bytes.swap32();return bytes.readBigUInt64BE()}
const qrcSchedules=[0,8,16].map(offset=>schedule(swapWords(qrcKey.readBigUInt64BE(offset))))
export function decodeQrc(input: string): string {
  if(!input)return ''
  if(!/^[\da-f]+$/i.test(input)||input.length%16||input.length>LIMIT*2)throw new Error('无效 QRC 密文长度')
  const bytes=Buffer.from(input,'hex'), output=Buffer.alloc(bytes.length)
  const keys=[qrcSchedules[2].slice().reverse(),qrcSchedules[1],qrcSchedules[0].slice().reverse()]
  for(let i=0;i<bytes.length;i+=8){let block=swapWords(bytes.readBigUInt64BE(i));for(const round of keys)block=des(block,round);output.writeBigUInt64BE(swapWords(block),i)}
  return inflate(output)
}
