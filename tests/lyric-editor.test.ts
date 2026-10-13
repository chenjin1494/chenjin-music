import {describe,expect,it}from 'vitest'
import {changeLyricRow,documentBytes,formatLyricTimestamp,lyricDocument,LyricEditorHistory,previewLyricText,shiftAllLyrics,shiftLyricText,validateLyricDocument}from '../src/renderer/src/domain/lyric-editor'
describe('lyric editor timing and history',()=>{
 it('formats milliseconds and shifts repeated LRC tags without touching metadata or lyric text',()=>{
  expect(formatLyricTimestamp(62345)).toBe('[01:02.345]')
  expect(formatLyricTimestamp(-20)).toBe('[00:00.000]')
  const raw='[ar:歌手]\n[offset:120]\n[00:01.23][00:03]歌 (123,4)\n[ti:标题]'
  expect(shiftLyricText(raw,100)).toBe('[ar:歌手]\n[offset:120]\n[00:01.330][00:03.100]歌 (123,4)\n[ti:标题]')
  expect(()=>formatLyricTimestamp(Infinity)).toThrow()
 })
 it('preserves LX/KRC relative word offsets and durations',()=>{
  const raw='[offset:20]\n[00:01.000]<0,200>你<200,300>好\n[3000,600]<0,300,0>世<300,300,0>界'
  expect(shiftLyricText(raw,500,'lxlyric')).toBe('[offset:20]\n[00:01.500]<0,200>你<200,300>好\n[3500,600]<0,300,0>世<300,300,0>界')
  expect(previewLyricText(shiftLyricText(raw,500,'lxlyric'),'lxlyric')[0].words?.map(word=>word.text)).toEqual(['你','好'])
 })
 it('moves YRC and QRC absolute word starts with line starts, preserving durations',()=>{
  expect(shiftLyricText('[1000,900](1000,400,0)你(1400,500,0)好',200,'lxlyric')).toBe('[1200,900](1200,400,0)你(1600,500,0)好')
  expect(shiftLyricText('[00:01.000]你(1000,400)好(1400,500)',-200,'lxlyric')).toBe('[00:00.800]你(800,400)好(1200,500)')
  expect(shiftLyricText('[100,900](100,400,0)你(500,500,0)好',-200,'lxlyric')).toBe('[0,900](0,400,0)你(400,500,0)好')
 })
 it('applies the global edit to all four variants and keeps offset tags unchanged',()=>{
  const doc=lyricDocument({lyric:'[offset:50]\n[00:01]原',tlyric:'[00:01]译',rlyric:'[00:01]roma',lxlyric:'[00:01]<0,1000>原'})
  const shifted=shiftAllLyrics(doc,100)
  expect(shifted.lyric).toBe('[offset:50]\n[00:01.100]原')
  expect(shifted.tlyric).toBe('[00:01.100]译')
  expect(shifted.rlyric).toBe('[00:01.100]roma')
  expect(shifted.lxlyric).toBe('[00:01.100]<0,1000>原')
  expect(doc.lyric).toBe('[offset:50]\n[00:01]原')
 })
 it('calibrates only the selected line using source offset and can timestamp untimed LRC',()=>{
  const raw='[offset:100]\n[00:01.000]一\n[00:02.000]二'
  expect(changeLyricRow(raw,2,3200)).toBe('[offset:100]\n[00:01.000]一\n[00:03.100]二')
  expect(changeLyricRow(raw,1,-100,'shift')).toBe('[offset:100]\n[00:00.900]一\n[00:02.000]二')
  expect(changeLyricRow('尚无时间戳',0,1200)).toBe('[00:01.200]尚无时间戳')
  expect(()=>changeLyricRow('[ar:艺人]',0,1200)).toThrow(/元信息/)
  expect(()=>changeLyricRow('没有字级时间',0,1200,'set','lxlyric')).toThrow(/字级/)
  expect(()=>changeLyricRow(raw,9,1)).toThrow(/有效/)
 })
 it('validates bad time formats and combined UTF8 size while allowing plain text and metadata',()=>{
  const valid=lyricDocument({lyric:'[ar:艺人]\n[custom:保留]\n[00:01]歌\n纯文本'})
  expect(validateLyricDocument(valid).filter(issue=>issue.level==='error')).toEqual([])
  expect(validateLyricDocument(lyricDocument({lyric:'[00:99]错误\n[00:ab]错误'})).filter(issue=>issue.level==='error')).toHaveLength(2)
  expect(validateLyricDocument(lyricDocument({lyric:'[00:01][00:ab]错误'})).some(issue=>issue.level==='error')).toBe(true)
  const large=lyricDocument({lyric:'中'.repeat(700000)})
  expect(documentBytes(large)).toBe(2100000)
  expect(validateLyricDocument(large)[0].message).toMatch(/2MB/)
  expect(()=>new LyricEditorHistory(valid).commit(large)).toThrow(/2MB/)
  expect(previewLyricText(`[${'9'.repeat(400)}:00]bad`,'lyric')).toEqual([])
 })
 it('supports undo/redo, clears redo after new input, and caps history count',()=>{
  const initial=lyricDocument({lyric:'one'}),history=new LyricEditorHistory(initial,3)
  history.commit({...initial,lyric:'two'});history.commit({...initial,lyric:'three'})
  expect(history.undo().lyric).toBe('two');expect(history.redo().lyric).toBe('three')
  history.undo();history.commit({...initial,lyric:'branch'});expect(history.canRedo).toBe(false)
  history.commit({...initial,lyric:'four'});expect(history.length).toBe(3)
  const current=history.current;current.lyric='external mutation';expect(history.current.lyric).toBe('four')
  expect(history.commit(history.current)).toBe(false)
 })
 it('bounds history memory and rejects nonfinite adjustment input',()=>{
  const doc=lyricDocument({lyric:'a'.repeat(100)}),history=new LyricEditorHistory(doc,50,250)
  for(let index=0;index<10;index++)history.commit({...doc,lyric:'a'.repeat(100)+index})
  expect(history.length).toBe(2);expect(history.canUndo).toBe(true)
  expect(()=>shiftAllLyrics(doc,NaN)).toThrow()
  expect(()=>shiftLyricText('[00:00]a',86400001)).toThrow()
 })
})
