import { describe,it,expect } from 'vitest'
import { createServer } from 'node:net'
import { OpenAPIService,initialPlayerStatus } from '../electron/main/services/open-api'
import { defaultSettings } from '../src/shared/defaults'
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as any).port;await new Promise<void>(r=>s.close(()=>r()));return p as number}
describe('LX OpenAPI wire compatibility',()=>{
 it('uses absolute seek seconds, integer percent volume and original lyric response',async()=>{
  const actions:{action:string;value?:unknown}[]=[];const status={...initialPlayerStatus,duration:120,progress:40,lyric:'[00:00.00]歌词',lyricLineText:'歌词'}
  const service=new OpenAPIService(()=>status,(action,value)=>actions.push({action,value}));const port=await freePort();await service.configure({...defaultSettings,openAPI:true,openAPIPort:port})
  try{
   const base=`http://127.0.0.1:${port}`
   expect(await (await fetch(base+'/lyric')).text()).toBe(status.lyric)
   expect(await (await fetch(base+'/seek?offset=15')).text()).toBe('OK');expect(actions.at(-1)).toEqual({action:'seek',value:15})
   expect((await fetch(base+'/seek?offset=-1')).status).toBe(400)
   await fetch(base+'/volume?volume=75');expect(actions.at(-1)).toEqual({action:'volume',value:.75})
   expect((await fetch(base+'/volume?volume=101')).status).toBe(400)
   expect((await fetch(base+'/mute?mute=1')).status).toBe(400)
   expect((await fetch(base+'/missing')).status).toBe(401)
   expect(await (await fetch(base+'/status?filter=name,progress')).json()).toEqual({name:'',progress:40})
   const abort=new AbortController();const stream=await fetch(base+'/subscribe-player-status?filter=progress',{signal:abort.signal});const reader=stream.body!.getReader();const first=await reader.read();expect(new TextDecoder().decode(first.value)).toContain('event: progress\ndata: 40');abort.abort();await reader.cancel().catch(()=>{})
  }finally{await service.dispose()}
 })
})
