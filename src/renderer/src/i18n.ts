import { shallowRef } from 'vue'

export type InterfaceLanguage = 'zh-CN' | 'zh-TW' | 'en-US'
export type TranslationEntry = string | { 'en-US': string; 'zh-TW'?: string }

/* UI phrases only. Never pass song titles, authors, lyrics, comments or user names
 * to t(). Templates preserve their interpolated metadata byte for byte. */
const dictionary: Record<string, TranslationEntry> = Object.fromEntries(`
琛瑾|Chenjin
音乐|Music
琛瑾音乐|Chenjin Music
琛瑾音乐首页|Chenjin Music home
在线音乐|Online music
主导航|Main navigation
为你推荐|For you
发现音乐|Discover music
下载管理|Downloads
音源管理|Music sources
我的歌单|My playlists
新建歌单|New playlist
创建歌单|Create playlist
你的音乐，自在收藏|Your music, your collection
浏览器预览 · 未连接桌面|Browser preview · Desktop disconnected
设置|Settings
返回首页|Back to home
为每一次聆听而设计|Designed for every listening moment
搜索歌曲、艺人、专辑|Search songs, artists and albums
搜索音乐|Search music
搜索建议|Search suggestions
最近搜索|Recent searches
清空|Clear
关闭搜索建议|Close search suggestions
平台热门搜索|Trending searches on this platform
从一个喜欢的名字开始。|Start with a name you love.
切换明暗主题|Toggle light and dark theme
最小化窗口|Minimize window
最大化窗口|Maximize window
关闭窗口|Close window
你正在浏览界面预览。打开桌面客户端即可导入歌曲、连接音源与播放。|You are viewing an interface preview. Open the desktop app to import songs, connect music sources and play music.
关闭错误提示|Dismiss error
正在读取你的音乐库…|Loading your music library…
好时光，值得好音乐|Good times deserve great music
在熟悉的旋律里，发现新的自己。|Find something new in familiar melodies.
属于你的音乐空间|Your own music space
把世界调成|Tune the world to
你喜欢的频率。|your favorite frequency.
从第一首喜欢的歌开始，让每段日常都有自己的背景音乐。|Start with a song you love and give every day its own soundtrack.
播放我的音乐|Play my music
导入本地音乐|Import local music
探索新声音|Explore new sounds
我的音乐角落|My music corner
收藏每一种心情。|A collection for every mood.
心动的声音|Sounds you love
私人收藏|Personal collection
为心情建一张歌单|Make a playlist for your mood
把喜欢留在这里|Keep your favorites here
继续聆听|Keep listening
让旋律接着流动。|Let the melodies flow.
查看队列|View queue
你的下一首好歌，还在路上|Your next favorite song is on its way
导入音乐或接入音源，即可开始你的聆听旅程。|Import music or connect a music source to start listening.
管理音源|Manage music sources
从不同的音乐世界，遇见值得循环的声音。|Explore different musical worlds and find sounds worth repeating.
发现平台|Discovery platform
精选歌单|Featured playlists
排行榜|Charts
全部平台|All platforms
等待一个新的音乐世界|A new world of music awaits
当前平台尚无可用内容。切换平台、检查网络或启用支持发现的音源。|No content is available on this platform yet. Switch platforms, check your connection or enable a source that supports discovery.
桌面客户端会从你选择的平台获取真实歌单。|The desktop app fetches playlists from your selected platform.
上一页|Previous page
下一页|Next page
播放全部|Play all
导入音乐|Import music
重命名歌单|Rename playlist
搜索平台|Search platform
本地音乐|Local music
正在载入歌单|Loading playlist
收藏歌单|Save playlist
歌曲列表|Track list
筛选当前列表|Filter this list
根据来源与歌曲 ID 去重|Remove duplicates by source and song ID
去重|Remove duplicates
导出|Export
文本|Text
删除歌单|Delete playlist
导入你信任的音源脚本，连接更多声音。|Import music source scripts you trust to connect to more music.
导入音源|Import music source
音乐来自你选择的音源|Music comes from the sources you choose
脚本提供播放地址与音质能力。仅导入你信任的脚本；平台歌曲资料不代表地址一定可播放。|Scripts provide playback URLs and audio quality options. Import only scripts you trust; platform song information does not guarantee a playable URL.
从链接导入音源脚本|Import a music source script from a URL
导入链接|Import URL
为音乐打开一扇门|Open a door to music
导入兼容音源脚本，或直接导入本地文件开始播放。|Import a compatible music source script or local files to start playing.
暂无描述|No description
未知作者|Unknown author
停用|Disable
启用|Enable
打开目录|Open folder
把喜欢的音乐带在身边|Take your favorite music with you
在歌曲菜单选择下载，任务与进度会显示在这里。|Choose Download in a song menu to see tasks and progress here.
等待中|Queued
下载中|Downloading
已暂停|Paused
已完成|Completed
下载失败|Download failed
已取消|Cancelled
暂停下载|Pause download
继续下载|Resume download
打开文件|Open file
取消下载|Cancel download
移除任务|Remove task
管理歌单|Manage playlists
创建新歌单|Create a new playlist
添加到歌单|Add to playlist
关闭弹窗|Close dialog
歌单名称|Playlist name
给这份心情取个名字|Give this mood a name
取消|Cancel
删除|Delete
保存|Save
歌曲评论|Song comments
声音里的共鸣|Shared feelings in music
关闭评论|Close comments
暂时没有可用评论。|No comments are available yet.
歌曲 / 艺人|Song / Artist
专辑|Album
来源|Source
时长|Duration
选择全部歌曲|Select all songs
正在寻找好音乐…|Looking for great music…
让音乐从这里开始|Let the music start here
导入本地歌曲，或在搜索与发现中找到想听的声音。|Import local songs or find something to listen to in Search and Discover.
未知艺人|Unknown artist
播放|Play
暂停|Pause
稍后播放|Play later
下一首播放|Play next
下载|Download
移除|Remove
下载歌曲|Download song
查看评论|View comments
不喜欢这首歌曲|Dislike this song
向上移动|Move up
向下移动|Move down
从歌单移除|Remove from playlist
关闭菜单|Close menu
音乐播放器|Music player
打开歌词|Open lyrics
此刻，留给音乐|This moment is for music
选择一首歌曲开始聆听|Choose a song to start listening
收藏当前歌曲|Favorite current song
列表循环|Repeat all
随机播放|Shuffle
顺序播放|Play in order
单曲循环|Repeat one
上一首|Previous track
下一首|Next track
打开完整歌词|Open full lyrics
播放进度|Playback progress
取消静音|Unmute
静音|Mute
音量|Volume
桌面歌词|Desktop lyrics
打开播放队列|Open play queue
播放队列|Play queue
关闭播放队列|Close play queue
接下来播放|Up next
清空队列|Clear queue
优先播放，然后返回原列表|Play these first, then return to the original list
播放列表|Playlist
拖动歌曲调整顺序|Drag songs to reorder
队列空空，先选一首喜欢的歌。|The queue is empty. Choose a song you love first.
完整歌词|Full lyrics
关闭歌词|Close lyrics
让音乐慢慢响起|Let the music begin
选择一首歌，开启聆听|Choose a song and start listening
译|Translation
音|Romanization
逐字歌词|Word-synced lyrics
逐行歌词|Line-synced lyrics
暂无可用歌词，静静享受音乐。|No lyrics are available. Enjoy the music.
播放或暂停|Play or pause
锁定歌词|Lock lyrics
置顶歌词|Keep lyrics on top
关闭桌面歌词|Close desktop lyrics
琛瑾音乐 · 等待播放|Chenjin Music · Waiting for playback
外观与体验|Appearance and experience
播放与音效|Playback and effects
歌词|Lyrics
快捷键|Keyboard shortcuts
桌面与网络|Desktop and network
设备同步|Device sync
备份与迁移|Backup and migration
不喜欢的音乐|Disliked music
关于与更新|About and updates
界面动效|Interface animations
遵循系统减少动态效果偏好|Respect the system preference for reduced motion
保持音调|Preserve pitch
调整速度时尽量保持原有音高|Keep the original pitch when changing playback speed
启动后继续播放|Resume playback on startup
恢复上一次的播放队列|Restore the previous play queue
记住播放进度|Remember playback position
下次继续未听完的内容|Continue where you left off next time
自动跳过不可用歌曲|Automatically skip unavailable songs
播放失败时继续队列|Continue the queue when playback fails
频谱可视化|Audio spectrum visualization
在播放器中显示实时音频频谱|Show a live audio spectrum in the player
显示翻译|Show translations
歌曲有翻译时展示|Show translations when available
显示罗马音|Show romanization
歌曲有罗马音时展示|Show romanization when available
启用下载|Enable downloads
由音源提供可用下载地址|Download URLs are supplied by the music source
下载歌词|Download lyrics
保存歌曲对应的歌词文件|Save the song's lyrics file
嵌入封面|Embed cover art
将专辑图片写入支持的文件|Write album artwork into supported files
嵌入歌词|Embed lyrics
将歌词写入支持的文件|Write lyrics into supported files
跳过已有文件|Skip existing files
避免重复下载|Avoid duplicate downloads
系统托盘|System tray
从托盘快速控制播放|Control playback from the system tray
关闭窗口时最小化|Minimize when closing the window
音乐继续在后台播放|Keep music playing in the background
播放时防止休眠|Prevent sleep during playback
保持持续聆听|Keep listening without interruption
记录搜索历史|Save search history
保存最近搜索关键词|Remember recent search terms
显示热门搜索|Show trending searches
从所选平台获取真实热搜|Get trending searches from the selected platform
启用 Open API|Enable Open API
允许外部程序控制播放|Allow external programs to control playback
允许局域网 API|Allow API access on the local network
与同网络设备连接|Connect to devices on the same network
让每一次聆听，都更合心意。|Make every listening moment your own.
设置分类|Settings categories
下载目录|Download folder
系统音乐目录|System music folder
选择|Choose
同时下载数量|Concurrent downloads
文件名模板|Filename template
{name} 歌名 · {singer} 艺人|{name} Song title · {singer} Artist
网络代理|Network proxy
API 端口|API port
浏览器界面预览|Browser interface preview
更新服务地址|Update service URL
配置你的更新服务|Configure your update service
打开下载目录|Open download folder
酷我音乐|Kuwo Music
酷狗音乐|Kugou Music
QQ 音乐|QQ Music
网易云音乐|NetEase Cloud Music
咪咕音乐|Migu Music
界面语言|Interface language
语言|Language
简体中文|Simplified Chinese
繁體中文|Traditional Chinese
繁体中文|Traditional Chinese
英语|English
主题|Theme
明暗之间，自在切换|Switch freely between light and dark
深色|Dark
浅色|Light
跟随系统|Follow system
强调色|Accent color
字体|Font
留空使用系统字体|Leave blank to use the system font
系统默认|System default
自定义主题颜色|Custom theme colors
主背景|Main background
侧栏背景|Sidebar background
卡片背景|Card background
正文颜色|Text color
辅助文字|Secondary text
恢复主题配色|Restore theme colors
主题文件|Theme file
仅包含外观，不包含个人资料库|Includes appearance only, without your personal library
导入|Import
导入主题文件|Import theme file
主题文件超过 100 KB|Theme file exceeds 100 KB
主题已应用|Theme applied
主题文件格式无效|Invalid theme file format
不是受支持的琛瑾音乐主题文件|Unsupported Chenjin Music theme file
主题模式或强调色无效|Invalid theme mode or accent color
默认音质|Default audio quality
标准 · 128k|Standard · 128k
高品质 · 320k|High quality · 320k
无损 · FLAC|Lossless · FLAC
播放速度|Playback speed
输出设备|Output device
移除设备时自动回到系统默认|Return to the system default when a device is removed
音频输出设备|Audio output device
输出通道|Output channels
单声道|Mono
立体声|Stereo
音效预设|Effect presets
重置全部音效|Reset all effects
十段均衡器|10-band equalizer
归零|Reset to zero
原声|Original sound
温暖人声|Warm vocals
低音增强|Bass boost
音乐厅|Concert hall
旋转声场|Rotating sound field
独立变调|Independent pitch shift
双读头 AudioWorklet · 约 40 ms 窗口 · 保持播放速度|Dual-read-head AudioWorklet · About 40 ms window · Preserves playback speed
变调半音|Pitch shift in semitones
首次播放后会初始化音频线程；初始化失败会保留原声播放，并显示原因。|The audio thread initializes after first playback. If initialization fails, the original audio continues and the reason is shown.
卷积混响|Convolution reverb
0% 原声 · 100% 纯混响|0% dry · 100% wet
混响干湿混合|Reverb dry/wet mix
混响尾音|Reverb tail
混响尾音秒数|Reverb tail in seconds
低频振荡器平滑控制左右声像|A low-frequency oscillator smoothly moves the stereo image
声场转速|Sound field rotation speed
定时停止|Sleep timer
当前歌曲结束后停止|Stop after the current song
关闭|Off
打开|On
当前歌曲结束|End of current song
指定时间|Specific time
停止时间|Stop time
若已过，将在明天这个时间停止|If this time has passed, stop at the same time tomorrow
到时等当前歌曲播完|Wait for the current song to finish
歌词样式|Lyrics style
居中逐行|Centered lines
左侧对齐|Left aligned
聚焦 / 卡拉 OK|Focus / Karaoke
简繁转换|Chinese script conversion
使用完整 OpenCC 字典，按需加载|Uses the full OpenCC dictionary, loaded on demand
保持原文|Keep original text
也可输入本机已安装的字体名称|You can also enter the name of an installed font
字号|Font size
歌词字号|Lyrics font size
行高|Line height
歌词行高|Lyrics line height
加粗歌词|Bold lyrics
逐字高亮|Highlight each word
支持 LX、YRC、KRC、QRC 有时间标记的歌词|Supports timed lyrics in LX, YRC, KRC and QRC formats
普通歌词颜色|Lyrics color
高亮歌词颜色|Highlighted lyrics color
歌词背景|Lyrics background
歌词背景色|Lyrics background color
跟随主题|Follow theme
歌词偏移|Lyrics offset
正值使歌词提前|Positive values display lyrics earlier
歌词偏移毫秒|Lyrics offset in milliseconds
毫秒|Milliseconds
桌面歌词锁定 / 置顶|Lock desktop lyrics / Keep on top
锁定|Lock
解锁|Unlock
置顶|Keep on top
播放 / 暂停|Play / Pause
提高音量|Volume up
降低音量|Volume down
空格|Space
点击输入框后按下新的组合键。Delete 清除。快捷键在应用窗口内生效，编辑文本时暂停匹配。|Click an input and press a new key combination. Press Delete to clear it. Shortcuts work inside the app window and are suspended while editing text.
未设置|Not set
恢复默认快捷键|Restore default shortcuts
全局快捷键|Global shortcuts
由桌面服务注册，应用在后台时也可使用。输入 Electron 组合键，例如 CommandOrControl+Alt+Space；媒体键可以使用 MediaPlayPause。留空停用该动作。|Registered by the desktop service and available while the app is in the background. Enter an Electron shortcut such as CommandOrControl+Alt+Space, or a media key such as MediaPlayPause. Leave blank to disable the action.
将歌单与不喜欢的歌曲同步到自己的设备。配置与连接状态来自桌面同步服务。|Sync playlists and disliked songs across your devices. Configuration and connection status come from the desktop sync service.
浏览器预览未连接桌面同步服务。|The browser preview is not connected to the desktop sync service.
启用同步|Enable sync
工作角色|Role
服务端 · 供其他设备连接|Server · Accept connections from other devices
客户端 · 连接另一台设备|Client · Connect to another device
服务端地址|Server address
同步端口|Sync port
正在读取同步状态…|Loading sync status…
尚未连接|Not connected
刷新|Refresh
连接码|Connection code
在另一台设备的客户端输入这个连接码。|Enter this code in the client on your other device.
服务端连接码|Server connection code
连接码或服务密码|Connection code or service password
验证并连接|Verify and connect
选择这次同步的方式|Choose how to sync this time
歌单|Playlist
不喜欢的歌曲|Disliked songs
合并 · 本地 → 远端|Merge · Local → Remote
合并两个设备的内容，以本地为主。|Merge both devices, giving priority to local content.
合并 · 远端 → 本地|Merge · Remote → Local
合并两个设备的内容，以远端为主。|Merge both devices, giving priority to remote content.
覆盖 · 本地 → 远端|Overwrite · Local → Remote
用本地内容替换远端同名列表；保留远端额外歌单。|Replace matching remote lists with local content; keep extra remote playlists.
覆盖 · 远端 → 本地|Overwrite · Remote → Local
用远端内容替换本地对应列表；保留本地额外歌单。|Replace matching local lists with remote content; keep extra local playlists.
完整镜像 · 本地 → 远端|Full mirror · Local → Remote
完整按本地内容同步远端，包括删除内容。|Mirror all local content to the remote device, including deletions.
完整镜像 · 远端 → 本地|Full mirror · Remote → Local
完整按远端内容同步本地，包括删除内容。|Mirror all remote content locally, including deletions.
取消本次同步|Cancel this sync
已授权设备|Authorized devices
尚无已授权设备。完成连接后，真实设备状态会显示在这里。|No devices are authorized yet. Device status will appear here after connecting.
已连接|Connected
离线|Offline
移除授权|Revoke authorization
应用更新|App updates
从配置的更新服务检查新版本|Check the configured update service for new versions
正在检查…|Checking…
检查更新|Check for updates
已是最新版本|You are up to date
当前安装形式不支持应用内安装，可从发布渠道获取更新。|This installation does not support in-app installation. Get updates from the release channel.
正在下载更新|Downloading update
更新下载进度|Update download progress
安装并重启|Install and restart
下载新版本|Download new version
为歌单与设置留一份备份。导入旧 LX 目录时，桌面服务会读取兼容数据；音乐文件不会被复制。|Back up your playlists and settings. When importing an old LX folder, the desktop service reads compatible data; music files are not copied.
导出范围|Export scope
完整资料库|Entire library
仅设置|Settings only
指定歌单|Selected playlist
选择歌单|Choose playlist
备份格式|Backup format
琛瑾音乐备份|Chenjin Music backup
LX 兼容 JSON|LX-compatible JSON
保存备份|Save backup
导出备份|Export backup
歌曲清单|Song list
方便阅读、整理或在表格软件中打开|Easy to read, organize or open in a spreadsheet
导入时合并歌单|Merge playlists on import
关闭则按备份恢复资料库|Turn off to restore the library from the backup
导入备份文件|Import backup file
选择备份|Choose backup
导入旧 LX 数据目录|Import old LX data folder
选择旧应用的数据文件夹|Choose the old app's data folder
选择目录|Choose folder
资料库|Library
播放时会跳过这些规则匹配的歌曲。歌曲名称与艺人规则适用于不同音源，也兼容旧资料库中的歌曲 ID。|Songs matching these rules are skipped during playback. Song title and artist rules work across sources; song IDs from old libraries are also supported.
规则类型|Rule type
歌曲|Song
歌手|Artist
歌曲名称|Song title
要跳过的歌曲|Song to skip
歌手名称|Artist name
艺人（可选）|Artist (optional)
艺人名称|Artist name
添加规则|Add rule
已保存规则|Saved rules
清空全部|Clear all
确认移除全部不喜欢规则？|Remove all dislike rules?
确认清空|Confirm clear
没有不喜欢的规则。歌曲菜单也可以直接添加。|No dislike rules yet. You can also add them from a song menu.
全部艺人|All artists
不喜欢规则已保存|Dislike rule saved
备份已导出|Backup exported
资料库已导入|Library imported
歌曲列表已导出|Song list exported
音源脚本已导入|Music source script imported
已加入不喜欢，将在播放时跳过|Added to dislikes; this song will be skipped during playback
已加入下载队列|Added to the download queue
备份已导入|Backup imported
已导出到所选位置|Exported to the selected location
评论接口没有返回数组|The comments service returned an invalid response
此功能需要在琛瑾音乐桌面客户端中使用|This feature requires the Chenjin Music desktop app
输出设备已移除，已切换到系统默认设备|Output device removed; switched to the system default
这首歌曲已设为不喜欢，请在设置中移除规则后播放|This song is disliked. Remove the rule in Settings to play it.
定时停止已完成|Sleep timer finished
已设为下一首播放|Set to play next
音频无法播放，请检查文件、音源或网络|Unable to play audio. Check the file, music source or connection.
当前环境不支持输出设备切换|Output device switching is not supported in this environment
更新在线歌单|Update online playlist
向上移动歌单|Move playlist up
向下移动歌单|Move playlist down
在线歌单已更新|Online playlist updated
请输入歌单 ID 或有效的在线歌单链接|Enter a playlist ID or a valid online playlist URL
歌单链接必须为 HTTP 或 HTTPS|Playlist URLs must use HTTP or HTTPS
暂不支持这个平台的歌单链接，请输入 ID 并选择平台|Playlist URLs from this platform are not supported yet. Enter the ID and choose a platform.
未在链接中找到歌单 ID，请从平台分享页面复制完整链接|No playlist ID was found in the URL. Copy the full URL from the platform's sharing page.
当前歌曲没有可用的平台资料编号|This song has no available platform metadata ID
资料库备份|Library backup
保存歌单、偏好与音源配置。|Save playlists, preferences and music source configuration.
导入备份|Import backup
移除下载任务|Remove download task
返回列表|Back to list
移动到歌单|Move to playlist
复制到歌单|Copy to playlist
返回|Back
音乐平台|Music platform
歌单分类|Playlist categories
歌单排序|Playlist order
热门|Popular
最新|Newest
全部|All
全部歌单|All playlists
打开在线歌单|Open online playlist
粘贴歌单链接或输入歌单 ID|Paste a playlist URL or enter a playlist ID
重试|Retry
正在连接音乐平台…|Connecting to the music platform…
重新加载|Reload
歌曲资料|Song details
关闭歌曲资料|Close song details
正在读取平台资料…|Loading platform information…
歌曲编号|Song ID
文件位置|File location
文件格式|File format
可用音质|Available audio qualities
打开专辑|Open album
打开艺人|Open artist
当前资料没有封面。平台资料请求不会生成虚构的图片。|No cover artwork is available. Platform requests do not generate placeholder artwork.
分类|Category
正在收藏…|Saving…
收藏关联歌单|Save linked playlist
正在读取资料|Loading information
正在读取…|Loading…
打开歌单|Open playlist
当前平台尚无可用内容。切换平台、分类或检查网络后重试。|No content is available on this platform yet. Try a different platform or category, or check your connection.
在线歌单已收藏，可在我的歌单中手动更新|Online playlist saved. You can update it manually in My playlists.
当前 Web Audio 环境不支持输出设备切换|Output device switching is not supported in this Web Audio environment
`.trim().split('\n').map(row => { const at = row.indexOf('|'); return [row.slice(0, at), row.slice(at + 1)] }))

