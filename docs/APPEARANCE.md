# 外观配置

琛瑾音乐的外观使用独立 JSON 配置。你可以统一设置颜色、字体、圆角、间距与动画，也可以覆盖某一个组件。格式版本为 `1`；无需填写主题模式。午夜紫、象牙白、紧凑三个预设可作为起点。

[默认配置模板](../appearance.default.json) 与代码中的 `DEFAULT_APPEARANCE` 完全一致：

```json
{
  "format": "chenjin-appearance",
  "version": 1,
  "name": "默认外观",
  "global": { "gap": 12 },
  "components": {}
}
```

默认模板省略颜色、字体、圆角与阴影，继承 Material 3 动态深浅配色和各组件原生形状；旧主题具体颜色仍可覆盖。仅完全未修改的旧默认（圆角14／间距12／柔和阴影且无组件覆盖）会迁移，其他自定义配置保留。省略的属性表示继承；`null`、空字符串和 `"inherit"` 不代表继承。恢复继承应删除对应属性。配置是一次完整的外观描述，不会自动与上次导入的配置合并。顶层五个字段必须存在，`global` 和 `components` 可以是空对象；名称为 1–80 个可显示字符。

## 优先级与 CSS 变量

同一属性的取值顺序为 **组件配置 → 全局配置 → 当前主题和组件原有样式**。组件尺寸仅在该组件配置中生效，全局没有宽度、高度或列表行高。配置只修改对应组件使用的样式属性，不注入任意选择器或 CSS 代码。

[纯配置模块](../src/shared/appearance.ts) 导出 `AppearanceComponentId`、`AppearanceStyle`、`AppearanceConfig` 类型，以及属性表、组件表、全局属性表、预设和默认配置。

- `parseAppearance(input)` 接受对象或 JSON 文本，严格验证并返回独立的配置对象。非法输入抛出错误；有限数值超出范围时夹到边界。
- `normalizeAppearance(input)` 用于读取存储设置。非法数据返回独立的默认配置，避免应用启动因配置损坏而失败。
- `appearancePropertyBounds(id, key)` 返回组件或 `global` 的数值边界 `{ min, max }`，优先使用组件专属边界，再使用属性表边界。非数值属性的边界为 `undefined`；是否允许某个属性仍以组件属性表为准。编辑器和解析器共享此函数。
- `appearanceVariables(config)` 再次验证配置，输出字符串 CSS 变量表，只输出显式配置的属性。它没有 DOM、Vue 或 Electron 依赖。

`APPEARANCE_PROPERTIES` 的 `default` 是编辑器在启用单个属性时使用的建议初始值，例如圆角 14、间距 12、字号 16、不透明度 1。它不会补入导入配置，也不会影响省略属性的继承。组件尺寸的建议值应按 `appearancePropertyBounds` 夹到该组件范围后显示。

变量使用 `--cj-global-{属性}` 和 `--cj-{组件}-{属性}`，驼峰转换为短横线，例如 `--cj-track-list-row-height`、`--cj-desktop-lyrics-font-size`。运行时从规范化配置生成固定作用域覆盖样式，布局与阴影消费对应变量，省略属性继承主题。数字默认转为 `px`；`opacity`、`lineHeight`、`fontWeight`、`strokeWidth` 无单位，`animationDuration` 为 `ms`。阴影选项会转换为固定安全 CSS 值。

全局 `fontSize` 是界面缩放基准，默认基准为 16，范围 10–32 对应 62.5%–200% 缩放。组件 `fontSize` 则表示实际像素字号：通常为 10–32 px，`lyrics` 特例为 12–72 px，`desktopLyrics` 特例为 12–96 px。全局 `shadow` 仅应用于卡片、面板与封面；任意支持 `shadow` 的组件可以单独覆盖自身阴影。全局 `opacity` 只作用于 body 一次，不会在所有组件中重复叠加。

## 编辑与文件使用

打开 **设置 → 外观与体验 → 组件外观工作室**。选择全局或组件，启用“自定义”后编辑；取消覆盖恢复继承。滑块释放或失焦后保存，文本输入短暂防抖。设置重启仍保留。

导入接受最多 512 KiB JSON；导出下载独立 `.appearance.json`，不包含歌曲、资料库或脚本。高级 JSON 应用前严格验证，损坏配置在启动时回退默认。完整可导入文件见 [40 组件示例](../appearance.example.json)，两个模板随安装／便携／源码包提供。

