# 琛瑾音乐 0.3.0 发布与使用

## 0.3.0 Windows 系统媒体会话

新增 Windows 系统媒体面板、媒体键与时间轴控制，歌曲和歌手随切歌同步，播放／暂停、上一首／下一首、停止、定位复用现有播放器。隐藏主窗口后继续控制。标准 Windows 媒体键不再被全局快捷键抢占，桌面歌词不创建重复会话。实现与验证细节见 [Windows 系统媒体会话](WINDOWS_MEDIA_SESSION.md)。Chromium 提供专辑元数据，但本机原生 WinRT 的专辑字段为空，系统展示以 Windows 为准。

本次发行 `Chenjin-Music-0.3.0-x64-Setup.exe`、`Chenjin-Music-0.3.0-x64-Portable.exe`、`Chenjin-Music-0.3.0-Source.zip` 和 `SHA256SUMS-0.3.0.txt`，仅更新 Windows 二进制；Linux 保留下面的 0.2.0 原生包。原生 WinRT 媒体会话验收 8 项已通过；Windows 完整回归 28 文件 253 项全部通过，原有外观界面 14 项检查通过；最终打包应用结果见源码包的 `windows-media-session-packaged-report.json`。

## 0.2.0 发行基线

原创桌面客户端，Windows 10/11 x64 优先，附 Ubuntu Linux x64 原生构建。没有云端账号、云端存储或服务部署要求。

## 发行文件

| 文件 | 用途 |
|---|---|
| `Chenjin-Music-0.2.0-x64-Setup.exe` | Windows 安装向导，可选安装目录和桌面快捷方式 |
| `Chenjin-Music-0.2.0-x64-Portable.exe` | Windows 便携版；数据保存在程序所在目录的 `data`，请放在可写目录 |
| `琛瑾音乐-0.2.0.AppImage` | Linux x64 自包含运行包；给予执行权限后运行 |
| `chenjin-music_0.2.0_amd64.deb` | Ubuntu/Debian x64 安装包 |
| `Chenjin-Music-0.2.0-Source.zip` | 源码、锁文件、测试、资源、兼容报告和精选验证证据；不包含node_modules和原上游业务代码 |
| `SHA256SUMS.txt` | 最终产物校验值 |

Windows 安装版与便携版均未购买发行者代码签名证书。Windows 可显示未知发布者提示。主程序产品名、应用标题、快捷方式均为“琛瑾音乐”。

Linux 示例：

```sh
chmod +x '琛瑾音乐-0.2.0.AppImage'
./'琛瑾音乐-0.2.0.AppImage'
# 或
sudo apt install ./chenjin-music_0.2.0_amd64.deb
```

AppImage 若系统未提供 FUSE，可以通过 `--appimage-extract-and-run` 运行。deb 声明桌面依赖与 `fonts-noto-cjk`；AppImage 使用系统字体，精简系统可执行 `sudo apt install fonts-noto-cjk`。实际包执行还取决于 Linux 音频服务、显示环境与桌面关联。

## 第一次使用

1. 从主页导入本地音乐；MP3、FLAC、WAV 等格式会读取真实文件资料。
2. 在线音乐需要在“音源管理”导入并启用可信的 LX API 2.0 兼容脚本。搜索与歌单查询使用平台真实接口，音频地址由用户的脚本提供。
3. 在“设置”切换主题与语言、输出设备、音效、桌面歌词和快捷键；自定义IR、主题背景与用户预设均可保存。
4. 原 LX 用户可以导入 `.lxmc` 备份，或关闭原应用后导入旧数据目录；程序会先备份现有数据，原文件保持不变。
5. 常规清理缓存保留用户编辑的歌词；清除编辑歌词需独立确认。建议定期导出全库备份。

正常安装数据在系统应用 userData 目录，便携数据在程序目录 `data`。本地／局域网同步与OpenAPI默认关闭。旧 `lxmusic://` 关联仅用户选择后启用。更新源默认未配置，不要求使用或部署云服务。

## 0.2.0 外观升级

