# LX 同步 v4 兼容报告

琛瑾音乐同步服务是从零编写的实现。LX Desktop 2.12.6 的同步模块仅用于理解协议、RPC 名称、参数和冲突语义，没有复制其业务源码。message2call 0.1.3 的通用封包格式已通过 npm 发布内容核对，当前实现不需要该依赖，也不会使用不兼容的 2.x 格式。

## 实现范围

| 层 | 兼容内容 |
| --- | --- |
| HTTP | GET `/hello` 返回 `Hello~::^-^::~v4~`；GET `/id` 返回 `OjppZDo6` 加持久 serverId；GET `/ah` 使用 `m` 与可选 `i` 请求头。支持反向代理路径前缀。 |
| 首次鉴权 | Desktop 六位配对码或独立服务复杂密码（客户端非空且最长 1024 字符）；MD5 十六进制字符串的前 16 个 ASCII 字节作为 AES-128-ECB key；PKCS7；明文 `lx-music auth::\nSPKI公钥主体\n设备名\nlx_music_desktop`；RSA OAEP 默认 SHA-1 返回 `{clientId,key,serverName}`。 |
| 再次鉴权 | `i=clientId`；`m=AES(auth前缀+设备名)`；服务端返回 AES 加密 hello。 |
| WebSocket | `/socket?i=clientId&t=urlencode(AES('lx-music connect'))`；无效 token 返回 HTTP 401。重复设备关闭旧连接。 |
| 编码 | UTF-8 JSON；字符串长度大于 1024 时 gzip 后 base64 并加 `cg_` 前缀。按 LX v4，业务消息不额外 AES 加密。 |
| RPC | message2call 0.1.3 请求 `{name,path:[method],data:args[]}`，响应 `{name,error:null,data}` 或 `{name,error:string}`；缺省 data 的属性读取兼容；异步应答与调用超时；list/dislike 本地队列。name 后缀是调用标识，接收方原样返回。 |
| 协商 | `getEnabledFeatures('desktop-app',{list:1,dislike:1})`；只接受匹配版本；支持 `skipSnapshot`；模块完成通知及 `finished()`。 |
| 列表 | `list_sync_get_md5/get_list_data/set_list_data/get_sync_mode/finished`，`onListSyncAction`；默认/收藏数组及 userList 的 LX 字段顺序。 |
| 操作 | 全量覆盖；建、删、改、移动歌单；歌曲覆盖、添加、移动、删除、更新、清空、位置调整。接收真实 LX action 名称和参数形状。 |
| 不喜欢 | 等价 dislike RPC 与 `onDislikeSyncAction`；规则字符串、换行与 `@` 分隔，添加/清空/覆盖；独立处理 `dislike` feature。 |
| 状态 | 服务端地址/连接码/设备，客户端待鉴权/连接/同步/就绪/失败，模式选择事件；心跳、断线销毁 pending RPC、异常断线自动重试，正常/协议失败关闭不重试。 |
| 快照 | 每设备最后成功应答的列表/规则基线；重连三方合并；基线已有且任一端删除的歌曲、歌单、规则不复活；名称、来源和来源歌单 ID 按基线判断更改。 |
| 持久化 | 显式指定应用自有 dataPath 才写 `state.json`；原子临时文件/rename、串行写入；存储 serverId、设备凭据、客户端鉴权与每设备快照；缺省内存模式。 |
| 边界 | HTTP 客户端总时限 10 秒、响应 32 KiB；WebSocket 与 gzip 解压限制 16 MiB；RPC 等待/入站各最多 256；设备最多 1000；鉴权错误 IP 限制及过期；错误封包关闭 4100。 |

## 六种首次列表模式

local 和 remote 从当前选择界面的本机视角解释。LX Desktop 作为服务端时由 LX 自己选择，琛瑾作为服务端时由琛瑾发起模式选择；兼容服务端通过 RPC 请求客户端选择的情况。

