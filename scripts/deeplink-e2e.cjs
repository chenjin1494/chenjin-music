/* Production Electron deep-link event routing probe. OS protocol association is
 * intentionally not tested: events are emitted through Electron's real handlers.
 * All WAVs, library state and userData are isolated temporary test fixtures. */
const { _electron: electron, expect } = require('@playwright/test')
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')

function wav(seconds = 90) {
  const rate = 22050, samples = rate * seconds, data = Buffer.alloc(44 + samples * 2)
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28)
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++) data.writeInt16LE(Math.round(Math.sin(index * 2 * Math.PI * 220 / rate) * 700), 44 + index * 2)
  return data
}
const storeExpression = () => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music')
async function main() {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chenjin-deeplink-'))
  const userData = path.join(temp, 'userdata'), output = path.resolve(process.env.DEEPLINK_OUTPUT_DIR || path.join(root, 'artifacts', `deeplink-${new Date().toISOString().replace(/[:.]/g, '-')}`))
  await fs.mkdir(output, { recursive: true })
  const env = { ...process.env, CHENJIN_TEST_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL; delete env.PORTABLE_EXECUTABLE_DIR
  const report = { started: new Date().toISOString(), output, checks: [], errors: [], runtimeErrors: [], blockedExternalRequests: [], routes: [], note: 'Real production Electron event handlers and renderer UI, not OS protocol registration. Network is blocked for search-route checks; no online results or accounts are used.', fixtures: { userData, directory: temp, generatedWavSeconds: 90 }, sessions: [] }
  let app, page, imported, queueIds, priorityId, lastLaunch
  const check = (name, value, evidence) => { assert(value, name); report.checks.push({ name, passed: true, evidence }) }
  async function launch(args = []) {
    app = await electron.launch({ args: [root, ...args], env, timeout: 45000 })
    // Block actual HTTP(S), while preserving local chenjin-media playback.
    await app.evaluate(({ session }) => { globalThis.__deeplinkBlocked = []; session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => { globalThis.__deeplinkBlocked.push(details.url); callback({ cancel: true }) }) })
    page = await app.firstWindow(); page.setDefaultTimeout(30000)
    page.on('pageerror', error => report.runtimeErrors.push(error.message))
    await page.waitForFunction(() => document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('music')?.hydrated)
    lastLaunch = { args, url: page.url(), visible: await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()) }
    if(!args.includes('--hidden')){await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);lastLaunch.visible=true}
    report.sessions.push(lastLaunch)
    const info = await call('app.info')
    check('Temporary userData verified before writes', path.resolve(info.userData) === path.resolve(userData), info)
    await page.evaluate(() => { window.__deeplinkEvents = []; window.__deeplinkErrors = []; window.chenjin.on('app.deeplink', event => window.__deeplinkEvents.push(event)); window.chenjin.on('app.error', event => window.__deeplinkErrors.push(event.message)) })
  }
  const call = (method, params) => page.evaluate(({ method, params }) => window.chenjin.invoke(method, params), { method, params })
  const snapshot = () => page.evaluate(() => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return { queueIds: store.queue.map(track => track.id), priorityIds: store.priorityQueue.map(track => track.id), currentId: store.current?.id, priorityCurrentId: store.priorityCurrent?.id, index: store.currentIndex, paused: store.service.audio.paused, playing: store.playing, currentTime: store.service.audio.currentTime, history: store.history.map(track => track.id), dislikes: [...store.library.dislikes], errors: [...window.__deeplinkErrors], events: [...window.__deeplinkEvents] } })
  async function open(raw) {
    report.routes.push({ kind: 'open-url', raw: Buffer.byteLength(raw) >= 16000 ? `oversized (${Buffer.byteLength(raw)} bytes)` : raw })
    await app.evaluate(({ app }, raw) => app.emit('open-url', { preventDefault() {} }, raw), raw)
  }
  async function second(args) {
    report.routes.push({ kind: 'second-instance', args })
    await app.evaluate(({ app }, args) => app.emit('second-instance', {}, ['electron', 'chenjin-music', ...args], process.cwd()), args)
  }
  async function errorFrom(raw, contains) {
    const before = (await snapshot()).errors.length
    await open(raw)
    await page.waitForFunction(count => window.__deeplinkErrors.length > count, before)
    const state = await snapshot(), message = state.errors.at(-1)
    check(`Malformed route reports ${contains}`, message.includes(contains) && message.startsWith('链接打开失败：'), message)
    return state
  }
  async function close() {
    if (!app) return
    report.blockedExternalRequests.push(...await app.evaluate(() => globalThis.__deeplinkBlocked || []))
    await app.close(); app = undefined
  }
  try {
    await launch()
    check('Visible production renderer', lastLaunch.visible && lastLaunch.url.startsWith('file:'), lastLaunch)
    await call('settings.update', { hotSearch: false, autoSkip: false, playMode: 'order', associateLegacyScheme: false, startupAutoPlay: false, volume: .04 })
    const files = [path.join(temp, 'Base one.wav'), path.join(temp, 'Base two.wav'), path.join(temp, 'Priority link.wav')]
    await Promise.all(files.map(file => fs.writeFile(file, wav())))
    await app.evaluate(({ dialog }, files) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files }) }, files)
    imported = await call('files.import', { playlistId: 'default' }); check('Three real WAV files imported', imported.length === 3, imported.map(track => ({ id: track.id, source: track.source, duration: track.meta.duration })))
    queueIds = imported.slice(0, 2).map(track => track.id); priorityId = imported[2].id
    await page.waitForFunction(ids => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return ids.every(id => store.library.playlists.find(list => list.id === 'default')?.tracks.some(track => track.id === id)) }, imported.map(track => track.id))
    await page.evaluate(async queueIds => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); const list = store.library.playlists.find(list => list.id === 'default').tracks; await store.play(list.find(track => track.id === queueIds[0]), list.filter(track => queueIds.includes(track.id))) }, queueIds)
    await page.waitForFunction(() => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return store.playing && store.service.audio.currentTime > .1 })

    const disabled = await errorFrom('lxmusic://player/pause', '旧LX链接关联未启用')
    check('Disabled legacy route has no playback or queue side effects', disabled.playing && !disabled.paused && JSON.stringify(disabled.queueIds) === JSON.stringify(queueIds), disabled)
    await call('settings.update', { associateLegacyScheme: true })
    await second(['lxmusic://player/pause'])
    await page.waitForFunction(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').service.audio.paused)
    check('Enabled legacy player action reaches renderer via second-instance', (await snapshot()).paused)
    await open('chenjinmusic://player/togglePlay')
    await page.waitForFunction(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music').playing)
    check('Modern player action reaches renderer via open-url', (await snapshot()).playing)

    const musicLink = `chenjinmusic://music/play?data=${encodeURIComponent(JSON.stringify({ songs: [imported[2]] }))}`
    await open(musicLink)
    await page.waitForFunction(priorityId => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return store.current?.id === priorityId && store.playing && store.service.audio.currentTime > .1 }, priorityId)
    const priority = await snapshot()
    check('Modern authorized local link enters priority playback without replacing the base queue', priority.priorityCurrentId === priorityId && JSON.stringify(priority.queueIds) === JSON.stringify(queueIds) && priority.index === 0, priority)
    await open('chenjinmusic://player/skipNext')
    await page.waitForFunction(id => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return store.current?.id === id && store.playing && !store.priorityCurrent }, queueIds[1])
    const resumed = await snapshot()
    check('Priority playback resumes the base queue at the next track', resumed.currentId === queueIds[1] && resumed.index === 1 && JSON.stringify(resumed.queueIds) === JSON.stringify(queueIds), resumed)

    const searchKeyword = '深链接 中文 & 原文'
    await second([`chenjinmusic://music/search?data=${encodeURIComponent(JSON.stringify({ source: 'wy', keywords: searchKeyword }))}`])
    await page.waitForFunction(keyword => document.querySelector('.search-input')?.value === keyword, searchKeyword)
    const search = await page.evaluate(() => ({ input: document.querySelector('.search-input').value, heading: document.querySelector('main h1')?.textContent, events: window.__deeplinkEvents.filter(event => event.action === 'search') }))
    check('Music search route preserves decoded Chinese keyword in the actual UI', search.input === searchKeyword && search.heading?.includes(searchKeyword) && search.events.at(-1)?.source === 'wy', search)

    const beforeMalformed = await snapshot()
    await errorFrom('chenjinmusic://player/not-a-real-action', '未知player动作')
    await errorFrom('chenjinmusic://music/play?data=%7Binvalid', '链接JSON数据无效')
    const afterOversize = await errorFrom('chenjinmusic://search?keyword=' + '中'.repeat(6000), '链接过长')
    check('Malformed and oversized routes leave active playback and queues unchanged', afterOversize.currentId === beforeMalformed.currentId && afterOversize.playing && JSON.stringify(afterOversize.queueIds) === JSON.stringify(beforeMalformed.queueIds) && JSON.stringify(afterOversize.priorityIds) === JSON.stringify(beforeMalformed.priorityIds), afterOversize)
    report.warmFinal = await snapshot()
    await call('settings.update', { startupAutoPlay: false, hotSearch: false })
    await expect.poll(async () => { const library = await call('library.load'); report.beforeRestartPersistedPlayer = library.player; return { ids: library.player?.queue.map(track => track.id), index: library.player?.resumeIndex } }, { timeout: 15000, intervals: [50, 100, 200] }).toEqual({ ids: queueIds, index: 1 })
    report.beforeRestartLibrary = await call('library.load')
    check('Base queue persisted through the production debounce before restart', JSON.stringify(report.beforeRestartPersistedPlayer.queue.map(track => track.id)) === JSON.stringify(queueIds), report.beforeRestartPersistedPlayer)
    await close()

    // A genuinely new Electron process consumes the startup protocol argument.
    await launch([musicLink])
    await page.waitForFunction(priorityId => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return store.current?.id === priorityId && store.playing && store.service.audio.currentTime > .1 && store.history.some(track => track.id === priorityId) }, priorityId)
    await page.waitForFunction(() => window.__deeplinkEvents.filter(event => event.action === 'priorityPlay').length > 0)
    const cold = await snapshot(), coldDispatches = cold.events.filter(event => event.action === 'priorityPlay')
    report.coldProtocol = cold
    check('Cold protocol argument is dispatched exactly once', coldDispatches.length === 1 && cold.priorityIds.filter(id => id === priorityId).length === 0 && cold.history.filter(id => id === priorityId).length === 1, cold)
    check('Cold authorized local route plays without replacing the persisted base queue', cold.priorityCurrentId === priorityId && JSON.stringify(cold.queueIds) === JSON.stringify(queueIds), cold)
    report.coldProtocol = cold
    await close()

    await launch(['--hidden', '--search=冷启动 中文搜索'])
    lastLaunch.initialVisibility = lastLaunch.visible
    await page.waitForFunction(() => document.querySelector('.search-input')?.value === '冷启动 中文搜索')
    await expect(page.locator('main h1')).toContainText('冷启动 中文搜索')
    const coldSearch = await page.evaluate(() => ({ input: document.querySelector('.search-input').value, heading: document.querySelector('main h1')?.textContent, events: window.__deeplinkEvents.filter(event => event.action === 'search') }))
    check('Hidden startup creates an initially hidden window before command routing', !lastLaunch.initialVisibility, lastLaunch)
    check('Cold --search argument reaches actual Chinese search UI once', coldSearch.input === '冷启动 中文搜索' && coldSearch.heading?.includes('冷启动 中文搜索') && coldSearch.events.length === 1, coldSearch)
    report.coldSearch = coldSearch
    // Intentionally do not wait for debounce here: real users can quit directly
    // after playback begins, and the renderer/main shutdown handshake must flush.
    const reversedQueue = [...queueIds].reverse()
    const fast = await page.evaluate(async ids => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); const tracks = ids.map(id => store.library.playlists.find(list => list.id === 'default').tracks.find(track => track.id === id)); window.__fastQueueStarted = performance.now(); await store.play(tracks[0], tracks); return { started: window.__fastQueueStarted } }, reversedQueue)
    await page.waitForFunction(id => { const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music'); return store.current?.id === id && store.playing && store.service.audio.currentTime > .1 }, reversedQueue[0])
    fast.elapsedBeforeQuitMs = await page.evaluate(() => performance.now() - window.__fastQueueStarted)
    fast.queue = await snapshot()
    check('Immediate quit is requested before the 600ms save debounce', fast.elapsedBeforeQuitMs < 600, fast)
    await close()
    report.fastQuit = fast
    await launch(['--hidden'])
    const restoredFast = await snapshot()
    report.fastQuit.restored = restoredFast
    check('Immediate quit flushes changed base queue and resume position across restart', JSON.stringify(restoredFast.queueIds) === JSON.stringify(reversedQueue) && restoredFast.currentId === reversedQueue[0] && restoredFast.index === 0 && !restoredFast.priorityCurrentId, report.fastQuit)
    check('No renderer runtime exceptions', report.runtimeErrors.length === 0, report.runtimeErrors)
    report.success = true
  } catch (error) {
    report.success = false; report.errors.push(error.stack || String(error)); process.exitCode = 1
  } finally {
    try { await close() } catch (error) { report.errors.push(`close: ${error.message || error}`); process.exitCode = 1 }
    const absolute = path.resolve(temp)
    if (path.dirname(absolute) === path.resolve(os.tmpdir()) && path.basename(absolute).startsWith('chenjin-deeplink-')) { await fs.rm(absolute, { recursive: true, force: true }); report.cleanup = { removedTemporaryDirectory: true, appClosed: !app } }
    else { report.errors.push('Refusing cleanup of unexpected directory'); process.exitCode = 1 }
    report.completed = new Date().toISOString()
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(`DEEPLINK_REPORT=${path.join(output, 'report.json')}`)
    console.log(JSON.stringify(report, null, 2))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
