# 歌词编辑器

[组件](<../src/renderer/src/components/LyricEditor.vue>)提供正文LRC、翻译、罗马音、LX逐字歌词四个页签。每种文本可直接编辑并实时解析预览；预览最多显示100行，原文本全量保存。标签/作者/标题与纯文本不会被删除，歌词和歌曲资料标记为不翻译；所有UI文案通过[独立词典模块](<../src/renderer/src/domain/lyric-editor-translations.ts>)导出lyricEditorTranslations并在module顶层registerTranslations，使用当前language；统一interface-translations可直接导入真实词典，测试无需先挂组件或复制测试假词条。

原LX只读参考：[歌词菜单](<D:/data/git/lx-music-desktop/src/renderer/components/layout/PlayDetail/components/LyricMenu.vue:121>)对四种歌词添加/更改offset标签，并写独立edited缓存；[edited IPC接口](<D:/data/git/lx-music-desktop/src/renderer/utils/ipc.ts:603>)与raw缓存分开保存/移除。此实现从零编写。四种文本全文编辑、单行校准、undo/redo与导出是本应用提供的编辑扩展，不宣称原菜单已有这些界面。

## 接入

```vue
<LyricEditor
  v-if="showEditor && music.current"
  :track="music.current"
  :lyrics="music.lyric"
  @close="showEditor = false"
  @saved="music.lyric = $event"
/>
```

props为track:Track、lyrics:Lyrics；事件close()、saved(lyrics:Lyrics)。保存成功保持窗口开放，便于继续编辑；父界面可自行关闭。轨道ID变化时重建编辑会话，旧异步保存/恢复结果不会覆盖新轨道的编辑器状态。

保存调用 `invoke('lyrics.save',{track,lyrics})`，先校验四种文本合计UTF8最多2MiB、严重时间错误。依赖主进程将结果写入用户override缓存，主进程返回Lyrics时作为saved事件结果，否则采用提交快照。组件不直接改播放器，也不修改全局settings.lyricOffset。父界面更新music.lyric，正常store状态监听负责歌词广播。

恢复按钮先显示二次确认；只有确认才调用 `invoke('lyrics',{track,refresh:true,resetEdited:true})`。取消没有IPC。成功后重建编辑历史并saved(原歌词)。恢复依赖宿主删除本轨道edited override，普通refresh:true不应删除编辑版本。

## 时间调整

[纯时间与历史逻辑](<../src/renderer/src/domain/lyric-editor.ts>)用于以下行为：

- 整体偏移输入毫秒后点击应用：四种歌词时间戳同步移动，正值延后、负值提前，textarea立即显示实际保存文本。原offset标签保持，避免替换用户其他元信息。
- 当前行由textarea光标/选区确定。前后100ms只改变该文本行，不误改其他行；有多个LRC时间标记时共同移动。
- 校准到播放位置使用music.progress加当前播放器全局lyricOffset对应的有效歌词位置，再扣源文本offset标签，写到当前行；无时间的普通LRC行可生成新时间戳。metadata与空行不生成歌词时间。
- 校准仅在props.track.id等于music.current.id时启用，避免其他歌曲播放时间写进编辑中的歌曲。手动行调整不依赖播放。
- LX/KRC `<相对字偏移,持续时间[,unused]>`保持所有字级标记和duration不变，仅移动行首；YRC `(绝对开始,持续时间,unused)`和QRC字后 `(绝对开始,持续时间)`随行首移动绝对开始，duration不变。负值跨零时行首归零，字级绝对起始使用实际行位移，避免时间负数。
- 普通LRC正文的`(123,4)`不会被当作字时间修改；只有逐字栏或毫秒行格式处理绝对字标记。没有字级标记的LX纯文本行不伪造逐字时间。

元信息标签允许保留；纯文本无时间为警告而非阻止保存。非法数字时间标签、秒数>=60、过大数值及超2MiB为错误；含错误时保存/导出禁用。超大粘贴在进入历史之前拒绝，显示2MB反馈，保留原有效文本。预览过滤非有限时间，畸形超长数字不会破坏模态渲染。

既有播放器对LX offset标签的解析由原domain lyrics维护者负责；本编辑器整体偏移直接修改起始时间，因此不会通过新增offset标签依赖该旧解析缺口。

## 操作与文件

撤销/重做最多50个快照，另外按8MiB快照合计约束（至少保留当前及一步撤销），新输入丢弃redo分支。Ctrl/Cmd+Z、Shift+Z、Y可操作历史，Ctrl/Cmd+S保存。

首次打开textarea获得焦点；Escape关闭编辑器，恢复确认打开时Escape只取消确认。Tab/Shift+Tab留在当前模态范围，确认恢复时范围限制到确认操作，忙碌状态不能穿透到背后的应用。关闭后恢复原焦点。

导出仅在用户点击时创建Blob与新文件下载：正文/翻译/罗马音使用.lrc，逐字使用.lxlrc；文件名中的非法字符替换。不覆盖原音频或原歌词文件，实际保存位置由浏览器/Electron下载流程处理。

## 验证边界

[单测](<../tests/lyric-editor.test.ts>)覆盖8组行为：LRC复时间标记/元信息保留、LX/KRC相对字时间、YRC/QRC绝对字时间、四种同步偏移、单行校准与offset、UTF8大小/非法时间/超长数值、undo/redo分支/数量及内存约束。组件经全仓vue-tsc检查。最终 **8/8单测通过**，提取独立词典后的**全仓vue-tsc --noEmit通过**；所有后台验证任务已收集。

此scope仅新增组件、domain、测试与本文档；没有改主进程、共享类型、store或其他界面。界面入口与用户override持久化由父代理接入。单测不替代真实Electron模态交互与重启后缓存验收，不把通过类型检查表述为已经验证OS文件下载或完整保存链路。