| 模式 | 行为 |
| --- | --- |
| `merge_local_remote` | 本地优先的歌曲去重合并、双方歌单保留。 |
| `merge_remote_local` | 远端优先的歌曲去重合并、双方歌单保留。 |
| `overwrite_local_remote` | 同 ID 歌单及内置列表使用本地，保留远端独有歌单。 |
| `overwrite_remote_local` | 同 ID 歌单及内置列表使用远端，保留本地独有歌单。 |
| `overwrite_local_remote_full` | 本地完整集合覆盖。 |
| `overwrite_remote_local_full` | 远端完整集合覆盖。 |
| `cancel` | 取消并结束当前连接，不改冲突数据。 |

LX 的 dislike 协议原生提供两种合并与两种覆盖；琛瑾允许 full 选项，其结果等于对应规则覆盖。默认歌曲添加位置为 bottom；操作收到 top 时遵循 LX 的先过滤已有 ID、再插入新增歌曲语义。

## 主进程接入

```ts
const sync = new SyncService(
  () => library.get(),
  async patch => { await library.mutate(state => Object.assign(state, patch)) },
  (event, data) => broadcast(event, data),
  join(app.getPath('userData'), 'sync')
)
await sync.configure(library.get().settings)
```

LibraryStore changed 回调应调用 `sync.notifyLocalChange(state)`。收到远端数据期间服务自己抑制回传。设置保存成功后调用 `configure(settings)`；应用退出时 await `dispose()`。该服务不保存应用设置；配置由原设置服务负责。

| IPC | 参数 | 返回/事件 |
| --- | --- | --- |
| `sync.status` | 无 | `getStatus()` |
| `sync.auth` | `{code:string}` | await `authenticate(code)`，返回状态 |
| `sync.mode` | `{mode:SyncMode}` | `chooseMode(mode)`，返回状态 |
| 设置保存 IPC | syncEnabled/syncMode/syncPort/syncHost | 保存后 await `configure(settings)` |
| `sync.status` 事件 | — | 完整状态 |
| `sync.mode` 事件 | — | `{deviceName,feature,modes}` 或关闭选择的 `null` |

状态形状：`{enabled,mode,status,state,message,address:string[],code:string,devices:[{clientId,deviceName,connected,lastConnectDate?}],pendingMode?:{deviceName,feature:'list'|'dislike',modes:SyncMode[]}}`。state 是 disabled/listening/connecting/authRequired/syncing/ready/error。服务端监听时 status=true，客户端 finished 后 status=true。`removeDevice(clientId)` 可由主进程另行暴露设备撤销 IPC。

## 验证与限制

已执行 `vitest run tests/sync.test.ts`：13/13 通过；全仓 `vue-tsc --noEmit` 通过。协议测试采用真实本机 HTTP、RSA OAEP 和 WebSocket 连接。独立 LX fixture 使用原 message2call 0.1.3 封包主动回答 features/RPC，测试并非只让同一个实现自我对话。另有服务双角色集成、首次模式选择、后续变更通知和显式磁盘持久化/重启/离线删除合并。编码、AES 密钥派生、压缩膨胀上限、HTTP 响应上限、设备撤销、非法封包关闭、错误返回、队列销毁、六模式区别和 list action 也有专门测试。

