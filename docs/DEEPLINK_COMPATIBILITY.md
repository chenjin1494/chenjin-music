# Scheme / CLI 兼容解析报告

[独立解析器](<../electron/main/services/deeplink.ts>)提供纯函数 `parseDeepLink(input:string,allowLegacy=false):DeepLinkAction`，错误抛出中文Error，不启动网络、不注册协议、不写设置、不更改收藏列表或播放队列。主进程负责把返回动作转换为应用行为。

只读原LX的useDeeplink目录index、music/songlist/player动作与utils，以及usePlaySonglist和FAQ，核对实际协议。从零实现，没有复制原业务源码。

## 协议与返回契约

默认接受 `chenjinmusic://`。只有显式 `allowLegacy=true` 才接受 `lxmusic://`；是否注册旧scheme应绑定设置associateLegacyScheme，由主进程负责，不默认抢占LX URL关联。其他scheme拒绝。

`scheme://type/action/path?data=JSON` 中data采用一次URI解码后的JSON对象，路径各段一次decodeURIComponent；查询按第一个等号切分，保留值中的等号，`+`保留为加号。原协议没有base64编码，解析器也不把base64猜成JSON。总输入UTF8字节数必须小于16000；无效URI、JSON、重复查询key、未知type/action拒绝。严格字节界限为本实现输入约束，原代码没有此界限。

| URI动作 | 返回契约 | 主执行含义 |
| --- | --- | --- |
| player/play、pause、skipNext、skipPrev、togglePlay、collect、uncollect、dislike | `{type:'player',action}` | 分别播放、暂停、下一首、上一首、切换、收藏、取消收藏、不喜欢；不是把collect/uncollect都映射成切换收藏。 |
| music/search | `{type:'search',keyword,source}` | 打开搜索；source在线五源/all/无效→null。JSON keywords允许string或number最长128；URL keyword超长截至128。 |
| music/play | `{type:'music',action:'play',tracks:Track[]}` | 原LX把歌曲插入优先播放队列顶部；已有播放歌曲时立刻切至新插入歌曲，未播放时启动。不得替换或删除现有收藏库。 |
| music/searchPlay | `{type:'music',action:'searchPlay',name,singer,albumName,interval,playLater}` | 主执行器用name/singer/albumName/interval搜索匹配其他源首结果；playLater=true追加优先队列，否则顶部插入并立即播放。解析器不伪造已搜索到的歌曲ID。 |
| songlist/open | `{type:'songlist',action:'open',source,link}` | 打开在线歌单详情，不静默导入/覆盖已有列表；JSON id优先，url次选；路径source/id或编码URL。 |
| songlist/play | `{type:'songlist',action:'play',source,link,index?}` | 获取歌单并建立临时播放队列，从指定序号播放；原动作不覆盖收藏歌单。index为1-based，缺省1，0/负数归1，范围最大1000000。 |

**重要的原文档差异：** 原[FAQ](<D:/data/git/lx-music-desktop/FAQ.md:387>)把歌单index写成从0开始，但实际[歌单执行器](<D:/data/git/lx-music-desktop/src/renderer/core/useApp/compositions/usePlaySonglist.ts:6>)先缺省1、约束到1..列表长度，然后返回index-1。此实现跟随实际执行代码，父执行器应使用 `Math.min(tracks.length-1,Math.max(0,(index??1)-1))`，不能把协议index直接交给零下标播放器。URL路径非法index省略，同原；JSON字符串index拒绝。

原实际music动作只有search/play/searchPlay；songlist动作只有open/play。`music/add`、`addAndPlay`、`songlist/import`等未知动作拒绝，不声称原LX有这些入口。

## 歌曲数据与本应用扩展

原flatten歌曲必需name、singer、source、songmid、types；name等文本有长度/类型校验，显式空singer合法。kw/wy以及kg/tx/mg平台字段保留；kg要求歌曲hash与音质hash，tx要求strMediaMid，mg要求copyrightId。支持128k/320k/flac/flac24bit音质，未知音质过滤，过滤后为空拒绝。

现有normalizeTrack适配flat歌成为Track，保留平台ID、albumName、picUrl、qualitys、_qualitys等。现代Track输入完整meta可保留嵌套provider扩展和质量信息，不只留下歌曲名称与编号。本应用额外接受 `data.songs` 或 `data.tracks` 批量，最多100首；原LX只接受单曲对象，此扩展明确不称为原协议功能。此动作仍是播放，不是隐式导入/覆盖收藏列表。

本应用原simple链接继续兼容：

- `chenjinmusic://search?source=all&keyword=晴天`
- `chenjinmusic://play?source=wy&id=123&name=晴天&singer=周杰伦&album=叶惠美`
- `chenjinmusic://play?track={URI编码现代Track JSON}`，同时兼容data单曲对象；id可用songId替代，来源默认wy。

chenjin现代Track支持local与filePath，旧LX scheme原协议仅在线五源。现代Track和批量歌曲是本应用扩展；legacy接受现代在线meta是兼容迁移扩展，并非原LXflat字段校验声明。

## CLI职责与接入

此任务不编辑startup/main/renderer。父startup已有单dash/double-dash参数搜索、链接与歌单启动解析，本文不将该代码归为本任务实现。父接入建议：

```ts
const action=parseDeepLink(raw,!!library.get().settings.associateLegacyScheme)
// 先等待main renderer初始化，再分派 typed action；错误走app.error。
```

CLI的search可生成simple chenjin search链接交给解析器；CLI play使用自身parsePlaylistLaunch，当前其返回index已经是零下标，与scheme返回1-based务必区分。

原LX [CLI类型说明](<D:/data/git/lx-music-desktop/src/common/types/common.d.ts:4>)列出-dt非透明模式、-proxy-server、-proxy-bypass-list、-dha、-dhmkh、-hidden、-search、-play。本解析器只处理scheme，不宣称独立实现所有CLI启动参数；代理/透明窗口选项由宿主启动处理。

## 验证与边界

[协议测试](<../tests/deeplink.test.ts>)覆盖10组实际契约：旧scheme默认拒绝、八个player动作、中文URI/原JSON搜索、加号等号保留、flat五源平台字段与音质验证、完整modern meta/批量、searchPlay延后标记、songlist URL及1-based、simple链接/local、无效/重复/超限输入及base64拒绝。独立严格TypeScript检查验证联合类型可由主执行器完整分派。

最终 **10/10协议单测通过**、解析器与测试的**独立严格TypeScript检查通过**。后台验证任务已全部收集，无运行中的探针或服务。

本任务没有启动真实OS URL协议，也没有做Electron全流程或播放/搜索网络验收。父接入后可另做隔离Electronprobe；仅解析成功不等价于浏览器协议注册成功、平台歌单可在线获取或歌曲可播放。default legacy=false是接收策略，OS是否关联仍属于父主进程实现。
