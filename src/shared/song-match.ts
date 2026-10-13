import type { Track } from './types'
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\([^)]*(?:live|remix|伴奏|翻唱)[^)]*\)/g,'$&').replace(/[\s\p{P}\p{S}]/gu,'')
export function songMatchScore(target:Track,candidate:Track):number {
 const a=normalize(target.name),b=normalize(candidate.name)
 if(a!==b)return 0
 const singerA=normalize(target.singer),singerB=normalize(candidate.singer)
 if(singerA!==singerB)return 0
 const da=Number(target.meta.duration)||0,db=Number(candidate.meta.duration)||0
 if(da&&db&&Math.abs(da-db)>8)return 0
 return 100+(target.meta.albumName&&normalize(target.meta.albumName)===normalize(candidate.meta.albumName)?20:0)+(da&&db?Math.max(0,8-Math.abs(da-db)):0)
}
export function rankAlternativeTracks(target:Track,tracks:Track[]):Track[]{return tracks.filter(track=>track.source!==target.source).map(track=>({track,score:songMatchScore(target,track)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).map(item=>item.track)}
