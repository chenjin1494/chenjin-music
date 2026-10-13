<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type CSSProperties } from 'vue'
import { useMusic } from '../store'
import { t } from '../i18n'
import '../domain/appearance-translations'
import { APPEARANCE_COMPONENTS, APPEARANCE_PROPERTIES, GLOBAL_APPEARANCE_PROPERTIES, APPEARANCE_PRESETS, DEFAULT_APPEARANCE, appearancePropertyBounds, normalizeAppearance, parseAppearance, type AppearanceConfig, type AppearanceComponentId, type AppearanceStyle } from '../../../shared/appearance'

const music = useMusic()
const tr = (text: string): string => t(text, String(music.settings.language || 'zh-CN'))
type Key = keyof AppearanceStyle
type Scope = AppearanceComponentId | 'global'
const componentNames = Object.fromEntries(APPEARANCE_COMPONENTS.map(component => [component.id, component.label])) as Record<AppearanceComponentId, string>
const propertyNames = Object.fromEntries(Object.entries(APPEARANCE_PROPERTIES).map(([key, info]) => [key, info.label])) as Record<Key, string>
const bounds = (key: Key): { min?: number; max?: number } => appearancePropertyBounds(selected.value, key)
const categories = [
 { id:'layout', label:'布局与导航', description:'调整布局、尺寸与导航表面。', ids:['sidebar','navigation','topbar','search','content','hero'] },
 { id:'music', label:'音乐与播放', description:'调整音乐卡片、列表、播放与歌词。', ids:['playlistCard','trackList','player','queue','lyrics','desktopLyrics','cover','trackDetails','sourceAlternatives','lyricEditor'] },
 { id:'content', label:'内容与管理', description:'调整设置与内容管理区域。', ids:['settings','downloads','sources','comments','onlinePanel','downloadsPanel','sourceManager','commentsPanel'] },
 { id:'settings', label:'设置与工具', description:'调整设置与内容管理区域。', ids:['appearanceEditor','themeSettings','audioSettings','lyricSettings','shortcutSettings','syncPanel','backupPanel','dislikePanel','updatePanel'] },
 { id:'controls', label:'基础控件', description:'调整可复用控件与反馈表面。', ids:['dialog','contextMenu','button','input','toast','emptyState','icon'] },
]
const config = ref<AppearanceConfig>(normalizeAppearance(music.settings.appearance))
const selected = ref<Scope>('global'), query = ref(''), category = ref(''), preset = ref('')
const fileInput = ref<HTMLInputElement>(), resetConfirm = ref(false), saveError = ref(''), fileError = ref('')
const fieldDrafts = ref<Record<string, string>>({}), fieldErrors = ref<Record<string, string>>({})
const jsonDraft = ref(JSON.stringify(config.value, null, 2)), jsonDirty = ref(false), jsonError = ref('')
const saving = ref(false), pending = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let revision = 0
let savedRevision = 0
let mounted = true
let flushRequested = false
const title = computed(() => selected.value === 'global' ? tr('全局样式') : tr(componentNames[selected.value]))
const description = computed(() => selected.value === 'global' ? tr('作为所有组件的共同基础；组件自定义值优先。') : tr(APPEARANCE_COMPONENTS.find(c => c.id === selected.value)?.description || '调整可复用控件与反馈表面。'))
const currentStyle = computed(() => selected.value === 'global' ? config.value.global : config.value.components[selected.value] || {})
const keys = computed(() => selected.value === 'global' ? GLOBAL_APPEARANCE_PROPERTIES : APPEARANCE_COMPONENTS.find(c => c.id === selected.value)?.properties || [])
const groups = computed(() => [ { label:'颜色与表面', keys:keys.value.filter(k => APPEARANCE_PROPERTIES[k].type === 'color') }, { label:'尺寸与排版', keys:keys.value.filter(k => APPEARANCE_PROPERTIES[k].type !== 'color') } ])
const visibleComponents = computed(() => APPEARANCE_COMPONENTS.filter(c => (!category.value || categories.find(g => g.id === category.value)?.ids.includes(c.id)) && (!query.value.trim() || [c.id,c.label,tr(componentNames[c.id]),c.description].join(' ').toLowerCase().includes(query.value.trim().toLowerCase()))))
const overrideCount = computed(() => Object.values(config.value.components).reduce((n, style) => n + Object.keys(style || {}).length, 0))
const scopeKey = (key: Key): string => `${selected.value}.${key}`
const own = (key: Key): boolean => Object.prototype.hasOwnProperty.call(currentStyle.value, key)
function effective(key: Key): string | number | undefined { return currentStyle.value[key] ?? config.value.global[key] ?? APPEARANCE_PROPERTIES[key].default }
function value(key: Key): string { return fieldDrafts.value[scopeKey(key)] ?? String(effective(key) ?? '') }
function fieldLabel(key: Key, suffix = ''): string { return `${title.value} ${tr(propertyNames[key])}${suffix ? ` ${tr(suffix)}` : ''}` }
function feedback(error: unknown): string { return error instanceof SyntaxError ? tr('JSON 格式错误，请检查引号、逗号和括号。') : `${tr('配置无效，请检查格式、字段名和字段值。')}${error instanceof Error && error.message ? ` ${error.message}` : ''}` }
function syncJson(): void { if (!jsonDirty.value) jsonDraft.value = JSON.stringify(config.value, null, 2) }
function schedule(): void { pending.value = true; revision++; saveError.value = ''; syncJson(); if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = undefined; void flush() }, 120) }
async function flush(): Promise<void> {
 if (timer) { clearTimeout(timer); timer = undefined }
 flushRequested = true
 if (saving.value || !pending.value) return
 saving.value = true
 try {
  while (flushRequested && pending.value) {
   flushRequested = false
   const targetRevision = revision
   const snapshot = parseAppearance(config.value)
   const saved=await music.updateSettings({ appearance: snapshot })
   if (!saved) throw new Error(String(music.error||tr('保存失败，请重试。')))
   savedRevision = targetRevision
   pending.value = savedRevision !== revision
  }
 } catch (error) { saveError.value = `${tr('保存失败，请重试。')} ${error instanceof Error ? error.message : ''}` }
 finally { saving.value = false; if ((!mounted || flushRequested) && pending.value && !saveError.value) void flush() }
}
watch(() => music.settings.appearance, incoming => {
 if (saving.value || pending.value) return
 config.value = normalizeAppearance(incoming)
 // Invalid text is intentionally retained across incoming settings snapshots.
 for (const key of Object.keys(fieldDrafts.value)) if (!fieldErrors.value[key]) delete fieldDrafts.value[key]
 syncJson()
}, { deep:true })
onBeforeUnmount(() => { mounted = false; if (timer) clearTimeout(timer); void flush() })
function setField(key: Key, raw: string, persist = true): void {
 const draftKey = scopeKey(key)
 fieldDrafts.value[draftKey] = raw
 const meta = APPEARANCE_PROPERTIES[key]
 try {
  if (meta.type === 'number' && (!raw.trim() || !Number.isFinite(Number(raw)))) throw new Error(tr('请输入有效的有限数字。'))
  const candidate = JSON.parse(JSON.stringify(config.value)) as AppearanceConfig
  const style = selected.value === 'global' ? candidate.global : (candidate.components[selected.value] ||= {})
  Object.assign(style, { [key]: meta.type === 'number' ? Number(raw) : raw })
  const parsed = parseAppearance(candidate)
  config.value = parsed
  delete fieldErrors.value[draftKey]
  if (meta.type === 'number') fieldDrafts.value[draftKey] = String((selected.value === 'global' ? parsed.global : parsed.components[selected.value])?.[key] ?? raw)
  if (persist) schedule(); else { if (timer) { clearTimeout(timer); timer = undefined }; pending.value = true; revision++; syncJson() }
 } catch (error) { fieldErrors.value[draftKey] = meta.type === 'color' ? `${tr('请输入有效的 CSS 颜色，例如 #8b5cf6、transparent 或 var(--accent)。')} ${error instanceof Error ? error.message : ''}` : feedback(error) }
}
function toggle(key: Key, enabled: boolean): void {
 const candidate = JSON.parse(JSON.stringify(config.value)) as AppearanceConfig
 const style = selected.value === 'global' ? candidate.global : (candidate.components[selected.value] ||= {})
 if (enabled) {
  const fallback = effective(key) ?? (APPEARANCE_PROPERTIES[key].type === 'color' ? 'transparent' : key === 'fontFamily' ? 'system-ui, sans-serif' : key === 'shadow' ? 'none' : bounds(key).min ?? 0)
  Object.assign(style, { [key]: fallback })
 } else { delete style[key]; if (selected.value !== 'global' && !Object.keys(style).length) delete candidate.components[selected.value] }
 try { config.value = parseAppearance(candidate); delete fieldDrafts.value[scopeKey(key)]; delete fieldErrors.value[scopeKey(key)]; schedule() } catch (error) { fieldErrors.value[scopeKey(key)] = feedback(error) }
}
function replace(input: unknown): void { config.value = parseAppearance(input); fieldDrafts.value = {}; fieldErrors.value = {}; jsonDirty.value = false; jsonError.value = ''; resetConfirm.value = false; schedule(); void flush() }
function resetCurrent(): void { const next = JSON.parse(JSON.stringify(config.value)) as AppearanceConfig; if (selected.value === 'global') next.global = {}; else delete next.components[selected.value]; replace(next) }
function resetAll(): void { replace(DEFAULT_APPEARANCE) }
function applyPreset(): void { const choice = APPEARANCE_PRESETS.find(p => p.id === preset.value); if (choice) replace(choice.config) }
function rename(raw: string): void { try { config.value = parseAppearance({ ...config.value, name:raw }); fileError.value = ''; schedule() } catch (error) { fileError.value = feedback(error) } }
function applyJson(): void { try { if (new Blob([jsonDraft.value]).size > 512 * 1024) throw new Error(tr('外观文件不能超过 512 KiB。')); replace(JSON.parse(jsonDraft.value)); fileError.value = '' } catch (error) { jsonError.value = feedback(error) } }
function reloadJson(): void { jsonDraft.value = JSON.stringify(config.value, null, 2); jsonDirty.value = false; jsonError.value = '' }
async function importFile(event: Event): Promise<void> {
 const input = event.target as HTMLInputElement, file = input.files?.[0]
 if (!file) return
 fileError.value = ''
 try { if (file.size > 512 * 1024) throw new Error(tr('外观文件不能超过 512 KiB。')); replace(JSON.parse(await file.text())) }
 catch (error) { fileError.value = feedback(error) }
 finally { input.value = '' }
}
function download(): void {
 try {
  const validated = parseAppearance(config.value)
  const url = URL.createObjectURL(new Blob([JSON.stringify(validated, null, 2)], { type:'application/json' }))
  const link = document.createElement('a'); link.href = url
  link.download = `${validated.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'chenjin'}.appearance.json`
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
 } catch (error) { fileError.value = feedback(error) }
}
function pickerValue(key: Key): string { const raw = value(key); if (/^#[0-9a-f]{6}$/i.test(raw)) return raw; if (/^#[0-9a-f]{8}$/i.test(raw)) return raw.slice(0, 7); if (/^#[0-9a-f]{3,4}$/i.test(raw)) return '#' + raw.slice(1, 4).split('').map(c => c + c).join(''); return '#8b5cf6' }
function optionLabel(option: string): string { return tr(({ none:'无阴影',soft:'柔和阴影',elevated:'浮起阴影' } as Record<string,string>)[option] || option) }
function previewStyle(scope: Scope): CSSProperties {
 const style: AppearanceStyle = { ...config.value.global, ...(scope === 'global' ? {} : config.value.components[scope]) }
 const result: CSSProperties = {}
 const direct: Array<keyof AppearanceStyle> = ['background','color','fontFamily','fontWeight','lineHeight','opacity']
 for (const key of direct) if (style[key] !== undefined) Object.assign(result, { [key]:style[key] })
 const pixels: Partial<Record<Key,string>> = { radius:'borderRadius',padding:'padding',gap:'gap',fontSize:'fontSize',borderWidth:'borderWidth',letterSpacing:'letterSpacing' }
 for (const [key, css] of Object.entries(pixels)) if (style[key as Key] !== undefined) Object.assign(result, { [css]:`${style[key as Key]}px` })
 if (style.borderColor) result.borderColor = style.borderColor
 if (style.blur !== undefined) result.backdropFilter = `blur(${style.blur}px)`
 if (style.shadow) result.boxShadow = { none:'none',soft:'0 5px 18px #00000018',elevated:'0 12px 32px #00000030' }[style.shadow]
 return result
}
const previewAccent = computed(() => String(currentStyle.value.accentColor ?? config.value.global.accentColor ?? 'var(--accent)'))
const previewMuted = computed(() => String(currentStyle.value.mutedColor ?? config.value.global.mutedColor ?? 'var(--muted)'))
</script>

<template>
 <section class="appearance-studio" :aria-label="tr('组件外观工作室')">
  <header class="studio-heading"><div><span class="studio-kicker">{{ tr('外观与体验') }}</span><h3>{{ tr('组件外观工作室') }}</h3><p>{{ tr('从整体气质到每个细节，让音乐界面成为你的风格。') }}</p></div><span class="save-status" role="status">{{ saving ? tr('正在应用…') : pending ? tr('更改待应用') : tr('更改已应用') }}</span></header>
  <div class="studio-tools">
   <label class="name-field"><span>{{ tr('外观方案名称') }}</span><input :value="config.name" maxlength="80" data-i18n-ignore :aria-label="tr('外观方案名称')" @change="rename(($event.target as HTMLInputElement).value)" /></label>
   <label class="preset-field"><span>{{ tr('外观预设') }}</span><select v-model="preset" :aria-label="tr('外观预设')"><option value="">{{ tr('选择预设') }}</option><option v-for="choice in APPEARANCE_PRESETS" :key="choice.id" :value="choice.id" data-i18n-ignore>{{ choice.label }}</option></select></label>
   <button type="button" :disabled="!preset" @click="applyPreset">{{ tr('应用预设') }}</button>
  </div>
  <div class="studio-layout">
   <nav class="component-picker" :aria-label="tr('选择编辑区域')">
    <input v-model="query" type="search" :placeholder="tr('搜索组件')" :aria-label="tr('搜索组件')" />
    <select v-model="category" :aria-label="tr('设置分类')"><option value="">{{ tr('全部区域') }}</option><option v-for="group in categories" :key="group.id" :value="group.id">{{ tr(group.label) }}</option></select>
    <div class="component-options"><button type="button" :class="{ selected:selected === 'global' }" :aria-pressed="selected === 'global'" @click="selected = 'global'"><span>{{ tr('全局样式') }}</span><span class="count" data-i18n-ignore>{{ Object.keys(config.global).length }}</span></button><button v-for="component in visibleComponents" :key="component.id" type="button" :class="{ selected:selected === component.id }" :aria-pressed="selected === component.id" @click="selected = component.id"><span>{{ tr(componentNames[component.id]) }}</span><span class="count" data-i18n-ignore>{{ Object.keys(config.components[component.id] || {}).length }}</span></button><p v-if="!visibleComponents.length" class="empty-filter">{{ tr('未找到匹配组件') }}</p></div>
   </nav>
   <div class="component-editor">
    <div class="editor-heading"><div><h4>{{ title }}</h4><p>{{ description }}</p><span class="override-summary"><b data-i18n-ignore>{{ Object.keys(currentStyle).length }}</b> {{ tr('已自定义字段') }}</span></div><button type="button" :disabled="!Object.keys(currentStyle).length" @click="resetCurrent">{{ tr('恢复当前区域') }}</button></div>
    <div class="preview-panel"><div class="preview-caption"><strong>{{ tr('实时预览') }}</strong><small>{{ tr('预览跟随当前有效输入；应用会更新实际界面。') }}</small></div><div class="preview-swatches" aria-hidden="true"><span v-for="key in (['background','color','mutedColor','accentColor','borderColor'] as const)" :key="key" :style="{ background:String(effective(key) || (key === 'background' ? 'var(--surface)' : key === 'accentColor' ? 'var(--accent)' : 'var(--muted)')) }"></span></div><div class="preview-card" :style="previewStyle(selected)"><span class="preview-art" :style="{ background:previewAccent }" aria-hidden="true"><svg v-if="selected === 'icon'" :width="currentStyle.iconSize ?? 24" :height="currentStyle.iconSize ?? 24" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="currentStyle.strokeWidth ?? 1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13M9 8l12-2" /><ellipse cx="6" cy="18" rx="3" ry="3" /><ellipse cx="18" cy="16" rx="3" ry="3" /></svg><template v-else>♫</template></span><div class="preview-copy"><strong>{{ tr('预览卡片') }}</strong><small :style="{ color:previewMuted }">{{ tr('让每一次聆听更合心意') }}</small></div><button type="button" class="preview-button" :style="{ ...previewStyle('button'), background:config.components.button?.background || previewAccent }">{{ tr('播放示例') }}</button><div class="preview-player" :style="previewStyle('player')"><span aria-hidden="true">▶</span><small>{{ tr('正在播放示例') }}</small><div class="preview-progress"><span :style="{ background:previewAccent }"></span></div><small data-i18n-ignore>01:24 / 03:36</small></div></div></div>
    <section v-for="group in groups" v-show="group.keys.length" :key="group.label" class="property-group"><h5>{{ tr(group.label) }}</h5><div v-for="key in group.keys" :key="`${selected}.${key}`" class="property-field" :class="{ inherited:!own(key), invalid:fieldErrors[scopeKey(key)] }">
     <div class="property-title"><label :for="`appearance-${selected}-${key}`">{{ tr(propertyNames[key]) }}</label><label class="override-toggle"><input type="checkbox" :checked="own(key)" :aria-label="`${title} ${tr('自定义')} ${tr(propertyNames[key])}`" @change="toggle(key, ($event.target as HTMLInputElement).checked)" />{{ own(key) ? tr('自定义') : selected === 'global' ? tr('跟随主题') : tr('继承全局') }}</label></div>
     <div v-if="APPEARANCE_PROPERTIES[key].type === 'color'" class="color-controls"><input type="color" :value="pickerValue(key)" :disabled="!own(key)" :aria-label="fieldLabel(key, '颜色选择器')" @input="setField(key, ($event.target as HTMLInputElement).value)" @change="flush" @blur="flush" /><input :id="`appearance-${selected}-${key}`" :value="value(key)" :disabled="!own(key)" data-i18n-ignore spellcheck="false" :aria-label="fieldLabel(key, '颜色值')" :aria-invalid="!!fieldErrors[scopeKey(key)]" :aria-describedby="fieldErrors[scopeKey(key)] ? `appearance-error-${selected}-${key}` : undefined" placeholder="#8b5cf6 / transparent / var(--accent)" @input="setField(key, ($event.target as HTMLInputElement).value)" @blur="flush" /></div>
     <div v-else-if="APPEARANCE_PROPERTIES[key].type === 'number'" class="number-controls"><input type="range" :min="bounds(key).min" :max="bounds(key).max" :step="APPEARANCE_PROPERTIES[key].step || 1" :value="effective(key) ?? APPEARANCE_PROPERTIES[key].min ?? 0" :disabled="!own(key)" :aria-label="fieldLabel(key, '滑块')" @input="setField(key, ($event.target as HTMLInputElement).value, false)" @change="flush" @blur="flush" /><input :id="`appearance-${selected}-${key}`" type="number" :min="bounds(key).min" :max="bounds(key).max" :step="APPEARANCE_PROPERTIES[key].step || 1" :value="value(key)" :disabled="!own(key)" :aria-label="fieldLabel(key, '数值')" :aria-invalid="!!fieldErrors[scopeKey(key)]" @input="setField(key, ($event.target as HTMLInputElement).value, false)" @change="flush" @blur="flush" /><span class="unit" data-i18n-ignore>{{ APPEARANCE_PROPERTIES[key].unit }}</span></div>
     <select v-else-if="APPEARANCE_PROPERTIES[key].type === 'select'" :id="`appearance-${selected}-${key}`" :value="value(key)" :disabled="!own(key)" :aria-label="fieldLabel(key)" @change="setField(key, ($event.target as HTMLSelectElement).value); flush()"><option v-for="option in APPEARANCE_PROPERTIES[key].options" :key="option" :value="option">{{ optionLabel(option) }}</option></select>
     <div v-else class="text-controls"><select v-if="key === 'fontFamily'" :value="['system-ui, sans-serif','sans-serif','serif','monospace'].includes(value(key)) ? value(key) : ''" :disabled="!own(key)" :aria-label="fieldLabel(key)" @change="setField(key, ($event.target as HTMLSelectElement).value); flush()"><option value="" disabled>{{ tr('自定义') }}</option><option value="system-ui, sans-serif">{{ tr('系统字体') }}</option><option v-for="font in ['sans-serif','serif','monospace']" :key="font" :value="font" data-i18n-ignore>{{ font }}</option></select><input :id="`appearance-${selected}-${key}`" :value="value(key)" :disabled="!own(key)" :aria-label="fieldLabel(key)" data-i18n-ignore @input="setField(key, ($event.target as HTMLInputElement).value)" @blur="flush" /></div>
     <p v-if="fieldErrors[scopeKey(key)]" :id="`appearance-error-${selected}-${key}`" class="validation-error" role="alert" data-i18n-ignore>{{ fieldErrors[scopeKey(key)] }}</p>
    </div></section>
   </div>
  </div>
  <footer class="studio-footer"><p><b data-i18n-ignore>{{ overrideCount }}</b> {{ tr('已自定义字段') }} · <b data-i18n-ignore>{{ Object.keys(config.global).length }}</b> {{ tr('全局自定义字段') }}</p><div class="action-row"><button type="button" @click="fileInput?.click()">{{ tr('导入外观') }}</button><button type="button" @click="download">{{ tr('导出外观') }}</button><button type="button" @click="resetConfirm = !resetConfirm">{{ tr('恢复所有外观') }}</button></div><small>{{ tr('仅包含外观配置，不包含歌曲、资料库或脚本。') }}</small></footer>
  <div v-if="resetConfirm" class="reset-confirm" role="group" :aria-label="tr('恢复所有外观')"><p>{{ tr('将恢复全局默认外观，并清除所有组件的自定义设置。') }}</p><button type="button" class="danger-button" @click="resetAll">{{ tr('确认恢复所有外观') }}</button><button type="button" @click="resetConfirm = false">{{ tr('取消恢复') }}</button></div>
  <p v-if="fileError" class="validation-error" role="alert" data-i18n-ignore>{{ fileError }}</p><div v-if="saveError" class="validation-error" role="alert"><span data-i18n-ignore>{{ saveError }}</span><button type="button" @click="flush">{{ tr('重试应用') }}</button></div>
  <details class="advanced-json"><summary>{{ tr('高级 JSON 编辑') }}<small v-if="jsonDirty"> · {{ tr('JSON 尚未应用') }}</small></summary><textarea v-model="jsonDraft" :aria-label="tr('编辑完整外观配置')" data-i18n-ignore spellcheck="false" @input="jsonDirty = true" /><div class="action-row"><button type="button" @click="applyJson">{{ tr('应用 JSON') }}</button><button type="button" @click="reloadJson">{{ tr('重新载入当前配置') }}</button></div><p v-if="jsonError" class="validation-error" role="alert" data-i18n-ignore>{{ jsonError }}</p></details>
  <input ref="fileInput" type="file" accept=".json,.appearance.json,application/json" class="file-input" :aria-label="tr('导入外观')" @change="importFile" />
 </section>
</template>

<style scoped>
.appearance-studio{margin-top:28px;border:1px solid var(--border);border-radius:18px;background:var(--surface);overflow:hidden;font-size:12px;color:var(--text)}.studio-heading{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;padding:24px 24px 18px;background:linear-gradient(125deg,color-mix(in srgb,var(--accent) 10%,transparent),transparent 70%)}.studio-kicker{color:var(--accent);font-size:10px;letter-spacing:.12em}.studio-heading h3{margin:7px 0;font-size:20px;font-weight:650;line-height:1.35}.studio-heading p,.editor-heading p{color:var(--muted);line-height:1.65;margin:6px 0}.save-status{color:var(--muted);font-size:10px;white-space:nowrap;padding:6px 9px;border:1px solid var(--border);border-radius:20px}.studio-tools{display:flex;align-items:flex-end;gap:10px;padding:0 24px 22px}.studio-tools label{display:grid;gap:7px;min-width:0}.name-field{flex:1}.preset-field{flex:1}.appearance-studio input:not([type=checkbox]):not([type=range]):not([type=color]),.appearance-studio select,.appearance-studio textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--border);background:var(--bg);border-radius:8px;color:var(--text);padding:8px 10px;font:inherit}.appearance-studio button{font:inherit;border:1px solid var(--border);border-radius:8px;padding:8px 11px;background:var(--bg);color:var(--text);cursor:pointer}.appearance-studio button:hover:not(:disabled){border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--bg))}.appearance-studio :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--accent);outline-offset:3px}.appearance-studio button:disabled{opacity:.45;cursor:default}.studio-layout{display:grid;grid-template-columns:166px minmax(0,1fr);border-top:1px solid var(--border)}.component-picker{padding:15px 12px;background:color-mix(in srgb,var(--bg) 50%,transparent);border-right:1px solid var(--border);min-width:0}.component-picker>select{margin:8px 0 12px}.component-options{display:flex;flex-direction:column;gap:3px;max-height:680px;overflow:auto;scrollbar-width:thin;padding:3px}.component-options button{display:flex;align-items:center;justify-content:space-between;text-align:left;border-color:transparent;background:transparent;gap:5px;padding:9px 8px}.component-options button.selected{background:color-mix(in srgb,var(--accent) 14%,transparent);border-color:color-mix(in srgb,var(--accent) 32%,transparent);color:var(--accent)}.count{font-size:10px;font-variant-numeric:tabular-nums;opacity:.7}.empty-filter{color:var(--muted);line-height:1.6;padding:8px}.component-editor{padding:20px;min-width:0}.editor-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}.editor-heading h4{font-size:16px;margin:0}.editor-heading p{font-size:11px;max-width:360px}.editor-heading>button{font-size:10px;white-space:nowrap}.override-summary{display:inline-block;margin-top:5px;font-size:10px;color:var(--muted)}.override-summary b{color:var(--accent);font-variant-numeric:tabular-nums}.preview-panel{padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--bg);margin-bottom:20px;overflow:hidden}.preview-caption{display:grid;gap:4px}.preview-caption strong{font-size:11px}.preview-caption small{color:var(--muted);font-size:10px;line-height:1.5}.preview-swatches{display:flex;gap:6px;margin:12px 0}.preview-swatches span{width:23px;height:23px;border-radius:50%;border:1px solid var(--border)}.preview-card{display:flex;flex-wrap:wrap;gap:12px;align-items:center;border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface);overflow:hidden;max-height:340px}.preview-art{display:grid;place-items:center;width:42px;height:42px;flex-shrink:0;border-radius:10px;font-size:24px;color:white}.preview-copy{display:grid;gap:4px;flex:1;min-width:80px}.preview-copy strong{font-size:inherit}.preview-copy small{font-size:10px;line-height:1.5}.preview-button{font-size:10px!important;color:white!important}.preview-player{width:100%;display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--border);font-size:10px;flex-wrap:wrap}.preview-player small{font-size:10px}.preview-progress{flex:1;min-width:30px;height:3px;background:var(--border);border-radius:10px;overflow:hidden}.preview-progress span{display:block;width:42%;height:100%}.property-group h5{font-size:11px;font-weight:600;color:var(--muted);margin:22px 0 10px;padding-bottom:9px;border-bottom:1px solid var(--border)}.property-field{padding:10px 0}.property-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.property-title>label:first-child{font-weight:500}.override-toggle{display:flex;align-items:center;gap:5px;cursor:pointer;font-size:10px;color:var(--muted)}.override-toggle input{accent-color:var(--accent);width:13px;height:13px;margin:0}.color-controls,.number-controls,.text-controls{display:flex;gap:8px;align-items:center}.color-controls input[type=color]{width:34px;height:33px;flex-shrink:0;padding:2px;border:1px solid var(--border);border-radius:7px;background:var(--bg);cursor:pointer}.color-controls input:not([type=color]){font-family:ui-monospace,monospace!important;font-size:11px!important}.number-controls input[type=range]{flex:1;min-width:40px;accent-color:var(--accent)}.number-controls input[type=number]{width:76px!important;font-variant-numeric:tabular-nums}.unit{color:var(--muted);width:20px;font-size:10px}.text-controls select{max-width:130px}.inherited .color-controls,.inherited .number-controls,.inherited .text-controls,.inherited>select{opacity:.5}.validation-error{font-size:11px;color:#ed7777;line-height:1.6;margin:8px 0;overflow-wrap:anywhere}.property-field.invalid input{border-color:#ed7777!important}.studio-footer{padding:16px 24px;border-top:1px solid var(--border)}.studio-footer p{color:var(--muted);font-size:11px;margin:0 0 10px}.studio-footer b{color:var(--text);font-variant-numeric:tabular-nums}.studio-footer>small{display:block;color:var(--muted);font-size:10px;margin-top:10px;line-height:1.6}.action-row{display:flex;flex-wrap:wrap;gap:8px}.reset-confirm{margin:0 24px 16px;padding:14px;border:1px solid #ed777744;border-radius:10px;background:#ed777709}.reset-confirm p{margin:0 0 12px;line-height:1.5}.reset-confirm button+button{margin-left:8px}.danger-button{color:#ed7777!important}.appearance-studio>.validation-error{margin:12px 24px}.advanced-json{border-top:1px solid var(--border);padding:16px 24px}.advanced-json summary{cursor:pointer;color:var(--muted)}.advanced-json textarea{height:260px;resize:vertical;margin:14px 0 10px;font-family:ui-monospace,monospace;font-size:11px;line-height:1.6;tab-size:2}.advanced-json summary small{font-size:10px;color:var(--accent)}.file-input{display:none}@media(max-width:760px){.studio-heading{padding:18px;flex-wrap:wrap}.studio-tools{padding:0 18px 18px;flex-wrap:wrap}.studio-tools label{flex-basis:40%}.studio-layout{grid-template-columns:135px minmax(0,1fr)}.component-picker{padding:12px 8px}.component-editor{padding:15px}.editor-heading{flex-wrap:wrap}.studio-footer,.advanced-json{padding:16px 18px}.preview-player>small:last-child{display:none}}@media(max-width:520px){.studio-layout{display:block}.component-picker{border-right:0;border-bottom:1px solid var(--border)}.component-options{max-height:170px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.studio-heading h3{font-size:18px}.property-title{gap:6px}.preview-card{padding:10px}}
</style>
