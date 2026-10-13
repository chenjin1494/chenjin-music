const { _electron: electron }=require('@playwright/test')
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os')
const sources=['kw','kg','tx','wy','mg']
async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'chenjin-provider-probe-'))
 const env={...process.env,CHENJIN_TEST_USER_DATA:path.join(temp,'userdata')};delete env.ELECTRON_RUN_AS_NODE
 const startedAt=new Date().toISOString(),report={startedAt,keyword:'周杰伦',environment:{electron:'real desktop',authenticated:false},sources:{}}
 const app=await electron.launch({args:[path.resolve('.')],env,timeout:30000})
 try{
  const win=await app.firstWindow();await win.waitForLoadState('domcontentloaded')
  const call=(method,params)=>win.evaluate(({method,params})=>window.chenjin.invoke(method,params),{method,params})
  await call('settings.update',{hotSearch:false,openAPI:false})
  if(process.argv.includes('--raw')){
   const endpoints=[
    ['wyHot','https://music.163.com/api/search/hot/detail'],['kwBoards','https://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2'],['kwPlaylist','https://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=3677150229&pn=0&rn=10&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&newver=1'],['kwWebPlaylist','https://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=3677150229&pn=0&rn=10&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1'],['kwHot','https://search.kuwo.cn/r.s?client=kt&encoding=utf8&rformat=json&ft=hotword'],['kwBang','https://wapi.kuwo.cn/api/pc/bang/list'],['kgBoards','https://mobilecdn.kugou.com/api/v3/rank/list?version=9108&plat=0&showtype=2&parentid=0&apiver=6&area_code=1&withsong=1'],['kgPlaylist','https://m.kugou.com/plist/list/3823475?json=true'],['kgPlaylist2','https://mobilecdn.kugou.com/api/v3/special/song?specialid=3823475&page=1&pagesize=10&version=9108&plat=0'],['kgHot','https://m.kugou.com/?json=true'],['mgPlaylists','https://app.c.nf.migu.cn/pc/bmw/page-data/playlist-square-recommend/v1.0?templateVersion=2&pageNo=1'],['mgBoards','https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0'],['txPlaylists','https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg?picmid=1&rnd=0.5&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&categoryId=10000000&sortId=5&sin=0&ein=23']
   ]
   await Promise.all(endpoints.map(async([name,url])=>{const result=await app.evaluate(async({net},{url})=>{try{const r=await net.fetch(url,{headers:{'user-agent':'Mozilla/5.0','referer':'https://y.qq.com/'},signal:AbortSignal.timeout(15000)});return {status:r.status,url:r.url,text:(await r.text()).slice(0,12000)}}catch(e){return {error:e.message}}},{url});console.log('RAW_'+name+'='+JSON.stringify(result))}));return
  }
  if(process.argv.includes('--raw2')){
   const endpoints=[['kgRanks','https://m.kugou.com/rank/list?json=true'],['kgHot','https://searchrecommend.kugou.com/v1/word_noclick?plat=0&count=10'],['kwHot','https://kuwo.cn/api/www/search/searchKey?key=&httpsStatus=1'],['wyHot','https://music.163.com/api/search/hot?type=1111'],['kwDetail','https://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=228908'],['kwPlaylist','https://www.kuwo.cn/api/www/playlist/playListInfo?pid=3677150229&pn=1&rn=10&httpsStatus=1'],['mgRank','https://app.c.nf.migu.cn/pc/bmw/rank/rank-detail/v1.0?rankId=83048887&pageNo=1&pageSize=10'],['mgPlaylist','https://app.c.nf.migu.cn/pc/bmw/playlist/playlist-detail/v1.0?playlistId=235048514&pageNo=1&pageSize=10'],['mgOldPlaylist','https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0?pageNo=1&pageSize=10&playlistId=235048514']]
   await Promise.all(endpoints.map(async([name,url])=>{const result=await app.evaluate(async({net},{url})=>{try{const r=await net.fetch(url,{headers:{'user-agent':'Mozilla/5.0','referer':'https://www.kuwo.cn/'},signal:AbortSignal.timeout(15000)});return {status:r.status,text:(await r.text()).slice(0,7000)}}catch(e){return {error:e.message}}},{url});console.log('RAW_'+name+'='+JSON.stringify(result))}));return
  }
  if(process.argv.includes('--raw3')){
   const endpoints=[['wyNew','https://music.163.com/api/playlist/list?cat=%E5%85%A8%E9%83%A8&order=new&offset=0&limit=24&total=true'],['kgFull','https://mobiles.kugou.com/api/v3/special/song?specialid=3823475&page=1&pagesize=100&version=9108&plat=0'],['kgFullAlt','https://specialrec.kugou.com/api/v3/special/song?specialid=3823475&page=1&pagesize=100&version=9108&plat=0'],['kgComments','https://comment.service.kugou.com/index.php?r=commentsv2/getCommentWithLike&code=fc4be23b4e972707f36b8a828a93ba8a&p=1&pagesize=20&ver=1.01&clientver=8373&kugouid=0&appid=1001&extdata=37A8F50A9EC3B267C3CC6BEC633D9C4A']]
   await Promise.all(endpoints.map(async([name,url])=>{const result=await app.evaluate(async({net},{url})=>{try{const r=await net.fetch(url,{signal:AbortSignal.timeout(15000)});const text=await r.text();let parsed;try{const d=JSON.parse(text);parsed={code:d.code??d.errcode??d.err_code,dataKeys:Object.keys(d.data??{}),total:d.data?.total,count:d.data?.info?.length,sample:d.data?.info?.[0]}}catch{}return {status:r.status,parsed,text:text.slice(0,1000)}}catch(e){return {error:e.message}}},{url});console.log('RAW_'+name+'='+JSON.stringify(result))}));return
  }
  if(!process.argv.includes('--built')){
   const esbuild=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite'))]})),bundle=path.join(temp,'providers.cjs')
   esbuild.buildSync({entryPoints:[path.resolve('electron/main/services/providers.ts')],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:bundle})
   await app.evaluate(({ipcMain},bundle)=>{globalThis.__providers=process.getBuiltinModule('module').createRequire(bundle)(bundle);const p=globalThis.__providers;ipcMain.removeHandler('chenjin:invoke');ipcMain.handle('chenjin:invoke',async(_event,method,x={})=>{switch(method){case 'search':return p.search(x.source,x.keyword,x.page,x.limit);case 'discovery.playlists':return p.getPlaylists(x.source,x.page,x.tag,x.sort);case 'discovery.playlist':return p.getPlaylist(x.source,x.id);case 'discovery.boards':return p.getBoards(x.source);case 'discovery.board':return p.getBoardTracks(x.source,x.id,x.page);case 'lyrics':return p.getLyrics(x.track);case 'comments':return p.getComments(x.track,x.page);case 'search.hot':return p.getHotSearch(x.source);case 'search.suggest':return p.getSuggestions(x.source,x.keyword);default:throw new Error('probe method not allowed')}})},bundle)
   report.environment.transport='latest provider bundle through test-only real IPC handler'
  }
  const measure=async(action)=>{const start=Date.now();try{const value=await action();return {ok:true,elapsedMs:Date.now()-start,value}}catch(error){return {ok:false,elapsedMs:Date.now()-start,error:error.message}}}
  await Promise.all(sources.map(async source=>{
   const result=report.sources[source]={}
   const [songs,playlists,boards,hot]=await Promise.all([measure(()=>call('search',{source,keyword:'周杰伦',page:1,limit:5})),measure(()=>call('discovery.playlists',{source,page:1})),measure(()=>call('discovery.boards',{source})),measure(()=>call('search.hot',{source}))])
   result.search=songs;result.playlists=playlists;result.boards=boards;result.hot=hot
   const track=songs.ok?songs.value.list?.[0]:null,playlist=playlists.ok?playlists.value?.[0]:null,board=boards.ok?boards.value?.[0]:null
   if(track){result.lyrics=await measure(()=>call('lyrics',{track}));result.comments=await measure(()=>call('comments',{track,page:1}));result.page2=await measure(()=>call('search',{source,keyword:'周杰伦',page:2,limit:5}))}
   if(playlist)result.playlistDetail=await measure(()=>call('discovery.playlist',{source,id:playlist.id}))
   if(board)result.boardTracks=await measure(()=>call('discovery.board',{source,id:board.id,page:1}))
   if(!process.argv.includes('--built')){
    result.playlistSearch=await measure(()=>app.evaluate(async(_electron,{source})=>globalThis.__providers.searchPlaylists(source,'周杰伦',1,5),{source}))
    result.tags=await measure(()=>app.evaluate(async(_electron,{source})=>globalThis.__providers.getPlaylistTags(source),{source}))
    if(result.tags.ok&&result.tags.value.length){const tag=result.tags.value.find(t=>source!=='kw'||t.id.endsWith('-10000'))??result.tags.value[0];result.taggedPlaylists=await measure(()=>call('discovery.playlists',{source,page:1,tag:tag.id}))}
    result.playlistsPage2=await measure(()=>call('discovery.playlists',{source,page:2}))
    if(result.playlistsPage2.ok&&playlists.ok){const ids=new Set(playlists.value.map(p=>p.id));result.playlistPaging={ok:result.playlistsPage2.value.some(p=>!ids.has(p.id)),value:{page1:playlists.value.slice(0,3).map(p=>p.id),page2:result.playlistsPage2.value.slice(0,3).map(p=>p.id)}}}
    if(['kw','tx','wy'].includes(source))result.newPlaylists=await measure(()=>call('discovery.playlists',{source,page:1,sort:'new'}))
    result.suggestions=await measure(()=>call('search.suggest',{source,keyword:'周杰伦'}))
    if(track){result.details=await measure(()=>app.evaluate(async(_electron,{track})=>globalThis.__providers.getTrackDetails(track),{track}));if(track.meta.albumId)result.album=await measure(()=>app.evaluate(async(_electron,{source,id})=>globalThis.__providers.getAlbum(source,String(id),1,10),{source,id:track.meta.albumId}));if(track.meta.singerIds?.[0])result.singer=await measure(()=>app.evaluate(async(_electron,{source,id})=>globalThis.__providers.getSinger(source,String(id),1,10),{source,id:track.meta.singerIds[0]}))}
   }
   if(result.page2?.ok&&songs.ok){const a=new Set(songs.value.list.map(t=>t.id));result.searchPaging={ok:result.page2.value.list.some(t=>!a.has(t.id)),value:{page1:songs.value.list.map(t=>t.id),page2:result.page2.value.list.map(t=>t.id)}}}
   console.log(JSON.stringify({source,summary:Object.fromEntries(Object.entries(result).map(([key,v])=>[key,v.ok?{ok:true,count:Array.isArray(v.value)?v.value.length:v.value?.list?.length??v.value?.tracks?.length??v.value?.lyric?.length,ms:v.elapsedMs}:v]))}))
  }))
  report.aggregate=await measure(()=>call('search',{source:'all',keyword:'周杰伦',page:1,limit:5}))
  report.finishedAt=new Date().toISOString()
  const summarize=(value)=>{if(Array.isArray(value))return {count:value.length,sample:value.slice(0,2)};if(value&&typeof value==='object'){const out={...value};if(Array.isArray(out.list))out.list={count:out.list.length,sample:out.list.slice(0,2)};if(Array.isArray(out.tracks))out.tracks={count:out.tracks.length,sample:out.tracks.slice(0,2)};if(typeof out.lyric==='string')out.lyric={characters:out.lyric.length,sample:out.lyric.slice(0,200)};return out}return value}
  for(const results of Object.values(report.sources))for(const result of Object.values(results))if(result.ok)result.value=summarize(result.value)
  if(report.aggregate.ok)report.aggregate.value=summarize(report.aggregate.value)
  if(process.argv.includes('--record')){
   const keys=['search','page2','searchPaging','playlists','playlistDetail','boards','boardTracks','lyrics','comments','hot','playlistSearch','tags','taggedPlaylists','playlistsPage2','playlistPaging','newPlaylists','suggestions','album','singer']
   const cell=r=>!r?'—':!r.ok?`不可用：${r.error?.split('\n')[0].replace(/^.*Error: /,'')??'分页结果重复'}`:`有响应 ${r.value?.count??r.value?.list?.count??r.value?.tracks?.count??r.value?.lyric?.characters??''}`
   const header='# 在线平台真实探测记录\n\n'+`采集时间：${report.startedAt} → ${report.finishedAt}。真实 Electron、独立临时 USER_DATA、未登录账户；关键词“周杰伦”，歌曲与歌单搜索 limit=5，专辑/歌手 limit=10。成功仅表示本次公开接口返回真实数据，不表示所有歌曲可播放或所有榜单完整。核心方法经测试专用真实 IPC，新增方法在 Electron 主进程执行同一临时源码 bundle。探测不修改发布构建。\n\n`
   const table='| 能力 | 酷我 | 酷狗 | QQ | 网易 | 咪咕 |\n|---|---|---|---|---|---|\n'+keys.map(key=>'| '+key+' | '+sources.map(source=>cell(report.sources[source][key])).join(' | ')+' |').join('\n')
   const notes='\n\n## 边界与接口\n\n- 酷狗官方评论域名若报证书域名错误，保持 TLS 校验并返回不可用；不会通过禁用证书绕过。\n- 酷狗歌单详情使用 mobiles.kugou.com 官方 API 连续页读取并核对 total；榜单网页 API 每页30首。酷我/QQ/咪咕按声明总数读取全部页；网易按trackIds补齐歌曲，不把缺失歌曲当作完整歌单。\n- 酷我/咪咕歌手详情未找到原协议公开支持，明确拒绝。咪咕热搜明确未支持。\n- configureProxy(proxy) 使用 Electron defaultSession.setProxy；空值使用系统代理，支持HTTP/HTTPS/SOCKS4/SOCKS5，不接受地址中的认证凭据。\n- 详情缓存上限200条、5分钟，标签缓存1小时；失败不会缓存。聚合 failures记录逐源失败，全失败拒绝。\n- getPlaylists(source,page,tag,sort)；searchPlaylists(source,keyword,page,limit)；getPlaylistTags(source)；getTrackDetails(track)；getAlbum/getSinger(source,id,page,limit)；clearProviderCache()。\n\n## 原始探测摘要及样本\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n'
   await fs.mkdir('docs',{recursive:true});await fs.writeFile('docs/PROVIDER_STATUS.md',header+table+notes)
  }
  console.log('PROVIDER_REPORT='+JSON.stringify(report,null,2))
 }finally{await app.close();await fs.rm(temp,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
