# 原功能审计（初审快照与最终处理）

初审表保留发现问题时的证据，用于追溯；表中“阻塞”“附加”是当时状态。单曲编辑与偏移、本地多编码/内嵌/KRC和缺失文件兜底、五播放模式与随机池、整表排序、主题背景与系统双主题、自定义IR、托盘/状态栏/置顶/频谱、旧偏好迁移和搜索清理现已补齐。最终状态和已执行／未执行的验证以[功能矩阵](FEATURE_MATRIX.md)、[界面验收](UI_VERIFICATION.md)、[本地歌词测试](../tests/local-lyrics.test.ts)、[旧偏好迁移](LEGACY_PREFERENCES.md)及各兼容报告为准。云端账号、云端存储、服务部署已由用户排除。

在线来源补齐后：四源逐字与扩展、酷狗标签五排序、五源热门/新评论及回复图片、咪咕热搜已实现且有真实Electron验收。酷狗个人分享码/chain/PC/全局收藏与网易短链/token已实现；全局收藏真实返回30hash对应27音频ID，符合原SDK按音频去重。其他分享结构通过fixture，私人账号样本未作真人验证。详见[来源验证记录](<PROVIDER_ORIGINAL_FEATURE_VERIFICATION.md>)。下表对应行保留初审问题证据；最终状态以验证记录为准。

以[原默认设置](<../../lx-music-desktop/src/common/defaultSetting.ts>)、[路由](<../../lx-music-desktop/src/renderer/router.ts>)及实际设置/窗口/SDK活代码为准。[FAQ](<../../lx-music-desktop/FAQ.md>)正文是旧注释，只交叉参考。这是补齐前快照；主代理并行修改，结束需重查。视觉差异不计缺口。阻塞=不能宣称全原功能；附加=独立设置/迁移/管理差距；无=有实现证据而非全在线验收。

