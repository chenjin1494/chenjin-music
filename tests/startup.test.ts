import { describe,it,expect } from 'vitest'
import { parseStartup,parsePlaylistLaunch } from '../electron/main/services/startup'
describe('startup compatibility',()=>{
 it('recognizes historical single-dash and modern double-dash flags',()=>{const options=parseStartup(['app','-hidden','--dha','-dhmkh','-search=晴天','-play=type=songList&source=myList&name=收藏&index=2','chenjinmusic://search?keyword=音乐']);expect(options.hidden).toBe(true);expect(options.disableHardwareAcceleration).toBe(true);expect(options.search).toBe('晴天');expect(options.links).toHaveLength(1);expect(parsePlaylistLaunch(options.play!)).toEqual({source:'myList',name:'收藏',link:undefined,index:1})})
 it('validates songlist launches and index boundaries',()=>{expect(parsePlaylistLaunch('type=unknown&source=wy')).toBeNull();expect(parsePlaylistLaunch('type=songList&source=wy&link=123&index=-1')?.index).toBe(0)})
})
