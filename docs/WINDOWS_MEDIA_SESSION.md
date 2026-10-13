# Windows 系统媒体会话

自 0.3.0 起，琛瑾音乐通过 Chromium Media Session 接入 Windows 系统媒体传输控制（SMTC），不需要安装插件或启动额外服务。

播放后 Windows 系统媒体面板显示歌曲名、歌手和时间轴；应用同步播放／暂停状态，提供专辑信息以及已有的网络／内嵌封面。没有封面时使用系统应用标识。媒体键由系统当前选中的媒体会话分发，应用不再全局抢占 Windows 标准播放／暂停、前后切歌和停止键。普通自定义组合快捷键保留。

支持系统播放、暂停、上一首、下一首、停止、向前／向后定位及绝对时间轴定位。动作复用现有播放器的队列、稍后播放和播放模式。上一首沿用播放器行为：已播放超过三秒时先回到本曲开头，否则切到前一首。隐藏主窗口后保持会话；停止、播放错误或页面退出清理媒体元数据和时间轴。桌面歌词窗口不会发布第二个媒体会话。

应用标识是 `com.chenjin.music`。Chromium 或系统不支持的操作会被安全忽略，不会阻断音频播放。系统面板展示的具体字段和按钮由 Windows 决定；本机实测 Chromium 提供了专辑元数据，但 WinRT 原生会话专辑字段为空，不能声称系统面板显示专辑名称。

## 实际验证

隔离资料库和生成的正弦 MP3 通过 Windows PowerShell 5.1 调用 `GlobalSystemMediaTransportControlsSessionManager`，根据唯一测试标题选择本应用会话，避免控制其他播放器。

- 原生读取应用标识、歌曲、歌手、播放状态和时间轴。
- `TryPauseAsync` / `TryPlayAsync` 真正控制音频，并观察播放器和原生状态变化。
- `TryChangePlaybackPositionAsync` 定位到 4 秒。
- `TrySkipNextAsync` / `TrySkipPreviousAsync` 切换两首测试歌曲，更新系统元数据。
- 隐藏主窗口后仍能原生暂停；停止后应用清理元数据和时间轴。

开发构建报告为 `artifacts/windows-media-session-report.json`，实际打包应用报告为 `artifacts/windows-media-session-packaged-report.json`；完整探针为 `scripts/windows-media-session.ps1`。诊断查询支持 Windows 10 1809+ 的 GSMTC 管理器，实机验证运行于 Windows 11；没有声称测试所有 Windows 10 版本或物理键盘。

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/windows-media-session.ps1
```

自动验收：

```sh
node scripts/windows-media-session-e2e.cjs
node scripts/windows-media-session-e2e.cjs --packaged
```
