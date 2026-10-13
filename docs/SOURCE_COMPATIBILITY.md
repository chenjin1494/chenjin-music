# LX 自定义音源 API 2 兼容报告

运行器保持 `lx.version='2.0.0'`、`lx.env='desktop'` 和 LX API 2 的脚本协议。实现从零编写；只读 LX Desktop 2.12.6 的 preload、FAQ、rendererEvent 用于核对参数与行为，没有复制其业务源码。

## 原协议与实现

| API / 行为 | 兼容情况 |
| --- | --- |
| 浏览器环境 | 真正隐藏 BrowserWindow 运行脚本，提供 window/globalThis/console/location；脚本不暴露 Node require/process、ipcRenderer 或应用主窗口 bridge。contextIsolation=true、sandbox=true、nodeIntegration=false。 |
| `currentScriptInfo` | name/description/version/author/homepage/rawScript 在脚本运行前写入隔离 preload，原始代码从 rawScript 获取。和当前 LX 一样不依赖 document.currentScript。 |
| `on(EVENT_NAMES.request,handler)` | 返回 Promise；回调 `{source,action,info}`；info.musicInfo 使用现有旧歌曲 flatten 适配，平台特有 ID 与本地 filePath/ext 保留；音乐质量在 info.type。 |
| `send(inited,{sources,openDevTools})` | Promise；仅一次；平台 kw/kg/tx/wy/mg/local，type=music，动作与音质过滤为 LX 支持集。local 质量列表固定为空，支持 musicUrl/lyric/pic；其余支持 musicUrl。 |
| `send(updateAlert,{log,updateUrl})` | Promise；每次脚本运行只能调用一次；非空 log 校验及长度限制；更新内容通过 onUpdate 的音源状态展示。 |
| request | `request(url,options,callback)` 返回 cancel 函数；额外兼容省略 options 的形式。回调 `(err,resp,body)`；resp={statusCode,statusMessage,headers,bytes,raw,body}。文本响应尝试 JSON 解析，raw 为可通过 buffer 工具处理的字节数组。 |
| request options | GET/POST 等 method、headers、body、form、formData、timeout；JSON对象、URL编码表单、二进制 body、multipart `buffer/filename/content_type` 上传。HTTP gzip 由 Electron 网络层解压。 |
| timeout / cancel | 大于零的 timeout 最长 60 秒，短超时不强行扩为 1 秒；cancel 触发错误回调，重复 cancel 不产生二次回调。 |
| buffer.from | UTF8、base64、hex、binary、数组、TypedArray 和 ArrayBuffer；默认UTF8，遵循 Buffer.from 语义。 |
| buffer.bufToString | 字节数组按指定格式转换；传入字符串时先按 binary 解码，符合 LX 原工具。 |
| crypto.aesEncrypt | AES128/192/256 ECB/CBC/CTR/CFB/OFB，PKCS7 默认；key/iv 传字节；返回加密字节；非法参数抛错。 |
| crypto.rsaEncrypt | LX 原工具使用 1024 位公钥，将输入左侧补零到 128 字节，RSA_NO_PADDING。不是 OAEP。过大输入和非1024位密钥明确拒绝。 |
| crypto.md5 / randomBytes | MD5十六进制字符串、随机字节；输入/尺寸校验，错误抛出。 |
| zlib.deflate / inflate | Promise返回字节；损坏数据reject；解压输出上限16MB。 |
| local lyric / pic | 返回歌词、tlyric/rlyric/lxlyric；翻译/罗马音/扩展超出原LX长度上限返回null；图片为有界HTTP(S)URL。 |
| 额外扩展 | buffer.concat、crypto.sha256、zlib.gzip/gunzip；这些是琛瑾提供的附加工具，不宣称是原LX API2内置方法。 |

原 API2 的工具方法经 contextBridge 后返回字节数组，脚本应使用 `lx.utils.buffer.bufToString`，不能假设 Buffer 实例的 Node 原型方法可用。JSON/压缩/加密输入和输出均有界；随机输出最多65536字节、HTTP响应/工具解压最多16MB、同时HTTP最多64个、脚本动作最多128个。

