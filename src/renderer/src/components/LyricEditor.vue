<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Lyrics, Track } from '../../../shared/types'
import { invoke, useMusic } from '../store'
import { t as translate } from '../i18n'
import '../domain/lyric-editor-translations'
import { changeLyricRow, documentBytes, formatLyricTimestamp, lyricDocument, LyricEditorHistory, previewLyricText, shiftAllLyrics, validateLyricDocument, type LyricDocument, type LyricField } from '../domain/lyric-editor'
import Icon from './Icon.vue'

const props=defineProps<{track:Track;lyrics:Lyrics}>()
const emit=defineEmits<{close:[];saved:[lyrics:Lyrics]}>()
const music=useMusic(),field=ref<LyricField>('lyric'),revision=ref(0),selectedRow=ref(0),delta=ref(0),busy=ref(false),error=ref(''),confirmReset=ref(false)
const t=(phrase:string)=>translate(phrase,music.settings.language)
const dialog=ref<HTMLElement>(),resetRegion=ref<HTMLElement>(),textarea=ref<HTMLTextAreaElement>(),resetButton=ref<HTMLButtonElement>()
const identifier=`lyric-editor-${Math.random().toString(36).slice(2)}`
const labels:Record<LyricField,string>={lyric:'歌词正文',tlyric:'翻译歌词',rlyric:'罗马音歌词',lxlyric:'LX逐字歌词'}
let history=new LyricEditorHistory(lyricDocument(props.lyrics)),alive=true,session=0,previousFocus:HTMLElement|null=null
const document=computed(()=>{void revision.value;return history.current})
const canUndo=computed(()=>{void revision.value;return history.canUndo}),canRedo=computed(()=>{void revision.value;return history.canRedo})
const issues=computed(()=>validateLyricDocument(document.value)),hasErrors=computed(()=>issues.value.some(issue=>issue.level==='error'))
const preview=computed(()=>previewLyricText(document.value[field.value],field.value))
const size=computed(()=>Math.round(documentBytes(document.value)/1024))
const canCalibrate=computed(()=>music.current?.id===props.track.id&&Number.isFinite(music.progress))
function commit(next:LyricDocument):void {if(history.commit(next))revision.value++;error.value=''}
function locate():void {const node=textarea.value;if(node)selectedRow.value=node.value.slice(0,node.selectionStart).split('\n').length-1}
function input(event:Event):void {const node=event.target as HTMLTextAreaElement;try{commit({...document.value,[field.value]:node.value});locate()}catch(failure){node.value=document.value[field.value];error.value=failure instanceof Error?failure.message:String(failure)}}
async function selectField(next:LyricField):Promise<void> {field.value=next;selectedRow.value=0;await nextTick();textarea.value?.focus()}
function undo():void {history.undo();revision.value++;error.value=''}
function redo():void {history.redo();revision.value++;error.value=''}
async function rowChange(value:number,mode:'set'|'shift'):Promise<void> {
 try{commit({...document.value,[field.value]:changeLyricRow(document.value[field.value],selectedRow.value,value,mode,field.value)});await nextTick();const rows=document.value[field.value].split('\n'),start=rows.slice(0,selectedRow.value).reduce((sum,row)=>sum+row.length+1,0);textarea.value?.focus();textarea.value?.setSelectionRange(start,start+(rows[selectedRow.value]?.length||0))}catch(failure){error.value=failure instanceof Error?failure.message:String(failure)}
}
function calibrate():void {if(canCalibrate.value)void rowChange((music.progress+Number(music.settings.lyricOffset||0)/1000)*1000,'set')}
function shiftAll():void {try{commit(shiftAllLyrics(document.value,Number(delta.value)));delta.value=0}catch(failure){error.value=failure instanceof Error?failure.message:String(failure)}}
async function save():Promise<void> {
 if(busy.value)return;if(hasErrors.value){error.value='保存前请修复时间格式或大小错误';return}
 const snapshot={...document.value},track=JSON.parse(JSON.stringify(props.track)) as Track,ticket=session;busy.value=true;error.value=''
 try{const result=await invoke<Lyrics|undefined>('lyrics.save',{track,lyrics:snapshot});if(alive&&ticket===session)emit('saved',result&&typeof result.lyric==='string'?result:snapshot)}catch(failure){if(alive&&ticket===session)error.value=failure instanceof Error?failure.message:String(failure)}finally{if(alive&&ticket===session)busy.value=false}
}
async function requestReset():Promise<void> {confirmReset.value=true;await nextTick();resetButton.value?.focus()}
async function reset():Promise<void> {
 if(!confirmReset.value||busy.value)return;busy.value=true;error.value='';const ticket=session,track=JSON.parse(JSON.stringify(props.track)) as Track
 try{const lyrics=await invoke<Lyrics>('lyrics',{track,refresh:true,resetEdited:true});if(alive&&ticket===session){history=new LyricEditorHistory(lyricDocument(lyrics));revision.value++;selectedRow.value=0;confirmReset.value=false;emit('saved',lyrics)}}catch(failure){if(alive&&ticket===session)error.value=failure instanceof Error?failure.message:String(failure)}finally{if(alive&&ticket===session)busy.value=false}
}
async function cancelReset():Promise<void> {confirmReset.value=false;await nextTick();textarea.value?.focus()}
function close():void {if(!busy.value)emit('close')}
function exportText():void {const text=document.value[field.value],url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),anchor=globalThis.document.createElement('a');anchor.href=url;anchor.download=`${props.track.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')||'lyrics'}-${field.value}${field.value==='lxlyric'?'.lxlrc':'.lrc'}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function keyboard(event:KeyboardEvent):void {
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(confirmReset.value&&!busy.value)void cancelReset();else close();return}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void save();return}
 if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();if(!busy.value){if(event.shiftKey||event.key.toLowerCase()==='y')redo();else undo()}return}
 if(event.key==='Tab'){const nodes=Array.from((confirmReset.value?resetRegion.value:dialog.value)?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]).filter(node=>node.getClientRects().length>0),first=nodes[0],last=nodes.at(-1);if(!first){event.preventDefault();dialog.value?.focus();return}if(!nodes.includes(globalThis.document.activeElement as HTMLElement)){event.preventDefault();first.focus();return}if(event.shiftKey&&globalThis.document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&globalThis.document.activeElement===last){event.preventDefault();first.focus()}}
}
watch(()=>props.track.id,()=>{session++;history=new LyricEditorHistory(lyricDocument(props.lyrics));revision.value++;selectedRow.value=0;delta.value=0;confirmReset.value=false;busy.value=false;error.value=''})
onMounted(()=>{previousFocus=globalThis.document.activeElement as HTMLElement|null;void nextTick(()=>textarea.value?.focus())})
onUnmounted(()=>{alive=false;session++;if(previousFocus?.isConnected)previousFocus.focus()})
</script>

<template>
 <Teleport to="body">
  <div class="modal-backdrop lyric-editor-backdrop" @click.self="close">
   <section ref="dialog" class="modal lyric-editor" role="dialog" tabindex="-1" :aria-busy="busy" aria-modal="true" :aria-labelledby="identifier" @keydown="keyboard">
    <div class="section-title"><h2 :id="identifier">{{ t('编辑歌词') }}</h2><button class="icon-button" :aria-label="t('关闭歌词编辑')" :disabled="busy" @click="close"><Icon name="X" /></button></div>
    <p class="editor-track" data-i18n-ignore>{{ track.name }} · {{ track.singer }}</p>
    <div class="editor-tabs" role="tablist" :aria-label="t('编辑歌词')"><button v-for="(label,key) in labels" :id="`${identifier}-${key}`" :key="key" role="tab" :aria-selected="field===key" :class="{active:field===key}" :disabled="busy" @click="selectField(key)">{{ t(label) }}</button></div>
    <div class="editor-toolbar"><button :disabled="!canUndo||busy" @click="undo">{{ t('撤销') }}</button><button :disabled="!canRedo||busy" @click="redo">{{ t('重做') }}</button><label>{{ t('整体偏移') }} <input v-model.number="delta" type="number" step="100" min="-86400000" max="86400000" :disabled="busy" /> ms</label><button :disabled="busy||!delta" @click="shiftAll">{{ t('应用整体偏移') }}</button></div>
    <p class="editor-hint">{{ t('整体偏移应用到四种歌词；正值延后，负值提前。') }}</p>
    <div class="editor-columns"><div class="editor-text"><label :for="`${identifier}-text`">{{ t('歌词文本') }} · {{ t(labels[field]) }}</label><textarea :id="`${identifier}-text`" ref="textarea" :value="document[field]" :disabled="busy" spellcheck="false" :aria-labelledby="`${identifier}-${field}`" :aria-invalid="hasErrors" @input="input" @click="locate" @keyup="locate" @select="locate" data-i18n-ignore /><small>{{ t('选择文本中的歌词行，再使用时间校准。') }} · {{ size }} KiB</small></div><div class="editor-preview" :aria-label="t('实时预览')"><h3>{{ t('实时预览') }}</h3><ol v-if="preview.length"><li v-for="(line,index) in preview.slice(0,100)" :key="index" data-i18n-ignore><time>{{ formatLyricTimestamp(line.time*1000) }}</time><span>{{ line.text || '♪' }}</span><small v-if="line.words?.length">{{ line.words.length }} {{ t('字级片段') }}</small></li></ol><p v-else>{{ t('没有时间行可预览，纯文本和元信息仍会保留。') }}</p><small v-if="preview.length>100">{{ t('预览只显示前100行') }}</small></div></div>
    <div class="editor-calibration"><span>{{ t('当前行') }} {{ selectedRow+1 }}</span><button :disabled="busy" @click="rowChange(-100,'shift')">{{ t('当前行提前100ms') }}</button><button :disabled="busy" @click="rowChange(100,'shift')">{{ t('当前行延后100ms') }}</button><button :disabled="busy||!canCalibrate" :title="canCalibrate?'':t('仅能用正在播放的这首歌校准时间')" @click="calibrate">{{ t('校准到播放位置') }}</button><small>{{ t('播放位置') }} {{ formatLyricTimestamp(music.progress*1000) }}</small></div>
    <ul v-if="issues.length" class="editor-issues" aria-live="polite"><li v-for="(issue,index) in issues.slice(0,15)" :key="index" :class="issue.level">{{ t(labels[issue.field]) }}{{ issue.line ? ` · ${t('当前行')} ${issue.line}` : '' }}: {{ t(issue.message) }}</li></ul>
    <p v-if="error" class="editor-error" role="alert" data-i18n-ignore>{{ t(error) }}</p>
    <div v-if="confirmReset" ref="resetRegion" class="editor-reset" role="alertdialog" :aria-label="t('恢复原歌词')"><p>{{ t('恢复原歌词会删除这首歌的编辑版本。继续？') }}</p><button :disabled="busy" @click="cancelReset">{{ t('取消恢复') }}</button><button ref="resetButton" :disabled="busy" @click="reset">{{ t('确认恢复原歌词') }}</button></div>
    <p class="editor-hint">{{ t('歌词编辑只保存到用户缓存，不修改原音频或歌词文件。') }}</p>
    <div class="editor-actions"><button :disabled="busy" @click="requestReset">{{ t('恢复原歌词') }}</button><button :disabled="busy||hasErrors" @click="exportText">{{ t('导出当前歌词') }}</button><button class="primary-button" :disabled="busy||hasErrors" @click="save">{{ t(busy?'正在保存…':'保存编辑') }}</button></div>
   </section>
  </div>
 </Teleport>
</template>

<style scoped>
.lyric-editor-backdrop{z-index:120}.lyric-editor{width:min(1000px,94vw);max-height:92vh;overflow:auto}.editor-track{margin:14px 0;color:var(--muted);overflow-wrap:anywhere}.editor-tabs,.editor-toolbar,.editor-calibration,.editor-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.editor-tabs{margin-bottom:14px}.editor-tabs .active{color:var(--accent);border-color:var(--accent)}.editor-toolbar input{width:110px;margin:0 6px}.editor-toolbar label,.editor-calibration{font-size:12px}.editor-hint{font-size:11px;color:var(--muted);line-height:1.6;margin:12px 0}.editor-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.editor-text{display:flex;flex-direction:column;gap:8px}.editor-text label,.editor-preview h3{font-size:12px}.editor-text textarea{width:100%;height:300px;min-height:150px;resize:vertical;font-family:Consolas,monospace;font-size:12px;line-height:1.7;white-space:pre}.editor-text small,.editor-preview small,.editor-calibration small{font-size:10px;color:var(--muted)}.editor-preview{max-height:345px;overflow:auto;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)}.editor-preview ol{padding:0;list-style:none}.editor-preview li{display:flex;gap:10px;margin:12px 0;font-size:12px;overflow-wrap:anywhere}.editor-preview time{font-family:monospace;color:var(--muted);flex-shrink:0}.editor-preview p{font-size:12px;line-height:1.7;color:var(--muted)}.editor-calibration{margin:16px 0}.editor-issues{max-height:100px;overflow:auto;font-size:11px;padding-left:20px;line-height:1.8}.editor-issues .error,.editor-error{color:var(--danger,#ef606c)}.editor-issues .warning{color:var(--muted)}.editor-reset{padding:12px;border:1px solid var(--border);border-radius:8px}.editor-reset p{margin-bottom:10px;font-size:12px}.editor-reset button{margin-right:8px}.editor-actions{justify-content:flex-end}@media(max-width:700px){.editor-columns{grid-template-columns:1fr}.editor-preview{max-height:180px}.editor-text textarea{height:200px}.lyric-editor{max-height:94vh}}
</style>
