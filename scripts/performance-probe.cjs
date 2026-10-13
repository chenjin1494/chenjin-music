/* Real Electron production-build performance and interaction probe.
 * Fixture tracks and a generated WAV are test inputs, not product content.
 * Never runs against the normal user profile; all state lives in mkdtemp.
 * Run only after the production build completes. Does not build or modify out/.
 * Output: PERF_OUTPUT_DIR or artifacts/performance-<timestamp>/report.json + PNGs.
 */
const { _electron: electron } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { performance } = require('node:perf_hooks')

function wave(seconds = 180) {
  const rate = 22050, samples = rate * seconds, buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++) buffer.writeInt16LE(Math.round(Math.sin(index * 2 * Math.PI * 220 / rate) * 1200), 44 + index * 2)
  return buffer
}
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return { samples: values, minimum: sorted[0], median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)], maximum: sorted.at(-1) }
}
async function buildAssets(root) {
  const directory = path.join(root, 'out', 'renderer'), html = await fs.readFile(path.join(directory, 'index.html'), 'utf8')
  const files = await fs.readdir(path.join(directory, 'assets'))
  const assets = []
  for (const name of files) {
    const bytes = await fs.readFile(path.join(directory, 'assets', name))
    assets.push({ file: `out/renderer/assets/${name}`, bytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), modified: (await fs.stat(path.join(directory, 'assets', name))).mtime.toISOString() })
  }
  const initialReferences = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(match => match[1].replace(/^\.\//, '').replace(/^\//, ''))
  const initial = assets.filter(asset => initialReferences.includes(asset.file.replace('out/renderer/', '')))
  return { directory, assets, initialReferences, initialBytes: initial.reduce((sum, item) => sum + item.bytes, 0), initialGzipBytes: initial.reduce((sum, item) => sum + item.gzipBytes, 0), note: 'Disk and gzip sizes, not network transfer timings. Initial references include entry scripts, CSS and HTML modulepreload links; runtime resource entries provide the observed loaded set.' }
}

async function main() {
  const root = path.resolve(__dirname, '..'), count = Math.max(1, Math.min(50000, Number(process.env.PERF_TRACK_COUNT) || 10000))
  const output = path.resolve(process.env.PERF_OUTPUT_DIR || path.join(root, 'artifacts', `performance-${new Date().toISOString().replace(/[:.]/g, '-')}`))
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chenjin-performance-')), userData = path.join(temp, 'userdata')
  const report = { started: new Date().toISOString(), platform: process.platform, host: { node: process.version, architecture: process.arch, cpu: os.cpus()[0]?.model, logicalCores: os.cpus().length, totalMemoryBytes: os.totalmem() }, output, fixture: { count, kind: 'Synthetic performance fixture with production Track structure and one real generated WAV; not real catalog metadata', directory: temp, userData, normalProfileTouched: false, audioSeconds: 180 }, checks: [], steps: [], errors: [], screenshots: [], memory: {}, navigation: [] }
  await fs.mkdir(output, { recursive: true })
  let app, page, closed = false
  const check = (name, passed, evidence) => { report.checks.push({ name, passed: !!passed, evidence }); return !!passed }
  const step = async (name, action) => {
    const started = performance.now()
    try { const result = await action(); report.steps.push({ name, status: 'completed', elapsedMs: performance.now() - started }); return result }
    catch (error) { report.steps.push({ name, status: 'failed', elapsedMs: performance.now() - started, error: String(error?.stack || error) }); report.errors.push(`${name}: ${error.message || error}`); console.error(`PROBE_STEP_FAILED ${name}: ${error.message || error}`); return undefined }
  }
  try {
    report.build = await buildAssets(root)
    const wav = path.join(temp, 'Performance fixture audio.wav')
    await fs.writeFile(wav, wave())
    const env = { ...process.env, CHENJIN_TEST_USER_DATA: userData }
    delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL; delete env.PORTABLE_EXECUTABLE_DIR
    const launched = performance.now()
    app = await electron.launch({ args: [root], env, timeout: 45000 })
    page = await app.firstWindow()
    page.setDefaultTimeout(45000)
    page.on('pageerror', error => report.errors.push(`renderer: ${error.message}`))
    const consoleErrors = []
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForFunction(() => document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('music')?.hydrated, { timeout: 45000 })
    report.startup = { firstHydratedWindowMs: performance.now() - launched, url: page.url(), window: await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows().find(item => !item.isDestroyed()); return { visible: win.isVisible(), bounds: win.getBounds(), contentBounds: win.getContentBounds() } }) }
    check('Production file renderer and visible first window', page.url().startsWith('file:') && report.startup.window.visible, report.startup)
    const call = (method, params) => page.evaluate(({ method, params }) => window.chenjin.invoke(method, params), { method, params })
    report.info = await call('app.info')
    if (path.resolve(report.info.userData) !== path.resolve(userData)) throw new Error(`Refusing fixture writes: actual userData is ${report.info.userData}`)
    check('Temporary userData isolation verified before fixture writes', true, report.info.userData)
    report.runtime = await app.evaluate(() => ({ versions: process.versions, processMemory: process.memoryUsage() }))
    const cdp = await page.context().newCDPSession(page)
    const loadedScripts = new Set()
    cdp.on('Debugger.scriptParsed', ({ url }) => { if (url) loadedScripts.add(url) })
    await cdp.send('Debugger.enable')
    await cdp.send('Runtime.enable')
    report.initialScripts = [...loadedScripts]
    const paint = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now())))))
    const memory = async name => {
      const renderer = await page.evaluate(() => ({ jsHeap: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null, nodes: document.getElementsByTagName('*').length, rows: document.querySelectorAll('.track-row').length, queueRows: document.querySelectorAll('.queue-track').length, timestamp: performance.now() }))
      const processes = await app.evaluate(async ({ app, BrowserWindow }) => {
        const result = { main: await process.getProcessMemoryInfo(), mainNode: process.memoryUsage(), metrics: app.getAppMetrics() }
        const win = BrowserWindow.getAllWindows().find(item => !item.isDestroyed())
        if (win && typeof win.webContents.getProcessMemoryInfo === 'function') result.renderer = await win.webContents.getProcessMemoryInfo()
        return result
      })
      const heap = await cdp.send('Runtime.getHeapUsage')
      report.memory[name] = { renderer: { ...renderer, preciseHeap: heap }, processes, note: 'CDP preciseHeap values and JS heap values are bytes. performance.memory may be rounded or frozen; use CDP values. Electron process memory fields and app metrics memory are KiB. No forced garbage collection.' }
    }
    await memory('initial')
    report.initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize })))

    await step('Import generated real WAV through production files.import', async () => {
      await app.evaluate(({ dialog }, wav) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [wav] }) }, wav)
      const tracks = await call('files.import', { playlistId: 'default' })
      if (tracks.length !== 1 || tracks[0].source !== 'local') throw new Error('Generated WAV import failed')
      report.importedAudio = { id: tracks[0].id, source: tracks[0].source, interval: tracks[0].interval, duration: tracks[0].meta.duration, ext: tracks[0].meta.ext }
      check('Real WAV metadata import and authorization', tracks[0].meta.duration >= 179, report.importedAudio)
    })

    await step('Production IPC save and load of mass library fixture', async () => {
      const result = await page.evaluate(async count => {
        const initial = await window.chenjin.invoke('library.load'), imported = initial.playlists.find(list => list.id === 'default').tracks[0]
        if (!imported) throw new Error('No real imported WAV available')
        const started = performance.now()
        const tracks = Array.from({ length: count }, (_, index) => index === 0 ? imported : { ...imported, id: `performance-fixture-${index + 1}`, name: `Fixture track ${String(index + 1).padStart(5, '0')}`, singer: 'Performance fixture artist', meta: { ...imported.meta, songId: `performance-fixture-${index + 1}`, albumName: `Fixture album ${Math.floor(index / 25)}`, picUrl: null } })
        const state = { ...initial, settings: { ...initial.settings, language: 'zh-CN', theme: 'dark', hotSearch: false, syncEnabled: false, openAPI: false, closeToTray: false, startupAutoPlay: false, volume: .08, desktopLyric: false }, playlists: initial.playlists.map(list => list.id === 'default' ? { ...list, tracks } : list), player: undefined }
        const generationMs = performance.now() - started, serializedBytes = new TextEncoder().encode(JSON.stringify(state)).byteLength
        const saveStarted = performance.now(); await window.chenjin.invoke('library.save', { state }); const saveMs = performance.now() - saveStarted
        const loads = []
        let loadedCount = 0
        for (let index = 0; index < 3; index++) { const began = performance.now(); const loaded = await window.chenjin.invoke('library.load'); loads.push(performance.now() - began); loadedCount = loaded.playlists.find(list => list.id === 'default').tracks.length }
        return { generationMs, serializedBytes, saveMs, loads, loadedCount }
      }, count)
      report.library = { ...result, loadSummaryMs: summary(result.loads), note: 'Save/load timings include real structured-clone IPC, production normalization and SQLite-worker persistence. The file path is shared only by test tracks; metadata labels are synthetic fixture values.' }
      await page.waitForFunction(count => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').library.playlists.find(list => list.id === 'default').tracks.length === count, count)
      check('Mass fixture persisted and hydrated via real library IPC', result.loadedCount === count, report.library)
    })

    const navigate = async (name, selector, index = 0) => {
      const result = await page.evaluate(async ({ selector, index }) => {
        const button = document.querySelectorAll(selector)[index]
        if (!button) throw new Error(`Navigation button missing: ${selector}[${index}]`)
        const started = performance.now(); button.click()
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music')
        return { elapsedMs: performance.now() - started, heading: document.querySelector('main h1')?.textContent, rowCount: document.querySelectorAll('.track-row').length, progress: store.service.audio.currentTime, playing: store.playing, audioPaused: store.service.audio.paused, sameService: !window.__performanceService || window.__performanceService === store.service, sameAudio: !window.__performanceAudio || window.__performanceAudio === store.service.audio }
      }, { selector, index })
      report.navigation.push({ name, ...result })
      return result
    }
    await step('Open 10000-track playlist and inspect rendered DOM', async () => {
      const result = await navigate('mass-playlist', '.playlist-nav .nav-item', 0)
      report.list = { ...result, totalTracks: count, virtualized: result.rowCount < Math.min(count, 200) }
      await memory('massPlaylist')
      check('Track list renders a bounded DOM window for the mass fixture', report.list.virtualized, report.list)
    })

    await step('Mass-list scrolling and last-track reachability', async () => {
      const result = await page.evaluate(async () => {
        const main = document.querySelector('.main-content')
        const candidates = [main, ...main.querySelectorAll('*')].filter(node => node.clientHeight > 50 && node.scrollHeight > node.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(node).overflowY))
        const scroller = candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0]
        if (!scroller) throw new Error('No scrollable mass-list container')
        const frames = [], started = performance.now(); let previous = started
        for (let index = 0; index < 30; index++) { scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * index / 29; await new Promise(resolve => requestAnimationFrame(resolve)); const now = performance.now(); frames.push(now - previous); previous = now }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const rows = [...document.querySelectorAll('.track-row')], visibleRows = rows.filter(row => { const rect = row.getBoundingClientRect(), viewport = scroller.getBoundingClientRect(); return rect.bottom >= viewport.top && rect.top <= viewport.bottom })
        const result = { elapsedMs: performance.now() - started, frames, scrollerClass: scroller.className, scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, domRows: rows.length, visibleRows: visibleRows.length, firstRendered: rows[0]?.querySelector('strong')?.textContent, lastRendered: rows.at(-1)?.querySelector('strong')?.textContent, lastVisible: visibleRows.at(-1)?.querySelector('strong')?.textContent }
        scroller.scrollTop = 0
        return result
      })
      report.scrolling = { ...result, frameSummaryMs: summary(result.frames), note: 'Programmatic scroll offsets and measured requestAnimationFrame intervals; these are not a claim about perceived smoothness.' }
      check('Last fixture track reachable by scrolling', result.lastVisible === `Fixture track ${String(count).padStart(5, '0')}`, report.scrolling)
    })

    await step('Filter mass list through the real input', async () => {
      const started = performance.now(), input = page.locator('.filter-input input').first()
      await input.fill(`Fixture track ${String(count).padStart(5, '0')}`)
      await page.waitForFunction(() => document.querySelectorAll('.track-row').length === 1)
      report.filter = { elapsedMs: performance.now() - started, result: await page.locator('.track-row strong').first().textContent() }
      check('Mass-list filter returns the requested fixture track', report.filter.result === `Fixture track ${String(count).padStart(5, '0')}`, report.filter)
      await input.fill(''); await paint()
    })

    await step('Keyboard End and Home traverse virtual track rows', async () => {
      await page.locator('.track-row').first().focus()
      await page.keyboard.press('End')
      await page.waitForFunction(index => document.activeElement?.getAttribute('data-track-index') === String(index), count - 1)
      const end = await page.evaluate(() => ({ focusedIndex: document.activeElement.getAttribute('data-track-index'), title: document.activeElement.querySelector('strong')?.textContent, domRows: document.querySelectorAll('.track-row').length }))
      await page.keyboard.press('Home')
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-track-index') === '0')
      const home = await page.evaluate(() => ({ focusedIndex: document.activeElement.getAttribute('data-track-index'), domRows: document.querySelectorAll('.track-row').length }))
      report.virtualKeyboard = { end, home }
      check('End reaches last track and Home reaches first with bounded virtual DOM', Number(end.focusedIndex) === count - 1 && home.focusedIndex === '0' && end.domRows < 200 && home.domRows < 200, report.virtualKeyboard)
      await page.evaluate(() => document.activeElement?.blur())
    })

    await step('Real audio playback with mass queue', async () => {
      const started = performance.now()
      await page.evaluate(async () => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); const tracks = store.library.playlists.find(list => list.id === 'default').tracks; await store.play(tracks[0], tracks); window.__performanceService = store.service; window.__performanceAudio = store.service.audio; window.__performanceAudioEvents = []; for (const name of ['pause', 'ended', 'emptied', 'error']) store.service.audio.addEventListener(name, () => window.__performanceAudioEvents.push({ name, time: store.service.audio.currentTime, timestamp: performance.now() })) })
      await page.waitForFunction(() => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return store.playing && store.service.audio.currentTime > .25 })
      report.audio = await page.evaluate(() => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return { playing: store.playing, currentTime: store.service.audio.currentTime, duration: store.service.audio.duration, queue: store.queue.length, context: store.service.context?.state, capabilities: store.audioCapabilities } })
      report.audio.startMs = performance.now() - started
      check('Real WAV playback progresses with a full fixture queue', report.audio.playing && report.audio.currentTime > 0 && report.audio.duration >= 179 && report.audio.queue === count, report.audio)
    })

    await step('Queue drawer mass DOM and Escape', async () => {
      const result = await page.evaluate(async () => {
        const start = performance.now(); document.querySelector('.queue-button').click(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const drawer = document.querySelector('.queue-drawer')
        return { elapsedMs: performance.now() - start, exists: !!drawer, domRows: drawer?.querySelectorAll('.queue-track').length || 0, buttons: drawer?.querySelectorAll('button').length || 0 }
      })
      report.queue = { ...result, totalTracks: count, virtualized: result.domRows < Math.min(count, 200) }
      check('Mass queue drawer opens', result.exists, result)
      check('Mass queue renders a bounded DOM window', report.queue.virtualized, report.queue)
      await memory('queueOpen')
      report.queue.scrolling = await page.evaluate(async () => {
        const drawer = document.querySelector('.queue-drawer')
        const scroller = [drawer, ...drawer.querySelectorAll('*')].filter(node => node.clientHeight > 50 && node.scrollHeight > node.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(node).overflowY)).sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0]
        if (!scroller) return { scrollable: false }
        const started = performance.now(); scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const viewport = scroller.getBoundingClientRect(), rows = [...drawer.querySelectorAll('.queue-track')]
        const visible = rows.filter(row => { const rect = row.getBoundingClientRect(); return rect.bottom >= viewport.top && rect.top <= viewport.bottom })
        return { scrollable: true, elapsedMs: performance.now() - started, scrollerClass: scroller.className, domRows: rows.length, lastVisible: visible.at(-1)?.querySelector('strong')?.textContent }
      })
      check('Last queue fixture reachable by scrolling', report.queue.scrolling.lastVisible === `Fixture track ${String(count).padStart(5, '0')}`, report.queue.scrolling)
      await page.keyboard.press('Escape'); await page.locator('.queue-drawer').waitFor({ state: 'hidden' })
      check('Escape closes queue drawer', true)
    })

    await step('Modal focus loop and keyboard search', async () => {
      await page.locator('.playlist-label button').click()
      await page.locator('[role="dialog"]').waitFor()
      const selectors = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]'
      await page.evaluate(selectors => { const nodes = [...document.querySelector('[role="dialog"]').querySelectorAll(selectors)]; nodes.at(-1).focus() }, selectors)
      await page.keyboard.press('Tab')
      const forward = await page.evaluate(selectors => { const nodes = [...document.querySelector('[role="dialog"]').querySelectorAll(selectors)]; return document.activeElement === nodes[0] }, selectors)
      await page.keyboard.press('Shift+Tab')
      const backward = await page.evaluate(selectors => { const nodes = [...document.querySelector('[role="dialog"]').querySelectorAll(selectors)]; return document.activeElement === nodes.at(-1) }, selectors)
      await page.keyboard.press('Escape'); await page.locator('[role="dialog"]').waitFor({ state: 'hidden' })
      await page.evaluate(() => document.activeElement?.blur())
      await page.keyboard.press('Control+f')
      const search = await page.evaluate(() => document.activeElement === document.querySelector('.search-input'))
      report.keyboard = { modalTabWrap: forward, modalShiftTabWrap: backward, controlFSearch: search }
      check('Modal Tab and Shift+Tab stay inside the dialog', forward && backward, report.keyboard)
      check('Ctrl+F focuses search', search, report.keyboard)
      await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur())
    })

    await step('Navigate while real audio continues without recreating service', async () => {
      for (const [name, selector, index] of [['home', '.sidebar nav:not(.playlist-nav) .nav-item', 0], ['downloads', '.sidebar nav:not(.playlist-nav) .nav-item', 2], ['sources', '.sidebar nav:not(.playlist-nav) .nav-item', 3], ['settings', '.sidebar-bottom .nav-item', 0], ['playlist-return', '.playlist-nav .nav-item', 0]]) {
        const result = await navigate(name, selector, index)
        check(`Audio survives ${name} navigation with the same AudioService and Audio element`, result.playing && !result.audioPaused && result.sameService && result.sameAudio, result)
      }
      report.audio.afterNavigation = await page.evaluate(() => ({ time: window.__performanceAudio.currentTime, paused: window.__performanceAudio.paused, events: window.__performanceAudioEvents }))
      check('Audio time advances across navigation with no pause/empty/error events', report.audio.afterNavigation.time > report.audio.currentTime && !report.audio.afterNavigation.paused && report.audio.afterNavigation.events.length === 0, report.audio.afterNavigation)
    })

    await step('Resize and capture actual theme/language combinations', async () => {
      // Capture settings to show translated labels and real controls. The profile
      // remains isolated; settings.update goes through real IPC and store events.
      await navigate('settings-screenshots', '.sidebar-bottom .nav-item')
      for (const variant of [
        { width: 1360, height: 880, theme: 'dark', language: 'en-US' },
        { width: 960, height: 640, theme: 'light', language: 'en-US' },
        { width: 1360, height: 880, theme: 'dark', language: 'zh-TW' },
        { width: 960, height: 640, theme: 'light', language: 'zh-TW' },
      ]) {
        await app.evaluate(({ BrowserWindow }, size) => { const win = BrowserWindow.getAllWindows().find(item => !item.isDestroyed()); win.setContentSize(size.width, size.height); win.show() }, variant)
        const started = performance.now(); await call('settings.update', { theme: variant.theme, language: variant.language }); await paint()
        const expected = variant.language === 'en-US' ? ['Settings'] : ['設定', '設置']
        let localizationReady = true
        try { await page.waitForFunction(expected => expected.includes(document.querySelector('.page-heading h1')?.textContent?.trim()), expected, { timeout: 10000 }) } catch { localizationReady = false }
        const geometry = await page.evaluate(() => {
          const footer = document.querySelector('.player-bar').getBoundingClientRect(), tools = document.querySelector('.player-tools').getBoundingClientRect()
          return { width: innerWidth, height: innerHeight, documentScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, footer: { left: footer.left, right: footer.right, top: footer.top, bottom: footer.bottom }, tools: { left: tools.left, right: tools.right, top: tools.top, bottom: tools.bottom }, heading: document.querySelector('.page-heading h1')?.textContent, htmlTheme: document.documentElement.dataset.theme, navigationLabels: [...document.querySelectorAll('.settings-nav button')].map(node => node.textContent.trim()), languageValue: document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').settings.language }
        })
        const filename = `${variant.theme}-${variant.language}-${variant.width}x${variant.height}.png`
        await page.screenshot({ path: path.join(output, filename), fullPage: false })
        const record = { ...variant, file: path.join(output, filename), settingsToScreenshotMs: performance.now() - started, localizationReady, geometry, visuallyReviewed: false }
        report.screenshots.push(record)
        check(`${variant.language} interface labels visibly populated in DOM at ${variant.width}x${variant.height}`, localizationReady, geometry)
        check(`${variant.theme} theme applied at ${variant.width}x${variant.height}`, geometry.htmlTheme === variant.theme, geometry.htmlTheme)
        check(`Viewport and player stay within requested ${variant.width}x${variant.height} bounds`, geometry.width === variant.width && geometry.height === variant.height && geometry.documentScrollWidth <= geometry.width + 1 && geometry.footer.right <= geometry.width + 1 && geometry.footer.bottom <= geometry.height + 1 && geometry.tools.right <= geometry.width + 1, geometry)
      }
      await memory('afterNavigationAndScreenshots')
      await cdp.send('HeapProfiler.collectGarbage')
      await app.evaluate(() => { const { setFlagsFromString } = process.getBuiltinModule('v8'); setFlagsFromString('--expose-gc'); const collect = process.getBuiltinModule('vm').runInNewContext('gc'); collect() })
      await memory('diagnosticAfterForcedGC')
      report.memory.diagnosticAfterForcedGC.diagnosticOnly = true
      report.memory.diagnosticAfterForcedGC.note += ' This snapshot deliberately collects main and renderer garbage via V8 and CDP; it is diagnostic live-retention evidence, not normal operation or a baseline performance result.'
    })
    report.finalResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize })))
    report.consoleErrors = consoleErrors
    report.finalScripts = [...loadedScripts]
    const observedInitially = asset => report.initialScripts.some(url => url.endsWith(asset.file.replace('out/renderer', '')))
    const observedFinally = asset => report.finalScripts.some(url => url.endsWith(asset.file.replace('out/renderer', '')))
    report.lazyAssets = {
      initiallyParsedJavaScript: report.build.assets.filter(asset => asset.file.endsWith('.js') && observedInitially(asset)),
      deferredJavaScript: report.build.assets.filter(asset => asset.file.endsWith('.js') && !observedInitially(asset)).map(asset => ({ ...asset, parsedLater: observedFinally(asset) })),
      resourceTimingAvailable: report.initialResources.length > 0,
      note: 'Debugger.scriptParsed enumerates actual V8-loaded JavaScript, including scripts loaded before Debugger.enable. CSS is excluded. file-origin Resource Timing can be empty and is not used to infer loading.'
    }
    await cdp.detach()
  } catch (error) {
    report.errors.push(`fatal: ${error.stack || error}`)
  } finally {
    if (app) {
      try { await app.evaluate(({ app }) => app.quit()); await app.close(); closed = true }
      catch (error) { try { await app.close(); closed = true } catch { report.errors.push(`cleanup: ${error.message || error}`) } }
    }
    report.cleanup = { appClosed: closed, temporaryDirectory: temp, removed: false }
    // Verify the exact absolute target before removal, never normal userData.
    const resolvedTemp = path.resolve(temp), expectedParent = path.resolve(os.tmpdir())
    if (path.dirname(resolvedTemp) === expectedParent && path.basename(resolvedTemp).startsWith('chenjin-performance-')) {
      try { await fs.rm(resolvedTemp, { recursive: true, force: true }); report.cleanup.removed = true }
      catch (error) { report.errors.push(`temporary cleanup: ${error.message || error}`) }
    } else report.errors.push('Refusing cleanup: unexpected temporary directory')
    report.completed = new Date().toISOString()
    report.success = report.errors.length === 0 && report.checks.every(item => item.passed) && report.cleanup.removed
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(`PERFORMANCE_REPORT=${path.join(output, 'report.json')}`)
    console.log(JSON.stringify({ success: report.success, checks: report.checks, steps: report.steps, errors: report.errors, startup: report.startup, library: report.library, list: report.list, scrolling: report.scrolling?.frameSummaryMs, queue: report.queue, cleanup: report.cleanup }, null, 2))
    if (!report.success) process.exitCode = 1
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