嵌套优先级：全局继承低于任何组件覆盖；外层面板低于内部具体组件；独立设置组高于通用设置区域；工作室自身高于主题设置组。通用控件不会覆盖具体列表、导航或播放器配置。标题字号高于同组件普通字号，JSON 字段排序不改变优先级。

全局背景为不透明 hex／rgb 颜色时生成协调的浅／深基础表面，组件仍可覆盖。全局字号缩放壳界面，桌面歌词保持独立。列表行高联动虚拟滚动并保留浏览位置；下载行高是最小高度，多行信息可自然撑高，避免截断。

恢复全部需二次确认，恢复默认全局并清除组件覆盖，不重置音乐库或旧主题。

## 通用属性

以下属性可用于 `global` 及 39 个界面组件。第 40 类 `icon` 仅支持后文列出的 6 个图标属性，避免提供无效的排版选项。数值必须是 JSON 数字，允许小数，不接受数字字符串、NaN、Infinity。边界外的有限数值会夹到边界，不按编辑器步长取整。

| 属性 | 含义 | 范围 / 值 |
| --- | --- | --- |
| `background` | 背景颜色 | 安全颜色字符串 |
| `color` | 主要文字颜色 | 安全颜色字符串 |
| `mutedColor` | 次要文字颜色 | 安全颜色字符串 |
| `accentColor` | 强调颜色 | 安全颜色字符串 |
| `borderColor` | 边框颜色 | 安全颜色字符串 |
| `hoverBackground` | 悬停背景 | 安全颜色字符串 |
| `activeBackground` | 选中背景 | 安全颜色字符串 |
| `radius` | 圆角 | 0–48 px |
| `padding` | 内边距 | 0–64 px |
| `gap` | 间距 | 0–48 px |
| `fontSize` | 字号 | 10–32 px |
| `fontWeight` | 字重 | 100–900，无单位 |
| `lineHeight` | 字体行高比例 | 1–2.5，无单位 |
| `borderWidth` | 边框宽度 | 0–4 px |
| `opacity` | 不透明度 | 0.2–1，无单位 |
| `blur` | 背景模糊 | 0–40 px |
| `letterSpacing` | 字间距 | -2–8 px |
| `animationDuration` | 动画时长 | 0–1000 ms；0 表示关闭相应过渡 |
| `shadow` | 阴影预设 | `none`、`soft`、`elevated` |
| `fontFamily` | 字体族列表 | 最多 200 字符，安全字体列表 |

颜色支持 `#rgb`、`#rgba`、`#rrggbb`、`#rrggbbaa`、逗号分隔的 `rgb(r,g,b)` 与 `rgba(r,g,b,a)`。RGB 通道为 0–255，alpha 为 0–1；也支持 `transparent`、`currentColor`、`var(--safe-token)`。变量名必须以 ASCII 字母开头，后续可为字母、数字、下划线或短横线；不支持变量回退表达式、百分比 RGB、HSL、渐变、URL、普通命名颜色或任意 CSS 表达式。

字体示例：`"Noto Sans SC", 微软雅黑, sans-serif`。字体名允许 Unicode 字母和数字、空格、下划线和短横线，名称可整体用成对单引号或双引号包裹，逗号分隔多个字体。多余空白会归一化；括号、分号、反斜线、CSS 注释和其他 CSS 元字符被拒绝。字体必须已在设备上安装。

阴影转换结果：

| 选项 | CSS 值 |
| --- | --- |
| `none` | `none` |
| `soft` | `0 4px 18px rgba(0, 0, 0, 0.08)` |
| `elevated` | `0 12px 36px rgba(0, 0, 0, 0.18)` |

## 组件与专属属性

下表除 `icon` 外的每个组件均支持上面的通用属性。`icon` 仅支持 `color`、`background`、`opacity`、`iconSize`、`strokeWidth`、`radius`；其中 `strokeWidth` 是无单位描边粗细，范围 0.5–4，编辑步长 0.25，建议值 1.75，不能用于全局或其他组件。专属属性不能用于全局或未列出的组件。`rowHeight` 是列表布局和虚拟滚动使用的整行高度，区别于字体的 `lineHeight`。