const revision = shallowRef(0)
let traditional: ((text: string) => string) | undefined
let conversion: Promise<void> | undefined
const listeners = new Set<() => void>()
const traditionalCache = new Map<string, string>()

export function normalizeInterfaceLanguage(language: string): InterfaceLanguage {
  if (/^(zh[-_](tw|hk|hant)(?:[-_].*)?|traditional)$/i.test(language)) return 'zh-TW'
  if (/^en(?:[-_].*)?$/i.test(language)) return 'en-US'
  return 'zh-CN'
}

/** The only OpenCC import: never loaded for Simplified Chinese or English. */
export async function ensureInterfaceLanguage(language: string): Promise<void> {
  if (normalizeInterfaceLanguage(language) !== 'zh-TW' || traditional) return
  conversion ||= import('opencc-js').then(({ Converter }) => {
    // The installed OpenCC supports twp (Taiwan phrases); the project's older
    // ambient declaration lists only cn/tw/hk. Keep this compatibility local.
    const converter = Converter as (options: { from: string; to: string }) => (text: string) => string
    traditional = converter({ from: 'cn', to: 'twp' })
    revision.value++
    for (const listener of listeners) listener()
  }).catch(error => { conversion = undefined; throw error })
  await conversion
}

/** Extend the known UI vocabulary, for example when adding a new settings page. */
export function registerTranslations(entries: Record<string, TranslationEntry>): void {
  Object.assign(dictionary, entries)
  traditionalCache.clear()
  revision.value++
  for (const listener of listeners) listener()
}

