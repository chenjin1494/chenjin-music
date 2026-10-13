import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APPEARANCE_COMPONENTS, APPEARANCE_PRESETS, APPEARANCE_PROPERTIES, DEFAULT_APPEARANCE, GLOBAL_APPEARANCE_PROPERTIES, appearancePropertyBounds, appearanceVariables, normalizeAppearance, parseAppearance } from '../src/shared/appearance'
import type { AppearanceStyle } from '../src/shared/appearance'
const config = (global: unknown = {}, components: unknown = {}) => ({ ...DEFAULT_APPEARANCE, global, components })

describe('appearance configuration', () => {
  it('migrates only the exact legacy default to native Material shapes',()=>{
    const old=config({radius:14,gap:12,shadow:'soft'})
    expect(normalizeAppearance(old)).toEqual(DEFAULT_APPEARANCE)
    expect(normalizeAppearance({...old,name:'我的外观'}).global.radius).toBe(14)
    expect(normalizeAppearance({...old,components:{sidebar:{radius:14}}}).global.radius).toBe(14)
    expect(normalizeAppearance(config({radius:15,gap:12,shadow:'soft'})).global.radius).toBe(15)
  })
  it('matches the default JSON and keeps base theme colors inherited', () => {
    const file = JSON.parse(readFileSync(new URL('../appearance.default.json', import.meta.url), 'utf8'))
    expect(parseAppearance(file)).toEqual(DEFAULT_APPEARANCE)
    expect(DEFAULT_APPEARANCE.global).toEqual({ gap: 12 })
    expect(DEFAULT_APPEARANCE.components).toEqual({})
    expect(appearanceVariables(DEFAULT_APPEARANCE)).not.toHaveProperty('--cj-global-background')
  })
  it('keeps all documented JSON examples valid and the customization example complete', () => {
    const doc = readFileSync(new URL('../docs/APPEARANCE.md', import.meta.url), 'utf8')
    const examples = [...doc.matchAll(/```json\s*([\s\S]*?)```/g)].map(match => parseAppearance(match[1]))
    expect(examples).toHaveLength(2)
    expect(examples[0]).toEqual(DEFAULT_APPEARANCE)
    expect(Object.keys(examples[1].components)).toEqual(APPEARANCE_COMPONENTS.map(c => c.id))
  })
  it('registers exactly the agreed 40 components with unique known properties', () => {
    const ids = ['sidebar','navigation','topbar','search','content','hero','playlistCard','trackList','player','queue','lyrics','desktopLyrics','settings','downloads','sources','comments','dialog','contextMenu','button','input','toast','emptyState','cover','appearanceEditor','themeSettings','audioSettings','lyricSettings','shortcutSettings','syncPanel','backupPanel','dislikePanel','updatePanel','onlinePanel','downloadsPanel','sourceManager','trackDetails','sourceAlternatives','lyricEditor','commentsPanel','icon']
    expect(APPEARANCE_COMPONENTS.map(c => c.id)).toEqual(ids)
    for (const item of APPEARANCE_COMPONENTS) {
      expect(new Set(item.properties).size).toBe(item.properties.length)
      expect(item.properties).toContain('background')
      expect(item.properties).toContain('radius')
      for (const property of item.properties) expect(APPEARANCE_PROPERTIES[property]).toBeDefined()
    }
    expect(GLOBAL_APPEARANCE_PROPERTIES).not.toContain('width')
    expect(GLOBAL_APPEARANCE_PROPERTIES).not.toContain('height')
    expect(GLOBAL_APPEARANCE_PROPERTIES).not.toContain('rowHeight')
  })
  it('shares component bounds and supplies valid editor seeds without filling inherited values', () => {
    expect(appearancePropertyBounds('sidebar', 'width')).toEqual({ min: 160, max: 320 })
    expect(appearancePropertyBounds('queue', 'width')).toEqual({ min: 280, max: 560 })
    expect(appearancePropertyBounds('player', 'height')).toEqual({ min: 68, max: 144 })
    expect(appearancePropertyBounds('global', 'fontSize')).toEqual({ min: 10, max: 32 })
    expect(appearancePropertyBounds('global', 'color')).toEqual({ min: undefined, max: undefined })
    expect(APPEARANCE_PROPERTIES.radius.default).toBe(14)
    expect(APPEARANCE_PROPERTIES.opacity.default).toBe(1)
    expect(parseAppearance(config()).global).toEqual({})
    for (const entry of APPEARANCE_COMPONENTS) {
      for (const key of entry.properties) {
        const info = APPEARANCE_PROPERTIES[key]
        expect(info.default).toBeDefined()
        const parsed = parseAppearance(config({}, { [entry.id]: { [key]: info.default } }))
        const result = parsed.components[entry.id]![key]
        if (info.type === 'number') {
          const bounds = appearancePropertyBounds(entry.id, key)
          expect(result).toBe(Math.min(bounds.max!, Math.max(bounds.min!, info.default as number)))
        } else expect(result).toBe(info.default)
      }
    }
  })
  it('limits icon controls and emits unitless bounded stroke widths', () => {
    expect(APPEARANCE_COMPONENTS.find(c => c.id === 'icon')!.properties).toEqual(['color', 'background', 'opacity', 'iconSize', 'strokeWidth', 'radius'])
    expect(GLOBAL_APPEARANCE_PROPERTIES).not.toContain('strokeWidth')
    expect(appearancePropertyBounds('icon', 'strokeWidth')).toEqual({ min: 0.5, max: 4 })
    expect(APPEARANCE_PROPERTIES.strokeWidth).toMatchObject({ step: 0.25, default: 1.75, unit: '' })
    const parsed = parseAppearance(config({}, { icon: { strokeWidth: 9, iconSize: 24 } }))
    expect(parsed.components.icon!.strokeWidth).toBe(4)
    expect(appearanceVariables(parsed)['--cj-icon-stroke-width']).toBe('4')
    expect(parseAppearance(config({}, { icon: { strokeWidth: -1 } })).components.icon!.strokeWidth).toBe(0.5)
    for (const value of [NaN, Infinity, '1.75']) expect(() => parseAppearance(config({}, { icon: { strokeWidth: value } }))).toThrow()
    expect(() => parseAppearance(config({ strokeWidth: 2 }))).toThrow()
    expect(() => parseAppearance(config({}, { icon: { padding: 8 } }))).toThrow()
    for (const id of ['trackDetails', 'sourceAlternatives', 'lyricEditor', 'commentsPanel'] as const) {
      expect(appearancePropertyBounds(id, 'width')).toEqual({ min: 280, max: 640 })
      expect(parseAppearance(config({}, { [id]: { width: 1 } })).components[id]!.width).toBe(280)
      expect(parseAppearance(config({}, { [id]: { width: 900 } })).components[id]!.width).toBe(640)
    }
  })
  it('uses larger lyric-specific font ranges while keeping global scale bounded', () => {
    const parsed = parseAppearance(config({ fontSize: 44 }, { lyrics: { fontSize: 44 }, desktopLyrics: { fontSize: 44 } }))
    expect(parsed.global.fontSize).toBe(32)
    expect(parsed.components.lyrics!.fontSize).toBe(44)
    expect(parsed.components.desktopLyrics!.fontSize).toBe(44)
    expect(appearanceVariables(parsed)['--cj-lyrics-font-size']).toBe('44px')
    expect(appearancePropertyBounds('lyrics', 'fontSize')).toEqual({ min: 12, max: 72 })
    expect(appearancePropertyBounds('desktopLyrics', 'fontSize')).toEqual({ min: 12, max: 96 })
    const above = parseAppearance(config({}, { lyrics: { fontSize: 100 }, desktopLyrics: { fontSize: 100 } }))
    expect(above.components.lyrics!.fontSize).toBe(72)
    expect(above.components.desktopLyrics!.fontSize).toBe(96)
    const below = parseAppearance(config({}, { lyrics: { fontSize: 1 }, desktopLyrics: { fontSize: 1 } }))
    expect(below.components.lyrics!.fontSize).toBe(12)
    expect(below.components.desktopLyrics!.fontSize).toBe(12)
  })
  it('round-trips every preset through JSON without mutations', () => {
    expect(APPEARANCE_PRESETS).toHaveLength(3)
    for (const { config: preset } of APPEARANCE_PRESETS) expect(parseAppearance(JSON.stringify(preset))).toEqual(preset)
    const parsed = parseAppearance(DEFAULT_APPEARANCE)
    parsed.global.radius = 2
    expect(DEFAULT_APPEARANCE.global.radius).toBeUndefined()
  })
  it.each(['#abc', '#abcd', '#ABCDEF', '#abcdef80', 'rgb(0, 128, 255)', 'rgba(255, 0, 2, .5)', 'rgba(1, 2, 3, 1)', 'transparent', 'currentColor', 'var(--cj-accent-color)'])('accepts safe color %s', color => {
    expect(parseAppearance(config({ background: color })).global.background).toBe(color)
  })
  it.each(['#12', '#abcde', 'red', 'rgb(256, 0, 0)', 'rgb(-1, 0, 0)', 'rgba(0,0,0,1.1)', 'rgba(0,0,0,-.1)', 'rgb(1,2,3,.5)', 'rgba(1,2,3)', 'rgb(Infinity,0,0)', 'var(--x, red)', 'var(--x); color:red', 'url(https://example.test/x)', '#fff;position:fixed', 'expression(alert(1))'])('rejects invalid or injectable color %s', value => {
    expect(() => parseAppearance(config({ background: value }))).toThrow()
  })
  it('validates numeric types and clamps values using component bounds', () => {
    const parsed = parseAppearance(config({ radius: -10, padding: 900, opacity: 9, letterSpacing: -9, animationDuration: 1200 }, { sidebar: { width: 999 }, player: { height: 1 }, queue: { width: 1, rowHeight: 999 }, trackList: { rowHeight: 1 }, topbar: { height: 999 } }))
    expect(parsed.global).toEqual({ radius: 0, padding: 64, opacity: 1, letterSpacing: -2, animationDuration: 1000 })
    expect(parsed.components).toEqual({ sidebar: { width: 320 }, player: { height: 68 }, queue: { width: 280, rowHeight: 100 }, trackList: { rowHeight: 44 }, topbar: { height: 108 } })
    for (const invalid of [NaN, Infinity, -Infinity, '14', null, undefined]) expect(() => parseAppearance(config({ radius: invalid }))).toThrow()
    expect(parseAppearance(config({ gap: 12.5 })).global.gap).toBe(12.5)
  })
  it('rejects unknown fields and inappropriate component dimensions', () => {
    for (const invalid of [
      { ...config(), typo: true }, { ...config(), version: 2 }, { ...config(), version: '1' }, { ...config(), format: 'other' },
      config({ raduis: 14 }), config({ width: 240 }), config({}, { sideBar: {} }), config({}, { button: { width: 200 } }),
      config({}, { lyrics: { rowHeight: 60 } }), config({ shadow: 'custom' }), config({ color: 42 }), config({}, { player: null }),
      { ...config(), name: '' }, { ...config(), name: 'x'.repeat(81) }, { ...config(), name: 'unsafe\nname' }, { version: 1 }
    ]) expect(() => parseAppearance(invalid)).toThrow()
  })
  it('rejects prototype pollution and accessor-bearing objects without evaluating accessors', () => {
    const polluted = JSON.parse('{"format":"chenjin-appearance","version":1,"name":"test","global":{"__proto__":{"polluted":true}},"components":{}}')
    expect(() => parseAppearance(polluted)).toThrow()
    expect(() => parseAppearance(config({}, JSON.parse('{"constructor":{}}')))).toThrow()
    expect(() => parseAppearance(config(Object.create({ radius: 20 })))).toThrow()
    const getter = { get radius() { throw new Error('getter ran') } }
    expect(() => parseAppearance(config(getter))).toThrow('不支持的属性')
    expect(() => parseAppearance(config({ [Symbol('hidden')]: 1 }))).toThrow()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
  it('sanitizes safe font lists and rejects CSS syntax and malformed quotes', () => {
    expect(parseAppearance(config({ fontFamily: '  "Noto Sans",  微软雅黑, sans-serif  ' })).global.fontFamily).toBe('"Noto Sans", 微软雅黑, sans-serif')
    for (const fontFamily of ['serif; color:red', 'url(x)', 'serif/*comment*/', '"broken', 'serif,,Arial', '', 'a'.repeat(201), 'var(--font)']) expect(() => parseAppearance(config({ fontFamily }))).toThrow()
  })
  it('falls back safely on invalid stored settings with independent result objects', () => {
    for (const value of [undefined, null, [], '{bad', config({ color: 'url(x)' })]) expect(normalizeAppearance(value)).toEqual(DEFAULT_APPEARANCE)
    const first = normalizeAppearance(null)
    first.global.radius = 0
    expect(normalizeAppearance(null).global.radius).toBeUndefined()
    expect(normalizeAppearance(JSON.stringify(APPEARANCE_PRESETS[0].config))).toEqual(APPEARANCE_PRESETS[0].config)
  })
  it('emits kebab-case names and safe values with property-specific units', () => {
    const variables = appearanceVariables(parseAppearance(config({ fontSize: 15, fontWeight: 600, lineHeight: 1.5, opacity: 0.8, letterSpacing: 0.5, animationDuration: 180, shadow: 'elevated', fontFamily: 'Arial, sans-serif' }, { desktopLyrics: { headingSize: 40, accentColor: '#abcdef' }, trackList: { rowHeight: 52 }, contextMenu: { hoverBackground: 'rgba(0,0,0,.5)' } })))
    expect(variables).toMatchObject({ '--cj-global-font-size': '15px', '--cj-global-font-weight': '600', '--cj-global-line-height': '1.5', '--cj-global-opacity': '0.8', '--cj-global-letter-spacing': '0.5px', '--cj-global-animation-duration': '180ms', '--cj-global-shadow': '0 12px 36px rgba(0, 0, 0, 0.18)', '--cj-global-font-family': 'Arial, sans-serif', '--cj-desktop-lyrics-heading-size': '40px', '--cj-desktop-lyrics-accent-color': '#abcdef', '--cj-track-list-row-height': '52px', '--cj-context-menu-hover-background': 'rgba(0,0,0,.5)' })
    expect(appearanceVariables(parseAppearance(config({ shadow: 'none' })))['--cj-global-shadow']).toBe('none')
    expect(() => appearanceVariables(config({ background: 'url(x)' }) as never)).toThrow()
  })
  it('supports every registered property with valid data in each component', () => {
    for (const entry of APPEARANCE_COMPONENTS) {
      const values: Record<string, unknown> = {}
      for (const key of entry.properties) {
        const info = APPEARANCE_PROPERTIES[key]
        values[key] = info.type === 'number' ? info.min : info.type === 'color' ? '#abc' : info.type === 'select' ? 'soft' : 'Arial, sans-serif'
      }
      const parsed = parseAppearance(config({}, { [entry.id]: values }))
      expect(Object.keys(parsed.components[entry.id] as AppearanceStyle)).toHaveLength(entry.properties.length)
      expect(Object.keys(appearanceVariables(parsed))).toHaveLength(entry.properties.length)
    }
  })
})
