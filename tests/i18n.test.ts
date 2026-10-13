import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'vite'
import { chromium, type Browser, type Page } from '@playwright/test'
import { parse } from 'vue/compiler-sfc'
const NodeTypes = { ELEMENT: 1, TEXT: 2, INTERPOLATION: 5, ATTRIBUTE: 6 }
import { computed } from 'vue'
import ts from 'typescript'
import { ensureInterfaceLanguage, normalizeInterfaceLanguage, registerTranslations, t } from '../src/renderer/src/i18n'
import '../src/renderer/src/interface-translations'

const renderer = resolve('src/renderer/src')

describe('interface dictionaries', () => {
  it('covers static Chinese text and accessibility labels across every renderer component', () => {
    const files = [resolve(renderer, 'App.vue'), ...readdirSync(resolve(renderer, 'components')).filter(name => name.endsWith('.vue')).map(name => resolve(renderer, 'components', name))]
    const missing = new Set<string>()
    let checked = 0
    for (const file of files) {
      const tree = parse(readFileSync(file, 'utf8')).descriptor.template?.ast
      if (!tree) continue
      const visit = (node: any, siblings: any[] = []) => {
        if (node.type === NodeTypes.TEXT && /\p{Script=Han}/u.test(node.content)) {
          // Static fragments adjoining an interpolation form a numeric template.
          const dynamic = siblings.some(item => item.type === NodeTypes.INTERPOLATION)
          const text = node.content.trim()
          if (!dynamic && text) { checked++; if (t(text, 'en-US') === text) missing.add(text) }
        }
        if (node.type === NodeTypes.ELEMENT) {
          for (const prop of node.props) if (prop.type === NodeTypes.ATTRIBUTE && ['aria-label', 'placeholder', 'title'].includes(prop.name) && /\p{Script=Han}/u.test(prop.value?.content || '')) {
            checked++; if (t(prop.value.content, 'en-US') === prop.value.content) missing.add(prop.value.content)
          }
        }
        for (const child of node.children || []) visit(child, node.children)
      }
      visit(tree)
    }
    expect(checked).toBeGreaterThan(150)
    expect([...missing]).toEqual([])
  })

  it('covers component script labels, setting descriptions and static notifications', () => {
    const missing = new Set<string>()
    for (const name of ['App.vue', ...readdirSync(resolve(renderer, 'components')).filter(name => name.endsWith('.vue')).map(name => `components/${name}`)]) {
      const component = parse(readFileSync(resolve(renderer, name), 'utf8')).descriptor
      const script = ts.createSourceFile(name + '.ts', component.scriptSetup?.content || '', ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node): void => {
        if (ts.isStringLiteral(node) && /\p{Script=Han}/u.test(node.text) && !/\.(?:json|txt|csv)$/.test(node.text) && t(node.text, 'en-US') === node.text) missing.add(node.text)
        ts.forEachChild(node, visit)
      }
      visit(script)
    }
    expect([...missing]).toEqual([])
  })

  it.each([
    ['已选择 12 首', '12 songs selected'],
    ['已导入 3 首歌曲', 'Imported 3 songs'],
    ['已加入稍后播放 · 4 首', 'Added to Play later · 4 songs'],
    ['8 首歌曲', '8 songs'],
    ['15 分钟后', 'In 15 minutes'],
    ['6 通道（设备最大）', '6 channels (device maximum)'],
    ['设备最多 8 通道；立体声内容保持原有声道', 'Device supports up to 8 channels; stereo content keeps its original channels'],
    ['歌词偏移 -500 ms · 逐字歌词', 'Lyrics offset -500 ms · Word-synced lyrics'],
    ['32Hz 增益', '32Hz gain'],
    ['2 首已完成 · 1 首正在下载', '2 completed · 1 downloading'],
    ['当前版本 1.2.3', 'Current version 1.2.3'],
    ['播放 / 暂停全局快捷键', 'Play / Pause global shortcut'],
  ])('translates numeric and state template %s', (source, english) => expect(t(source, 'en-US')).toBe(english))

  it('preserves interpolated song names, keywords and diagnostic payloads', async () => {
    await ensureInterfaceLanguage('zh-TW')
    expect(t('播放 后来，听见你', 'en-US')).toBe('Play 后来，听见你')
    expect(t('移除 后来，听见你', 'zh-TW')).toBe('移除 后来，听见你')
    expect(t('按 Enter 搜索「音乐里的后来的我们」', 'en-US')).toBe('Press Enter to search for “音乐里的后来的我们”')
    expect(t('确定删除「我的音乐」？本地音乐文件会保留。', 'zh-TW')).toBe('確定刪除「我的音乐」？本地音樂檔案會保留。')
    expect(t('输出设备切换失败：设备原文/404', 'en-US')).toBe('Failed to switch output device: 设备原文/404')
    expect(t('输出设备切换失败：设备原文/404', 'zh-TW')).toBe('輸出裝置切換失敗：设备原文/404')
    expect(t('未知在线歌曲的名字', 'zh-TW')).toBe('未知在线歌曲的名字')
  })

  it('loads full Traditional Chinese conversion and invalidates Vue computed translations', async () => {
    const label = computed(() => t('下载管理', 'zh-TW'))
    await ensureInterfaceLanguage('zh-TW')
    expect(label.value).toBe('下載管理')
    expect(t('导入备份文件', 'zh-TW')).toBe('匯入備份檔案')
    expect(t(' 下载 ', 'en-US')).toBe(' Download ')
    expect(t('下载', 'zh-CN')).toBe('下载')
  })

  it('supports custom exact UI phrases and language aliases', () => {
    registerTranslations({ '测试界面项目': { 'en-US': 'Test interface item', 'zh-TW': '測試介面項目' } })
    expect(t('测试界面项目', 'zh-Hant')).toBe('測試介面項目')
    expect(normalizeInterfaceLanguage('en-GB')).toBe('en-US')
    expect(normalizeInterfaceLanguage('zh_CN')).toBe('zh-CN')
    expect(normalizeInterfaceLanguage('not-a-language')).toBe('zh-CN')
  })
})

