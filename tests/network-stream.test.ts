import { describe,it,expect,vi,beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
vi.mock('electron',()=>({net:{fetch:vi.fn()},session:{defaultSession:{resolveProxy:vi.fn()}}}))
vi.mock('node:https',()=>({request:vi.fn()}))
vi.mock('proxy-agent',()=>({ProxyAgent:class{constructor(public options:any){}destroy(){}}}))
import { net,session } from 'electron'
import { request as httpsRequest } from 'node:https'
import { fetchBytes,normalizeResolvedProxy } from '../electron/main/services/network'
const mock=vi.mocked(httpsRequest),proxy=vi.mocked(session.defaultSession.resolveProxy),endpoint='https://mobiles.kugou.com/api/v5/special/info_v2'
function fixture(status=200,body=Buffer.from('hi'),headers:Record<string,string>={}){const request=Object.assign(new EventEmitter(),{write:vi.fn(),destroy:vi.fn(),end:()=>queueMicrotask(()=>{const response=Object.assign(new EventEmitter(),{statusCode:status,headers,destroy:vi.fn(),resume:vi.fn()});const callback=mock.mock.calls.at(-1)![2] as any;callback(response);response.emit('data',body);response.emit('end')})});mock.mockReturnValueOnce(request as any);return request}
beforeEach(()=>{vi.resetAllMocks();proxy.mockResolvedValue('DIRECT')})
describe('restricted KG native streaming transport',()=>{
 it('honors resolved system HTTP/SOCKS proxies with no environment proxy substitution',()=>{expect(normalizeResolvedProxy('DIRECT')).toBe('');expect(normalizeResolvedProxy('PROXY localhost:8;DIRECT')).toBe('http://localhost:8');expect(normalizeResolvedProxy('HTTPS localhost:8')).toBe('https://localhost:8');expect(normalizeResolvedProxy('SOCKS5 localhost:8')).toBe('socks5://localhost:8');expect(()=>normalizeResolvedProxy('UNKNOWN host:1')).toThrow('格式')})
 it('keeps bounded bytes and charset and the Electron-selected proxy',async()=>{proxy.mockResolvedValue('SOCKS5 proxy.example:80');const request=fixture(200,Buffer.from('字'),{'content-type':'application/json;charset=gbk'});const result=await fetchBytes(endpoint,{transport:'kugou-share',method:'POST',body:'json'});expect(result.bytes.toString()).toBe('字');expect(result.charset).toBe('gbk');expect(proxy).toHaveBeenCalledWith(endpoint);expect((mock.mock.calls[0][1] as any).agent.options.getProxyForUrl()).toBe('socks5://proxy.example:80');expect(request.write).toHaveBeenCalledWith('json');expect(net.fetch).not.toHaveBeenCalled()})
 it('rejects general destinations before issuing native requests',async()=>{await expect(fetchBytes('https://example.com/',{transport:'kugou-share'})).rejects.toThrow('端点');expect(mock).not.toHaveBeenCalled();await expect(fetchBytes('https://mobiles.kugou.com/api/unrelated',{transport:'kugou-share'})).rejects.toThrow('端点')})
 it('enforces streaming and announced response bounds',async()=>{const streamed=fixture(200,Buffer.alloc(10));await expect(fetchBytes(endpoint,{transport:'kugou-share'},5)).rejects.toThrow('大小限制');expect(streamed.destroy).toHaveBeenCalled();const declared=fixture(200,Buffer.alloc(1),{'content-length':'100'});await expect(fetchBytes(endpoint,{transport:'kugou-share'},5)).rejects.toThrow('大小限制');expect(declared.destroy).toHaveBeenCalled()})
 it('rejects upstream failures and canceled calls before starting a socket',async()=>{fixture(403);await expect(fetchBytes(endpoint,{transport:'kugou-share'})).rejects.toThrow('HTTP 403');mock.mockClear();const controller=new AbortController();controller.abort();await expect(fetchBytes(endpoint,{transport:'kugou-share',signal:controller.signal})).rejects.toThrow('已取消');expect(mock).not.toHaveBeenCalled()})
})
