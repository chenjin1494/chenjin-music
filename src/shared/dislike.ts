import type { Track } from './types'
const clean=(text:string)=>text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLocaleLowerCase()
export function dislikeRule(track:Track):string{return `${track.name}@${track.singer}`}
export function isDisliked(track:Track,rules:string[]):boolean {
 const name=clean(track.name),singer=clean(track.singer)
 return rules.some(rule=>{
  if(rule===track.id)return true
  const index=rule.lastIndexOf('@')
  if(index<0)return clean(rule)===name
  const song=clean(rule.slice(0,index)),artist=clean(rule.slice(index+1))
  return (!song||song===name)&&(!artist||artist===singer)
 })
}
export function similarityKey(track:Track):string{return `${clean(track.name)}@${clean(track.singer)}`}
