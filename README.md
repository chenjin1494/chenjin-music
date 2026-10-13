# 琛瑾音乐

全新编写的音乐桌面客户端。Electron + Vue + TypeScript，Material You / Material 3 动态配色与深浅界面，独立的应用标识、数据目录和原创品牌图标。参照 LX Music Desktop 的功能与开放协议，从零编写业务代码；原项目保持只读。

## 当前版本与启动

当前版本为 **0.1.0**，按用户要求重置；功能继续包含 Material 3、40 类组件外观、Windows 媒体会话、桌面歌词与关闭选择。只有用户明确要求时才修改版本号，见 [协作约定](AGENTS.md)。非首屏面板及音频解析／标签库按需加载。启动验证方法与结果见 [启动说明](docs/STARTUP.md)。

## 开发

需要 Node.js 22 或更新版本、pnpm。

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm pack:win
pnpm pack:linux
pnpm pack:mac
```

Windows 面向 Windows 10/11 x64；Linux 输出 AppImage 和 deb；macOS 配置 dmg，macOS 原生构建及运行需要对应系统。

## 使用

1. 导入本地音频，或在“音源管理”导入你选择的 LX API 2.0 兼容脚本并启用。
2. 在线搜索用于获取歌曲资料。在线播放和下载由启用的脚本提供实际音频 URL。
3. 歌曲支持收藏、歌单管理、播放队列、稍后播放、歌词、下载和音效设置。
4. 设置中可配置输出设备、EQ、混响、声场、独立移调、快捷键、桌面歌词、备份、同步和开放 API。

本客户端不依赖云端账号或云端存储，不需要部署云服务。在线音乐查询和音源播放保留，设备同步为可选的本地／局域网功能。

本项目不附带第三方收费音乐授权或内置播放音源。外部平台接口需要正常网络，并可能因平台改变或服务限制而暂时不可用；真实探测结果在验证报告中记录。

## 桌面歌词与关闭窗口

桌面歌词支持 UTF-8、UTF-16 LE／BE 和 GB18030，修复 Windows 歌词误解码；中文字体回退、长句自适应、下一句预览、工具栏、托盘解锁和位置恢复完善。主窗口关闭默认询问“隐藏到托盘／退出程序／取消”，可勾选“下次不再询问”；设置 → 桌面与网络 → 关闭主窗口时可恢复“每次询问”。详见 [使用说明](docs/DESKTOP_LYRICS.md)。完整回归 **287 项**、真实歌词 **15 项**、关闭选择 **9 项**验收通过。

## Material You / Material 3

官方 HCT Tonal Spot 根据强调色生成协调的主色、容器、表面和文字色，深浅主题自动配套；导航、胶囊搜索、卡片、播放器、设置和弹窗统一采用 Material 3 形状与状态层。设置里改变强调色即可换肤，40 类组件自定义继续生效。完全未修改的旧默认自动迁移，其他配置保留。详见 [设计说明](docs/MATERIAL_DESIGN.md)。Windows 完整回归 **272 项通过**，真实 Material 界面 **11 项**、原有外观 **14 项**、设置 **6 项**检查通过。

## GitHub 一键构建

打开 [Actions → Build desktop app](https://github.com/chenjin1494/chenjin-music/actions/workflows/build.yml)，点击 **Run workflow**，可选 Windows、Linux、macOS 或全部平台。默认构建 Windows，完成后从该次运行的 **Artifacts** 下载安装包／便携包及 SHA-256 校验文件。详见 [构建说明](docs/GITHUB_BUILD.md)。Git 只保存源码、必要资源和测试输入，构建目录及安装包不会提交。

## Windows 系统媒体会话

播放后 Windows 系统媒体面板显示歌曲名、歌手、状态和时间轴，可播放／暂停、切歌和定位，隐藏主窗口后仍可控制。标准媒体键交给系统当前会话，避免全局抢占和双重触发。详见 [系统媒体会话说明](docs/WINDOWS_MEDIA_SESSION.md)。本次新增发布 Windows 安装／便携包和源码，Linux 二进制保留 0.2.0。

## 外观自定义

设置 → 外观与体验 → **组件外观工作室**。全局与 40 类组件可独立修改颜色、圆角、间距、字体、透明度、阴影、尺寸、列表行高和图标描边；支持预设、继承、确认重置、完整 JSON 编辑与 `.appearance.json` 文件导入／导出。

- [默认配置模板](appearance.default.json)：省略颜色以继承深／浅主题。
- [完整组件示例](appearance.example.json)：可直接导入或编辑。
- [配置格式与组件说明](docs/APPEARANCE.md)：安全值、范围和优先级。

配置只包含外观，不含歌曲或脚本。侧栏／播放器尺寸联动布局，虚拟列表调整行高仍保留歌曲索引与浏览位置。

## 数据

音乐库使用独立 worker 中的 SQLite，包含歌单、歌曲、排序索引、设置、音源脚本、下载任务与不喜欢规则。正常版本存储在应用 userData 目录。Windows 便携版本存储在程序所在目录的 `data` 文件夹。

支持自有 gzip/JSON 备份、LX `.lxmc` 历史格式与旧 LX 数据目录导入。导入旧 SQLite 目录前需关闭原应用以完成 WAL 写入。覆盖恢复前创建当前音乐库备份；设置与单歌单备份恢复保留其他资料。

调试时可以用 `CHENJIN_TEST_USER_DATA` 指定隔离目录（仅开发模式），`PORTABLE_EXECUTABLE_DIR` 用于便携存储。

## 协议

- 独立链接：`chenjinmusic://search?source=wy&keyword=晴天`、`chenjinmusic://play?source=wy&id=123&name=歌名&singer=歌手`。
- OpenAPI 默认端口 23330，默认关闭，可在设置开启。支持 LX 原 `/status`、`/lyric`、`/lyric-all`、播放控制与逐字段 SSE。
- 原 `/volume?volume=75` 使用 0–100，`/seek?offset=15` 使用绝对秒数。
- 同步默认端口 23332，默认关闭，提供 LX v4 兼容客户端与服务端、设备管理、歌单及不喜欢规则同步、六种冲突策略。
- 更新使用独立清单 URL，安装包必须提供大小及 SHA-512，验证成功后可运行安装程序。未配置更新源时明确显示未配置。