| 原能力 | 新实现证据 | 缺口级别 |
|---|---|---|
| 单曲整份歌词偏移保存/恢复，原译音逐字同步；[原菜单](<../../lx-music-desktop/src/renderer/components/layout/PlayDetail/components/LyricMenu.vue:121>) | [LyricsView](<../src/renderer/src/components/LyricsView.vue:57>)仅全局lyricOffset，[缓存](<../electron/main/services/lyric-cache.ts>)无编辑与原始区分 | **阻塞**；无原自由文本/逐行时间编辑器证据 |
| 本地LRC编码识别/KRC/内嵌LYRICS及USLT；[原工具](<../../lx-music-desktop/src/renderer/utils/music.ts:173>) | [新歌词](<../electron/main/index.ts:224>)仅UTF8 LRC和新sidecar，导入不保留内嵌 | **阻塞**三类读取 |
| 本地文件/歌词/封面缺失跨源兜底；[原local](<../../lx-music-desktop/src/renderer/core/music/local.ts:69>) | [解析](<../electron/main/index.ts:129>)realpath失败报错，[歌词](<../electron/main/index.ts:224>)不匹配在线 | **阻塞**；普通在线匹配已有 |
| KG KRC/TX QRC/MG MRC/KW lrcx获取解码；[原KG](<../../lx-music-desktop/src/renderer/utils/musicSdk/kg/lyric.js:53>)、[TX](<../../lx-music-desktop/src/renderer/utils/musicSdk/tx/lyric.js:225>)、[MG](<../../lx-music-desktop/src/renderer/utils/musicSdk/mg/lyric.js:81>)、[KW](<../../lx-music-desktop/src/renderer/utils/musicSdk/kw/lyric.js:228>) | [provider](<../electron/main/services/providers.ts:158>)只普通歌词，[parser](<../src/renderer/src/domain/lyrics.ts>)不能代替获取解密 | **阻塞**四源逐字/扩展，交本代理；WY yrc已有 |
| 五模式含none、随机未播放池耗尽重置；[原player](<../../lx-music-desktop/src/renderer/core/player/action.ts:450>)、[worker](<../../lx-music-desktop/src/renderer/worker/main/list.ts:43>) | [新player](<../src/renderer/src/domain/player.ts:11>)只排除当前，[类型](<../src/shared/types.ts>)四模式 | **阻塞** |
| 整表名称歌手专辑时长来源升降序/随机；[原排序](<../../lx-music-desktop/src/renderer/views/List/MyList/components/ListSortModal.vue>) | [TrackList](<../src/renderer/src/components/TrackList.vue>)只拖动移动 | **阻塞** |
| KG标签与推荐热门最新热藏飙升五排序；[原发现](<../../lx-music-desktop/src/renderer/utils/musicSdk/kg/songList.js:18>) | [provider](<../electron/main/services/providers.ts:118>)忽略tag/sort、拒绝标签 | **阻塞**，交本代理 |
| KG个人分享码/command/chain/global_collection_id/PC，WY短链/id###token；[原KG](<../../lx-music-desktop/src/renderer/utils/musicSdk/kg/songList.js:739>)、[WY](<../../lx-music-desktop/src/renderer/utils/musicSdk/wy/songList.js:49>) | [前端](<../src/renderer/src/domain/online.ts>)丢token，[后端](<../electron/main/services/providers.ts:124>)直接###有但无特殊分享跳转 | **阻塞**，后端交本代理；普通歌单完整分页已有 |
| 热门最新评论/附带回复图片；[原评论](<../../lx-music-desktop/src/renderer/components/layout/PlayDetail/components/MusicComment/index.vue:16>)、[楼层](<../../lx-music-desktop/src/renderer/components/layout/PlayDetail/components/MusicComment/CommentFloor.vue:20>) | [provider](<../electron/main/services/providers.ts:168>)普通且丢reply/images，[详情](<../src/renderer/src/components/TrackDetailPanel.vue>)无热门 | **阻塞**，交本代理后端；原无发帖基线 |
| 背景图/多主题/自动亮暗独立选择；[原编辑](<../../lx-music-desktop/src/renderer/views/Setting/components/ThemeEditModal/index.vue:370>)、[选择](<../../lx-music-desktop/src/renderer/views/Setting/components/ThemeSelectorModal.vue>) | [设置](<../src/renderer/src/components/ThemeSettings.vue>)、[格式](<../src/renderer/src/domain/theme.ts>)单份色font | **阻塞**，原.lxtheme外部格式无证据 |
| 六路由/五有效源搜索发现榜单 | [App](<../src/renderer/src/App.vue>)、[OnlinePanel](<../src/renderer/src/components/OnlinePanel.vue>)、[providers](<../electron/main/services/providers.ts>) | 无整体缺失；[原XM](<../../lx-music-desktop/src/renderer/utils/musicSdk/xm.js>)全reject不算有效第六源 |
| 历史建议热搜 | [SearchBox](<../src/renderer/src/components/SearchBox.vue>)、[provider](<../electron/main/services/providers.ts:177>) | **附加**：MG热搜未实现，[原MG](<../../lx-music-desktop/src/renderer/utils/musicSdk/mg/hotSearch.js>)活代码，今日接口可用待测 |
| 歌单搜索专辑歌手详情 | [provider](<../electron/main/services/providers.ts:193>) | 无整体缺失，KW/MG原无独立singer不虚构 |
| 列表增删改名复制重排/多选内搜索移动去重；[原菜单](<../../lx-music-desktop/src/renderer/views/List/MyList/useMenu.js>) | [PlaylistPanel](<../src/renderer/src/components/PlaylistPanel.vue>)、[TrackList](<../src/renderer/src/components/TrackList.vue>)、[library](<../electron/main/services/library.ts>) | 无，字段排序另列 |
| 多本地文件导入；[原actions](<../../lx-music-desktop/src/renderer/views/List/MyList/actions.ts>) | [导入](<../electron/main/index.ts:156>)metadata封面多选 | 无，原没有递归文件夹基线 |
| 关联列表更新；[原更新](<../../lx-music-desktop/src/renderer/views/List/MyList/useListUpdate.ts>) | [刷新及定时](<../electron/main/index.ts:290>) | 无，特殊分享另列 |
| 试听喜欢不喜欢/播放暂停上下首seek音量静音品质 | [store](<../src/renderer/src/store.ts>)、[player](<../src/renderer/src/domain/player.ts>)、[PlayerBar](<../src/renderer/src/components/PlayerBar.vue>)、[DislikePanel](<../src/renderer/src/components/DislikePanel.vue>) | 无 |
| 稍后队列历史重启进度/在线匹配错误切源优先已下载 | [store](<../src/renderer/src/store.ts>)、[queue](<../src/renderer/src/domain/queue.ts>)、[匹配](<../src/shared/song-match.ts>)、[解析](<../electron/main/index.ts:140>) | 无整体缺失，随机/本地另列 |
| 定时/本曲结束停止、EQ/IR空间变调输出设备通道可视化 | [AudioSettings](<../src/renderer/src/components/AudioSettings.vue>)、[player](<../src/renderer/src/domain/player.ts>)、[Visualizer](<../src/renderer/src/components/Visualizer.vue>) | 无整体缺失；旧wait迁移另验 |
| 可选设备移除停止 | [audio](<../src/renderer/src/domain/player.ts>)无条件回默认，[迁移](<../src/shared/legacy-settings.ts>)只deviceRemovedStop | **附加** |
| 用户预设保存应用删除；[原IPC](<../../lx-music-desktop/src/main/modules/winMain/rendererEvent/soundEffect.ts>) | [UserEffectPresets](<../src/renderer/src/components/UserEffectPresets.vue>) | 无整体缺失；[字段](<../src/renderer/src/domain/effects.ts>)无IR/normalize关联待核 |
| 歌词显示译音交换简繁字体点行seek | [parser](<../src/renderer/src/domain/lyrics.ts>)、[转换](<../src/renderer/src/domain/lyric-text.ts>)、[LyricsView](<../src/renderer/src/components/LyricsView.vue>) | 无框架缺失，获取偏移本地另列 |
| 桌面窗穿透置顶拖动缩放字体方向色透明/暂停主窗全屏锁定悬停隐藏任务栏 | [desktop](<../electron/main/services/desktop.ts>)、[DesktopLyric](<../src/renderer/src/components/DesktopLyric.vue>)、[设置](<../src/renderer/src/components/DesktopLyricSettings.vue>) | 无整体缺失；[原全屏](<../../lx-music-desktop/src/main/modules/winLyric/index.ts:38>)只主窗 |
| 桌面循环置顶/限制屏内/频谱/延迟滚动；[原设置](<../../lx-music-desktop/src/renderer/views/Setting/components/SettingDesktopLyric.vue>) | [desktop](<../electron/main/services/desktop.ts>)、[DesktopLyric](<../src/renderer/src/components/DesktopLyric.vue>)无这些控制/数据 | **附加** |
| 状态栏歌词 | [迁移](<../src/shared/legacy-settings.ts>)只有字段，[desktop](<../electron/main/services/desktop.ts>)无更新 | **附加** |
| 下载并发暂停继续重试取消断点品质/命名分目录跳过覆盖跨源封面 | [downloads](<../electron/main/services/downloads.ts>)、[DownloadPanel](<../src/renderer/src/components/DownloadPanel.vue>)、[设置](<../src/renderer/src/components/SettingsPanel.vue>)、[FLAC](<../electron/main/services/flac-tags.ts>) | 无整体缺失 |
| UTF8GBK原译音逐字/扩展嵌入；[原build](<../../lx-music-desktop/src/renderer/worker/download/lrcTool.ts:81>) | [downloads](<../electron/main/services/downloads.ts:89>)sidecar有、标签仅lyric | **附加**awlrc封装/嵌译音逐字，sidecar不列缺失 |
| LXMC/JSON全量设置全部单列表/TXTCSV | [backup](<../electron/main/services/backup.ts>)、[scope](<../electron/main/services/backup-scope.ts>)、[面板](<../src/renderer/src/components/BackupPanel.vue>) | 无；[原allData](<../../lx-music-desktop/src/renderer/views/Setting/components/SettingBackup.vue:175>)只有setting+playList |
| 原目录列表不喜欢下载配置脚本 | [legacy-import](<../electron/main/services/legacy-import.ts>) | 无整体缺失 |
| 原模式/快捷键主题音效运行恢复 | [迁移](<../src/shared/legacy-settings.ts>)没list→order，[normalize](<../electron/main/services/library.ts>)舍list/none，[目录](<../electron/main/services/legacy-import.ts:34>)只legacyThemes/legacySoundEffects/legacyHotkeys | **附加**保存JSON不等于恢复 |
| 原edited歌词/IR/背景资产迁移 | [legacy-import](<../electron/main/services/legacy-import.ts>)无表和复制 | **附加**，不是要求原LXMC包含 |
| 同步双端认证设备列表不喜欢增量六冲突 | [sync](<../electron/main/services/sync/index.ts>)、[data](<../electron/main/services/sync/data.ts>)、[SyncPanel](<../src/renderer/src/components/SyncPanel.vue>) | 无整体缺失，有真实联调 |
| 同步历史快照数量 | [Storage](<../electron/main/services/sync/index.ts:16>)只当前，[面板](<../src/renderer/src/components/SyncPanel.vue>)无数量控制 | **附加** |
| 音源2.0脚本启切删URL/musicUrl pic lyric/网络取消crypto storage env | [runtime](<../electron/main/services/source-runtime.ts>)、[SourcePanel](<../src/renderer/src/components/SourcePanel.vue>) | 无整体缺失，有worker联调 |
| hidden dha dhmkh odt search play/LX深链 | [startup](<../electron/main/services/startup.ts>)、[deeplink](<../electron/main/services/deeplink.ts>)、[入口](<../electron/main/index.ts>) | 无整体缺失，分享另列 |
| 可编辑本地全局快捷键；[原动作](<../../lx-music-desktop/src/common/hotKey.ts>) | [ShortcutSettings](<../src/renderer/src/components/ShortcutSettings.vue>)、[desktop](<../electron/main/services/desktop.ts>) | **附加**最小化隐藏关闭seek喜欢取消不喜欢桌面可见锁置顶，核心已有 |
| 托盘关闭托盘任务栏防睡眠全屏媒体键 | [desktop](<../electron/main/services/desktop.ts>)、[App](<../src/renderer/src/App.vue>) | 无整体缺失 |
| 原生黑白自动托盘主题；[原Other](<../../lx-music-desktop/src/renderer/views/Setting/components/SettingOther.vue:9>) | [desktop](<../electron/main/services/desktop.ts>)固定图标 | **附加** |
| 系统手动代理 | [network](<../electron/main/services/network.ts>)、[设置](<../src/renderer/src/components/SettingsPanel.vue>) | 无，TLS验证保留 |
| 多缓存计数分别清理；[原Other](<../../lx-music-desktop/src/renderer/views/Setting/components/SettingOther.vue:16>) | [cache.clear IPC](<../electron/main/index.ts>)、[缓存](<../electron/main/services/lyric-cache.ts>)有，无前端入口计数 | **附加** |
| ODC深链清输入结果；[原Odc](<../../lx-music-desktop/src/renderer/views/Setting/components/SettingOdc.vue>) | [迁移](<../src/shared/legacy-settings.ts>)两字段无消费者 | **附加** |
| 语言字体缩放动画系统主题 | [设置](<../src/renderer/src/components/SettingsPanel.vue>)、[App](<../src/renderer/src/App.vue>) | 主代理并行补语言，结束重查，视觉不计 |
| 更新说明检查下载取消安装 | [update](<../electron/main/services/update.ts>)、[UpdatePanel](<../src/renderer/src/components/UpdatePanel.vue>) | 无整体缺失，12单元+16Electron夹具通过；没执行安装器，生产需HTTPS直链 |

