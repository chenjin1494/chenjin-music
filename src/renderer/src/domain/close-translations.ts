import { registerTranslations, t } from '../i18n'

const translations:Record<string,[string,string]>={
 '关闭主窗口时':['關閉主視窗時','When closing the main window'],
 '选择每次询问可恢复关闭确认；隐藏到托盘会继续播放。':['選擇每次詢問可恢復關閉確認；隱藏到系統匣會繼續播放。','Choose Ask every time to restore the close prompt; hiding to tray keeps playback running.'],
 '每次询问':['每次詢問','Ask every time'],
 '隐藏到托盘':['隱藏到系統匣','Hide to tray'],
 '退出程序':['退出程式','Exit'],
}
registerTranslations(Object.fromEntries(Object.entries(translations).filter(([cn])=>t(cn,'en-US')===cn).map(([cn,[tw,en]])=>[cn,{'zh-TW':tw,'en-US':en}])))
