import {describe,expect,it}from 'vitest'
import {parseDeepLink}from '../electron/main/services/deeplink'
const link=(route:string,data:unknown,scheme='lxmusic')=>`${scheme}://${route}?data=${encodeURIComponent(JSON.stringify(data))}`
const song={source:'wy',name:'晴天',singer:'周杰伦',songmid:123,albumName:'叶惠美',img:'https://example.test/cover',interval:'4:29',types:[{type:'128k',size:'3M'},{type:'unknown',size:null}]}
describe('LX and Chenjin deep links',()=>{
 it('requires explicit legacy opt-in and accepts only known schemes/actions',()=>{
  expect(()=>parseDeepLink('lxmusic://player/play')).toThrow(/未启用/)
  expect(parseDeepLink('lxmusic://player/play',true)).toEqual({type:'player',action:'play'})
  for(const uri of ['https://player/play','chenjinmusic://player/erase','chenjinmusic://music/add','chenjinmusic://music/addAndPlay','chenjinmusic://songlist/import','chenjinmusic://unknown/open'])expect(()=>parseDeepLink(uri,true)).toThrow()
 })
 it('retains all eight exact original player actions',()=>{
  for(const action of ['play','pause','skipNext','skipPrev','togglePlay','collect','uncollect','dislike'])expect(parseDeepLink(`lxmusic://player/${action}`,true)).toEqual({type:'player',action})
  expect(()=>parseDeepLink('lxmusic://player/play/extra',true)).toThrow()
 })
 it('supports URI Chinese search paths and encoded JSON search data',()=>{
  expect(parseDeepLink('lxmusic://music/search/wy/%E6%99%B4%E5%A4%A9',true)).toEqual({type:'search',keyword:'晴天',source:'wy'})
  expect(parseDeepLink('lxmusic://music/search/周杰伦',true)).toEqual({type:'search',keyword:'周杰伦',source:null})
  expect(parseDeepLink(link('music/search',{keywords:123,source:'all'}),true)).toEqual({type:'search',keyword:'123',source:'all'})
  expect(parseDeepLink(link('music/search',{keywords:'晴天',source:'not-a-source'}),true)).toMatchObject({source:null})
  expect(parseDeepLink(`lxmusic://music/search/${'a'.repeat(140)}`,true)).toMatchObject({keyword:'a'.repeat(128)})
  expect(()=>parseDeepLink(link('music/search',{keywords:'a'.repeat(129)}),true)).toThrow(/过长/)
 })
 it('keeps plus signs and equals inside URI JSON values',()=>{
  expect(parseDeepLink('lxmusic://music/search?data='+encodeURIComponent(JSON.stringify({keywords:'C++=爱&歌?'})),true)).toMatchObject({keyword:'C++=爱&歌?'})
  expect(parseDeepLink('lxmusic://music/search?data={"keywords":"A+B=C"}',true)).toMatchObject({keyword:'A+B=C'})
 })
 it('normalizes original flattened music and validates provider-specific quality requirements',()=>{
  const result=parseDeepLink(link('music/play',song),true)
  expect(result.type).toBe('music');if(result.type!=='music'||result.action!=='play')throw new Error('wrong action')
  expect(result.tracks[0]).toMatchObject({id:'wy_123',name:'晴天',singer:'周杰伦',meta:{songId:123,albumName:'叶惠美',qualitys:[{type:'128k',size:'3M'}]}})
  expect(parseDeepLink(link('music/play',{...song,singer:''}),true)).toMatchObject({tracks:[{singer:''}]})
  expect(()=>parseDeepLink(link('music/play',{...song,singer:123}),true)).toThrow(/singer/)
  expect(()=>parseDeepLink(link('music/play',{...song,types:[]}),true)).toThrow(/音质/)
  expect(()=>parseDeepLink(link('music/play',{...song,source:'kg'}),true)).toThrow(/hash/)
  expect(parseDeepLink(link('music/play',{...song,source:'kg',hash:'abc',types:[{type:'flac',hash:'qhash',size:null}]}),true)).toMatchObject({tracks:[{meta:{hash:'abc',qualitys:[{hash:'qhash'}]}}]})
  expect(()=>parseDeepLink(link('music/play',{...song,source:'tx'}),true)).toThrow(/strMediaMid/)
  expect(parseDeepLink(link('music/play',{...song,source:'tx',strMediaMid:'media',albumMid:'album'}),true)).toMatchObject({tracks:[{meta:{strMediaMid:'media',albumMid:'album'}}]})
  expect(parseDeepLink(link('music/play',{...song,source:'mg',copyrightId:456,lrcUrl:'https://example.test/lyric'}),true)).toMatchObject({tracks:[{meta:{copyrightId:456,lrcUrl:'https://example.test/lyric'}}]})
 })
 it('preserves complete modern nested metadata and supports additional songs batches',()=>{
  const track={id:'tx_custom',name:'歌',singer:'歌手',source:'tx',interval:null,meta:{songId:'mid',albumName:'专辑',strMediaMid:'m',albumMid:'a',qualitys:[{type:'flac24bit',size:'42M'}],_qualitys:{flac24bit:{size:'42M',hash:'h'}},providerExtra:{codes:[1,2],token:'x'}}}
  const result=parseDeepLink(link('music/play',{songs:[track]},'chenjinmusic'))
  expect(result).toEqual({type:'music',action:'play',tracks:[track]})
  expect(track.meta.providerExtra).toEqual({codes:[1,2],token:'x'})
  expect(()=>parseDeepLink(link('music/play',{songs:[]},'chenjinmusic'))).toThrow(/数量/)
 })
 it('keeps searchPlay as a distinct resolving action and playLater append flag',()=>{
  expect(parseDeepLink('lxmusic://music/searchPlay/晴天%20-%20周杰伦',true)).toEqual({type:'music',action:'searchPlay',name:'晴天',singer:'周杰伦',albumName:'',interval:null,playLater:false})
  expect(parseDeepLink(link('music/searchPlay',{name:'歌',singer:'人',albumName:'专辑',interval:'3:00',playLater:true}),true)).toEqual({type:'music',action:'searchPlay',name:'歌',singer:'人',albumName:'专辑',interval:'3:00',playLater:true})
  expect(()=>parseDeepLink(link('music/searchPlay',{name:'歌',playLater:'true'}),true)).toThrow(/boolean/)
 })
 it('supports songlist IDs, encoded URLs and one-based play index',()=>{
  expect(parseDeepLink(link('songlist/open',{source:'wy',id:123}),true)).toEqual({type:'songlist',action:'open',source:'wy',link:'123'})
  const url='https://music.163.com/#/playlist?id=123&from=朋友'
  expect(parseDeepLink(`lxmusic://songlist/play/wy/${encodeURIComponent(url)}/3`,true)).toEqual({type:'songlist',action:'play',source:'wy',link:url,index:3})
  expect(parseDeepLink(link('songlist/play',{source:'tx',id:'id',index:0}),true)).toMatchObject({index:1})
  expect(parseDeepLink('lxmusic://songlist/play/kw/123/notnumber',true)).toEqual({type:'songlist',action:'play',source:'kw',link:'123'})
  expect(()=>parseDeepLink(link('songlist/play',{source:'wy',id:1,index:'2'}),true)).toThrow(/数字/)
  expect(()=>parseDeepLink('lxmusic://songlist/open/all/123',true)).toThrow(/来源/)
 })
 it('retains native simple search/play contracts including local modern tracks',()=>{
  expect(parseDeepLink('chenjinmusic://search?source=all&keyword=晴天')).toEqual({type:'search',source:'all',keyword:'晴天'})
  expect(parseDeepLink('chenjinmusic://play?source=wy&id=123&name=晴天&singer=周杰伦&album=叶惠美')).toMatchObject({type:'music',action:'play',tracks:[{name:'晴天',singer:'周杰伦',meta:{songId:'123',albumName:'叶惠美'}}]})
  const track={id:'local-song',name:'歌',singer:'',source:'local',interval:null,meta:{songId:'C:/歌.mp3',albumName:'',filePath:'C:/歌.mp3',ext:'mp3'}}
  expect(parseDeepLink('chenjinmusic://play?track='+encodeURIComponent(JSON.stringify(track)))).toEqual({type:'music',action:'play',tracks:[track]})
  expect(()=>parseDeepLink(link('music/play',track),true)).toThrow(/本地/)
 })
 it('rejects malformed/duplicate URI JSON, unimplemented base64 and strict byte-size boundary',()=>{
  for(const uri of ['chenjinmusic://search?keyword=%E0%A4%A','chenjinmusic://search?keyword=a&keyword=b','lxmusic://music/play?data=%7Bbad','lxmusic://music/play?data='+Buffer.from(JSON.stringify(song)).toString('base64'),'lxmusic://music/play?data='+encodeURIComponent('{"__proto__":{},"source":"wy"}')])expect(()=>parseDeepLink(uri,true)).toThrow()
  expect(()=>parseDeepLink('chenjinmusic://search?keyword='+'中'.repeat(5334))).toThrow(/过长/)
  expect(()=>parseDeepLink('chenjinmusic://search?keyword='+'a'.repeat(16000))).toThrow(/过长/)
  expect(()=>parseDeepLink(link('music/play',{...song,name:123}),true)).toThrow(/name/)
 })
})
