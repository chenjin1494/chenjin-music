export function shortcutFromEvent(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
  if (/^(Control|Alt|Shift|Meta)/.test(event.code) || event.code === 'Escape' || event.code === 'Tab') return ''
  return [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', event.metaKey ? 'Meta' : '', event.code].filter(Boolean).join('+')
}

export function shortcutMatches(event: KeyboardEvent, shortcut: string | undefined): boolean {
  return !!shortcut && shortcutFromEvent(event) === shortcut
}

export function shortcutLabel(shortcut: string): string {
  return shortcut.replace(/Key([A-Z])/g, '$1').replace(/Digit(\d)/g, '$1').replace('Space', '空格').replace('ArrowRight', '→').replace('ArrowLeft', '←').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('Meta', '⌘')
}