function phrase(source: string, language: InterfaceLanguage): string {
  const entry = dictionary[source]
  if (language === 'en-US') return typeof entry === 'string' ? entry : entry['en-US']
  if (language === 'zh-TW') {
    if (typeof entry !== 'string' && entry['zh-TW']) return entry['zh-TW']
    if (!traditional) return source
    if (!traditionalCache.has(source)) traditionalCache.set(source, traditional(source))
    return traditionalCache.get(source)!
  }
  return source
}

type Template = { source: string; english: string; pattern: RegExp; ui?: string[] }
const templates: Template[] = []
function template(source: string, english: string, types: Record<string, string> = {}, ui: string[] = []): void {
  let pattern = '^', end = 0
  for (const match of source.matchAll(/\{(\w+)\}/g)) {
    pattern += escapeRegex(source.slice(end, match.index)) + `(?<${match[1]}>${types[match[1]] || '[\\s\\S]+?'})`
    end = match.index! + match[0].length
  }
  pattern += escapeRegex(source.slice(end)) + '$'
  templates.push({ source, english, pattern: new RegExp(pattern), ui })
}
function escapeRegex(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
const number = '[+-]?[\\d,]+(?:\\.\\d+)?'
const n = { n: number }
template('{n} 首歌曲', '{n} songs', n)
template('{n} 首', '{n} songs', n)
template('已选择 {n} 个任务', '{n} tasks selected', n)
template('选择下载任务 {value}', 'Select download task {value}')
template('已选择 {n} 首', '{n} songs selected', n)
template('已导入 {n} 首歌曲', 'Imported {n} songs', n)
template('已加入稍后播放 · {n} 首', 'Added to Play later · {n} songs', n)
template('你已收藏 {n} 首歌曲。熟悉的声音，随时为你响起。', 'You have saved {n} songs. Familiar sounds are always ready to play.', n)
template('{n} 首 · 心动的声音', '{n} songs · Sounds you love', n)
template('{n} 首 · 私人收藏', '{n} songs · Personal collection', n)
template('{n} 首歌曲 · 创建于 {date}', '{n} songs · Created on {date}', n)
template('{n} 个结果 · {platform}', '{n} results · {platform}', n, ['platform'])
template('{n} 个已启用', '{n} enabled', n)
template('{n} 首已完成 · {running} 首正在下载', '{n} completed · {running} downloading', { ...n, running: number })
template('为 {n} 首歌曲选择一个归属。', 'Choose a playlist for {n} songs.', n)
template('{n} 次播放', '{n} plays', n)
template(' · {n} 次播放', ' · {n} plays', n)
template('{n} 人喜欢', '{n} likes', n)
template('{n} 台', '{n} devices', n)
template('{n} 分钟后', 'In {n} minutes', n)
template('{n} 通道（设备最大）', '{n} channels (device maximum)', n)
template('设备最多 {n} 通道；立体声内容保持原有声道', 'Device supports up to {n} channels; stereo content keeps its original channels', n)
template('{n}Hz 增益', '{n}Hz gain', n)
template('{n} 半音', '{n} semitones', n)
template('歌词偏移 {n} ms · {style}', 'Lyrics offset {n} ms · {style}', n, ['style'])
template('{time} 起，等当前歌曲结束', 'From {time}, wait for the current song to finish')
template('{time} 停止', 'Stop at {time}')
template('按 Enter 搜索「{value}」', 'Press Enter to search for “{value}”')
template('确定删除「{value}」？本地音乐文件会保留。', 'Delete “{value}”? Local music files will be kept.')
template('正在连接 {platform}…', 'Connecting to {platform}…', {}, ['platform'])
template('正在优先播放 · {value}', 'Playing first · {value}')
template('歌手 · {value}', 'Artist · {value}')
template('向上移动 {value}', 'Move {value} up')
template('向下移动 {value}', 'Move {value} down')
template('移除 {value}', 'Remove {value}')
template('选择 {value}', 'Select {value}')
template('播放 {value}', 'Play {value}')
template('收藏 {value}', 'Favorite {value}')
template('{value} 更多操作', 'More actions for {value}')
template('{value} 下载进度', 'Download progress for {value}')
template('这个组合已用于「{action}」', 'This combination is already assigned to “{action}”', {}, ['action'])
template('{action}全局快捷键', '{action} global shortcut', {}, ['action'])
template('{action}快捷键', '{action} shortcut', {}, ['action'])
template('版本 {version}', 'Version {version}')
template('当前版本 {version}', 'Current version {version}')
template('发现新版本 {version}', 'New version available: {version}', { version: '[\\s\\S]*' })
template('{version} 已下载，安装会重新启动应用。', '{version} downloaded. Installation will restart the app.')
template(' · 上次连接 {date}', ' · Last connected {date}')
template('主题颜色 {key} 无效', 'Invalid theme color: {key}')
template('无法枚举输出设备：{error}', 'Unable to list output devices: {error}')
template('独立变调不可用：{error}', 'Independent pitch shifting unavailable: {error}')
template('部分平台暂不可用：{error}', 'Some platforms are temporarily unavailable: {error}')
template('输出设备切换失败：{error}', 'Failed to switch output device: {error}')

templates.sort((a, b) => b.source.replace(/\{\w+\}/g, '').length - a.source.replace(/\{\w+\}/g, '').length)

function translateKnown(text: string, language: InterfaceLanguage): string | undefined {
  if (Object.hasOwn(dictionary, text)) return phrase(text, language)
  for (const item of templates) {
    const match = item.pattern.exec(text)
    if (!match?.groups) continue
    const parts = (language === 'en-US' ? item.english : item.source).split(/(\{\w+\})/g)
    return parts.map(part => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1]
      if (key) return item.ui?.includes(key) ? t(match.groups![key], language) : match.groups![key]
      return language === 'zh-TW' ? traditional?.(part) ?? part : part
    }).join('')
  }
  return undefined
}

