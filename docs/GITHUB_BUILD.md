# GitHub 一键构建

在 [Actions → Build desktop app](https://github.com/chenjin1494/chenjin-music/actions/workflows/build.yml) 页面点击 **Run workflow**，选择 `main` 分支和目标平台，再点击运行。默认 `windows`，还可选择 `linux`、`macos`、`all`。

完成后打开该次运行，在 **Artifacts** 中下载：

| 目标 | 构建程序 | 下载产物 |
|---|---|---|
| windows | Windows x64 | 安装向导、便携 EXE、SHA256SUMS |
| linux | Ubuntu x64 | AppImage、deb、SHA256SUMS |
| macos | macOS x64 | DMG、SHA256SUMS |
| all | 上述三个独立任务 | 三份平台产物 |

产物在 GitHub 保留 30 天。下载的 Actions ZIP 中包含程序和 SHA-256 校验文件。工作流只上传平台安装／便携文件，不上传 unpacked、依赖、资料库或构建中间目录；不会自动创建 GitHub Release。

工作流使用 Node.js 22.22.1、pnpm 11.7.0、Python 3.12，按 `pnpm-lock.yaml` 冻结安装依赖，安装 Playwright Chromium 后执行单元测试与界面字典测试，再运行 TypeScript 检查、生产构建和 electron-builder。可用的单元测试随平台执行 Windows 专属跳过。Windows WinRT/物理媒体键验收需要交互式桌面，未在 GitHub 托管 runner 上强行执行。

使用 `contents: read` 最小仓库权限；不需要额外 Token 或证书 Secrets。程序默认不签名／公证。macOS 构建配置可运行，但当前本地没有 macOS 实机验证，首次云端结果以 Actions 日志为准。

## 源码提交范围

Git 仓库包含应用源码、构建配置、工作流、文档、原始图标资产、测试与音频夹具。图标与夹具是程序构建／测试输入，不是已构建程序。

`.gitignore` 排除 `node_modules/`、`out/`、`release/`、`artifacts/`、`coverage/`、`.tools/`、缓存、运行 `data/`、日志与 `.env`。不会将本地 EXE、AppImage、deb、DMG 或源码打包 ZIP 提交到 Git。