## OpenAPI全路由

[原服务](<../../lx-music-desktop/src/main/modules/openApi/index.ts>)对[新服务](<../electron/main/services/open-api.ts>)、[消费者](<../src/renderer/src/store.ts:293>)。

| 原能力 | 新实现证据 | 缺口级别 |
|---|---|---|
| enable/ip/port | [configure](<../electron/main/services/open-api.ts>)与[迁移](<../src/shared/legacy-settings.ts>) | 无 |
| GET/status/filter | [新服务](<../electron/main/services/open-api.ts>)LX字段 | 无 |
| /lyric /lyric-all | [新服务](<../electron/main/services/open-api.ts>) | 无路由缺失，歌词来源另列 |
| /play /pause /skip-next /skip-prev | [新服务](<../electron/main/services/open-api.ts>)command | 无 |
| /seek offset秒 /volume百分数 /mute布尔串 | [新服务](<../electron/main/services/open-api.ts>)单位校验 | 无 |
| /collect /uncollect | [新服务](<../electron/main/services/open-api.ts>)→[store](<../src/renderer/src/store.ts:307>) | 无 |
| /subscribe-player-status SSE/filter/变更字段 | [新服务](<../electron/main/services/open-api.ts>) | 无 |
| GET-only/未知401 | [新服务](<../electron/main/services/open-api.ts>) | 无 |

没有原平台登录UI/通用Cookie管理证据；WY###token是特定输入。没有.lxtheme外部格式/自由文本歌词编辑/递归文件夹/有效XM基线。IR预设TXTCSV普通匹配关联更新备份同步不能列整体缺失。原活请求（MG热搜）新没实现不能称原未支持。外部失效不等于没代码，代码也不等于今日成功。此报告不是全GUI和所有源端到端验收，补齐须记录真实词时间/分页/输入/错误，不能以控件parser声明替代。