| ID | 组件 | 额外属性及边界（px） |
| --- | --- | --- |
| `sidebar` | 侧边栏 | `width` 160–320 |
| `navigation` | 导航项目 | `height` 32–64、`iconSize` 12–40 |
| `topbar` | 顶部栏 | `height` 60–108、`iconSize` 12–40 |
| `search` | 搜索框与结果 | `height` 32–64、`iconSize` 12–40 |
| `content` | 内容区域 | `headingSize` 16–64 |
| `hero` | 首页横幅 | `height` 120–400、`headingSize` 16–64 |
| `playlistCard` | 歌单卡片 | `coverSize` 32–320、`headingSize` 16–64 |
| `trackList` | 歌曲列表 | `rowHeight` 44–100、`coverSize` 32–64、`iconSize` 12–40 |
| `player` | 播放控制栏 | `height` 68–144、`coverSize` 32–96、`iconSize` 12–40 |
| `queue` | 播放队列 | `width` 280–560、`rowHeight` 44–100、`coverSize` 32–64、`iconSize` 12–40 |
| `lyrics` | 应用内歌词 | `fontSize` 12–72、`headingSize` 16–64 |
| `desktopLyrics` | 桌面歌词 | `fontSize` 12–96、`headingSize` 16–64 |
| `settings` | 设置面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `downloads` | 下载列表 | `rowHeight` 44–100、`iconSize` 12–40 |
| `sources` | 音源管理 | `iconSize` 12–40 |
| `comments` | 评论 | `iconSize` 12–40 |
| `dialog` | 对话框 | `width` 280–640、`headingSize` 16–64 |
| `contextMenu` | 右键菜单 | `iconSize` 12–40 |
| `button` | 通用按钮 | `height` 28–64、`iconSize` 12–40 |
| `input` | 输入控件 | `height` 32–64 |
| `toast` | 通知提示 | `iconSize` 12–40 |
| `emptyState` | 空状态 | `headingSize` 16–64、`iconSize` 12–40 |
| `cover` | 封面图片 | `coverSize` 32–320 |
| `appearanceEditor` | 外观编辑器 | `headingSize` 16–64、`iconSize` 12–40 |
| `themeSettings` | 主题设置 | `headingSize` 16–64、`iconSize` 12–40 |
| `audioSettings` | 音频设置 | `headingSize` 16–64、`iconSize` 12–40 |
| `lyricSettings` | 歌词设置 | `headingSize` 16–64、`iconSize` 12–40 |
| `shortcutSettings` | 快捷键设置 | `headingSize` 16–64、`iconSize` 12–40 |
| `syncPanel` | 同步面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `backupPanel` | 备份面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `dislikePanel` | 屏蔽面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `updatePanel` | 更新面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `onlinePanel` | 在线音乐面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `downloadsPanel` | 下载管理面板 | `headingSize` 16–64、`iconSize` 12–40 |
| `sourceManager` | 音源管理器 | `headingSize` 16–64、`iconSize` 12–40 |
| `trackDetails` | 歌曲详情 | `width` 280–640、`headingSize` 16–64、`iconSize` 12–40 |
| `sourceAlternatives` | 换源对话框 | `width` 280–640、`headingSize` 16–64、`iconSize` 12–40 |
| `lyricEditor` | 歌词编辑器 | `width` 280–640、`headingSize` 16–64、`iconSize` 12–40 |
| `commentsPanel` | 评论面板 | `width` 280–640、`headingSize` 16–64、`iconSize` 12–40 |
| `icon` | 通用图标 | `iconSize` 12–40、`strokeWidth` 0.5–4（无单位）；仅支持上述 6 个属性 |

属性和组件的 ID 区分大小写。未知属性、组件或顶层字段会报错，以发现拼写错误。`__proto__`、`prototype`、`constructor` 键、自定义对象原型和访问器属性会被拒绝。导入只接受版本 1；不会静默解释未来版本。

## 完整自定义示例

下面的配置展示所有组件和所有通用属性。可复制后删掉不需要的属性，以恢复主题继承。尺寸遵守各组件边界；预设不需要 `mode` 字段，明确的颜色即可表达深浅色意图。

