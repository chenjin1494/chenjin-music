import { describe,it,expect } from 'vitest'
import { rankAlternativeTracks,songMatchScore } from '../src/shared/song-match'
const track=(source:any,name='晴天',singer='周杰伦',duration=240):any=>({id:source,name,singer,source,interval:'04:00',meta:{songId:1,albumName:'叶惠美',duration}})
describe('cross-source matching',()=>{
 it('requires same song version and artists with close duration',()=>{const target=track('wy');expect(songMatchScore(target,track('tx'))).toBeGreaterThan(0);expect(songMatchScore(target,track('tx','晴天 (Live)'))).toBe(0);expect(songMatchScore(target,track('tx','晴天','其他歌手'))).toBe(0);expect(songMatchScore(target,track('tx','晴天','周杰伦',300))).toBe(0);expect(rankAlternativeTracks(target,[track('wy'),track('tx')])).toHaveLength(1)})
})
