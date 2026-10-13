# LX偏好迁移

[迁移模块](<../electron/main/services/legacy-preferences.ts>)导出：

```ts
export async function migrateLegacyPreferences(settings: Settings, dataDirectory: string): Promise<Settings>
```

由宿主在基础设置normalize后、保存导入状态前调用：

```ts
state.settings = await migrateLegacyPreferences(state.settings, dataDirectory)
```

模块不改主进程入口、导入服务、共享类型或前端，只返回新的Settings根对象；不写旧数据、不抓取网络资源。实际持久化和前端应用由宿主完成。原sound_effect/hot_key/theme JSON保存在legacySoundEffects/legacyHotkeys/legacyThemes，未支持、重复或有损转换记录在legacyMigrationWarnings，不把保留原数据表述为已经生效。

## 实际旧格式与映射

| 数据 | 原实现证据 | 新行为 |
|---|---|---|
| 十段EQ | [类型](<D:/data/git/lx-music-desktop/src/common/types/sound_effect.d.ts:3>)为hz31、62、125、250、500、1000、2000、4000、8000、16000；sound_effect.json.eqPreset数组 | settings.effectUserPresets，以名称为键，用实际parseEffect验证十段数值。重名添加LX后缀，非法项报告，超±12dB限幅并报告。旧预设只保存EQ；新版完整快照捕获迁移时其它音效，差异明确报告。 |
| 卷积预设 | [保存按钮](<D:/data/git/lx-music-desktop/src/renderer/components/common/SoundEffectBtn/AddConvolutionPresetBtn.vue:39>)source取convolution.fileName；[实际加载](<D:/data/git/lx-music-desktop/src/renderer/core/useApp/usePlayer/useSoundEffect.ts:19>)require打包assets/medias/filters文件 | source不是内嵌base64，也不保证数据目录中存在。保留legacyConvolutionReferences；新版UserEffect没有IR切换字段，非活动预设不伪装成可等效应用的音效。 |
| 当前IR | config_v2.json.setting的player.soundEffect.convolution.fileName，以及mainGain/sendGain（存值按十分之一用于音频） | 只有数据目录内实际有效音频才恢复impulseResponseBase64/name。通常旧内置WAV不在数据目录：记录warning、保留引用，并关闭替代生成混响，避免听起来不同却宣称恢复。 |
| 快捷键 | [动作列表](<D:/data/git/lx-music-desktop/src/common/hotKey.ts:114>)自动加player_/common_/desktop_lyric_前缀；[按键解析](<D:/data/git/lx-music-desktop/src/renderer/utils/keyBind.ts:11>)使用平台mod及event.key；hot_key.json.local/global包含enable和keys | local转换为KeyboardEvent.code，例如mod+arrowleft→Ctrl+ArrowLeft（macOS为Meta+ArrowLeft）；global转换为Electron accelerator，例如CommandOrControl+Alt+Left。player_prev→local previous/global prev；desktop lyric→local desktopLyric/Lock/Top、global lyric/lyricLock/lyricTop。 |
| 禁用/重复快捷键 | 原[事件分发](<D:/data/git/lx-music-desktop/src/renderer/event/keyEvent.ts:27>)检查local.enable | 禁用local时清空所有新版默认绑定，避免新默认快捷键意外生效；禁用global时不给旧绑定注册。原绑定仍在legacyHotkeys。多个旧键映射同一动作、规范化后冲突或不支持的键/动作保留首个并记录warning。新版local无法绑定Escape/Tab，明确报告。 |
| 自定义主题 | [原类型](<D:/data/git/lx-music-desktop/src/common/types/theme.d.ts:261>)含config.themeColors/extInfo/isDark/isDarkFont；theme.json.themes数组 | settings.userThemes:Record<string,ThemeFile>；解析var()、六/三位HEX与RGB；alpha无法精确保留则报告。映射五种界面颜色和accent，不宣称专用按钮/徽章全部等同。重名主题独立保留。 |
| 背景图 | [原主进程](<D:/data/git/lx-music-desktop/src/main/utils/index.ts:261>)把非URL拼接dataDirectory/theme_images/{name} | 数据目录内PNG/JPEG/GIF/WebP按真实字节签名内嵌data URL；外目录路径、目录外链接和远程URL仅保留legacyThemeReferences+warning，不读外部内容、不请求网络。 |
| 选中主题 | 原[theme.id逻辑](<D:/data/git/lx-music-desktop/src/main/utils/index.ts:245>)支持auto和独立lightId/darkId | 手动选中的自定义主题同时应用到当前theme/accent/themeColors/background。auto设system并保留两个ID；新版没有自动切换两套自定义配色的字段，集合仍保留、差异报告，供用户手动应用。 |

干湿增益按实际音频图换算：原dry=a、wet=b，新mix=2·atan2(b,a)/π，两个gain=√(a²+b²)，因此cos(mix·π/2)·gain=a、sin(mix·π/2)·gain=b。新gain最大2，超过时按比例限幅并报告。直接将mix设1会丢失干声，因此不采用这种错误迁移。

## 读取边界

固定读取五个JSON文件：sound_effect.json、hot_key.json、theme.json、config_v2.json、config.json；v2优先。每个文件最多8MiB，资源内嵌总计24MiB。路径先做目录边界检查，再通过realpath核对符号链接/Junction的实际目标，读取前后校验普通文件和大小。外部引用保留但不读取。图片依据字节识别MIME；音频检查WAV/FLAC/Ogg/M4A/MP3头，实际解码仍由播放器负责。

JSON损坏、目录不存在、格式错误、资源缺失、颜色转换和功能不支持均有warning。原JSON与资源保持不变；不搜索原应用安装目录，不复制第三方打包音频，不假造原资源路径。

## 验证

[迁移测试](<../tests/legacy-preferences.test.ts>)包含8组：十段与重名/限幅、真实前缀动作与标点accelerator、禁用快捷键、实际WAV与干湿换算、缺失内置IR、选中主题与theme_images真实PNG、Junction外目录逃逸及远程引用、损坏JSON/auto双主题。

fixture临时目录包含实际JSON、有效WAV和PNG；测试确认输入对象及原文件不变。资源边界检查包含真实Junction。该验证证明转换与读取行为，不代替宿主导入后UI应用和真实WebAudio解码验收；主进程接入和最终打包由父代理负责。
