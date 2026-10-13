import { describe,expect,it,vi } from 'vitest'
import { createCipheriv,generateKeyPairSync,publicEncrypt,constants } from 'node:crypto'
import { deflateSync } from 'node:zlib'
vi.mock('electron',()=>({BrowserWindow:vi.fn(),ipcMain:{on:vi.fn(),handle:vi.fn()},net:{},app:{}}))
import { runSourceTool,parseSource } from '../electron/main/services/source-runtime'
describe('LX API2 tool semantics',()=>{
 it('preserves UTF8/base64/hex/binary encodings and concat',()=>{
  expect(runSourceTool('string',[runSourceTool('buffer',['中文']),'utf8'])).toBe('中文')
  expect(runSourceTool('string',[runSourceTool('buffer',['aGVsbG8=','base64']),'utf8'])).toBe('hello')
  expect(runSourceTool('string',[runSourceTool('buffer',['ff00','hex']),'hex'])).toBe('ff00')
  expect(runSourceTool('string',['\xff','hex'])).toBe('ff')
  expect(runSourceTool('string',[runSourceTool('concat',[[new Uint8Array([65]),new Uint8Array([66])]]),'utf8'])).toBe('AB')
 })
 it('matches Node AES ECB/CBC known results and reports errors',()=>{
  const key=Buffer.from('1234567890123456'),iv=Buffer.from('6543210987654321')
  for(const mode of ['aes-128-ecb','aes-128-cbc']){const c=createCipheriv(mode,key,mode.endsWith('ecb')?null:iv);expect(runSourceTool('aes',[Buffer.from('hello'),mode,key,mode.endsWith('ecb')?null:iv])).toEqual(Buffer.concat([c.update('hello'),c.final()]))}
  expect(()=>runSourceTool('aes',['hello','not-aes',key,null])).toThrow()
  expect(()=>runSourceTool('random',[-1])).toThrow()
  expect(()=>runSourceTool('concat',[[Buffer.from('x')],16_000_001])).toThrow()
  expect(()=>runSourceTool('buffer',[new ArrayBuffer(16_000_001)])).toThrow()
 })
 it('implements LX 1024-bit RSA zero-left-padding rather than OAEP',()=>{
  const pair=generateKeyPairSync('rsa',{modulusLength:1024}),publicKey=pair.publicKey.export({type:'spki',format:'pem'})
  const expected=publicEncrypt({key:pair.publicKey,padding:constants.RSA_NO_PADDING},Buffer.concat([Buffer.alloc(125),Buffer.from('abc')]))
  expect(runSourceTool('rsa',[Buffer.from('abc'),publicKey])).toEqual(expected)
  expect(()=>runSourceTool('rsa',[Buffer.alloc(129),publicKey])).toThrow()
 })
 it('rejects corrupt or oversized compressed data and supports round trips',()=>{
  expect(runSourceTool('inflate',[runSourceTool('deflate',['压缩'])])).toEqual(Buffer.from('压缩'))
  expect(runSourceTool('gunzip',[runSourceTool('gzip',['gzip'])])).toEqual(Buffer.from('gzip'))
  expect(()=>runSourceTool('inflate',[Buffer.from('bad')])).toThrow()
  expect(()=>runSourceTool('inflate',[deflateSync(Buffer.alloc(16_000_001))])).toThrow()
 })
 it('hashes exactly and parses metadata without enabling imports',()=>{
  expect(runSourceTool('md5',['hello'])).toBe('5d41402abc4b2a76b9719d911017c592')
  expect(runSourceTool('sha256',['hello'])).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  const source=parseSource('/**\n * @name Protocol Test\n * @version 2\n * @author tester\n */\nconsole.log(1)')
  expect(source).toMatchObject({name:'Protocol Test',version:'2',author:'tester',enabled:false})
 })
})
