import { app } from 'electron'
import { search,getLyrics,getComments,getPlaylistTags,getPlaylists,getHotSearch } from '../electron/main/services/providers'
import { parseTimedLyrics } from '../src/renderer/src/domain/lyrics'
const keepAlive=setInterval(()=>{},1000)
app.whenReady().then(async()=>{
 for(const source of ['kg','tx','mg','kw','wy'] as const){try{const song=(await search(source,'周杰伦 晴天',1,1)).list[0];for(const kind of ['normal','hot'] as const)try{const list=await getComments(song,1,kind);console.log('COMMENT_PROBE',JSON.stringify({source,kind,count:list.length,replyCount:list.reduce((n,c)=>n+(c.reply?.length||0),0),imageCount:list.reduce((n,c)=>n+(c.images?.length||0),0),first:list[0]}))}catch(e){console.log('COMMENT_ERROR',source,kind,String(e))}}catch(e){console.log('SEARCH_ERROR',source,String(e))}}
 try{const tags=await getPlaylistTags('kg');console.log('KG_TAGS',tags.length,JSON.stringify(tags.slice(0,3)));for(const sort of ['5','6','7','3','8'])try{const list=await getPlaylists('kg',1,'',sort);console.log('KG_SORT',sort,list.length,JSON.stringify(list.slice(0,2)))}catch(e){console.log('KG_SORT_ERROR',sort,String(e))}}catch(e){console.log('KG_TAG_ERROR',String(e))}
 try{console.log('MG_HOTSEARCH',JSON.stringify(await getHotSearch('mg')))}catch(e){console.log('MG_HOT_ERROR',String(e))}
 for(const source of ['kg','tx','mg','kw'] as const)for(const term of ['YOASOBI アイドル','Adele Hello']){try{const found=await search(source,term,1,2);for(const song of found.list)try{const l=await getLyrics(song);console.log('EXTENDED_LYRIC',JSON.stringify({source,name:song.name,id:song.meta.songId,wordLines:parseTimedLyrics(l.lxlyric).length,translation:l.tlyric?.split('\n').length||0,roman:l.rlyric?.split('\n').length||0}));if(l.tlyric||l.rlyric)break}catch(e){console.log('EXTENDED_ERROR',source,String(e))}}catch(e){console.log('EXTENDED_SEARCH_ERROR',source,String(e))}}
 console.log('EXTENSION_PROBE_DONE');clearInterval(keepAlive);app.quit()
})
