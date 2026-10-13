import { argbFromHex, Hct, hexFromArgb, SchemeTonalSpot } from '@material/material-color-utilities'

const roleNames = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'surface', 'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow',
  'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest', 'onSurface', 'onSurfaceVariant',
  'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'error', 'onError', 'errorContainer', 'onErrorContainer',
] as const
export type MaterialRole = typeof roleNames[number]
/** Official HCT Tonal Spot palettes at Material 3 standard contrast. */
export function materialRoles(seed: string, dark: boolean): Record<MaterialRole, string> {
  const source = /^#[0-9a-f]{6}$/i.test(seed) ? seed : '#a78bfa'
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(source)), dark, 0)
  return Object.fromEntries(roleNames.map(role => [role, hexFromArgb(scheme[role])])) as Record<MaterialRole, string>
}
const kebab = (name: string) => name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
export function applyMaterialRoles(seed: string, dark: boolean, customColors: Record<string,string> = {}, root: HTMLElement = document.documentElement): void {
  const roles = materialRoles(seed, dark)
  for (const [role, value] of Object.entries(roles)) root.style.setProperty(`--md-${kebab(role)}`, value)
  const aliases: Record<string,string> = {
    bg:roles.surface, sidebar:roles.surfaceContainerLow, surface:roles.surfaceContainer,
    'surface-hover':roles.surfaceContainerHigh, text:roles.onSurface, muted:roles.onSurfaceVariant,
    border:roles.outlineVariant, player:roles.surfaceContainerHigh, 'on-accent':roles.onPrimary,
  }
  for (const [name, value] of Object.entries(aliases)) root.style.setProperty(`--${name}`, /^#[0-9a-f]{6}$/i.test(customColors[name]??'') ? customColors[name] : value)
}
