import { registerTranslations } from '../i18n'

export const lyricEditorTranslations = {
 '编辑歌词':'Edit lyrics','关闭歌词编辑':'Close lyric editor','歌词正文':'Main lyrics','翻译歌词':'Translated lyrics','罗马音歌词':'Romanized lyrics','LX逐字歌词':'LX word-timed lyrics',
 '歌词文本':'Lyric text','实时预览':'Live preview','当前行':'Current line','校准到播放位置':'Set to playback position','当前行提前100ms':'Move current line 100ms earlier','当前行延后100ms':'Move current line 100ms later',
 '整体偏移':'Shift all lyrics','应用整体偏移':'Apply time shift','整体偏移应用到四种歌词；正值延后，负值提前。':'Apply the shift to all four lyric types; positive delays and negative advances.',
 '撤销':'Undo','重做':'Redo','恢复原歌词':'Restore original lyrics','恢复原歌词会删除这首歌的编辑版本。继续？':'Restoring removes the edited lyrics for this song. Continue?',
 '确认恢复原歌词':'Confirm restore','取消恢复':'Cancel restore','保存编辑':'Save edits','正在保存…':'Saving…','导出当前歌词':'Export current lyrics',
 '歌词编辑只保存到用户缓存，不修改原音频或歌词文件。':'Edits are stored in your user cache and do not change the original audio or lyric files.',
 '选择文本中的歌词行，再使用时间校准。':'Select a line in the text, then calibrate its timestamp.','没有时间行可预览，纯文本和元信息仍会保留。':'No timed lines to preview. Plain text and metadata are retained.',
 '仅能用正在播放的这首歌校准时间':'Timing calibration requires this song to be the active track','播放位置':'Playback position','保存前请修复时间格式或大小错误':'Fix invalid timing or size errors before saving',
 '四种歌词合计不能超过2MB':'The four lyric texts must total no more than 2MB','时间戳秒数必须小于60':'Timestamp seconds must be less than 60','时间戳格式无效':'Invalid timestamp format','时间数值超出允许范围':'Time value is out of range',
 '逐字歌词行没有字级时间标记':'This word-timed line has no word timestamps','此行没有时间戳，将作为纯文本保存':'This line has no timestamp and will be saved as plain text',
 '时间必须是有限数字':'Time must be a finite number','偏移超出允许范围':'Time shift is out of range','请选择有效歌词行':'Select a valid lyric line',
 '当前行没有时间戳，请先校准到播放位置':'Set this untimed line to the playback position first','元信息或空行不能校准为歌词':'Metadata and empty lines cannot be timed as lyrics',
 '逐字歌词行需要保留字级时间标记':'Word-timed lines need word timestamps','字级片段':'word segments','预览只显示前100行':'Preview shows the first 100 timed lines',
} as const

registerTranslations(lyricEditorTranslations)
