import{afterEach,describe,expect,it}from 'vitest'
import{mkdtemp,mkdir,writeFile,readFile,rm,symlink}from 'node:fs/promises'
import path from 'node:path'
import{tmpdir}from 'node:os'
import{defaultSettings}from '../src/shared/defaults'
import{migrateLegacyPreferences}from '../electron/main/services/legacy-preferences'
import{parseTheme}from '../src/renderer/src/domain/theme'
import{parseEffect}from '../src/renderer/src/domain/effects'
const roots:string[]=[]
async function fixture():Promise<string>{const dir=await mkdtemp(path.join(tmpdir(),'chenjin-legacy-preferences-'));roots.push(dir);return dir}
async function json(dir:string,name:string,value:unknown):Promise<void>{await writeFile(path.join(dir,name),JSON.stringify(value))}
afterEach(async()=>{for(const dir of roots.splice(0)){if(path.resolve(dir)!==dir||!dir.startsWith(path.join(tmpdir(),'chenjin-legacy-preferences-')))throw new Error('Unexpected cleanup target');await rm(dir,{recursive:true,force:true})}})
const eq=(name='保留中文')=>({id:'1',name,...Object.fromEntries([31,62,125,250,500,1000,2000,4000,8000,16000].map((hz,index)=>[`hz${hz}`,index-4]))})
const theme=(image='none')=>({id:'own',name:'我的主题',isDark:true,isDarkFont:false,config:{themeColors:{'--color-primary':'#123456','--color-050':'rgb(250,240,230)','--color-450':'#888','--color-primary-light-1000':'#010203'},extInfo:{'--color-main-background':'var(--color-primary-light-1000)','--color-app-background':'#112233','--background-image':image}}})
function wav():Buffer{const data=Buffer.alloc(48);data.write('RIFF');data.writeUInt32LE(40,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(44100,24);data.writeUInt32LE(88200,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(4,40);return data}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=','base64')
describe('read-only LX preference migration',()=>{
 it('restores ten-band presets, retains duplicate names and warns about unsupported/clipped data',async()=>{
  const dir=await fixture(),data={eqPreset:[eq(),eq(),{...eq('限幅'),hz31:99},{name:'坏数据'}],convolutionPreset:[{id:'r',name:'内置响应',source:'matrix-reverb1.wav',mainGain:15,sendGain:9}]}
  await json(dir,'sound_effect.json',data);const settings={...defaultSettings,effectUserPresets:{}}
  const before=JSON.stringify(settings),original=await readFile(path.join(dir,'sound_effect.json'),'utf8'),result=await migrateLegacyPreferences(settings,dir),presets=result.effectUserPresets as Record<string,unknown>
  expect(Object.keys(presets)).toHaveLength(3);expect(parseEffect(presets['保留中文']).eq).toEqual([-4,-3,-2,-1,0,1,2,3,4,5]);expect(parseEffect(presets['限幅']).eq[0]).toBe(15)
  expect(String(result.legacyMigrationWarnings)).toMatch(/重复|同名/);expect(String(result.legacyMigrationWarnings)).toMatch(/无法恢复/);expect(String(result.legacyMigrationWarnings)).toMatch(/IR切换/)
  expect(JSON.stringify(settings)).toBe(before);expect(await readFile(path.join(dir,'sound_effect.json'),'utf8')).toBe(original)
 })
 it('converts actual prefixed LX actions into local code bindings and Electron accelerators',async()=>{
  const dir=await fixture();await json(dir,'hot_key.json',{local:{enable:true,keys:{'mod+arrowleft':{action:'player_prev'},'ctrl+left':{action:'player_next'},'mod+alt+m':{action:'player_volume_mute'},'ctrl+x':{action:'not_real'},'ctrl+constructor':{action:'player_toggle_play'},f1:{action:'common_focus_search_input'}}},global:{enable:true,keys:{'mod+alt+arrowleft':{action:'player_prev'},'mod+alt+-':{action:'desktop_lyric_toggle_lock'},'mod+alt+=':{action:'desktop_lyric_toggle_always_top'},'ctrl+/':{action:'player_music_love'}}}})
  const result=await migrateLegacyPreferences({...defaultSettings},dir),local=result.shortcuts as Record<string,string>,global=result.globalHotkeys as Record<string,string>
  expect(local.previous).toBe(process.platform==='darwin'?'Meta+ArrowLeft':'Ctrl+ArrowLeft');expect(local.mute).toBe(process.platform==='darwin'?'Alt+Meta+KeyM':'Ctrl+Alt+KeyM');expect(local.search).toBe('F1');expect(local.toggle).toBe('')
  expect(global.collect).toBe('Ctrl+/');expect(global.prev).toBe('CommandOrControl+Alt+Left');expect(global.lyricLock).toBe('CommandOrControl+Alt+-');expect(global.lyricTop).toBe('CommandOrControl+Alt+=');expect(String(result.legacyMigrationWarnings)).toMatch(/未支持/)
  if(process.platform!=='darwin')expect(String(result.legacyMigrationWarnings)).toMatch(/重复/)
 })
 it('keeps disabled legacy shortcuts disabled rather than enabling new defaults',async()=>{
  const dir=await fixture();await json(dir,'hot_key.json',{local:{enable:false,keys:{space:{action:'player_toggle_play'}}},global:{enable:false,keys:{'mod+f5':{action:'player_toggle_play'}}}})
  const result=await migrateLegacyPreferences({...defaultSettings},dir);expect(Object.values(result.shortcuts as object).every(value=>value==='')).toBe(true);expect(result.globalHotkeys).toEqual({});expect(result.legacyHotkeys).toBeTruthy()
 })
 it('restores real data-directory IR bytes and translates separate dry/wet gains accurately',async()=>{
  const dir=await fixture(),bytes=wav();await writeFile(path.join(dir,'response.wav'),bytes);await json(dir,'config_v2.json',{setting:{'player.soundEffect.convolution.fileName':'response.wav','player.soundEffect.convolution.mainGain':13,'player.soundEffect.convolution.sendGain':10}})
  const result=await migrateLegacyPreferences({...defaultSettings},dir),mix=Number(result.reverb),dry=Number(result.reverbDryGain),wet=Number(result.reverbWetGain)
  expect(Buffer.from(String(result.impulseResponseBase64),'base64')).toEqual(bytes);expect(result.impulseResponseName).toBe('response.wav');expect(Math.cos(mix*Math.PI/2)*dry).toBeCloseTo(1.3);expect(Math.sin(mix*Math.PI/2)*wet).toBeCloseTo(1)
 })
 it('does not substitute a generated response for a missing bundled WAV',async()=>{
  const dir=await fixture();await json(dir,'config_v2.json',{setting:{'player.soundEffect.convolution.fileName':'matrix-reverb1.wav'}})
  const result=await migrateLegacyPreferences({...defaultSettings,reverb:.5},dir);expect(result.impulseResponseBase64).toBe('');expect(result.reverb).toBe(0);expect(result.legacyImpulseResponseReference).toBe('matrix-reverb1.wav');expect(String(result.legacyMigrationWarnings)).toMatch(/未恢复活动卷积/)
 })
 it('restores selected custom themes and embeds actual theme_images resources',async()=>{
  const dir=await fixture();await mkdir(path.join(dir,'theme_images'));await writeFile(path.join(dir,'theme_images','one.png'),png);await json(dir,'theme.json',{themes:[theme('one.png')]});await json(dir,'config_v2.json',{setting:{'theme.id':'own'}})
  const result=await migrateLegacyPreferences({...defaultSettings},dir),collection=result.userThemes as Record<string,unknown>,converted=parseTheme(collection['我的主题'])
  expect(converted.background).toBe(`data:image/png;base64,${png.toString('base64')}`);expect(converted.colors.bg).toBe('#010203');expect(converted.colors.text).toBe('#faf0e6');expect(converted.accent).toBe('#123456');expect(result.themeBackground).toBe(converted.background);expect(result.theme).toBe('dark')
 })
 it('preserves remote/outside references and blocks symlink resource escapes without fetching',async()=>{
  const dir=await fixture(),outside=await fixture();await writeFile(path.join(outside,'outside.png'),png);await symlink(outside,path.join(dir,'theme_images'),'junction')
  await json(dir,'theme.json',{themes:[theme('outside.png'),{...theme('https://example.test/background.jpg'),id:'remote',name:'remote'}]})
  const result=await migrateLegacyPreferences({...defaultSettings},dir),collection=result.userThemes as Record<string,any>
  expect(collection['我的主题'].background).toBe('');expect(collection.remote.background).toBe('');expect(result.legacyThemeReferences).toEqual({'我的主题':'outside.png',remote:'https://example.test/background.jpg'});expect(String(result.legacyMigrationWarnings)).toMatch(/指向目录外/)
 })
 it('reports corrupt JSON and unsupported automatic custom-theme switching without discarding base settings',async()=>{
  const dir=await fixture();await writeFile(path.join(dir,'sound_effect.json'),'{broken');await json(dir,'theme.json',{themes:[theme()]});await json(dir,'config_v2.json',{setting:{'theme.id':'auto','theme.darkId':'own','theme.lightId':'green'}})
  const result=await migrateLegacyPreferences({...defaultSettings},dir);expect(result.theme).toBe('system');expect(String(result.legacyMigrationWarnings)).toMatch(/无法迁移/);expect(String(result.legacyMigrationWarnings)).toMatch(/不能自动切换/);expect(result.volume).toBe(defaultSettings.volume)
 })
})