/** Synchronous and Vue-reactive. Await ensureInterfaceLanguage('zh-TW') when
 * changing language, or let the reactive revision re-render after lazy loading.
 * Unknown strings are deliberately returned unchanged, even in Traditional Chinese. */
export function t(text: string, language: string): string {
  void revision.value
  const target = normalizeInterfaceLanguage(language)
  if (target === 'zh-TW' && !traditional) void ensureInterfaceLanguage(target).catch(() => {})
  const direct = translateKnown(text, target)
  if (direct !== undefined) return direct
  const trimmed = text.trim()
  if (trimmed && trimmed !== text) {
    const translated = translateKnown(trimmed, target)
    if (translated !== undefined) return text.slice(0, text.indexOf(trimmed)) + translated + text.slice(text.indexOf(trimmed) + trimmed.length)
  }
  return text
}

// Strong exclusions always win over data-i18n and over exact dictionary matches.
// Metadata can legitimately be named “播放”, “设置”, etc.; vocabulary alone is unsafe.
const ignored = '.desktop-word-content, [data-i18n-ignore], [translate="no"], [contenteditable]:not([contenteditable="false"]), script, style, textarea, .lyric-scroll, .lyric-line, .lyric-word, .desktop-lyric > p, .comment, .release-notes, .suggestion, .search-popover .chips, .dislike-rule > span, .sync-device strong, .source-info h3, .source-info p, .source-info small, .download-info strong, .download-info small:not(:has([data-i18n])), .lyrics-art h2, .lyrics-art p, .lyrics-art > small:first-of-type, .now-playing strong, .now-playing small, .track-title strong, .track-title small, .album, .source-label, .queue-track-name, .priority-current, .playlist-nav .text-ellipsis, .playlist-card:not(.new-playlist-card) strong, .discovery-grid .playlist-card small, .collect-choice span, .comments-modal .section-title small, .playlist-heading h1, .playlist-heading > div > p:not(.eyebrow), .tag-group:not(:first-child), .chips:not(.lyrics-art .chips):not(.tag-group:first-child .chips) button'
// No unrestricted tree-wide phrase substitution. Only established UI containers
// and explicit data-i18n opt-ins are considered by the compatibility adapter.
const uiRegions = '.download-toolbar, .download-clear, .user-effects, .alternatives-help, .online-import, .discovery-filters > .section-title, .tag-group:first-child > span, .details-grid dt, .details-loading, .details-note, [data-i18n], .nav-label, .sidebar-bottom, .sidebar nav:not(.playlist-nav), .brand, .topbar-caption, .section-title, .page-heading, .welcome-hero, .hero-content, .home-section, .quiet-empty, .new-playlist-card, .playlist-card small, .tabs, .pagination, .list-toolbar, .selection-bar, .track-head, .context-menu, .empty-state, .preview-banner, .error-banner, .info-card, .source-url-form, .button-row, .modal-field, .modal-actions, .modal > form > p, .modal > p, .toast, .settings-layout, .setting-row, .settings-help, .sync-help, .sync-status, .sync-mode-grid, .connection-form, .connection-code, .sync-conflict h3, .sync-conflict > button, .sync-device small, .sync-device > button, .update-panel, .about-brand, .backup-help, .dislike-help, .dislike-heading, .clear-confirm, .queue-actions, .queue-section-title, .lyrics-art .chips, .lyrics-art > small:last-child, .transport-buttons, .player-tools'
const control = 'button, input, select, option, label, summary, [role="dialog"], [role="table"], [role="search"], [role="navigation"], nav, .player-bar, .full-lyrics, .queue-drawer'
const attrs = ['aria-label', 'placeholder', 'title'] as const
// Only option values and labels that occur as static controls in the renderer.
// Playlist IDs and output-device names are arbitrary metadata and never qualify.
const staticOptions: Record<string, string[]> = {
  '': ['选择预设'],
  hot: ['热门'], new: ['最新'],
  top: ['列表顶部'], bottom: ['列表底部'], horizontal: ['横向'], vertical: ['纵向'],
  queued: ['等待中'], running: ['下载中'], paused: ['已暂停'], completed: ['已完成'], failed: ['下载失败'], cancelled: ['已取消'],
  all: ['完整资料库', '全部平台', '全部任务'], settings: ['仅设置'], playlist: ['指定歌单'],
  default: ['系统默认', '琛瑾音乐备份'], lx: ['LX 兼容 JSON'],
  song: ['歌曲'], artist: ['歌手'], center: ['居中逐行'], left: ['左侧对齐'], karaoke: ['聚焦 / 卡拉 OK'],
  original: ['保持原文'], simplified: ['简体中文'], traditional: ['繁體中文'],
  '128k': ['标准 · 128k'], '320k': ['高品质 · 320k'], flac: ['无损 · FLAC'],
  off: ['关闭'], track: ['当前歌曲结束'], clock: ['指定时间'],
  server: ['服务端 · 供其他设备连接'], client: ['客户端 · 连接另一台设备'],
  local: ['本地音乐'], kw: ['酷我音乐'], kg: ['酷狗音乐'], tx: ['QQ 音乐'], wy: ['网易云音乐'], mg: ['咪咕音乐'],
  'zh-CN': ['简体中文'], 'zh-TW': ['繁體中文', '繁体中文'], 'en-US': ['English', '英语'],
}

