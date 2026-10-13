export type AppearanceComponentId = 'sidebar' | 'navigation' | 'topbar' | 'search' | 'content' | 'hero' | 'playlistCard' | 'trackList' | 'player' | 'queue' | 'lyrics' | 'desktopLyrics' | 'settings' | 'downloads' | 'sources' | 'comments' | 'dialog' | 'contextMenu' | 'button' | 'input' | 'toast' | 'emptyState' | 'cover' | 'appearanceEditor' | 'themeSettings' | 'audioSettings' | 'lyricSettings' | 'shortcutSettings' | 'syncPanel' | 'backupPanel' | 'dislikePanel' | 'updatePanel' | 'onlinePanel' | 'downloadsPanel' | 'sourceManager' | 'trackDetails' | 'sourceAlternatives' | 'lyricEditor' | 'commentsPanel' | 'icon'
export interface AppearanceStyle {
  background?: string; color?: string; mutedColor?: string; accentColor?: string; borderColor?: string; hoverBackground?: string; activeBackground?: string
  radius?: number; padding?: number; gap?: number; fontSize?: number; fontWeight?: number; lineHeight?: number; borderWidth?: number; opacity?: number; blur?: number; letterSpacing?: number; animationDuration?: number
  width?: number; height?: number; rowHeight?: number; iconSize?: number; coverSize?: number; headingSize?: number; strokeWidth?: number
  shadow?: 'none' | 'soft' | 'elevated'; fontFamily?: string
}
export interface AppearanceConfig { format: 'chenjin-appearance'; version: 1; name: string; global: AppearanceStyle; components: Partial<Record<AppearanceComponentId, AppearanceStyle>> }
type Property = keyof AppearanceStyle
type PropertyInfo = { label: string; type: 'color' | 'number' | 'select' | 'text'; min?: number; max?: number; step?: number; unit?: string; options?: string[]; default?: string | number }
const numeric = (label: string, min: number, max: number, unit = 'px', step = 1): PropertyInfo => ({ label, type: 'number', min, max, unit, step })
export const APPEARANCE_PROPERTIES: Record<Property, PropertyInfo> = {
  background: { label: '背景颜色', type: 'color' }, color: { label: '文字颜色', type: 'color' }, mutedColor: { label: '次要文字', type: 'color' }, accentColor: { label: '强调颜色', type: 'color' }, borderColor: { label: '边框颜色', type: 'color' }, hoverBackground: { label: '悬停背景', type: 'color' }, activeBackground: { label: '选中背景', type: 'color' },
  radius: numeric('圆角', 0, 48), padding: numeric('内边距', 0, 64), gap: numeric('间距', 0, 48), fontSize: numeric('字号', 10, 32), fontWeight: numeric('字重', 100, 900, '', 100), lineHeight: numeric('行高比例', 1, 2.5, '', 0.05), borderWidth: numeric('边框宽度', 0, 4), opacity: numeric('不透明度', 0.2, 1, '', 0.05), blur: numeric('背景模糊', 0, 40), letterSpacing: numeric('字间距', -2, 8, 'px', 0.1), animationDuration: numeric('动画时长', 0, 1000, 'ms', 10), width: numeric('宽度', 160, 640), height: numeric('高度', 28, 400), rowHeight: numeric('列表行高', 44, 100), iconSize: numeric('图标大小', 12, 40), coverSize: numeric('封面大小', 32, 320), headingSize: numeric('标题字号', 16, 64),
  strokeWidth: { ...numeric('描边粗细', 0.5, 4, '', 0.25), default: 1.75 },
  shadow: { label: '阴影', type: 'select', options: ['none', 'soft', 'elevated'] }, fontFamily: { label: '字体族', type: 'text' }
}
// Editor seeds are guidance for enabling a property, never implicit config values.
const PROPERTY_SEEDS: Record<Property, string | number> = {
  background: '#181523', color: '#f3efff', mutedColor: '#afa6c6', accentColor: '#ba9bff',
  borderColor: '#362c4b', hoverBackground: '#29213c', activeBackground: '#3a2b54',
  radius: 14, padding: 12, gap: 12, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
  borderWidth: 1, opacity: 1, blur: 12, letterSpacing: 0, animationDuration: 180,
  width: 224, height: 76, rowHeight: 56, iconSize: 20, coverSize: 56, headingSize: 28, strokeWidth: 1.75,
  shadow: 'soft', fontFamily: '"Noto Sans SC", 微软雅黑, sans-serif'
}
for (const key of Object.keys(PROPERTY_SEEDS) as Property[]) APPEARANCE_PROPERTIES[key].default = PROPERTY_SEEDS[key]
export const GLOBAL_APPEARANCE_PROPERTIES: Property[] = ['background', 'color', 'mutedColor', 'accentColor', 'borderColor', 'hoverBackground', 'activeBackground', 'radius', 'padding', 'gap', 'fontSize', 'fontWeight', 'lineHeight', 'borderWidth', 'opacity', 'blur', 'letterSpacing', 'animationDuration', 'shadow', 'fontFamily']
const component = (id: AppearanceComponentId, label: string, description: string, extra: Property[] = []) => ({ id, label, description, properties: [...GLOBAL_APPEARANCE_PROPERTIES, ...extra] })
export const APPEARANCE_COMPONENTS: Array<{ id: AppearanceComponentId; label: string; description: string; properties: Property[] }> = [
  component('sidebar', '侧边栏', '应用导航和收藏入口', ['width']), component('navigation', '导航项目', '侧边栏中的导航按钮', ['height', 'iconSize']), component('topbar', '顶部栏', '页面标题和操作区域', ['height', 'iconSize']), component('search', '搜索', '搜索框和搜索结果', ['height', 'iconSize']), component('content', '内容区域', '主要页面的内容容器', ['headingSize']), component('hero', '首页横幅', '首页欢迎区域与推荐横幅', ['height', 'headingSize']), component('playlistCard', '歌单卡片', '歌单封面与标题', ['coverSize', 'headingSize']), component('trackList', '歌曲列表', '歌曲行与列表表头', ['rowHeight', 'coverSize', 'iconSize']), component('player', '播放控制栏', '底部播放控制与歌曲信息', ['height', 'coverSize', 'iconSize']), component('queue', '播放队列', '播放队列面板和歌曲行', ['width', 'rowHeight', 'coverSize', 'iconSize']), component('lyrics', '歌词', '应用内歌词视图', ['headingSize']), component('desktopLyrics', '桌面歌词', '独立桌面歌词窗口', ['headingSize']), component('settings', '设置', '设置面板与选项分组', ['headingSize', 'iconSize']), component('downloads', '下载', '下载任务与进度列表', ['rowHeight', 'iconSize']), component('sources', '音源', '音源管理与状态卡片', ['iconSize']), component('comments', '评论', '评论列表和回复区域', ['iconSize']), component('dialog', '对话框', '确认、导入及编辑弹窗', ['width', 'headingSize']), component('contextMenu', '右键菜单', '歌曲与歌单操作菜单', ['iconSize']), component('button', '按钮', '通用按钮与操作入口', ['height', 'iconSize']), component('input', '输入框', '文本输入与选择控件', ['height']), component('toast', '通知', '轻量操作反馈', ['iconSize']), component('emptyState', '空状态', '无结果或空列表提示', ['headingSize', 'iconSize']), component('cover', '封面', '歌曲与歌单封面图片', ['coverSize']),
  component('appearanceEditor', '外观编辑器', '外观导入、预设与逐组件配置', ['headingSize', 'iconSize']),
  component('themeSettings', '主题设置', '主题模式、强调色与主题选项', ['headingSize', 'iconSize']),
  component('audioSettings', '音频设置', '音质、音量和播放行为选项', ['headingSize', 'iconSize']),
  component('lyricSettings', '歌词设置', '歌词显示和桌面歌词选项', ['headingSize', 'iconSize']),
  component('shortcutSettings', '快捷键设置', '快捷键编辑与按键提示', ['headingSize', 'iconSize']),
  component('syncPanel', '同步面板', '设备同步配置与状态', ['headingSize', 'iconSize']),
  component('backupPanel', '备份面板', '备份导入、导出与恢复', ['headingSize', 'iconSize']),
  component('dislikePanel', '屏蔽面板', '不喜欢的歌曲与歌手管理', ['headingSize', 'iconSize']),
  component('updatePanel', '更新面板', '应用版本和更新状态', ['headingSize', 'iconSize']),
  component('onlinePanel', '在线音乐面板', '在线搜索、榜单与推荐区域', ['headingSize', 'iconSize']),
  component('downloadsPanel', '下载管理面板', '下载任务管理的独立面板', ['headingSize', 'iconSize']),
  component('sourceManager', '音源管理器', '音源导入、启用与管理界面', ['headingSize', 'iconSize']),
  component('trackDetails', '歌曲详情', '歌曲元数据与详情对话框', ['width', 'headingSize', 'iconSize']),
  component('sourceAlternatives', '换源对话框', '歌曲替代音源选择', ['width', 'headingSize', 'iconSize']),
  component('lyricEditor', '歌词编辑器', '歌词时间轴与文本编辑对话框', ['width', 'headingSize', 'iconSize']),
  component('commentsPanel', '评论面板', '歌曲评论的独立对话框', ['width', 'headingSize', 'iconSize']),
  { id: 'icon', label: '图标', description: '通用图标的颜色、尺寸与描边', properties: ['color', 'background', 'opacity', 'iconSize', 'strokeWidth', 'radius'] }
]
const DIALOG_BOUNDS: Partial<Record<Property, [number, number]>> = { width: [280, 640] }
const COMPONENT_BOUNDS: Partial<Record<AppearanceComponentId, Partial<Record<Property, [number, number]>>>> = {
  lyrics: { fontSize: [12, 72] }, desktopLyrics: { fontSize: [12, 96] },
  sidebar: { width: [160, 320] }, navigation: { height: [32, 64] }, topbar: { height: [60, 108] }, search: { height: [32, 64] }, hero: { height: [120, 400] }, player: { height: [68, 144], coverSize: [32, 96] }, queue: { width: [280, 560], rowHeight: [44, 100], coverSize: [32, 64] }, trackList: { rowHeight: [44, 100], coverSize: [32, 64] }, downloads: { rowHeight: [44, 100] }, dialog: DIALOG_BOUNDS, trackDetails: DIALOG_BOUNDS, sourceAlternatives: DIALOG_BOUNDS, lyricEditor: DIALOG_BOUNDS, commentsPanel: DIALOG_BOUNDS, button: { height: [28, 64] }, input: { height: [32, 64] }
}
export function appearancePropertyBounds(id: AppearanceComponentId | 'global', key: keyof AppearanceStyle): { min?: number; max?: number } {
  const bounds = id === 'global' ? undefined : COMPONENT_BOUNDS[id]?.[key]
  const info = APPEARANCE_PROPERTIES[key]
  return { min: bounds?.[0] ?? info.min, max: bounds?.[1] ?? info.max }
}
export const DEFAULT_APPEARANCE: AppearanceConfig = { format: 'chenjin-appearance', version: 1, name: '默认外观', global: { gap: 12 }, components: {} }
const preset = (name: string, global: AppearanceStyle, components: AppearanceConfig['components'] = {}): AppearanceConfig => ({ format: 'chenjin-appearance', version: 1, name, global: { ...DEFAULT_APPEARANCE.global, ...global }, components })
export const APPEARANCE_PRESETS: Array<{ id: string; label: string; config: AppearanceConfig }> = [
  { id: 'midnight', label: '午夜紫', config: preset('午夜紫', { background: '#151321', color: '#f1eefc', mutedColor: '#aaa2bf', accentColor: '#b69aff', borderColor: '#332c47', hoverBackground: '#272039', activeBackground: '#382950', radius: 18, shadow: 'elevated' }, { sidebar: { background: '#1b172a' }, player: { background: '#211b32' }, hero: { background: '#302344', headingSize: 32 } }) },
  { id: 'ivory', label: '象牙白', config: preset('象牙白', { background: '#faf7f0', color: '#302c26', mutedColor: '#80766a', accentColor: '#9a6847', borderColor: '#e5ddcf', hoverBackground: '#f0e9dd', activeBackground: '#eadbc9', radius: 16 }, { sidebar: { background: '#f2ede3' }, player: { background: '#fffdf7' }, hero: { background: '#efe4d3', headingSize: 32 } }) },
  { id: 'compact', label: '紧凑', config: preset('紧凑', { radius: 8, padding: 8, gap: 8, fontSize: 12, shadow: 'none', animationDuration: 120 }, { sidebar: { width: 180 }, navigation: { height: 34 }, topbar: { height: 60 }, trackList: { rowHeight: 44, coverSize: 32 }, player: { height: 68, coverSize: 40 }, queue: { width: 300, rowHeight: 44 } }) }
]
const fail = (message: string): never => { throw new Error(`外观配置无效：${message}`) }
function object(input: unknown, path: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(`${path} 必须是对象`)
  const proto = Object.getPrototypeOf(input)
  if (proto !== Object.prototype && proto !== null) return fail(`${path} 不允许自定义原型`)
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) return fail(`${path} 包含不安全键`)
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail(`${path} 包含不支持的属性`)
  }
  return input as Record<string, unknown>
}
function color(value: string): string {
  const clean = value.trim()
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(clean) || /^(?:transparent|currentColor)$/i.test(clean) || /^var\(--[a-zA-Z][a-zA-Z0-9_-]*\)$/.test(clean)) return clean
  const match = /^(rgb|rgba)\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?|\.\d+))?\s*\)$/i.exec(clean)
  if (match && (match[1].toLowerCase() === 'rgba') === (match[5] !== undefined) && match.slice(2, 5).every(v => Number(v) <= 255) && (match[5] === undefined || Number(match[5]) <= 1)) return clean
  return fail('颜色必须使用安全的十六进制、rgb/rgba、transparent、currentColor 或 var(--token)')
}
function font(value: string): string {
  const clean = value.trim().replace(/\s+/g, ' ')
  if (!clean || clean.length > 200 || !/^[\p{L}\p{N} _,'"-]+$/u.test(clean)) return fail('字体族包含不安全字符')
  for (const family of clean.split(',')) {
    const part = family.trim()
    if (!part || !/^(?:[\p{L}\p{N} _-]+|'[\p{L}\p{N} _-]+'|"[\p{L}\p{N} _-]+")$/u.test(part)) return fail('字体族格式无效')
  }
  return clean
}
function style(input: unknown, id?: AppearanceComponentId): AppearanceStyle {
  const source = object(input, id || 'global')
  const allowed = id ? APPEARANCE_COMPONENTS.find(c => c.id === id)!.properties : GLOBAL_APPEARANCE_PROPERTIES
  const result: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(source)) {
    const property = key as Property
    if (!allowed.includes(property)) return fail(`${id || 'global'}.${key} 不受支持`)
    const info = APPEARANCE_PROPERTIES[property]
    if (info.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${key} 必须是有限数值`)
      const bounds = appearancePropertyBounds(id || 'global', property)
      result[key] = Math.min(bounds.max!, Math.max(bounds.min!, value))
    } else {
      if (typeof value !== 'string') return fail(`${key} 必须是字符串`)
      if (info.type === 'color') result[key] = color(value)
      else if (property === 'fontFamily') result[key] = font(value)
      else if (info.options?.includes(value)) result[key] = value
      else return fail(`${key} 选项无效`)
    }
  }
  return result as AppearanceStyle
}
export function parseAppearance(input: unknown): AppearanceConfig {
  const source = object(typeof input === 'string' ? JSON.parse(input) : input, 'config')
  const keys = ['format', 'version', 'name', 'global', 'components']
  if (Object.keys(source).some(key => !keys.includes(key)) || keys.some(key => !Object.prototype.hasOwnProperty.call(source, key))) return fail('配置字段缺失或存在未知字段')
  if (source.format !== 'chenjin-appearance' || source.version !== 1) return fail('格式或版本不受支持')
  if (typeof source.name !== 'string' || !source.name.trim() || source.name.length > 80 || /[\x00-\x1f\x7f]/.test(source.name)) return fail('名称必须为 1–80 个可显示字符')
  const components: AppearanceConfig['components'] = {}
  for (const [key, value] of Object.entries(object(source.components, 'components'))) {
    if (!APPEARANCE_COMPONENTS.some(c => c.id === key)) return fail(`未知组件 ${key}`)
    components[key as AppearanceComponentId] = style(value, key as AppearanceComponentId)
  }
  return { format: 'chenjin-appearance', version: 1, name: source.name.trim(), global: style(source.global), components }
}
export function normalizeAppearance(input: unknown): AppearanceConfig {
  try {
    const config=parseAppearance(input),global=config.global
    if(config.name==='默认外观'&&Object.keys(config.components).length===0&&Object.keys(global).length===3&&global.radius===14&&global.gap===12&&global.shadow==='soft')return parseAppearance(DEFAULT_APPEARANCE)
    return config
  } catch { return parseAppearance(DEFAULT_APPEARANCE) }
}
const SHADOWS = { none: 'none', soft: '0 4px 18px rgba(0, 0, 0, 0.08)', elevated: '0 12px 36px rgba(0, 0, 0, 0.18)' }
const kebab = (value: string) => value.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
export function appearanceVariables(config: AppearanceConfig): Record<string, string> {
  const validated = parseAppearance(config)
  const variables: Record<string, string> = {}
  const add = (prefix: string, values: AppearanceStyle) => {
    for (const [key, value] of Object.entries(values)) {
      const property = key as Property
      variables[`--cj-${prefix}-${kebab(key)}`] = property === 'shadow' ? SHADOWS[value as keyof typeof SHADOWS] : typeof value === 'number' ? `${value}${APPEARANCE_PROPERTIES[property].unit || ''}` : value
    }
  }
  add('global', validated.global)
  for (const [id, values] of Object.entries(validated.components)) add(kebab(id), values)
  return variables
}