describe('real browser DOM adapter and Vue updates', () => {
  let browser: Browser, page: Page
  beforeAll(async () => {
    const entry = 'virtual:i18n-browser-tests'
    const output = await build({
      configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      plugins: [{ name: 'i18n-test-entry', resolveId: id => id.includes(entry) ? '\0' + entry : undefined,
        load: id => id === '\0' + entry ? `import * as i18n from ${JSON.stringify(resolve(renderer, 'i18n.ts').replace(/\\/g, '/'))}; import ${JSON.stringify(resolve(renderer, 'interface-translations.ts').replace(/\\/g, '/'))}; import {createApp,h,ref,nextTick} from 'vue'; window.I18nTest = {...i18n,createApp,h,ref,nextTick};` : undefined }],
      build: { write: false, minify: false, lib: { entry, name: 'I18nTest', formats: ['iife'] } },
    })
    const bundles = Array.isArray(output) ? output : [output]
    const code = bundles.flatMap(item => 'output' in item ? item.output : []).find(item => item.type === 'chunk' && item.isEntry)
    if (!code || code.type !== 'chunk') throw new Error('No browser test bundle generated')
    const executablePath = process.env.I18N_TEST_BROWSER || [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ].find(existsSync)
    browser = await chromium.launch({ executablePath, headless: true })
    page = await browser.newPage()
    const browserErrors: string[] = []
    page.on('pageerror', error => browserErrors.push(error.message))
    await page.addScriptTag({ content: code.code })
    if (!await page.evaluate(() => Boolean((window as any).I18nTest))) throw new Error(`Browser bundle failed: ${browserErrors.join('; ')}; ${code.code.slice(0, 200)}`)
  }, 60_000)
  afterAll(async () => { await browser?.close() })

  it('translates known controls, restores Chinese, and never changes coincidentally matching metadata', async () => {
    const result = await page.evaluate(async () => {
      const api = (window as any).I18nTest
      document.body.innerHTML = `<main id="root">
        <div class="section-title"><h2>歌曲列表</h2><small>5 首歌曲</small></div>
        <button aria-label="播放 后来的我们" title="下载歌曲">播放</button>
        <input placeholder="搜索歌曲、艺人、专辑" aria-label="搜索音乐" value="下载" />
        <div class="track-row"><div class="track-title"><strong>下载</strong><small>设置</small></div><span class="album">发现音乐</span><div class="context-menu"><button>稍后播放</button></div></div>
        <nav class="playlist-nav"><span class="text-ellipsis">设置</span></nav>
        <button class="playlist-card"><strong>播放</strong><small>2 首 · 心动的声音</small></button>
        <div class="playlist-heading"><div><h1>发现音乐</h1><p>在线作者音乐</p></div></div>
        <div class="lyrics-art"><h2>下载</h2><p>设置</p><small>音乐</small></div>
        <div class="lyric-scroll"><button class="lyric-line" aria-label="下载">下载</button></div>
        <article class="comment"><strong>设置</strong><p>播放</p></article>
        <button class="suggestion">下载</button><div class="search-popover"><div class="chips"><button>播放</button></div></div>
        <label class="setting-row"><select><option value="user-playlist">下载</option><option value="flac">无损 · FLAC</option></select></label>
        <button data-i18n-ignore title="下载">下载</button><div translate="no"><button>播放</button></div>
        <div data-i18n><span>设置</span></div>
      </main>`
      const root = document.querySelector<HTMLElement>('#root')!
      const adapter = api.installInterfaceTranslation(root)
      await adapter.setLanguage('en-US')
      const ui = [...root.querySelectorAll('.section-title h2,.section-title small,.context-menu button,[data-i18n] span')].map(item => item.textContent)
      const metadata = [...root.querySelectorAll('.track-title strong,.track-title small,.album,.playlist-nav span,.playlist-card strong,.playlist-heading h1,.playlist-heading p,.lyrics-art h2,.lyrics-art p,.lyric-line,.comment strong,.comment p,.suggestion,.search-popover .chips button,option[value="user-playlist"],[data-i18n-ignore],[translate="no"] button')].map(item => item.textContent)
      const input = root.querySelector('input')!
      const values = [input.value, input.placeholder, input.getAttribute('aria-label'), root.querySelector('button')!.getAttribute('aria-label')]
      const options = root.querySelector('option[value="flac"]')!.textContent
      await adapter.setLanguage('zh-TW')
      const tw = root.querySelector('.section-title h2')!.textContent
      await adapter.setLanguage('zh-CN')
      const restored = [root.querySelector('.section-title h2')!.textContent, input.placeholder, root.querySelector('button')!.getAttribute('aria-label')]
      adapter.dispose()
      return { ui, metadata, values, options, tw, restored }
    })
    expect(result.ui).toEqual(['Track list', '5 songs', 'Play later', 'Settings'])
    expect(result.metadata).toEqual(['下载', '设置', '发现音乐', '设置', '播放', '发现音乐', '在线作者音乐', '下载', '设置', '下载', '设置', '播放', '下载', '播放', '下载', '下载', '播放'])
    expect(result.values).toEqual(['下载', 'Search songs, artists and albums', 'Search music', 'Play 后来的我们'])
    expect(result.options).toBe('Lossless · FLAC')
    expect(result.tw).toBe('歌曲列表')
    expect(result.restored).toEqual(['歌曲列表', '搜索歌曲、艺人、专辑', '播放 后来的我们'])
  })

  it('protects desktop word lyrics while translating actual registered effect and alternative UI', async () => {
    const result = await page.evaluate(async () => {
      const api = (window as any).I18nTest
      const description = '仅显示歌名、艺人与时长匹配的真实候选。播放地址仍由启用的音源提供。'
      document.body.innerHTML = `<main id="root"><div class="desktop-word-content" data-i18n><button title="下载">下载</button><span>我的音效预设</span></div><div class="user-effects"><strong>我的音效预设</strong><select><option value="">选择预设</option><option value="custom" data-i18n-ignore>我的音效预设</option></select></div><p class="alternatives-help">${description}</p></main>`
      const root = document.querySelector<HTMLElement>('#root')!
      const adapter = api.installInterfaceTranslation(root)
      await adapter.setLanguage('en-US')
      const english = { lyric: root.querySelector('.desktop-word-content')!.textContent, lyricTitle: root.querySelector('.desktop-word-content button')!.getAttribute('title'), effect: root.querySelector('.user-effects strong')!.textContent, staticOption: root.querySelector('option[value=""]')!.textContent, userOption: root.querySelector('option[value="custom"]')!.textContent, help: root.querySelector('.alternatives-help')!.textContent }
      await adapter.setLanguage('zh-TW')
      const traditional = root.querySelector('.desktop-word-content')!.textContent
      await adapter.setLanguage('zh-CN')
      const restored = [root.querySelector('.user-effects strong')!.textContent, root.querySelector('.alternatives-help')!.textContent]
      adapter.dispose()
      return { english, traditional, restored, description }
    })
    expect(result.english).toEqual({ lyric: '下载我的音效预设', lyricTitle: '下载', effect: 'My effect presets', staticOption: 'Select preset', userOption: '我的音效预设', help: 'Candidates match the title, artist and duration. Enabled music sources provide their playback URLs.' })
    expect(result.traditional).toBe('下载我的音效预设')
    expect(result.restored).toEqual(['我的音效预设', result.description])
  })

  it('translates new static options and marked download status without changing artist metadata', async () => {
    const result = await page.evaluate(async () => {
      const api = (window as any).I18nTest
      document.body.innerHTML = `<main id="root"><div class="download-toolbar"><span>选择全部</span><select><option value="all">全部任务</option><option value="queued">等待中</option></select></div><div class="selection-bar"><span>已选择 2 个任务</span></div><div class="download-info"><strong data-i18n-ignore>下载</strong><small><span data-i18n-ignore>设置 · FLAC</span> · <span data-i18n>下载中</span></small><small class="danger" data-i18n-ignore>播放</small></div><label class="setting-row"><select><option value="top">列表顶部</option><option value="vertical">纵向</option></select></label></main>`
      const root = document.querySelector<HTMLElement>('#root')!
      const adapter = api.installInterfaceTranslation(root)
      await adapter.setLanguage('en-US')
      const translated = [...root.querySelectorAll('.download-toolbar > span,option,.selection-bar span,.download-info [data-i18n]')].map(item => item.textContent)
      const metadata = [...root.querySelectorAll('.download-info [data-i18n-ignore]')].map(item => item.textContent)
      await adapter.setLanguage('zh-CN')
      const restored = root.querySelector('.download-info [data-i18n]')!.textContent
      adapter.dispose()
      return { translated, metadata, restored }
    })
    expect(result.translated).toEqual(['Select all', 'All tasks', 'Queued', '2 tasks selected', 'Downloading', 'Top of list', 'Vertical'])
    expect(result.metadata).toEqual(['下载', '设置 · FLAC', '播放'])
    expect(result.restored).toBe('下载中')
  })

  it('tracks Vue text/attribute replacements and new nodes, ignores metadata updates, and disposes cleanly', async () => {
    const result = await page.evaluate(async () => {
      const api = (window as any).I18nTest
      document.body.innerHTML = '<div id="vue-root"></div>'
      const count = api.ref(2), playing = api.ref(false), song = api.ref('播放'), extra = api.ref(false)
      const app = api.createApp({ setup: () => () => api.h('main', [
        api.h('div', { class: 'selection-bar' }, [api.h('span', `已选择 ${count.value} 首`)]),
        api.h('button', { 'aria-label': playing.value ? '暂停' : '播放' }, playing.value ? '暂停' : '播放'),
        api.h('div', { class: 'track-title' }, [api.h('strong', song.value)]),
        extra.value ? api.h('div', { class: 'section-title' }, [api.h('h2', '下载管理')]) : null,
      ]) })
      app.mount('#vue-root')
      const root = document.querySelector<HTMLElement>('#vue-root')!
      const adapter = api.installInterfaceTranslation(root)
      await adapter.setLanguage('en-US')
      count.value = 9; playing.value = true; song.value = '下载'; extra.value = true
      await api.nextTick(); await new Promise(resolve => setTimeout(resolve, 0))
      const updated = [root.querySelector('.selection-bar span')!.textContent, root.querySelector('button')!.textContent, root.querySelector('button')!.getAttribute('aria-label'), root.querySelector('strong')!.textContent, root.querySelector('h2')!.textContent]
      await adapter.setLanguage('zh-TW')
      const tw = root.querySelector('h2')!.textContent
      await adapter.setLanguage('zh-CN')
      const cn = [root.querySelector('.selection-bar span')!.textContent, root.querySelector('button')!.textContent, root.querySelector('h2')!.textContent]
      await adapter.setLanguage('en-US')
      root.querySelector('h2')!.setAttribute('data-i18n-ignore', '')
      await new Promise(resolve => setTimeout(resolve, 0))
      const ignore = root.querySelector('h2')!.textContent
      adapter.dispose()
      const disposed = root.querySelector('button')!.textContent
      count.value = 10; playing.value = false
      await api.nextTick(); await new Promise(resolve => setTimeout(resolve, 0))
      const after = root.querySelector('.selection-bar span')!.textContent
      app.unmount()
      return { updated, tw, cn, ignore, disposed, after }
    })
    expect(result.updated).toEqual(['9 songs selected', 'Pause', 'Pause', '下载', 'Downloads'])
    expect(result.tw).toBe('下載管理')
    expect(result.cn).toEqual(['已选择 9 首', '暂停', '下载管理'])
    expect(result.ignore).toBe('下载管理')
    expect(result.disposed).toBe('暂停')
    expect(result.after).toBe('已选择 10 首')
  })
})
