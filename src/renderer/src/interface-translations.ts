import { registerTranslations } from './i18n'
import './domain/lyric-editor-translations'
import './domain/comment-translations'
import './domain/appearance-translations'
import './domain/close-translations'
import './domain/desktop-translations'

registerTranslations(Object.fromEntries(`
更新说明|Update notes
查看音源更新|View source update
作者主页|Author website
桌面歌词频谱|Desktop lyric spectrum
显示当前播放音频的真实频谱|Show the actual spectrum of the playing audio
限制在屏幕内|Keep within screen
由桌面服务保持歌词窗口位于可见屏幕|Keep the lyric window within the visible screen
持续保持置顶|Keep restoring on-top state
定期恢复已启用的歌词置顶状态|Periodically restore the enabled on-top state
托盘显示歌词|Show lyrics in tray
将当前歌词显示在托盘提示中|Show the current lyric in the tray tooltip
系统浅色主题|System light theme
系统深色主题|System dark theme
默认主题|Default theme
界面字号|Interface font size
缩放文字与控件，保持页面适配窗口|Scale text and controls while fitting the window
托盘图标主题|Tray icon theme
品牌彩色|Brand colors
黑色|Black
白色|White
离开搜索时清空输入|Clear input when leaving search
离开搜索时清空结果|Clear results when leaving search
打开搜索歌单详情时保留搜索状态|Keep the search state when opening playlist details
继续|Resume
不循环|No repeat
自动清理已播放记录|Clear played history automatically
随机播放一轮后重新开始，关闭时播完即停止|Start a new shuffle cycle when all tracks have played; otherwise stop
音效预设已保存|Effect preset saved
预设文件超过 100 KB|The preset file exceeds 100 KB
无效的音效预设文件|Invalid effect preset file
音效预设已导入|Effect presets imported
预设文件超过 100 KB|The preset file exceeds 100 KB
背景图片|Background image
选择背景图片|Choose background image
清除背景|Clear background
背景图片地址|Background image URL
背景透明度|Background opacity
我的主题|My themes
为当前主题起一个名字|Name the current theme
主题名称|Theme name
保存当前主题|Save current theme
选择已保存主题|Select saved theme
选择主题|Choose theme
应用主题|Apply theme
删除主题|Delete theme
主题文件超过 12 MB|The theme file exceeds 12 MB
主题背景地址无效|Invalid theme background URL
歌曲排序字段|Track sort field
歌曲排序方向|Track sort direction
歌名|Title
艺人|Artist
随机排序|Shuffle order
升序|Ascending
降序|Descending
排序歌单|Sort playlist
后退五秒|Seek back five seconds
前进五秒|Seek forward five seconds
取消收藏当前歌曲|Unfavorite current track
不喜欢当前歌曲|Dislike current track
切换桌面歌词|Toggle desktop lyrics
切换桌面歌词锁定|Toggle desktop lyric lock
切换桌面歌词置顶|Toggle desktop lyric on top
最小化或恢复窗口|Minimize or restore window
隐藏或显示窗口|Hide or show window
播放缓存|Playback cache
清除平台歌词与播放缓存，保留手动编辑的歌词|Clear fetched lyrics and playback cache while keeping edited lyrics
清除缓存|Clear cache
播放缓存已清除|Playback cache cleared
输出设备移除时暂停|Pause when the output device is removed
避免设备断开后从其他扬声器继续播放|Prevent playback from continuing through another speaker after disconnecting
输出设备已移除，播放已暂停|Output device removed; playback paused
嵌入翻译歌词|Embed translated lyrics
将翻译追加到音频歌词标签|Append translations to audio lyric tags
嵌入罗马音歌词|Embed romanized lyrics
将罗马音追加到音频歌词标签|Append romanization to audio lyric tags
嵌入逐字歌词|Embed word-timed lyrics
将逐字时间标记写入音频歌词标签|Write word timing to audio lyric tags
缓存统计|Cache statistics
读取缓存统计|Read cache statistics
手动编辑的歌词|Manually edited lyrics
清理编辑版本|Clear edited lyrics
确认删除所有手动编辑的歌词？此操作无法撤销。|Delete all manually edited lyrics? This cannot be undone.
确认清理编辑版本|Confirm clearing edited lyrics
在线资料|Online data
编辑版本|Edited versions
搜索歌单|Search playlists
歌单分类|Playlist categories
分类|Categories
全部歌单|All playlists
热门|Popular
最新|Newest
歌单排序|Playlist order
音乐平台|Music platform
打开在线歌单|Open an online playlist
粘贴歌单链接或输入歌单 ID|Paste a playlist URL or enter its ID
打开歌单|Open playlist
正在读取…|Loading…
返回列表|Back to results
收藏关联歌单|Save linked playlist
正在收藏…|Saving…
复制到歌单|Copy to playlist
移动到歌单|Move to playlist
更新在线歌单|Refresh online playlist
向上移动歌单|Move playlist up
向下移动歌单|Move playlist down
当前平台尚无可用内容。切换平台、分类或检查网络后重试。|No content is available. Try another platform or category, or check your connection.
部分平台暂不可用|Some platforms are unavailable
歌曲资料|Track details
关闭歌曲资料|Close track details
正在读取平台资料…|Loading track details…
正在读取资料|Loading details
打开专辑|Open album
打开艺人|Open artist
歌曲编号|Track ID
文件位置|File location
文件格式|File format
可用音质|Available qualities
当前资料没有封面。平台资料请求不会生成虚构的图片。|This track has no cover artwork available from its platform.
切换歌曲来源|Change track source
关闭来源选择|Close source selector
仅显示歌名、艺人与时长匹配的真实候选。播放地址仍由启用的音源提供。|Candidates match the title, artist and duration. Enabled music sources provide their playback URLs.
正在寻找其他来源…|Finding other sources…
暂未找到匹配的其他来源。|No matching alternative sources were found.
已下载|Downloaded
播放已下载歌曲|Play downloaded track
选择全部下载任务|Select all download tasks
选择全部|Select all
筛选下载任务|Filter download tasks
全部任务|All tasks
全部暂停|Pause all
全部继续|Resume all
清空任务|Clear tasks
确认清空下载任务？已下载的音频文件会保留。|Clear download tasks? Downloaded audio files will be kept.
确认清空|Confirm clear
移除任务|Remove tasks
桌面歌词外观与行为|Desktop lyric appearance and behavior
独立字体|Desktop font
留空跟随完整歌词字体|Leave empty to use the full lyric view font
跟随歌词字体|Use lyric font
独立字号|Desktop font size
排列方向|Text direction
横向|Horizontal
纵向|Vertical
已唱歌词颜色|Sung lyric color
未唱歌词颜色|Upcoming lyric color
不透明度|Opacity
桌面歌词不透明度|Desktop lyric opacity
锁定歌词|Lock lyrics
锁定后鼠标可穿透，解锁请回到此设置|Mouse clicks pass through locked lyrics. Return here to unlock.
始终置顶|Always on top
暂停时隐藏|Hide when paused
暂停播放时由桌面服务隐藏窗口|Hide the lyric window when playback pauses
应用全屏时隐藏|Hide when the app is fullscreen
应用进入全屏时由桌面服务隐藏窗口|Hide lyrics while the music app is fullscreen
鼠标经过时隐藏|Hide on hover
仅锁定时生效，避免歌词遮挡操作|Works while locked so lyrics do not obstruct your work
显示在任务栏|Show in taskbar
允许从任务栏切换到桌面歌词|Switch to desktop lyrics from the taskbar
自动切换播放来源|Switch playback source automatically
当前来源不可用时寻找匹配歌曲|Find a matching track when the current source is unavailable
优先播放已下载歌曲|Prefer downloaded audio
下载完成且文件存在时直接播放本地文件|Play the local file when a completed download is available
点击歌曲播放整个列表|Play the whole list on track click
关闭时只播放选中的单首歌曲|When disabled, only the selected track plays
自动更新关联歌单|Refresh linked playlists automatically
由桌面客户端更新收藏的在线歌单|The desktop client refreshes saved online playlists
下载翻译歌词|Download translated lyrics
保存平台提供的歌词翻译|Save translated lyrics provided by the platform
下载罗马音歌词|Download romanized lyrics
保存平台提供的罗马音|Save romanized lyrics provided by the platform
下载逐字歌词|Download word-timed lyrics
保留平台提供的逐字时间标记|Keep word timing provided by the platform
按歌单建立下载目录|Group downloads by playlist
每张歌单使用独立的子目录|Use a separate folder for each playlist
下载时尝试其他来源|Try other download sources
当前下载来源失败时查找匹配歌曲|Find a matching track if the current download source fails
歌词文件编码|Lyric file encoding
新歌曲加入位置|New track position
列表顶部|Top of list
列表底部|Bottom of list
交换翻译与罗马音位置|Swap translation and romanization
将罗马音显示在翻译之前|Show romanization before the translation
关联旧 LX 链接|Open legacy LX links
启用后由琛瑾音乐打开 LX 分享链接|Let Chenjin Music open legacy LX sharing links
自定义卷积响应|Custom impulse response
导入 WAV 响应|Import WAV response
恢复生成混响|Use generated reverb
原声增益|Dry gain
混响增益|Wet gain
我的音效预设|My effect presets
导入预设|Import presets
导出预设|Export presets
为当前音效起一个名字|Name the current effect settings
音效预设名称|Effect preset name
保存当前音效|Save current effects
选择预设|Select preset
应用预设|Apply preset
删除预设|Delete preset
导入音效预设文件|Import effect preset file
`.trim().split('\n').map(line => { const split=line.indexOf('|');return [line.slice(0,split),line.slice(split+1)] })))
