import type { Settings } from './types'
const keys: Record<string,string>={
 'common.font':'font','common.startInFullscreen':'startInFullscreen','common.fontSize':'interfaceFontSize','common.langId':'language','common.isShowAnimation':'animation',
 'player.volume':'volume','player.isMute':'muted','player.playbackRate':'playbackRate','player.preservesPitch':'preservesPitch',
 'player.playQuality':'quality','player.togglePlayMethod':'playMode','player.startupAutoPlay':'startupAutoPlay','player.isSavePlayTime':'savePlayTime',
 'player.autoSkipOnError':'autoSkip','player.powerSaveBlocker':'preventSleep','player.mediaDeviceId':'outputDevice','player.isMediaDeviceRemovedStopPlay':'pauseOnDeviceRemoved',
 'player.isShowLyricTranslation':'lyricTranslation','player.isShowLyricRoma':'lyricRoma','player.isSwapLyricTranslationAndRoma':'swapLyric',
 'player.audioVisualization':'visualization','player.waitPlayEndStop':'waitPlayEndStop','player.waitPlayEndStopTime':'waitPlayEndStopTime',
 'player.isAutoCleanPlayedList':'autoCleanPlayed','player.isMaxOutputChannelCount':'maxChannels','player.isShowStatusBarLyric':'statusBarLyric',
 'desktopLyric.enable':'desktopLyric','desktopLyric.isLock':'desktopLyricLock','desktopLyric.isAlwaysOnTop':'desktopLyricTop',
 'desktopLyric.isShowTaskbar':'desktopLyricTaskbar','desktopLyric.fullscreenHide':'desktopLyricFullscreenHide','desktopLyric.pauseHide':'desktopLyricPauseHide',
 'desktopLyric.isHoverHide':'desktopLyricHoverHide','desktopLyric.direction':'desktopLyricDirection','desktopLyric.width':'desktopLyricWidth',
 'desktopLyric.height':'desktopLyricHeight','desktopLyric.x':'desktopLyricX','desktopLyric.y':'desktopLyricY',
 'desktopLyric.style.font':'desktopLyricFont','desktopLyric.style.fontSize':'desktopLyricFontSize','desktopLyric.style.lineGap':'desktopLyricLineGap',
 'desktopLyric.style.opacity':'desktopLyricOpacity','desktopLyric.style.lyricPlayedColor':'desktopLyricPlayedColor','desktopLyric.style.lyricUnplayColor':'desktopLyricUnplayColor',
 'download.enable':'downloadEnabled','download.savePath':'downloadPath','download.maxDownloadNum':'downloadConcurrency','download.fileName':'downloadFileName',
 'download.skipExistFile':'skipExisting','download.isDownloadLrc':'downloadLyrics','download.isDownloadLxLrc':'downloadWordLyrics',
 'download.isDownloadTLrc':'downloadTranslation','download.isDownloadRLrc':'downloadRoman','download.lrcFormat':'lyricEncoding',
 'download.isEmbedLyricLx':'embedWordLyrics','download.isEmbedLyricT':'embedTranslation','download.isEmbedLyricR':'embedRoman','download.isEmbedPic':'embedCover','download.isEmbedLyric':'embedLyrics','download.isSavePathGroupByListName':'downloadGroupByList',
 'download.isUseOtherSource':'downloadOtherSource','search.isShowHotSearch':'hotSearch','search.isShowHistorySearch':'searchHistory',
 'tray.themeId':'trayTheme','desktopLyric.isAlwaysOnTopLoop':'desktopLyricTopLoop','desktopLyric.isLockScreen':'desktopLyricScreenLock','desktopLyric.audioVisualization':'desktopLyricVisualization','desktopLyric.isDelayScroll':'desktopLyricDelayScroll','tray.enable':'tray','sync.mode':'syncMode','sync.enable':'syncEnabled','sync.server.port':'syncPort','sync.client.host':'syncHost',
 'openAPI.enable':'openAPI','openAPI.port':'openAPIPort','openAPI.bindLan':'openAPILan',
 'list.isClickPlayList':'clickPlayList','list.isShowSource':'showSource','list.addMusicLocationType':'addMusicLocation',
 'odc.isAutoClearSearchInput':'clearSearchInput','odc.isAutoClearSearchList':'clearSearchResults',
 'player.soundEffect.panner.enable':'panner','player.soundEffect.panner.speed':'pannerSpeed',
 'player.soundEffect.convolution.sendGain':'reverb','player.soundEffect.pitchShifter.playbackRate':'pitchRate'
}
export function migrateLegacySettings(raw:Record<string,unknown>):Partial<Settings> {
 const result:Record<string,unknown>={...raw}
 for(const [oldKey,newKey] of Object.entries(keys))if(raw[oldKey]!=null&&raw[newKey]==null)result[newKey]=raw[oldKey]
 if(result.playMode==='list')result.playMode='order'
 for(const key of ['syncPort','openAPIPort'])if(result[key]!=null)result[key]=Number(result[key])
 if(raw.proxy==null&&raw['network.proxy.enable']&&raw['network.proxy.host'])result.proxy=`http://${raw['network.proxy.host']}:${raw['network.proxy.port'] || 8080}`
 const eq=[31,62,125,250,500,1000,2000,4000,8000,16000].map(hz=>raw[`player.soundEffect.biquadFilter.hz${hz}`])
 if(raw.eq==null&&eq.some(n=>n!=null))result.eq=eq.map(n=>Number(n)||0)
 if(typeof result.downloadFileName==='string')result.downloadFileName=result.downloadFileName.replace('歌名','{name}').replace('歌手','{singer}')
 if(raw.desktopLyricOpacity==null&&raw['desktopLyric.style.opacity']!=null)result.desktopLyricOpacity=Number(raw['desktopLyric.style.opacity'])/100
 if(raw.pannerSpeed==null&&raw['player.soundEffect.panner.speed']!=null)result.pannerSpeed=Number(raw['player.soundEffect.panner.speed'])/100
 if(raw.reverb==null&&raw['player.soundEffect.convolution.sendGain']!=null)result.reverb=Math.max(0,Math.min(1,Number(raw['player.soundEffect.convolution.sendGain'])/10))
 if(raw.pitch==null&&raw['player.soundEffect.pitchShifter.playbackRate']!=null)result.pitch=12*Math.log2(Number(raw['player.soundEffect.pitchShifter.playbackRate'])||1)
 if(raw.lyricScript==null&&raw['player.isS2t'])result.lyricScript='traditional'
 if(raw.theme==null&&raw['theme.id'])result.theme=String(raw['theme.id']).match(/black|dark/)?'dark':'light'
 return result as Partial<Settings>
}