已运行真实 [LX Music Sync Server 2.1.2](https://github.com/lyswhut/lx-music-sync-server/commit/d47aca4284a7c4d9ef755df1f44fb0b0a5b2af36)，commit `d47aca4284a7c4d9ef755df1f44fb0b0a5b2af36`，隔离临时源码目录安装依赖；上游源码和配置没有改动。通过原项目提供的 `ts-node/register`、`tsconfig-paths/register` 与原 tsconfig 的 transpileOnly 执行入口，环境变量设置独立 data/log 目录、测试用户密码、`BIND_IP=127.0.0.1`、端口 29548 和 bottom 添加顺序。由于 pnpm 严格依赖解析下上游 tsc 找不到未声明直接依赖的 @types/node，采用该官方开发入口执行而非修改上游源码。

[互通脚本](<../scripts/sync-interop.cjs>)实际加载隔离安装的 **message2call 0.1.3 原发布库** 和 ws，使用独立参考客户端逻辑，未用琛瑾 SyncRpc 或新版 RPC 库驱动对端。新服务临时编译包及 userdata 也分别隔离。真实运行通过 **9/9 项**：

| 验证 | 实际证据 |
| --- | --- |
| 新 Sync client → 原 LX server | 复杂密码 `interop.pass-2026` 首次 RSA 鉴权、features、list/dislike、finished 成功。 |
| 上游存储与压缩 | 原库参考客户端从原服务获取 `interop-list`，1800 个中文字符长歌曲名完整一致，收到真实 `cg_` 压缩帧。 |
| 原服务发起首次冲突 | 双方非空时原服务调用客户端 list/dislike 模式 RPC，本地优先选择经原 TRANS_MODE 转换后合并成功。 |
| 原服务 → 新客户端精细操作 | 原库客户端发送 `list_music_add` 和 `dislike_music_add`，原服务广播后新客户端保存成功。 |
| 新客户端 → 原服务 → 原库客户端 | notifyLocalChange 全量操作经原服务处理和广播，原库对端收到歌曲 `local-notify` 与不喜欢规则。 |
| 原服务恢复与快照 | 重建新客户端实例从磁盘恢复原凭据，原服务日志显示 `handleMergeListDataFromSnapshot`；`initial` 删除不复活，`remote-offline` 和 `client-offline` 均保留。 |
| 原 message2call client → 新 server | 原库请求/应答、RSA鉴权、features、list/dislike、长数据压缩及 finished 完成。 |
| 原库 → 新服务精细动作 | 添加歌曲到 top 与清空不喜欢动作成功，响应 error=null。 |
| 新服务 → 原库客户端 | list/dislike 原生覆盖操作广播均收到且数据断言通过。 |

完整带逐帧方法/压缩摘要的 [JSON 运行证据](<C:/Users/琛瑾喵呜/AppData/Local/Temp/chenjin-lx-interop-20260717/evidence-final.json>) 与 [原服务日志目录](<C:/Users/琛瑾喵呜/AppData/Local/Temp/chenjin-lx-interop-20260717/upstream-logs-final>)留在隔离临时目录；临时目录可能被系统后续清理。受管原服务进程在验证完成后已停止；没有公网部署。

尚未启动 LX Desktop GUI，因此剩余的是桌面界面端到端验收，不能把此次原独立服务/原 RPC 库的验证表述为 LX Desktop GUI 验收。

应用的本地变更通知只提供整个 LibraryState，无法恢复每一次用户动作的精细参数，因此发送 LX 原生 `list_data_overwrite` / `dislike_data_overwrite` 操作；远端传来的全部精细 action 已实现。16 MiB/100000 项上限意味着超大音乐库会明确失败，不能无限占用内存。同步规则保存到 dislikes 字符串数组，不转换歌曲 ID 型字符串为 LX 的歌曲名/歌手规则；现有应用如何解释规则仍由播放器层决定。临时/下载列表不进入 LX 的同步集合；脚本、设置、下载任务与播放状态不在 LX v4 list/dislike features 范围内。

## 协议来源

- 只读 LX 仓库：`src/common/constants_sync.ts`、`src/main/modules/sync/client`、`server/server`、`listEvent.ts`、`dislikeEvent.ts`、`server/modules/list/sync`、`server/modules/dislike/sync` 与公共类型；`src/main/worker/dbService/modules/list` 用于核对重复 ID 添加/移动语义。
- [message2call 0.1.3 npm 元信息](https://unpkg.com/message2call@0.1.3/package.json)
- [message2call 0.1.3 发布封包实现](https://unpkg.com/message2call@0.1.3/dist/message2call.esm.js)

所有新业务代码限于授权的同步服务目录、同步测试和本报告；父代理随后授权新增独立互通脚本以及临时目录依赖安装。没有修改只读 LX Desktop 或下载的原服务业务源码，没有修改本项目 package；外部依赖安装仅位于隔离临时目录。