## 生命周期与隔离修复

每次 activate 使用唯一 preload 和独立非持久 session partition。启动、文件写入、loadURL、执行结果与 renderer退出回调都由 generation 绑定；并发切换时旧激活Promise和旧待处理请求拒绝，旧窗口的回复不能污染新脚本。主进程仅接受当前隐藏窗口主帧的源API IPC，其他窗口与子帧工具调用拒绝。

初始化从文件准备开始计时，默认15秒。脚本动作默认60秒；超时会拒绝请求并销毁源窗口，避免只返回错误但保留无限循环脚本。测试通过可选构造 deadline 缩短到 init=1500ms/request=500ms，生产默认没有改变。关闭运行器同时清理待处理Promise、计时器、HTTP请求与IPC监听。

## 实际验证

[真实Electron探针](<../scripts/source-probe.cjs>)启动应用且隔离userData，在Electron主进程加载临时esbuild运行器bundle（electron保持external），用本机HTTP服务执行请求和上传断言。脚本本身在隐藏sandbox renderer使用公开 lx API；加密结果和Node主进程独立计算结果逐字节比较。

验证覆盖：GET响应/请求headers与raw、POST JSON/form、二进制multipart上传、HTTP gzip、80ms短超时、cancel错误回调；UTF8/base64/hex/binary/concat；AES128 ECB/CBC、RSA1024 NO_PADDING、MD5、random、SHA256扩展；deflate/inflate、gzip扩展和解压错误；浏览器全局、currentScriptInfo、重复inited/updateAlert；本地音乐URL、翻译/罗马音/扩展歌词和图片；Node/应用bridge不可见、外部窗口和子帧IPC拒绝；并发激活、已发起请求切换失效；初始化与请求中的无限循环确实被销毁。

最终 **33/33 项真实Electron检查通过**，**5/5 单测通过**，全仓 `vue-tsc --noEmit` 通过。初始化无限循环在1507ms、请求无限循环在517ms被watchdog销毁，随后主进程仍能执行下一项验证。完整 [JSON证据](<C:/Users/琛瑾喵呜/AppData/Local/Temp/chenjin-source-evidence.json>)保留在临时目录，可能被系统后续清理。所有探针Electron和HTTP服务已在finally关闭。

[工具协议单测](<../tests/source-runtime.test.ts>)专门验证编码、AES/RSA、损坏/膨胀压缩包、显式Buffer输出上限、hash和头部解析。运行探针可用 `node scripts/source-probe.cjs`；通过 `SOURCE_PROBE_OUTPUT` 指定证据JSON路径。

## 明确的边界

- 此实现兼容以上 LX API2 公共调用，不给脚本开放 Node、任意IPC、文件系统或主应用对象。脚本自己调用 require/fs/child_process 不属于受支持的源API。
- updateAlert 的 log 通过音源状态回调展示；源运行器不自行打开 updateUrl、下载脚本或显示更新安装弹窗。主界面的更新交互仍由应用层负责。
- 底层使用 Electron net.fetch，并非复制 needle；响应结构、JSON解析、请求取消与文档选项已实际验证，但不提供 needle 内部未公开的 agent/socket/debug选项。原LX代理是宿主配置，不是脚本公开API；此运行器没有独立的自定义HTTP隧道代理设置方法。
- 运行器 `pic(track)` 已实现；主应用是否调用本地音源pic由主进程接入决定。本报告的图片验证通过直接实例调用，不宣称已验证完整主界面显示流程。
- 此探针使用明确可控的契约脚本，没有导入未知第三方音源或访问其音乐API，不能据此保证第三方服务仍在线或其URL有效。

## 只读参考

- LX `src/main/modules/userApi/renderer/preload.js`：API2、crypto/buffer/zlib、needle callback、重复事件、歌词/URL结果边界。
- LX `FAQ.md` 自定义源 window.lx API 说明。
- LX `src/main/modules/userApi/rendererEvent/rendererEvent.ts`：宿主请求与取消、更新通知。

修改范围限于 source-runtime、源探针、源测试与本报告；main/package/shared/frontend均未编辑。
