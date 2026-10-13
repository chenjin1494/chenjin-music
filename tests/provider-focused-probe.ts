import { app } from 'electron'
import { inflateSync } from 'node:zlib'
import { fetchBytes,queryURL } from '../electron/main/services/network'
import { getPlaylists,getPlaylistTags,getComments,search,getPlaylist } from '../electron/main/services/providers'
const keep=setInterval(()=>{},1000)
app.whenReady().then(async()=>{
 try{const data=(await fetchBytes('https://mlyric.kuwo.cn/mobi.s?f=web&type=lyric&lrcx=1&rid=268650423&encode=utf8')).bytes;const packed=inflateSync(data.subarray(data.indexOf('\r\n\r\n')+4));const key=Buffer.from('yeelion');console.log('KW_RAW',Buffer.from(packed.toString(),'base64').map((b,i)=>b^key[i%7]).toString().split('\n').slice(0,32).join('\n'))}catch(e){console.log('RAW_ERROR',String(e))}
 try{console.log('KG_TAGS',JSON.stringify((await getPlaylistTags('kg')).slice(0,4)));for(const sort of ['5','6','7','3','8'])try{const list=await getPlaylists('kg',1,'',sort);console.log('KG_SORT',sort,list.length,list[0]?.id);if(sort==='5'&&list.length)console.log('KG_PUBLIC', (await getPlaylist('kg',list[0].id)).tracks.length)}catch(e){console.log('SORT_ERROR',sort,String(e))}}catch(e){console.log('TAG_ERROR',String(e))}
 for(const source of ['kg','mg'] as const)try{const song=(await search(source,'周杰伦 晴天',1,1)).list[0];const hot=await getComments(song,1,'hot'),root=hot.find(c=>(c.replyCount||0)>0);if(root){const replies=await getComments(song,1,'reply',root.id);console.log('REPLY_PROBE',source,replies.length,replies[0]?.text)}}catch(e){console.log('REPLY_ERROR',source,String(e))}
 console.log('FOCUSED_DONE');clearInterval(keep);app.quit()
})
