# Renderer UI verification

Verification recorded against the production Electron application, not a mock browser. The renderer owner edited `src/renderer/**`, `tests/player.test.ts`, and `tests/lyrics.test.ts`; sibling owners supplied i18n and lyric-editor/comments modules. Backend and packaging validation belongs to the main agent.

## Automated checks

- `vue-tsc --noEmit`: passed after the final EQ/cache controls and quit-flush/device-removal amendments.
- Final domain and interface suite after all amendments: 53 tests passed: player 20, lyrics 12, i18n 21. This covers queue modes/priority/resume/dislikes, no-repeat random history, independent pitch real waveform frequency/bypass, restricted theme/effect imports, complete sharing URLs, LX/YRC/KRC/QRC timings including document offsets, word progress, OpenCC conversion, and real Chromium/Vue interface translation updates with metadata protection.
- Original `scripts/e2e.cjs` retained its checks and passed all six: real WAV import, HTTP 206 media ranges, playlist create/add, actual playback progression, isolated source contracts, light theme. Latest observed `playing:true`, `progress:0.783673`, `duration:3`, ten filters, AudioContext running, AudioWorklet supported, capability error empty.
- Production build before the final quit-flush/device-removal/EQ/cache amendments: renderer 709.38 kB, CSS 59.31 kB, pitch worker 2.25 kB, OpenCC dictionaries lazy 1195.22 kB. Main agent performs the final unified build and package.

## Real Electron UI operations

| Operation | Observed result |
| --- | --- |
| Shift selection | Selecting row 1 then Shift-clicking row 4 selected four tracks |
| Batch copy | Source remained six tracks, destination received four |
| Batch move | Source became two tracks, destination remained four after deduplication |
| Name descending sort | Real `playlists.sort` placed verification track 5 first |
| Track details | Song metadata displayed in the real detail dialog |
| Interface language | English `Settings`, Taiwan Traditional `設定`, then Simplified Chinese restored |
| Custom themes | A named theme was saved, selected and applied |
| Custom effects | A named effect preset was saved, selected and applied |
| Shortcuts | 21 local actions and 18 global actions were observed in the real UI; the final source additionally exposes global search for 19 global actions |
| Desktop preferences | Full desktop lyric appearance and window behavior controls rendered |
| Download controls | Bulk pause/continue/clear UI rendered with real RPC handlers |
| Online discovery | NetEase supplied 71 category buttons and actual playlist cards |
| Linked collection | Actual playlist `18271967084`, “欧美R&B｜“顶级旋律 开口沦陷””, loaded 98 tracks and was saved with `source:'wy'` and `sourceListId` |
| Song and playlist search | Search for 周杰伦 returned real songs, then real playlists after tab change |
| Album detail | Song menu opened “中国新歌声第二季 第13期” with 16 tracks |
| Singer detail | Song menu opened 周杰伦 with 30 tracks on the current page |
| Lyric editing | Editor save updated the active player lyrics; subsequent backend `lyrics` returned `[00:01]实际编辑歌词二` |

## Audio and desktop rendering

An actual effect probe observed equal-power reverb at mix .3: dry gain .891006529 and wet gain .453990489, impulse length 2.2000208 s, output gain .6000000, running worklet with pitch +5, and nonzero analyser RMS .00914388. This demonstrates a connected audio graph rather than a visual-only control.

A real imported three-second WAV decoded into `ConvolverNode.buffer`. Changing the mix retained the same buffer object (cached decode), while playback and worklet remained active and the error string remained empty.

The real desktop BrowserWindow rendered two timed word spans for 你好. At progress 10.5 s the second word fill was 28.5714%; computed styles were `writing-mode:vertical-rl`, `font-size:30px`, `opacity:0.7`. The status fixture was injected into the actual Electron window after component mount and main playback was stopped so live main status did not overwrite it. This desktop rendering check is a deterministic status fixture; online metadata/search checks above used live provider responses.

## Large libraries and persistence

