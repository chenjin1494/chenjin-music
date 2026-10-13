import { registerTranslations,t } from '../i18n'
const translations:Record<string,[string,string]>={
 '桌面歌词工具栏':['桌面歌詞工具列','Desktop lyric toolbar'],
 '拖动移动歌词':['拖曳移動歌詞','Drag to move lyrics'],
 '显示主窗口':['顯示主視窗','Show main window'],
 '缩小歌词':['縮小歌詞','Decrease lyric size'],
 '放大歌词':['放大歌詞','Increase lyric size'],
 '锁定后从托盘或设置解锁':['鎖定後從系統匣或設定解鎖','After locking, unlock from the tray or settings'],
 '下一句预览':['下一句預覽','Next line preview'],
 '横向且窗口高度足够时显示下一句歌词':['橫向且視窗高度足夠時顯示下一句歌詞','Show the next line when horizontal and tall enough'],
 '恢复歌词窗口':['恢復歌詞視窗','Restore lyric window'],
 '找回移出屏幕或尺寸过小的歌词窗口':['找回移出螢幕或尺寸過小的歌詞視窗','Recover an off-screen or very small lyric window'],
 '重置歌词位置':['重設歌詞位置','Reset lyric position'],
}
registerTranslations(Object.fromEntries(Object.entries(translations).filter(([cn])=>t(cn,'en-US')===cn).map(([cn,[tw,en]])=>[cn,{'zh-TW':tw,'en-US':en}])))