## 验证

验证详情见 [功能矩阵](docs/FEATURE_MATRIX.md)、[界面验收](docs/UI_VERIFICATION.md)、[性能报告](docs/PERFORMANCE.md)、[来源与逐字歌词](docs/PROVIDER_ORIGINAL_FEATURE_VERIFICATION.md) 和 [发布说明](docs/RELEASE.md)。0.2.0 Windows **245 项测试通过**，真实 Electron 外观 **14 项**、原有设置界面 **6 项**检查通过；包含文件实际导入导出、重启、桌面歌词、1500 曲虚拟列表和自定义行高。Linux 本次原生 **223 项通过、1 项 Windows 专属跳过**，Xvfb 下真实外观 **14 项全部通过**。旧版基线为 Windows 192 项、Ubuntu 170 项通过（1 项 Windows 专属测试跳过），浏览器 DOM 本地化 21 项已在 Windows Chrome 实测。

Windows 和 Ubuntu 均已实际播放本地 WAV、运行十段 EQ 与 AudioWorklet，并验证 MP3／FLAC 标签及 Range 断点恢复、移除音源后已下载音频的离线播放。还已执行 SQLite 重启恢复、原 LX 独立同步服务互通、HTTP/SSE、隔离音源、歌曲编辑歌词和旧偏好迁移测试。测试音频是自行生成的正弦波。快速退出在真实播放 211.7 ms 后重启，队列和当前歌曲均正确恢复。

万条列表实测只渲染 15 行，队列 13 行，均可到达第 10000 首。优化后 renderer 正常末期 JS 堆约 78 MiB，但主进程与系统工作集仍有优化空间。外部平台的私人分享账号、物理多音频设备插拔、macOS 原生运行，以及生产远端更新和真实安装升级不在已执行的实机验证之列。

## 许可

本项目原创业务代码和原创品牌图标使用 MIT 许可。依赖库按各自许可使用。上游 LX 项目的品牌、资源和业务源码未复制到本项目。
