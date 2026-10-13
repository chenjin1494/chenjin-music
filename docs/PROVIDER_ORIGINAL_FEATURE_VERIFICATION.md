# 在线原功能补齐验证记录

本记录覆盖[提供方](<../electron/main/services/providers.ts>)、[网络传输](<../electron/main/services/network.ts>)和[独立歌词协议解码](<../electron/main/services/lyric-codecs.ts>)。协议字段、表、固定密钥可用于互通；业务和解码算法重新编写，未导入原SDK。主代理负责IPC和界面接入。

## 真实 Electron 35 网络验证

通过真实 Electron 主进程获取后，调用现有前端 `parseTimedLyrics` 核对词时间，未把普通行歌词或只有parser的实现算成逐字成功。

|来源|真实《晴天》编号|含词时间的行数|词数|
|---|---|---:|---:|
|酷狗 KRC|20505418 / B3A52A7A958BF0AED0EBFBA2E9A818B7|63|602|
|QQ QRC|0039MnYb0qxYhV / numeric 97773|63|602|
|咪咕 MRC|60054701923 / resource 3790007|65|580|
|酷我 lrcx|228908|63|602|

四源返回统一 `lyric/tlyric/rlyric/lxlyric`，逐字内容采用 `<offset,duration>` 兼容渲染器。咪咕搜索结果可能已有LRC但没有MRC，因此仍补资源详情。QRC含非标准S-box、32位小端字布局及右半PC2偏移；普通标准3DES无法互通。实现使用独立BigInt Feistel与zlib，无需 crypto-js。KRC解码也供本地 `.krc` 文件使用。

外语样本验证：酷狗 YOASOBI《アイドル》79逐字行/79译文行/79音译行，QQ同曲79逐字行/86译文行/79音译行，咪咕《Make You Feel My Love (Live At WXPN, Philadelphia)》39逐字行/42译文行。酷我《アイドル》79主行、80译文行（含元信息空白行），重复时间戳前置翻译已对齐上一原文，未重复计为158逐字行；酷我未提供音译字段。

五来源最新评论、热门评论均获取成功：每页约20条；QQ热门响应实际21条。附带回复/图片保留，网易引用父评论保留。酷狗热门页10张图片，咪咕热门附带22条回复，酷我热门附带48条回复，QQ最新附带5条回复。酷狗独立回复接口返回19条，咪咕独立回复返回20条。原SDK没有网易/QQ/酷我独立翻回复页能力，提供其响应附带回复。

酷狗热门与分组歌单标签真实获取成功，推荐/热门/最新/热藏/飙升五种排序各20歌单，`id_3339907` 公共歌单详情返回30首。分类与评论用原公开HTTP端点，其HTTPS域名证书不匹配；没有禁用TLS验证。咪咕热搜HTTPS端点真实返回20词。

酷狗全局收藏链接 `https://m.kugou.com/share/?global_collection_id=collection_3_1049244401_2005_0` 真实获取成功，歌单为“乡村之旅：安静惬意·与自然同在”，拉取30文件hash，元数据接口返回30项、27不同音频ID，按原音频ID去重得到27首。链码、个人分享码、PC页面、encoded gcid、全局收藏、网易短链及 `id###token` 已实现结构解析和分页；个人分享码、链码、PC与网易token/短链通过独立响应fixture验证。没有实际登录用户的私有列表或过期分享码样本，不能称所有私人分享已做真人网络验证。

Chromium在带分享页Referer的成功酷狗响应上返回 `ERR_BLOCKED_BY_CLIENT`，相同HTTPS请求用Node传输可取回。只在酷狗分享既定host/path的此错误发生时使用受限NodeHTTP(S)传输；代理从 Electron `session.resolveProxy` 解析并交给通用 `proxy-agent`。保留TLS验证、取消、整体超时、响应大小边界和5次重定向限制，HTTPS不能降级，跨来源移除授权头。实际系统代理为DIRECT。HTTP/HTTPS/SOCKS代理映射和Agent配置通过fixture；没有运行真实HTTP/SOCKS代理服务器。

## 回归验证

[歌词测试](<../tests/lyric-codecs.test.ts>)7条，包含实际QRC加密XML头向量、KRC语言行对应、酷我双语对齐与词时钟、解压边界；[扩展提供方测试](<../tests/provider-extensions.test.ts>)11条，包含5排序、类别、分享与完整分页、cookie token保留、reply/images；[受限传输测试](<../tests/network-stream.test.ts>)5条，覆盖代理、端点白名单、响应边界、取消与HTTP错误。连同已有[提供方测试](<../tests/providers.test.ts>)12条，35/35通过。集成 `vue-tsc --noEmit` 通过。

真实探测保留[四源逐字脚本](<../tests/lyric-provider-probe.ts>)、[评论及外语脚本](<../tests/provider-extension-probe.ts>)、[分类及独立回复脚本](<../tests/provider-focused-probe.ts>)及[全局分享脚本](<../tests/provider-final-sample-probe.ts>)。无窗口Electron进程须使用 `Start-Process -Wait`，并移除环境 `ELECTRON_RUN_AS_NODE`；仅调用GUI可执行文件可能让PowerShell提前结束。生成的临时 `.cjs` bundle不是交付源码。
