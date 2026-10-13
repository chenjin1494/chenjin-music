# 桌面集成功能兼容报告

DesktopService 独立实现了桌面歌词窗口规则及现有托盘、快捷键、任务栏与电源管理。只读 LX Desktop 的 `winLyric/index.ts`、`main.ts`、`config.ts`、`mouseCheckTools.ts` 和 `utils.ts` 用于核对窗口协议，没有复制其业务源码。

## 窗口与桌面行为

| 功能 | 实现与验证边界 |
| --- | --- |
| 托盘 | 原生Tray、显示/播放暂停/上下首/退出/桌面歌词复选菜单；配置更新时重新构建菜单状态。 |
| 系统快捷键 | 自定义 globalHotkeys 与媒体键；偏好mediaKeys参与注册签名；仅记录和释放本实例成功注册的键，不调用unregisterAll。增加lyric/lyricLock/lyricTop/show动作。快捷键被其他应用占用时Electron可能注册失败。 |
| Windows任务栏 | 播放进度限制0..1；上一首/播放暂停/下一首thumbar按钮；不发送任何真实播放或系统媒体控制以做测试。 |
| 防休眠 | 播放状态下按preventSleep启动prevent-app-suspension；暂停/停止/关闭时释放。此类型防应用休眠，不宣称强制显示器常亮。 |
| 锁定 | setIgnoreMouseEvents(true,{forward:true})及禁止resize；解锁允许鼠标交互和调整；状态改变可保存设置。 |
| 置顶 | floating层alwaysOnTop；可即时切换，不抢主窗口焦点。 |
| 任务栏 | desktopLyricTaskbar控制setSkipTaskbar的反值；0..1 opacity即时设置，包括0。 |
| 空状态 | 尚无歌名/歌词/歌词行时窗口隐藏；播放状态提供内容后showInactive。 |
| 暂停隐藏 | pauseHide且不播放时隐藏；恢复播放且其余隐藏条件消失时恢复。 |
| 全屏隐藏 | 主应用窗口enter-full-screen/leave-full-screen；支持启动时主窗口已全屏。LX只读原`winLyric/index.ts`同样监听自身main_window_fullscreen，没有外部应用全屏探测。 |
| 悬停隐藏 | locked和hoverHide同时开启时，100ms轮询screen.getCursorScreenPoint；在歌词实际屏幕bounds内隐藏，移出恢复。解锁不悬停隐藏，保证可以拖动和编辑。计时器unref且禁用/关闭时清理。 |
| 多显示器 | 使用全部screen.getAllDisplays().workArea；支持负坐标副屏，选择最大重叠或最近屏幕；默认完整限制到工作区，最大尺寸为目标屏幕工作区，最小38×38。desktopLyricScreenLock=false时保留与有效屏幕相交的部分越界位置；无有效相交屏幕、无效尺寸或显示器移除时仍恢复到可见区域。 |
| 显示器变化 | display-added/display-removed/display-metrics-changed触发当前窗口重新限制，防止拔下副屏后歌词丢失；保存修正位置。 |
| 位置保存 | 原生move/resize事件，250ms防抖保存desktopLyricX/Y/Width/Height；相同值不重复写；关闭时刷新尚未防抖保存的位置。 |
| 竖排/字体/颜色 | service保留horizontal/vertical、font/fontSize、played/unplayColor、opacity等设置，尺寸可按竖排配置；apply及窗口did-finish-load发送desktop.preferences完整Settings。具体排版由歌词renderer处理。 |

隐藏条件由一个统一谓词组合：启用、有内容，并且没有暂停隐藏、主应用全屏隐藏或锁定悬停隐藏。任何一个条件仍成立时，另一条件解除不会错误地重新展示窗口。

## 主进程接入

```ts
new DesktopService(
  () => mainWindow,
  () => createLyricWindow(),
  command,
  {},
  patch => library.settings(patch)
)
```

第五个参数是可选 `onSettingChange(patch:Partial<Settings>):void|Promise<void>`。第四个是可选 `{pollMs?:number}`，默认100ms。主进程设置更新继续调用apply(settings)，播放状态调用status(status,settings)，关闭时dispose。位置与快捷键锁定/置顶/歌词开关通过第五参数保存。

歌词窗口应订阅 `desktop.preferences`，payload是完整Settings；preload需要加入事件白名单。main library.updated通路也应同步设置，避免字体/颜色变化只在重开后生效。service不执行renderer CSS，也不虚构已验证其字体像素结果。

## 实际验证

[Electron探针](<../scripts/desktop-probe.cjs>)在隔离userData启动真实Electron，在主进程加载临时esbuild service bundle，创建透明无框测试歌词窗口。自定义设置保存callback只记录内存patch，不写应用数据库，不控制用户音频。