```json
{
  "format": "chenjin-appearance",
  "version": 1,
  "name": "我的紫夜音乐空间",
  "global": {
    "background": "#171422", "color": "#f3efff", "mutedColor": "#afa6c6",
    "accentColor": "#ba9bff", "borderColor": "#362c4b",
    "hoverBackground": "#29213c", "activeBackground": "#3a2b54",
    "radius": 16, "padding": 12, "gap": 12,
    "fontSize": 14, "fontWeight": 400, "lineHeight": 1.5,
    "borderWidth": 1, "opacity": 1, "blur": 12,
    "letterSpacing": 0.2, "animationDuration": 180,
    "shadow": "soft", "fontFamily": "\"Noto Sans SC\", 微软雅黑, sans-serif"
  },
  "components": {
    "sidebar": { "width": 224, "background": "#1d182c", "padding": 14 },
    "navigation": { "height": 42, "iconSize": 19, "radius": 10 },
    "topbar": { "height": 76, "iconSize": 20, "background": "#1d182c" },
    "search": { "height": 40, "iconSize": 18, "radius": 20 },
    "content": { "padding": 24, "headingSize": 28 },
    "hero": { "height": 200, "headingSize": 36, "background": "#302344" },
    "playlistCard": { "coverSize": 180, "headingSize": 18, "radius": 14 },
    "trackList": { "rowHeight": 56, "coverSize": 40, "iconSize": 18 },
    "player": { "height": 88, "coverSize": 56, "iconSize": 22, "background": "#221b33" },
    "queue": { "width": 360, "rowHeight": 56, "coverSize": 40, "iconSize": 18 },
    "lyrics": { "fontSize": 24, "headingSize": 32, "lineHeight": 1.8 },
    "desktopLyrics": { "fontSize": 28, "headingSize": 40, "background": "rgba(18,14,28,0.8)" },
    "settings": { "headingSize": 24, "iconSize": 20, "gap": 16 },
    "downloads": { "rowHeight": 60, "iconSize": 20 },
    "sources": { "iconSize": 22, "padding": 16 },
    "comments": { "iconSize": 18, "lineHeight": 1.7 },
    "dialog": { "width": 480, "headingSize": 24, "shadow": "elevated" },
    "contextMenu": { "iconSize": 17, "radius": 12, "padding": 8 },
    "button": { "height": 40, "iconSize": 18, "radius": 10 },
    "input": { "height": 40, "radius": 10, "borderColor": "#534365" },
    "toast": { "iconSize": 20, "shadow": "elevated" },
    "emptyState": { "headingSize": 22, "iconSize": 36, "mutedColor": "#c0b5d5" },
    "cover": { "coverSize": 180, "radius": 12, "shadow": "soft" },
    "appearanceEditor": { "headingSize": 24, "iconSize": 20, "gap": 16 },
    "themeSettings": { "headingSize": 22, "iconSize": 20 },
    "audioSettings": { "headingSize": 22, "iconSize": 20 },
    "lyricSettings": { "headingSize": 22, "iconSize": 20 },
    "shortcutSettings": { "headingSize": 22, "iconSize": 18 },
    "syncPanel": { "headingSize": 22, "iconSize": 20 },
    "backupPanel": { "headingSize": 22, "iconSize": 20 },
    "dislikePanel": { "headingSize": 22, "iconSize": 18 },
    "updatePanel": { "headingSize": 22, "iconSize": 20 },
    "onlinePanel": { "headingSize": 28, "iconSize": 20 },
    "downloadsPanel": { "headingSize": 24, "iconSize": 20 },
    "sourceManager": { "headingSize": 24, "iconSize": 22 },
    "trackDetails": { "width": 520, "headingSize": 24, "iconSize": 20 },
    "sourceAlternatives": { "width": 520, "headingSize": 24, "iconSize": 20 },
    "lyricEditor": { "width": 640, "headingSize": 24, "iconSize": 20 },
    "commentsPanel": { "width": 560, "headingSize": 24, "iconSize": 20 },
    "icon": { "color": "currentColor", "background": "transparent", "opacity": 1, "iconSize": 20, "strokeWidth": 1.75, "radius": 0 }
  }
}
```

组件单独设置的 `background` 不改变全局文字颜色；同时设置背景和文字可保持可读性。紧凑预设仅修改尺寸与间距，保留当前主题颜色。若多个值需要同步，可使用应用已有的安全 CSS 变量，但导入不会自行创建 JSON 中未定义的 CSS 变量。
