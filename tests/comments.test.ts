import {describe,expect,it}from 'vitest'
import {canFetchCommentReplies,commentImageURL,commentRootId,CommentLoadEpoch}from '../src/renderer/src/domain/comments'
const comment={id:'child',author:'播放',text:'<script>alert(1)</script>设置',time:'today',likes:0,rootId:'root'}
describe('comment UI request lifecycle and limits',()=>{
 it('accepts provider remote images and rejects executable or invalid sources',()=>{
  expect(commentImageURL('https://example.test/avatar?a=1')).toBe('https://example.test/avatar?a=1')
  expect(commentImageURL('//example.test/image.jpg')).toBe('https://example.test/image.jpg')
  for(const url of ['javascript:alert(1)','data:text/html,<script>','file:///C:/private.png','not-a-url','https://user:pass@example.test/image'])expect(commentImageURL(url)).toBeNull()
 })
 it('fetches only supported KG/MG reply roots below the nesting boundary',()=>{
  expect(commentRootId(comment)).toBe('root')
  expect(commentRootId({...comment,rootId:''})).toBe('child')
  expect(canFetchCommentReplies('kg',comment,3)).toBe(true)
  expect(canFetchCommentReplies('mg',comment,4)).toBe(false)
  for(const source of ['kw','wy','tx','local'])expect(canFetchCommentReplies(source,comment,0)).toBe(false)
  expect(canFetchCommentReplies('kg',{...comment,id:'',rootId:''},0)).toBe(false)
 })
 it('prevents delayed old track/tab/page results and disposed components from winning',async()=>{
  const epoch=new CommentLoadEpoch(),visible:string[]=[]
  let finishOld!:(value:string)=>void
  const old=epoch.next(),slow=new Promise<string>(resolve=>{finishOld=resolve}).then(value=>{if(epoch.isCurrent(old))visible.push(value)})
  const current=epoch.next();if(epoch.isCurrent(current))visible.push('current popular comments')
  finishOld('previous normal comments');await slow
  expect(visible).toEqual(['current popular comments'])
  epoch.invalidate();expect(epoch.isCurrent(current)).toBe(false)
 })
})
