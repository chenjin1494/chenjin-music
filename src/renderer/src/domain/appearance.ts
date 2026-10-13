import type { AppearanceComponentId, AppearanceConfig, AppearanceStyle } from '../../../shared/appearance'
import { appearanceVariables, normalizeAppearance } from '../../../shared/appearance'

/** Fixed, audited selectors: files describe values, never arbitrary executable CSS. */
export const APPEARANCE_SELECTORS: Record<AppearanceComponentId, string> = {
 sidebar:'.sidebar',navigation:'.nav-item',topbar:'.topbar',search:'.search-box, .search-popover',content:'.main-content',hero:'.welcome-hero',playlistCard:'.playlist-card',trackList:'.track-table',player:'.player-bar',queue:'.queue-drawer',lyrics:'.full-lyrics',desktopLyrics:'.desktop-word-lyric',settings:'.settings-card, .settings-section',downloads:'.download-card',sources:'.source-card',comments:'.comment-item',dialog:'.modal, .dialog',contextMenu:'.context-menu',button:'button:not(.playlist-card):not(.cover):not(.lyric-line):not(.nav-item):not(.queue-track-name):not(.alternative-choice)',input:'input:not([type=checkbox]):not([type=range]):not([type=color]), select, textarea',toast:'.toast, .error-banner, .notice',emptyState:'.empty-state, .quiet-empty',cover:'.cover, .playlist-art, .large-cover',
 appearanceEditor:'.appearance-studio',themeSettings:'.settings-card[data-settings-group=appearance]',audioSettings:'.settings-card[data-settings-group=playback]',lyricSettings:'.settings-card[data-settings-group=lyrics]',shortcutSettings:'.settings-card[data-settings-group=shortcuts]',syncPanel:'.settings-card[data-settings-group=sync]',backupPanel:'.settings-card[data-settings-group=backup]',dislikePanel:'.settings-card[data-settings-group=dislikes]',updatePanel:'.settings-card[data-settings-group=about]',onlinePanel:'.main-content[data-page=discovery],.main-content[data-page=online]',downloadsPanel:'.main-content[data-page=downloads]',sourceManager:'.main-content[data-page=sources]',trackDetails:'.track-details',sourceAlternatives:'.alternatives-modal',lyricEditor:'.lyric-editor',commentsPanel:'.comments-panel',icon:'svg.lucide',
}
const cssNames: Partial<Record<keyof AppearanceStyle, string>> = {strokeWidth:'stroke-width',background:'background',color:'color',borderColor:'border-color',radius:'border-radius',padding:'padding',gap:'gap',fontSize:'font-size',fontWeight:'font-weight',lineHeight:'line-height',borderWidth:'border-width',opacity:'opacity',blur:'backdrop-filter',shadow:'box-shadow',fontFamily:'font-family',letterSpacing:'letter-spacing',animationDuration:'transition-duration',width:'width',height:'height'}
const textChildren=':is(h1,h2,h3,h4,h5,h6,p,span,strong,small,label,a,time,button,input,select,textarea)'
const componentPriority=(id:AppearanceComponentId)=>id==='appearanceEditor'?5:['themeSettings','audioSettings','lyricSettings','shortcutSettings','syncPanel','backupPanel','dislikePanel','updatePanel'].includes(id)?4:['sidebar','topbar','settings','content','dialog','onlinePanel','downloadsPanel','sourceManager'].includes(id)?1:['button','input','cover','icon','trackDetails','sourceAlternatives','lyricEditor','commentsPanel'].includes(id)?2:3
const scope=(selector:string,priority=0)=>`:root body :is(${selector})${':not(#cj-appearance-specificity)'.repeat(priority)}`
const rule=(selector:string,declarations:string[])=>declarations.length?`${selector}{${declarations.join(';')}}`:' '
function styleRules(id:AppearanceComponentId,style:AppearanceStyle,priority=componentPriority(id)):string {
 const selector=scope(APPEARANCE_SELECTORS[id],priority),declarations:string[]=[],extra:string[]=[]
 for(const [key,raw]of Object.entries(style) as [keyof AppearanceStyle,string|number][]){
  if(raw==null)continue
  if(['mutedColor','accentColor','hoverBackground','activeBackground','rowHeight','iconSize','coverSize','headingSize'].includes(key))continue
  const property=cssNames[key];if(!property)continue
  let value=typeof raw==='number'?`${raw}${['opacity','lineHeight','fontWeight','strokeWidth'].includes(key)?'':key==='animationDuration'?'ms':'px'}`:String(raw)
  if(key==='height'&&['search','input'].includes(id)){extra.push(rule(id==='search'?scope('.search-box',priority):scope('input:not([type=checkbox]):not([type=range]):not([type=color]),select',priority),[`height:${value}!important`]));continue}
  if(key==='height'&&id==='hero')declarations.push(`min-height:${value}!important`,'overflow:hidden')
  if(key==='blur')value=`blur(${value})`
  if(key==='shadow')value=`var(--cj-${id.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}-shadow,var(--cj-global-shadow))`
  if(key==='width'&&['queue','dialog','trackDetails','sourceAlternatives','lyricEditor','commentsPanel'].includes(id))value=`min(${value}, calc(100% - 32px))`
  if(key==='width'&&id==='sidebar')value='100%'
  if(key==='padding'&&['trackList','queue'].includes(id))continue
  if(key==='padding'&&id==='player'){declarations.push(`padding-inline:${value}!important`,`padding-block:min(${value}, max(2px, calc((var(--cj-player-height,100px) - 54px) / 2)))!important`);continue}
  if(key==='height'&&id==='player')value='100%'
  declarations.push(`${property}:${value}!important`)
  if(key==='color'&&id!=='lyrics'&&id!=='desktopLyrics')extra.push(rule(`${selector} ${textChildren}:not(.active):not(.active *)`,[`color:${value}!important`]))
  if(key==='borderWidth'&&Number(raw)>0)declarations.push('border-style:solid!important')
  const typography=['fontSize','fontFamily','fontWeight','lineHeight','letterSpacing'].includes(key)
  if(typography&&id==='desktopLyrics')extra.push(rule(`${selector} .desktop-word-content`,[`${property}:${value}!important`]))
  else if(typography&&id!=='lyrics')extra.push(rule(`${selector} ${textChildren}`,[`${property}:${value}!important`]))
  if(id==='lyrics'){const lyricVariable=({fontSize:'--lyric-size',fontWeight:'--lyric-weight',lineHeight:'--lyric-height'} as Record<string,string>)[key];if(lyricVariable)declarations.push(`${lyricVariable}:${value}!important`);if(key==='fontSize')extra.push(rule(`${selector} .lyric-line`,[`font-size:${value}!important`]))}
 }
 if(style.mutedColor){extra.push(rule(`${selector} :is(small,.muted,.source-label,time,.nav-label,.library-stat,.track-time)`,[`color:${style.mutedColor}!important`]));if(id==='input'||id==='search')extra.push(rule(id==='input'?`${selector}::placeholder`:`${selector} input::placeholder`,[`color:${style.mutedColor}!important`]))}
 if(style.accentColor){declarations.push(`--accent:${style.accentColor}`);extra.push(rule(`${selector}:is(.active,.selected), ${selector} :is(.accent,.active,.selected,.quality-tag)`,[`color:${style.accentColor}!important`]))}
 const hoverTarget=id==='trackList'?`${selector} .track-row`:id==='queue'?`${selector} .queue-track`:selector
 if(style.hoverBackground)extra.push(rule(`${hoverTarget}:hover`,[`background:${style.hoverBackground}!important`]))
 if(style.activeBackground)extra.push(rule(`${selector}:is(.active,.selected,:active${id==='input'?',:focus':''}), ${selector} :is(.active,.selected)`,[`background:${style.activeBackground}!important`]))
 if(style.iconSize!==undefined)extra.push(rule(id==='icon'?selector:`${selector} svg`,[`width:${style.iconSize}px!important`,`height:${style.iconSize}px!important`]))
 if(style.headingSize!==undefined)extra.push(rule(id==='playlistCard'?`${selector}>strong`:id==='desktopLyrics'?`${selector} .desktop-main-line`:`${selector} :is(h1,h2,h3,h4,h5,h6)`,[`font-size:${style.headingSize}px!important`]))
 if(style.coverSize!==undefined){const target=id==='cover'?selector:id==='playlistCard'?`${selector} .playlist-art`:`${selector} .cover`;extra.push(rule(target,[`width:${style.coverSize}px!important`,`height:${style.coverSize}px!important`,'max-width:100%','aspect-ratio:auto!important']))}
 if(id==='lyrics'){
  if(style.color)declarations.push(`--lyric-color:${style.color}!important`)
  if(style.accentColor)declarations.push(`--lyric-active:${style.accentColor}!important`)
 }
 if(id==='desktopLyrics'){
  const played=style.accentColor??style.color
  if(played)declarations.push(`--desktop-played:${played}!important`)
  if(style.opacity!==undefined)extra.push(rule(`${selector} .desktop-word-content`,['opacity:1!important']))
  if(style.mutedColor)declarations.push(`--desktop-unplayed:${style.mutedColor}!important`)
  // Word fills remain timed gradients; only their two stops change.
  extra.push(rule(`${selector} .desktop-word-content`,[...(played?[`--desktop-played:${played}!important`]:[]),...(style.mutedColor?[`--desktop-unplayed:${style.mutedColor}!important`]:[])]))
 }
 if(style.rowHeight!==undefined&&id!=='downloads'){const row=id==='trackList'?'.track-row':'.queue-track';extra.push(rule(`${selector} ${row}`,[`height:${style.rowHeight}px!important`,`min-height:${style.rowHeight}px!important`,`box-sizing:border-box`,`overflow:hidden`]))}
 if(id==='downloads'&&style.rowHeight!==undefined)declarations.push(`min-height:${style.rowHeight}px!important`)
 if(id==='trackList'||id==='queue'){
  const row=id==='trackList'?'.track-row':'.queue-track',height=style.rowHeight??65,border=style.borderWidth??0,padding=style.padding
  if(style.gap!==undefined)extra.push(rule(`${selector} ${row}`,[`gap:${style.gap}px!important`]))
  if(style.radius!==undefined)extra.push(rule(`${selector} ${row}`,[`border-radius:${style.radius}px!important`]))
  if(padding!==undefined)extra.push(rule(`${selector} ${row}`,[`padding-inline:${padding}px!important`,`padding-block:min(${padding}px, max(0px, ${(height-36-2*border)/2}px))!important`]))
  extra.push(rule(`${selector} ${row} .cover`,[`max-width:${Math.max(12,height-10-2*border)}px!important`,`max-height:${Math.max(12,height-10-2*border)}px!important`]))
 }
 return rule(selector,declarations)+extra.join('\n')
}
export function colorBrightness(color:string):number|undefined{
 const hex=color.match(/^#([0-9a-f]{3,8})$/i)
 let rgb:number[]|undefined
 if(hex){const text=hex[1];if(text.length===3||text.length===4)rgb=text.slice(0,3).split('').map(c=>parseInt(c+c,16));else rgb=[0,2,4].map(i=>parseInt(text.slice(i,i+2),16));if((text.length===4&&parseInt(text[3]+text[3],16)<128)||(text.length===8&&parseInt(text.slice(6),16)<128))return}
 else{const match=color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);if(match)rgb=match.slice(1).map(Number)}
 return rgb?(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255:undefined
}
export function buildAppearanceCSS(input:unknown):string {
 const config=normalizeAppearance(input),global=config.global,parts:string[]=[]
 const base:string[]=[]
 const brightness=global.background?colorBrightness(global.background):undefined
 if(brightness!==undefined){const light=brightness>.6;for(const [key,value]of Object.entries(light?{surface:'#ffffff',sidebar:'#fcfbff','surface-hover':'#eeedf5',player:'#fff',text:'#242437',muted:'#79798f'}:{surface:'#1c1c29',sidebar:'#15151f','surface-hover':'#252536',player:'#1c1c29',text:'#f1f0fa',muted:'#9998af'}))base.push(`--${key}:${value}!important`);base.push(`color-scheme:${light?'light':'dark'}`)}
 if(global.accentColor){const accentLight=colorBrightness(global.accentColor);if(accentLight!==undefined)base.push(`--on-accent:${accentLight>.55?'#201731':'#ffffff'}!important`)}
 for(const [key,variable]of Object.entries({background:'--bg',color:'--text',mutedColor:'--muted',accentColor:'--accent',borderColor:'--border'})){
  const value=global[key as keyof AppearanceStyle];if(value!==undefined)base.push(`${variable}:${value}!important`)
 }
 if(global.fontFamily)base.push(`font-family:${global.fontFamily}!important`)
 parts.push(rule(':root',base))
 const globalOverrides:AppearanceStyle={...global};delete globalOverrides.fontSize;delete globalOverrides.background;delete globalOverrides.color;delete globalOverrides.mutedColor;delete globalOverrides.accentColor;delete globalOverrides.borderColor;delete globalOverrides.padding;delete globalOverrides.gap
 delete globalOverrides.opacity
 if(global.opacity!==undefined)parts.push(rule('body',[`opacity:${global.opacity}!important`]))
 for(const id of Object.keys(APPEARANCE_SELECTORS) as AppearanceComponentId[]){
  if(id==='desktopLyrics'||id==='icon')continue
  const inherited={...globalOverrides}
  if(!['playlistCard','settings','dialog','sources','downloads','contextMenu','cover'].includes(id))delete inherited.shadow
  parts.push(styleRules(id,inherited,0))
 }
 if(global.padding!==undefined)parts.push(rule(scope('.settings-card,.modal,.source-card'),[`padding:${global.padding}px!important`]))
 if(global.gap!==undefined)parts.push(rule(scope('.playlist-cards,.discovery-grid,.button-row,.settings-layout'),[`gap:${global.gap}px!important`]))
 if(global.animationDuration!==undefined)parts.push(rule('body :is(button,input,.nav-item,.playlist-card,.source-card)',[`transition-duration:${global.animationDuration}ms!important`]))
 // Region styles first, controls afterwards: button/input/cover overrides win inside panels.
 for(const [id,style]of Object.entries(config.components).sort(([a],[b])=>Number(['button','input','cover'].includes(a))-Number(['button','input','cover'].includes(b))))parts.push(styleRules(id as AppearanceComponentId,style as AppearanceStyle))
 return parts.join('\n')
}
let installedVariables:string[]=[]
export function applyAppearance(input:unknown,document:Document=window.document):AppearanceConfig {
 const config=normalizeAppearance(input),variables=appearanceVariables(config),root=document.documentElement
 for(const key of installedVariables)root.style.removeProperty(key)
 for(const [key,value]of Object.entries(variables))root.style.setProperty(key,value)
 installedVariables=Object.keys(variables)
 let sheet=document.getElementById('chenjin-component-appearance') as HTMLStyleElement|null
 if(!sheet){sheet=document.createElement('style');sheet.id='chenjin-component-appearance';document.head.append(sheet)}
 const css=buildAppearanceCSS(config)
 if(sheet.textContent!==css)sheet.textContent=css
 return config
}
