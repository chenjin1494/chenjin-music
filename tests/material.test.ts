import { describe, it, expect } from 'vitest'
import { argbFromHex, lstarFromArgb, Contrast } from '@material/material-color-utilities'
import { materialRoles } from '../src/renderer/src/domain/material'
const contrast=(a:string,b:string)=>Contrast.ratioOfTones(lstarFromArgb(argbFromHex(a)),lstarFromArgb(argbFromHex(b)))
describe('Material 3 dynamic color',()=>{
 for(const dark of [false,true])for(const seed of ['#a78bfa','#006874','#b3261e','#00ff00','#ff0000','#000000','#ffffff']){
  it(`keeps readable foreground roles for ${seed}/${dark?'dark':'light'}`,()=>{
   const colors=materialRoles(seed,dark)
   for(const [foreground,background]of [['onPrimary','primary'],['onPrimaryContainer','primaryContainer'],['onSecondaryContainer','secondaryContainer'],['onSurface','surface'],['onSurfaceVariant','surfaceContainer']]as const)expect(contrast(colors[foreground],colors[background])).toBeGreaterThanOrEqual(4.5)
   for(const value of Object.values(colors))expect(value).toMatch(/^#[a-f0-9]{6}$/)
  })
 }
 it('accent changes regenerate surfaces and tonal containers together',()=>{const purple=materialRoles('#a78bfa',false),teal=materialRoles('#006874',false);expect(teal.primary).not.toBe(purple.primary);expect(teal.secondaryContainer).not.toBe(purple.secondaryContainer);expect(teal.surface).not.toBe(purple.surface)})
 it('light/dark palettes reverse surface luminance while retaining source hue',()=>{const light=materialRoles('#a78bfa',false),dark=materialRoles('#a78bfa',true);expect(lstarFromArgb(argbFromHex(light.surface))).toBeGreaterThan(95);expect(lstarFromArgb(argbFromHex(dark.surface))).toBeLessThan(10)})
 it('invalid dynamic color input falls back to the default seed',()=>{expect(materialRoles('url(attack)',true)).toEqual(materialRoles('#a78bfa',true))})
})
