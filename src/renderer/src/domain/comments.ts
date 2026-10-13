import type { Comment } from '../../../shared/types'

/** Only remote image resources supplied by the provider, never HTML/data/script URLs. */
export function commentImageURL(value:unknown):string|null {
 if(typeof value!=='string'||!value.trim())return null
 try{const url=new URL(value.startsWith('//')?`https:${value}`:value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null}catch{return null}
}
export function commentRootId(comment:Comment):string {return String(comment.rootId??'').trim()||String(comment.id??'').trim()}
export function canFetchCommentReplies(source:string,comment:Comment,depth:number):boolean {return ['kg','mg'].includes(source)&&depth<4&&!!commentRootId(comment)}
/** A modal/component owns its epoch; tab, track, page and disposal invalidate older work. */
export class CommentLoadEpoch {
 private epoch=0
 next():number{return ++this.epoch}
 isCurrent(ticket:number):boolean{return ticket===this.epoch}
 invalidate():void{this.epoch++}
}