/** Legacy static-template adapter. Explicit t() calls are preferred for new UI.
 * Does not touch input.value, song/playlist metadata, lyrics or comments.
 * setLanguage is awaitable (including lazy OpenCC); dispose restores originals. */
export function installInterfaceTranslation(root: HTMLElement): { setLanguage: (language: string) => Promise<void>; dispose: () => void } {
  type RecordValue = { source: string; rendered: string }
  const texts = new Map<Text, RecordValue>()
  const attributes = new Map<Element, Map<string, RecordValue>>()
  let language: InterfaceLanguage = 'zh-CN', disposed = false, scheduled = false
  const view = root.ownerDocument.defaultView
  const Observer = view?.MutationObserver ?? globalThis.MutationObserver
  const blocked = (element: Element): boolean => !!element.closest(ignored)
  function update(current: string, record: RecordValue | undefined): RecordValue {
    // Vue may replace text/attributes in-place; only our own last rendering can
    // be reversed. Every external change becomes a new original value.
    const source = record && current === record.rendered ? record.source : current
    return { source, rendered: t(source, language) }
  }
  function scan(node: Node): void {
    if (node.nodeType === 3) {
      const text = node as Text, parent = text.parentElement
      if (!parent || blocked(parent) || parent.closest('input, textarea')) return
      if (parent.closest('.track-row') && !parent.closest('.context-menu')) return
      const option = parent.closest('option')
      const optionLabel = option?.closest('.setting-row')?.querySelector(':scope > span')?.textContent?.trim()
      if (optionLabel && ['选择歌单', '選擇歌單', 'Choose playlist'].includes(optionLabel)) return
      if (option && !option.hasAttribute('data-i18n')) {
        const source = texts.get(text)?.source ?? text.data
        const value = option.getAttribute('value') || ''
        const known = staticOptions[value]?.includes(source.trim()) ||
          (/^\d+$/.test(value) && /^(?:\d+ 分钟后|单声道|立体声|\d+ 通道（设备最大）)$/.test(source.trim()))
        if (!known) return
      }
      if (!parent.closest(uiRegions) && !parent.closest('button:not(.playlist-card):not(.collect-choice):not(.queue-track-name)')) return
      const current = text.data, next = update(current, texts.get(text))
      if (next.rendered !== next.source || texts.has(text)) texts.set(text, next)
      if (current !== next.rendered) text.data = next.rendered
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    if (blocked(element)) return
    if (element.matches(control) || element.hasAttribute('data-i18n')) {
      for (const attr of attrs) {
        const current = element.getAttribute(attr)
        if (current === null) { attributes.get(element)?.delete(attr); continue }
        const next = update(current, attributes.get(element)?.get(attr))
        if (next.rendered !== next.source || attributes.get(element)?.has(attr)) {
          if (!attributes.has(element)) attributes.set(element, new Map())
          attributes.get(element)!.set(attr, next)
        }
        if (current !== next.rendered) element.setAttribute(attr, next.rendered)
      }
    }
    for (const child of Array.from(element.childNodes)) scan(child)
  }
  const observe = (): void => observer?.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...attrs, 'class', 'data-i18n', 'data-i18n-ignore', 'translate', 'contenteditable'] })
  function refresh(): void {
    if (disposed) return
    observer?.disconnect()
    // Restore nodes newly marked ignored, without overwriting a Vue change.
    for (const [text, record] of texts) {
      if (!root.contains(text)) { texts.delete(text); continue }
      if (text.parentElement && blocked(text.parentElement)) {
        if (text.data === record.rendered) text.data = record.source
        texts.delete(text)
      }
    }
    for (const [element, records] of attributes) {
      if (!root.contains(element)) { attributes.delete(element); continue }
      if (blocked(element)) {
        for (const [attr, record] of records) if (element.getAttribute(attr) === record.rendered) element.setAttribute(attr, record.source)
        attributes.delete(element)
      }
    }
    scan(root)
    observe()
  }
  function schedule(): void {
    if (disposed || scheduled) return
    scheduled = true
    queueMicrotask(() => { scheduled = false; refresh() })
  }
  const observer = Observer ? new Observer(schedule) : undefined
  listeners.add(schedule)
  refresh()
  return {
    async setLanguage(next: string): Promise<void> {
      if (disposed) return
      language = normalizeInterfaceLanguage(next)
      refresh()
      await ensureInterfaceLanguage(language)
      refresh()
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      observer?.disconnect()
      listeners.delete(schedule)
      for (const [text, record] of texts) if (root.contains(text) && text.data === record.rendered) text.data = record.source
      for (const [element, records] of attributes) if (root.contains(element)) for (const [attr, record] of records) if (element.getAttribute(attr) === record.rendered) element.setAttribute(attr, record.source)
      texts.clear(); attributes.clear()
    },
  }
}