验证原生Tray实例与globalShortcut.isRegistered；空状态隐藏、锁定mouse forwarding和不可resize、实际alwaysOnTop/opacity、skipTaskbar setter；实际屏幕越界恢复；playing/pause状态与powerSaveBlocker.isStarted；模拟应用全屏事件；模拟screen cursor悬停/离开；真实setBounds产生move/resize及防抖patch；模拟display-metrics-changed和工作区收缩；竖排大小和style payload；mediaKeys重新注册；dispose只释放本service键、托盘、窗口和blocker，保留另一个测试组件注册的快捷键。

最终 **14/14真实Electron探针检查通过**、**3/3单测通过**；desktop service与测试的独立严格TypeScript检查通过。完整 [JSON证据](<C:/Users/琛瑾喵呜/AppData/Local/Temp/chenjin-desktop-evidence.json>)保留在临时目录，测试Electron已关闭。全仓vue-tsc当次仍被其他正在编辑的App.vue和i18n.ts类型错误阻塞，这些不属于desktop scope，已反馈父代理；不将独立desktop检查表述为全仓通过。

[单测](<../tests/desktop.test.ts>)覆盖负坐标副屏、断开显示器的坐标恢复、超大/无效尺寸、暂停/全屏/锁定悬停等独立隐藏谓词。

探针不发送物理媒体键、不操作系统光标、不打开外部全屏应用；hover和display事件是明确模拟输入，窗口操作与Electron APIs是真实执行。因此不能把模拟display测试称为真实拔插显示器验收，也不能把setSkipTaskbar调用断言称为Windows任务栏视觉截图验收。

## 明确缺项与平台限制

- 外部应用全屏隐藏没有实现。Electron screen/BrowserWindow只能提供本应用窗口状态，检测任意外部程序需要额外的Windows原生窗口API或平台模块；本scope未加入原生依赖，不声称已做外部全屏实测。它并非所读LX自身全屏事件协议的缺失。
- 桌面歌词font/颜色/竖排CSS及主界面设置UI由renderer代理维护，本service只发送契约与窗口尺寸；未在此scope修改frontend或main。
- 跨物理屏的DPI变化、Wayland对绝对位置和置顶的限制、真实系统媒体键冲突仍需目标OS手动验收。屏幕坐标使用Electron DIP单位，不混用物理像素。
- 自定义globalShortcut注册失败不会抢占其他组件或用户应用的快捷键。dispose只注销成功归属本实例的键。

## 最后原功能核对补齐

- desktopLyricTopLoop=true：复用默认100ms窗口轮询，仅在enabled且onTop时重新setAlwaysOnTop(true,'floating')；关闭置顶不被循环反向开启，禁用歌词和dispose停止计时器。原只读[置顶循环](<D:/data/git/lx-music-desktop/src/main/modules/winLyric/main.ts:213>)使用500ms和screen-saver层，本实现沿原service浮动层和当前100ms polling；不保证能覆盖OS安全界面。
- statusBarLyric=true：保留原[Tray.setTitle(lyricLineText)](<D:/data/git/lx-music-desktop/src/main/modules/tray.ts:324>)原生状态栏文本行为。跨平台同时写tooltip和主窗title，title始终保留琛瑾音乐及当前歌名/艺人。歌词和歌曲名称直接显示原文；关闭偏好立即移除歌词，不等待下一帧。原实现tooltip只显示歌名/艺人，因此跨平台title/tooltip歌词是对应平台展示映射，不误称原Windows任务栏已支持Tray.setTitle文字。
- trayTheme接受auto/brand/black/white；兼容trayThemeId及旧tray.themeId数字。原[themeList](<D:/data/git/lx-music-desktop/src/main/modules/tray.ts:37>)实际0auto、1tray_origin彩色、2tray_black；不把数字1错误解释为黑色、数字2错误解释为白色。auto暗系统选白图标、亮系统选黑图标；nativeTheme.updated重新更新，dispose只移除本service listener。禁用再启用托盘仍恢复正确图标。
- 黑白图标通过模块内PNG编码器生成32px原创八段波形，背景alpha=0，线条alpha=255；使用真实nativeImage.createFromBuffer，无打包资源路径、无第三方图标、无在彩色背景上整张白色覆盖。品牌色继续原有原创音符图标。PNG像素测试确认同时存在透明与可见像素，标记不到400像素，避免不透明方块。
- desktopLyricScreenLock默认开。关闭时允许有效显示器上的部分越界位置；显示器ID移除会强制clamp防止失联屏幕丢窗。完全不可见位置仍自动恢复。

最终[desktop单测](<../tests/desktop.test.ts>) **8/8通过**，覆盖原3组规则及5组native生命周期、状态歌词即时清除、OS主题变更与监听清理、PNG透明像素、显示器移除恢复；**全仓vue-tsc --noEmit通过**。此次新增三项与screenLock使用Electron mock及假计时器验证，未重新运行真实OS托盘/状态栏/置顶循环探针；此前14/14真实Electron证据仅对应报告前面列明的旧检查范围。不要将mock调用结果表述为真实OS图标截图、物理显示器拔插或新功能人工验收。

修改范围只包含desktop service、desktop probe、desktop测试与本报告。