Track and main/priority queue lists use fixed-height visible windows with overscan and preserve the full source index range. Selection, Shift ranges, Ctrl+A, Home/End navigation, drag ordering and playback operate on the complete arrays. Immutable track metadata is marked raw while list containers and settings stay reactive. A separate performance agent measured the real 10k-track fixture and reports its memory/timing artifacts to the main agent.

The final source also handles `app.flush` by cancelling pending debounce, saving the current queue/priority/progress snapshot, awaiting backend completion, then acknowledging `app.flushReady`. The main agent verifies the final rebuilt fast-exit handshake. Device removal retains the removed device ID, returns routing to default, and pauses if `pauseOnDeviceRemoved` or the legacy `deviceRemovedStop` preference is enabled.

## Final desktop compatibility additions

The final source adds desktop spectrum from 16 averaged groups of actual analyser bins, sampled with playback status and rendered with CSS interpolation; paused audio emits zero levels. It exposes screen bounds, periodic on-top restoration, tray lyrics and auto/brand/black/white tray preferences for the backend desktop service. System appearance changes select independent saved light/dark themes including palette, font and background. Interface font size applies actual Chromium zoom with inverse shell dimensions to preserve the viewport. Search input and results clearing are independent when leaving the search page; online playlist details stay inside that page. Actual search results use an eight-entry session cache, with explicit clearing and late-response invalidation; this has a dedicated regression test. These last additions passed type checking and the 53-case domain/interface suite. Their final rebuilt desktop/native and layout integration checks are assigned to the main agent; no additional production build was started by the renderer owner.

## Final unified integration results

The main agent rebuilt the final production bundle (main 332.70 kB, renderer 725.62 kB, CSS 60.52 kB) and ran `scripts/settings-e2e.cjs`; all six checks passed, with no renderer exceptions. `artifacts/settings-report.json` preserves actual measurements:

- Font size 24 at native 960×660 produced shell bounds exactly 960×660, zoom 1.5, and a clickable fully visible close control. The initial check exposed header overflow; a flexible search field and content-container settings layout fixed it.
- Emulated light/dark media changes selected two independent saved palettes with actual CSS accents `#225588` / `#aa66ee`.
- A real MP3 fed 16 analyser groups through main IPC to the desktop window; the sine wave produced a nonzero first bar around 13.85 px. Main accepts only finite bounded levels from the primary playback window, preventing the desktop's auxiliary store from overwriting playback status.
- The native main-window title showed the sidecar lyric unchanged and cleared it when status-bar lyrics were disabled. Native `setAlwaysOnTop` calls continued while the loop option was enabled; this verifies actual API calls, not interaction with other applications' window stacking.
- A valid isolated script's updateAlert retained its HTTP URL; a real source-card click passed the validated URL to shell. Browser opening was stubbed, and javascript URLs were rejected.
- Search input and result-cache clearing behaved independently on real route transitions and re-entry. Provider responses for this cleanup check were an explicit local fixture, not claimed online-search evidence.

The full final Windows suite passed 192 cases across 25 files. Ubuntu passed 170, with one Windows-specific skip; the 21 DOM language cases ran in Windows Chrome. Independent final packaged Windows/Linux MP3/SQLite/AudioWorklet checks are documented in the release report.

## Evidence provenance and limits

Renderer extended probes were PowerShell here-string scripts executed directly through bundled Node, with JSON stdout captured in the session tool log; they were not persisted as repository test scripts. The isolated test profile for the latest probes was `%TEMP%\chenjin-e2e-ocprNS\userdata`; the standard E2E owns its screenshot/report artifacts. No synthetic songs or counts were added to product code: verification tracks existed only in this isolated profile. No renderer background jobs remain.

Pitch processing uses a dual read-head time-domain delay with approximately 40 ms window, which has audible timbre/latency limitations compared with studio pitch processors. Physical device unplug and remote sync conflicts were not independently exercised in this renderer UI pass. Network providers can reject requests or omit IDs and artwork; errors and missing data are shown rather than invented.
