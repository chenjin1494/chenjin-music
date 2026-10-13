import {describe,it,expect} from 'vitest'
import {defaultSettings} from '../src/shared/defaults'
import {normalizeSettings} from '../electron/main/services/library'

describe('main window close preferences',()=>{
 it('defaults to asking rather than silently quitting',()=>{expect(defaultSettings.closeBehavior).toBe('ask');expect(normalizeSettings({}).closeBehavior).toBe('ask')})
 it('persists each explicit behavior and keeps legacy flags consistent',()=>{for(const behavior of ['ask','tray','quit']as const){const result=normalizeSettings({closeBehavior:behavior});expect(result.closeBehavior).toBe(behavior);expect(result.closeToTray).toBe(behavior==='tray')}})
 it('preserves explicit legacy hide-to-tray preferences',()=>{const result=normalizeSettings({closeToTray:true});expect(result.closeBehavior).toBe('tray');expect(result.closeToTray).toBe(true)})
 it('legacy false returns to asking rather than implicitly selecting exit',()=>{expect(normalizeSettings({closeToTray:false}).closeBehavior).toBe('ask')})
 it('explicit restored ask overrides old remembered tray flag',()=>{const result=normalizeSettings({closeBehavior:'ask',closeToTray:true});expect(result.closeBehavior).toBe('ask');expect(result.closeToTray).toBe(false)})
 it('rejects unknown or malformed close behavior values',()=>{for(const value of ['none',null,{},false])expect(normalizeSettings({closeBehavior:value}as any).closeBehavior).toBe('ask')})
 it('partial unrelated updates retain the remembered behavior',()=>{const current=normalizeSettings({closeBehavior:'quit'});expect(normalizeSettings({volume:.25},current).closeBehavior).toBe('quit')})
})
