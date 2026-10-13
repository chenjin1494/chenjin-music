import { open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Settings } from '../../../src/shared/types'
import { parseEffect, type UserEffect } from '../../../src/renderer/src/domain/effects'
import { parseTheme, type ThemeFile } from '../../../src/renderer/src/domain/theme'
import { rendererDefaults } from '../../../src/renderer/src/domain/preferences'

const LIMIT=8*1024*1024
const frequencies=[31,62,125,250,500,1000,2000,4000,8000,16000]
type Data=Record<string,any>
const object=(value:unknown):Data=>value&&typeof value==='object'&&!Array.isArray(value)?value as Data:{}
const localActions:Record<string,string>={player_toggle_play:'toggle',player_next:'next',player_prev:'previous',player_seekbackward:'seekBack',player_seekforward:'seekForward',player_volume_up:'volumeUp',player_volume_down:'volumeDown',player_volume_mute:'mute',player_music_love:'collect',player_music_unlove:'uncollect',player_music_dislike:'dislike',common_min:'windowMinimize',common_toggle_min:'windowToggleMin',common_toggle_hide:'windowToggleHide',common_toggle_close:'windowClose',common_focus_search_input:'search',desktop_lyric_toggle_visible:'desktopLyric',desktop_lyric_toggle_lock:'desktopLock',desktop_lyric_toggle_always_top:'desktopTop'}
const globalActions:Record<string,string>={...localActions,player_prev:'prev',player_seekbackward:'seekBackward',desktop_lyric_toggle_visible:'lyric',desktop_lyric_toggle_lock:'lyricLock',desktop_lyric_toggle_always_top:'lyricTop'}
const codes:Record<string,string>={space:'Space',arrowleft:'ArrowLeft',left:'ArrowLeft',arrowright:'ArrowRight',right:'ArrowRight',arrowup:'ArrowUp',up:'ArrowUp',arrowdown:'ArrowDown',down:'ArrowDown',enter:'Enter',backspace:'Backspace',delete:'Delete',insert:'Insert',home:'Home',end:'End',pageup:'PageUp',pagedown:'PageDown',escape:'Escape',tab:'Tab','-':'Minus','=':'Equal',',':'Comma','.':'Period','/':'Slash',';':'Semicolon',"'":'Quote','[':'BracketLeft',']':'BracketRight','\\':'Backslash','`':'Backquote',numadd:'NumpadAdd',numsub:'NumpadSubtract',nummul:'NumpadMultiply',numdiv:'NumpadDivide',numdec:'NumpadDecimal',nument:'NumpadEnter',mediaplaypause:'MediaPlayPause',medianexttrack:'MediaTrackNext',mediaprevioustrack:'MediaTrackPrevious',mediastop:'MediaStop'}
function binding(input:string,global:boolean):string|null {
 const parts=input.toLowerCase().split('+'),key=parts.pop()||'',modifiers=new Set<string>()
 for(const modifier of parts){const name=({mod:global?'CommandOrControl':process.platform==='darwin'?'Meta':'Ctrl',ctrl:'Ctrl',control:'Ctrl',alt:'Alt',shift:'Shift',meta:global?'Super':'Meta',command:global?'Command':'Meta'} as Record<string,string>)[modifier];if(typeof name!=='string')return null;modifiers.add(name)}
 const code=Object.hasOwn(codes,key)?codes[key]:(/^[a-z]$/.test(key)?`Key${key.toUpperCase()}`:/^\d$/.test(key)?`Digit${key}`:/^f(?:[1-9]|1\d|2[0-4])$/.test(key)?key.toUpperCase():/^num\d$/.test(key)?`Numpad${key.slice(3)}`:'')
 if(!code||(!global&&['Escape','Tab'].includes(code)))return null
 const main=global?code.replace(/^Key|^Digit/,'').replace(/^Arrow/,'').replace('MediaTrackNext','MediaNextTrack').replace('MediaTrackPrevious','MediaPreviousTrack').replace('NumpadAdd','numadd').replace('NumpadSubtract','numsub').replace('NumpadMultiply','nummult').replace('NumpadDivide','numdiv').replace('NumpadDecimal','numdec').replace(/^Numpad(\d)$/,'num$1').replace('Minus','-').replace('Equal','=').replace('Comma',',').replace('Period','.').replace('Slash','/').replace('Semicolon',';').replace('Quote',"'").replace('BracketLeft','[').replace('BracketRight',']').replace('Backslash','\\').replace('Backquote','`'):code
 if(global&&code==='NumpadEnter')return null
 return [...(global?['CommandOrControl','Ctrl','Alt','Shift','Super','Command']:['Ctrl','Alt','Shift','Meta']).filter(name=>modifiers.has(name)),main].join('+')
}
function inside(root:string,target:string):boolean{const relative=path.relative(root,target);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative))}
function imageMime(data:Buffer):string|undefined{if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(data[0]===255&&data[1]===216&&data[2]===255)return 'image/jpeg';if(/^GIF8[79]a$/.test(data.subarray(0,6).toString()))return 'image/gif';if(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return 'image/webp'}
function audio(data:Buffer):boolean{return (data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WAVE')||['fLaC','OggS'].includes(data.subarray(0,4).toString())||data.subarray(0,3).toString()==='ID3'||data.subarray(4,8).toString()==='ftyp'||(data.length>1&&data[0]===255&&(data[1]&224)===224)}

/** Read-only migration. Call before persisting the imported state, after normalizing base settings. */
export async function migrateLegacyPreferences(settings:Settings,dataDirectory:string):Promise<Settings>{
 const result={...settings},warnings:string[]=[...(Array.isArray(settings.legacyMigrationWarnings)?settings.legacyMigrationWarnings.filter((value):value is string=>typeof value==='string'):[])]
 const warn=(message:string)=>{if(!warnings.includes(message))warnings.push(message)}
 let root:string
 try{root=await realpath(path.resolve(dataDirectory))}catch{warn('旧数据目录不存在，未迁移偏好');return {...result,legacyMigrationWarnings:warnings}}
 let assetBytes=0
 async function read(name:string):Promise<Buffer|null>{
  let candidate:string
  try{candidate=name.startsWith('file:')?fileURLToPath(name):path.resolve(root,name)}catch{warn(`资源路径无效：${name}`);return null}
  if(!inside(root,candidate)){warn(`保留外部资源引用，未读取目录外文件：${name}`);return null}
  let resolved:string
  try{resolved=await realpath(candidate)}catch(failure){if((failure as NodeJS.ErrnoException).code!=='ENOENT')warn(`无法解析旧资源 ${name}：${String(failure)}`);return null}
  if(!inside(root,resolved)){warn(`保留外部资源引用，未读取指向目录外的链接：${name}`);return null}
  const handle=await open(resolved,'r')
  try{const info=await handle.stat();if(!info.isFile()||info.size>LIMIT){warn(`旧文件不是普通文件或超过8MiB：${name}`);return null}const bytes=await handle.readFile();if(bytes.length>LIMIT){warn(`读取期间文件超过8MiB：${name}`);return null}return bytes}finally{await handle.close()}
 }
 async function json(name:string):Promise<Data|null>{try{const bytes=await read(name);if(!bytes)return null;const data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('不是JSON对象');return data}catch(failure){warn(`旧文件 ${name} 无法迁移：${String(failure)}`);return null}}
 const [sound,hotkeys,themes,configV2,configV1]=await Promise.all(['sound_effect.json','hot_key.json','theme.json','config_v2.json','config.json'].map(json))
 const config=configV2||configV1||{},legacy={...object(config.setting||config),...settings}
 if(sound)result.legacySoundEffects=sound;if(hotkeys)result.legacyHotkeys=hotkeys;if(themes)result.legacyThemes=themes
 if(sound&&sound.eqPreset!==undefined&&!Array.isArray(sound.eqPreset))warn('旧eqPreset不是数组，未恢复均衡预设')
 if(sound&&sound.convolutionPreset!==undefined&&!Array.isArray(sound.convolutionPreset))warn('旧convolutionPreset不是数组，保留原数据但未恢复卷积预设')
 if(themes&&themes.themes!==undefined&&!Array.isArray(themes.themes))warn('旧themes不是数组，未恢复主题集合')
 const unique=(name:string,collection:Data):string=>{let key=name.trim().slice(0,60)||'LX未命名预设';if(['__proto__','constructor','prototype'].includes(key))key+=' (LX)';if(Object.hasOwn(collection,key)){let suffix=2;while(Object.hasOwn(collection,`${key} (LX ${suffix})`))suffix++;warn(`同名预设保留为独立项目：${key}`);key+=` (LX ${suffix})`}return key}
 const convolution=Array.isArray(sound?.convolutionPreset)?sound.convolutionPreset:[]
 if(convolution.length){result.legacyConvolutionReferences=convolution.map((value:unknown)=>{const preset=object(value);return {id:preset.id,name:preset.name,source:preset.source,mainGain:preset.mainGain,sendGain:preset.sendGain}});warn('旧卷积预设引用已保留；新版音效预设不含IR切换，只有当前活动IR可恢复，不能将其它卷积预设伪装成相同音效')}
 const active=legacy['player.soundEffect.convolution.fileName']
 if(typeof active==='string'&&active){
  result.legacyImpulseResponseReference=active
  let bytes:Buffer|null=null;try{bytes=await read(active)}catch(failure){warn(`活动卷积响应无法读取：${String(failure)}`)}
  if(bytes&&audio(bytes)&&assetBytes+bytes.length<=24*1024*1024){
   assetBytes+=bytes.length;result.impulseResponseBase64=bytes.toString('base64');result.impulseResponseName=path.basename(active)
   const rawDry=Number(legacy['player.soundEffect.convolution.mainGain']??10)/10,rawWet=Number(legacy['player.soundEffect.convolution.sendGain']??0)/10
   const dry=Number.isFinite(rawDry)?Math.max(0,rawDry):1,wet=Number.isFinite(rawWet)?Math.max(0,rawWet):0,norm=Math.hypot(dry,wet)
   result.reverb=norm?Math.atan2(wet,dry)*2/Math.PI:0;result.reverbDryGain=Math.min(2,norm);result.reverbWetGain=Math.min(2,norm)
   if(norm>2)warn('原卷积干湿增益超出新版范围，按比例限幅，音量不能完全等同')
  }else{result.impulseResponseBase64='';result.impulseResponseName='';result.reverb=0;warn(`未恢复活动卷积响应 ${active}：LX通常引用打包内置WAV，数据目录未提供有效音频；关闭替代混响并保留引用`)}
 }
 const effects:Record<string,UserEffect>={...object(result.effectUserPresets)}
 if(Array.isArray(sound?.eqPreset))for(const value of sound.eqPreset){const preset=object(value);try{const eq=frequencies.map(hz=>preset[`hz${hz}`]);if(eq.some(gain=>typeof gain==='number'&&Math.abs(gain)>15))warn(`均衡预设 ${String(preset.name)} 超出±15dB范围，已限幅`);const name=unique(String(preset.name||''),effects);effects[name]=parseEffect({...result,eq},name)}catch(failure){warn(`均衡预设 ${String(preset.name)} 无法恢复：${String(failure)}`)}}
 if(Array.isArray(sound?.eqPreset)&&sound.eqPreset.length)warn('旧EQ预设仅保存十段增益；新版预设保存完整音效，已同时捕获迁移时的当前混响和声场设置')
 if(sound)result.effectUserPresets=effects
 if(hotkeys)for(const scope of ['local','global'] as const){
  const group=object(hotkeys[scope]);if(!Object.keys(group).length)continue
  const enabled=group.enable===true,targets=scope==='local'?localActions:globalActions,converted:Record<string,string>=scope==='local'?Object.fromEntries(Object.keys(rendererDefaults.shortcuts).map(key=>[key,''])):{}
  const used=new Set<string>()
  for(const [key,value]of Object.entries(object(group.keys))){const info=object(value),action=Object.hasOwn(targets,String(info.action||info.name||''))?targets[String(info.action||info.name||'')]:undefined,accelerator=binding(key,scope==='global');if(!action||!accelerator){warn(`未支持的${scope}快捷键：${key} → ${String(info.action||info.name)}`);continue}if(used.has(accelerator)||converted[action]){warn(`重复的${scope}快捷键或动作，仅保留首个：${key} → ${action}`);continue}used.add(accelerator);converted[action]=accelerator}
  result[scope==='local'?'shortcuts':'globalHotkeys']=enabled?converted:scope==='local'?Object.fromEntries(Object.keys(converted).map(key=>[key,''])):{}
  if(!enabled)warn(`旧${scope}快捷键已禁用；绑定保留在legacyHotkeys，未启用旧绑定`)
 }
 const collection:Record<string,ThemeFile>={...object(result.userThemes)},byId=new Map<string,ThemeFile>(),references:Record<string,string>={}
 if(Array.isArray(themes?.themes))for(const value of themes.themes){
  const old=object(value),config=object(old.config),colors={...object(config.themeColors),...object(config.extInfo)},name=unique(String(old.name||''),collection)
  if(!old.config||typeof old.isDark!=='boolean'){warn(`主题 ${name} 缺少原始配置，未生成虚假主题`);continue}
  function color(raw:unknown,fallback:string,seen=new Set<string>()):string{
   if(typeof raw!=='string')return fallback
   const variable=raw.match(/^var\((--[\w-]+)\)$/);if(variable){if(seen.has(variable[1])){warn(`主题 ${name} 存在颜色变量循环`);return fallback}seen.add(variable[1]);return color(colors[variable[1]],fallback,seen)}
   if(/^#[a-f\d]{6}$/i.test(raw))return raw
   if(/^#[a-f\d]{3}$/i.test(raw))return '#'+raw.slice(1).split('').map(part=>part+part).join('')
   const rgba=raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/)
   if(rgba&&rgba.slice(1,4).every(channel=>Number(channel)<=255)){if(rgba[4]!==undefined&&Number(rgba[4])!==1)warn(`主题 ${name} 的半透明颜色转为RGB；不能完全保留原透明度`);return '#'+rgba.slice(1,4).map(channel=>Number(channel).toString(16).padStart(2,'0')).join('')}
   warn(`主题 ${name} 颜色 ${raw} 无法精确转换，使用已有基础颜色`);return fallback
  }
  const dark=old.isDark,accent=color(colors['--color-primary']||colors['--color-theme'],/^#[a-f\d]{6}$/i.test(result.accent)?result.accent:'#a78bfa')
  const theme:ThemeFile={format:'chenjin-theme',version:1,theme:dark?'dark':'light',accent,font:typeof result.font==='string'?result.font:'',colors:{bg:color(colors['--color-main-background'],dark?'#15131d':'#f5f3fa'),sidebar:color(colors['--color-app-background'],dark?'#100f17':'#eeebf5'),surface:color(colors['--color-content-background']||colors['--color-primary-light-1000'],dark?'#1c1926':'#ffffff'),text:color(colors['--color-font']||colors[old.isDarkFont?'--color-850':'--color-050'],dark?'#f1eef8':'#242130'),muted:color(colors['--color-font-label']||colors['--color-450'],'#92909f')},background:'',backgroundOpacity:.25}
  const source=String(colors['--background-image']||'');if(source&&source!=='none'){
   references[name]=source
   try{let bytes:Buffer|null=null;if(source.startsWith('data:')){const encoded=source.match(/^data:image\/(?:png|jpeg|webp|gif);base64,([a-z\d+/=]+)$/i);if(encoded&&encoded[1].length<=Math.ceil(LIMIT/3)*4)bytes=Buffer.from(encoded[1],'base64')}else if(!/^https?:/i.test(source))bytes=await read(path.isAbsolute(source)||source.startsWith('file:')?source:path.join('theme_images',source))
    const mime=bytes&&imageMime(bytes);if(bytes&&bytes.length<=LIMIT&&mime&&assetBytes+bytes.length<=24*1024*1024){assetBytes+=bytes.length;theme.background=`data:${mime};base64,${bytes.toString('base64')}`}else warn(`主题 ${name} 背景仅保留引用：未提供目录内有效图片、远程URL未抓取、或超过8MiB/合计24MiB限制`)
   }catch(failure){warn(`主题 ${name} 背景无法迁移：${String(failure)}`)}
  }
  collection[name]=parseTheme(theme);byId.set(String(old.id),collection[name])
 }
 if(themes){result.userThemes=collection;result.legacyThemeReferences=references;if(byId.size)warn('主题映射到新版五种界面颜色；原专用按钮、徽章、背景位置和大小不能完全等同')}
 const selected=legacy['theme.id'];if(selected==='auto'){result.theme='system';result.legacyThemeSelection={id:selected,lightId:legacy['theme.lightId'],darkId:legacy['theme.darkId']};if(byId.has(String(legacy['theme.lightId']))||byId.has(String(legacy['theme.darkId'])))warn('旧自动模式的两套自定义主题已保存，但新版不能自动切换两套自定义配色，请在我的主题选择应用')}
 else if(byId.has(String(selected))){const chosen=byId.get(String(selected))!;Object.assign(result,{theme:chosen.theme,accent:chosen.accent,font:chosen.font,themeColors:chosen.colors,themeBackground:chosen.background||'',themeBackgroundOpacity:chosen.backgroundOpacity})}
 result.legacyMigrationWarnings=warnings
 return result
}