- 默认导航、卡片、横幅、搜索、播放器与弹窗重新整理留白、层次和响应式布局。
- 设置 → 外观与体验 → 组件外观工作室：全局与 **40 类组件** 独立覆盖，午夜紫、象牙白、紧凑预设，继承／滑块／数值／颜色／字体／尺寸／图标描边。
- 独立 `.appearance.json` 导入、导出、JSON 编辑与确认重置。默认模板 `appearance.default.json`、完整 40 组件示例 `appearance.example.json` 随发行提供，格式说明见 [外观配置](APPEARANCE.md)。配置不含歌曲、资料库或脚本。
- 侧栏宽度、底栏高度、列表行高联动真实布局；虚拟列表改变行高后保留浏览位置。桌面歌词字号与渐变颜色可独立设置。

## 本次已执行的验证

- Windows：全仓 TypeScript 检查与生产构建；27 文件 **245 项测试通过**，含 39 项严格配置校验、14 项渲染配置契约和原有回归。
- 真实 Electron 外观 **14 项检查通过**：全局／40 组件编辑器、实际滑块与颜色控件、非法 CSS 拒绝、真实文件导入与下载事件导出、SQLite 重启、独立模块、桌面歌词 44 px、1500 曲列表／队列虚拟化和行高切换、浅色预设、重置、24 字号／960×660 关闭控制可达、界面语言切换。
- 原有设置界面 **6 项检查通过**：系统明暗主题、实际 MP3 频谱／置顶／原文歌词、状态栏关闭、音源链接及搜索输入／结果清理。
- Ubuntu 原生：同锁文件生产构建；26 文件 **223 项通过、1 项 Windows 专属跳过**。Xvfb 中真实 Electron 外观 **14 项全部通过**，无需修改源码或平台专用补丁。安装包的 ASAR smoke 结果另见最终发行报告。

报告见源码包 `artifacts/unit-tests.json`、`artifacts/appearance-report.json`、`artifacts/settings-report.json`。验收使用隔离资料库、自行生成的正弦 MP3 与 1500 条测试歌曲记录，不操作用户资料。截图是实际 Electron 渲染结果；几何和样式检查基于 DOM，没有声称进行模型目视审核。

## 0.1.0 基础功能历史验证

下列为上一版的验证基线；本次外观升级另列上述回归与打包检查。

- Windows：全仓 TypeScript 检查及生产构建，25文件192项测试通过。
- Ubuntu：相同pnpm 11.7.0锁文件，原生构建与24文件170项回归通过，1项Windows专属测试跳过。浏览器DOM本地化21项在Windows Chrome运行。
- 两系统真实WAV播放／AudioWorklet／十段EQ，以及MP3/FLAC断点续传、完整时长、标签与已下载离线播放。
- 五源查询、四源逐字歌词、酷狗分类五排序和全局分享、评论、咪咕热搜；UI真实查询和关联收藏。
- 原LX独立同步服务互通、OpenAPI HTTP/SSE、自定义脚本隔离完整工具与取消、桌面歌词和多屏规则探针。
- 10000曲的虚拟列表／完整索引／队列／键盘／导航不中断播放，实际语言主题几何检查。
- 最终生产深链接25检查，快速退出211.7ms后队列和当前歌曲重启恢复。
- Windows/Linux打包应用另执行ASAR内SQLiteworker、便携路径、真实MP3播放和AudioWorklet smoke。

报告与JSON在源码压缩包的 `docs`、`artifacts`。截图是实际渲染结果；自动检查基于DOM、计算样式与几何，没有将模型目视审核作为证据。

## 验证边界

外部平台接口会变化；私人账号分享链接目前有结构fixture及公共分享实证，没有私人账号的真人全流程测试。实际HTTP/SOCKS代理、物理输出设备插拔、外部应用全屏、macOS原生运行、系统默认URL关联、实际安装升级和远端生产更新未全部进行实机测试。macOS仅保留构建配置，没有交付未经验证的macOS安装包。

大库优化后renderer正常末期JS堆约78MiB，系统工作集仍更大，主进程resident约577MiB；不能把JS堆指标称为整个程序总内存。原内置IR资源未复制：旧偏好恢复缺少该WAV时会明确记录迁移警告并保留引用，用户可以自行导入IR。

原创源码与品牌使用MIT，运行依赖各自许可与实际版权文本见 `THIRD_PARTY_NOTICES.md`；Electron随发行包保留自身LICENSE/NOTICE。
