import { app } from 'electron'
import { search,getLyrics } from '../electron/main/services/providers'
import { parseTimedLyrics } from '../src/renderer/src/domain/lyrics'
app.commandLine.appendSwitch('no-sandbox')
app.whenReady().then(async()=>{
 const report:unknown[]=[]
 for(const source of ['kg','tx','mg','kw'] as const){
  try{const found=await search(source,'周杰伦 晴天',1,5);let success=false
   for(const song of found.list.slice(0,3))try{const lyrics=await getLyrics(song),timed=parseTimedLyrics(lyrics.lxlyric),item={source,name:song.name,singer:song.singer,id:song.meta.songId,meta:song.meta,lineCount:lyrics.lyric.split('\n').length,wordLines:timed.length,wordCount:timed.reduce((n,line)=>n+(line.words?.length||0),0),firstWords:timed[5]?.words?.slice(0,3),translation:!!lyrics.tlyric,roman:!!lyrics.rlyric};console.log('LYRIC_PROBE',JSON.stringify(item));report.push(item);if(timed.length){success=true;break}}catch(error){console.log('LYRIC_ERROR',source,song.meta.songId,String(error))}
   if(!success)console.log('NO_WORD_SAMPLE',source)
  }catch(error){console.log('SOURCE_ERROR',source,String(error))}
 }
 console.log('LYRIC_PROBE_DONE',JSON.stringify(report));app.quit()
})
