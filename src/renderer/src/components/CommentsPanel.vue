<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Comment, Track } from '../../../shared/types'
import { invoke, useMusic } from '../store'
import { t as translate } from '../i18n'
import '../domain/comment-translations'
import { CommentLoadEpoch } from '../domain/comments'
import CommentItem from './CommentItem.vue'
import Icon from './Icon.vue'

const props=defineProps<{track:Track}>()
const emit=defineEmits<{close:[]}>()
const music=useMusic(),t=(phrase:string)=>translate(phrase,music.settings.language)
const kind=ref<'normal'|'hot'>('normal'),page=ref(1),comments=ref<Comment[]>([]),loading=ref(false),error=ref(''),loaded=ref(false)
const dialog=ref<HTMLElement>(),closeButton=ref<HTMLButtonElement>(),epoch=new CommentLoadEpoch(),identifier=`comments-${Math.random().toString(36).slice(2)}`
let previousFocus:HTMLElement|null=null
const local=computed(()=>props.track.source==='local'),nextPage=computed(()=>loaded.value&&comments.value.length>=20&&!loading.value)
async function load(target=page.value):Promise<void> {
 const ticket=epoch.next();page.value=target;loading.value=false;error.value='';comments.value=[];loaded.value=false
 if(local.value){loaded.value=true;return}
 const track=JSON.parse(JSON.stringify(props.track)) as Track,requestKind=kind.value;loading.value=true
 try{const result=await invoke<Comment[]>('comments',{track,page:target,kind:requestKind});if(epoch.isCurrent(ticket)){if(!Array.isArray(result))throw new Error('评论接口没有返回数组');comments.value=result;loaded.value=true}}catch(failure){if(epoch.isCurrent(ticket))error.value=failure instanceof Error?failure.message:String(failure)}finally{if(epoch.isCurrent(ticket))loading.value=false}
}
function switchKind(next:'normal'|'hot'):void {if(next===kind.value)return;kind.value=next;void load(1)}
function keyboard(event:KeyboardEvent):void {
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();emit('close');return}
 if(event.key!=='Tab')return
 const nodes=Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')||[]).filter(node=>node.getClientRects().length>0),first=nodes[0],last=nodes.at(-1)
 if(!first){event.preventDefault();dialog.value?.focus();return}
 if(!nodes.includes(globalThis.document.activeElement as HTMLElement)){event.preventDefault();first.focus();return}
 if(event.shiftKey&&globalThis.document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&globalThis.document.activeElement===last){event.preventDefault();first.focus()}
}
watch(()=>[props.track.id,props.track.source,props.track.meta.songId],()=>{kind.value='normal';void load(1)},{immediate:true})
onMounted(()=>{previousFocus=globalThis.document.activeElement as HTMLElement|null;void nextTick(()=>closeButton.value?.focus())})
onUnmounted(()=>{epoch.invalidate();if(previousFocus?.isConnected)previousFocus.focus()})
</script>

<template>
 <Teleport to="body"><div class="modal-backdrop comments-backdrop" @click.self="emit('close')"><section ref="dialog" class="modal comments-panel" role="dialog" aria-modal="true" tabindex="-1" :aria-labelledby="identifier" :aria-busy="loading" @keydown="keyboard">
  <div class="section-title"><h2 :id="identifier">{{ t('歌曲评论') }}</h2><button ref="closeButton" class="icon-button" :aria-label="t('关闭评论')" @click="emit('close')"><Icon name="X" /></button></div>
  <p class="comments-track" data-i18n-ignore>{{ track.name }} · {{ track.singer }}</p>
  <div class="comments-tabs" role="tablist" :aria-label="t('歌曲评论')"><button role="tab" :aria-selected="kind==='normal'" :class="{active:kind==='normal'}" :disabled="local" @click="switchKind('normal')">{{ t('普通评论') }}</button><button role="tab" :aria-selected="kind==='hot'" :class="{active:kind==='hot'}" :disabled="local" @click="switchKind('hot')">{{ t('热门评论') }}</button></div>
  <div class="comments-list">
   <p v-if="local" class="comments-empty">{{ t('本地歌曲没有平台评论。') }}</p>
   <p v-else-if="loading" class="comments-loading" role="status"><span class="spinner" />{{ t('正在读取评论…') }}</p>
   <div v-else-if="error" class="comments-error" role="alert"><strong>{{ t('评论加载失败') }}</strong><p data-i18n-ignore>{{ error }}</p><button @click="load()">{{ t('重试评论') }}</button></div>
   <template v-else><p v-if="loaded&&!comments.length" class="comments-empty">{{ t(page>1?'这一页没有评论，请返回上一页。':kind==='hot'?'暂无热门评论':'暂无评论') }}</p><CommentItem v-for="(comment,index) in comments" :key="`${comment.id}-${index}`" :comment="comment" :track="track" /></template>
  </div>
  <div v-if="!local" class="comments-pagination"><button :disabled="loading||page<=1" @click="load(page-1)">{{ t('上一页') }}</button><span :aria-label="t('评论页码')" data-i18n-ignore>{{ page }}</span><button :disabled="!nextPage" @click="load(page+1)">{{ t('下一页') }}</button></div>
  <p v-if="!local" class="comments-note">{{ t('平台返回不足20条时停止翻页；没有提供总数。') }}</p>
 </section></div></Teleport>
</template>

<style scoped>
.comments-backdrop{z-index:125}.comments-panel{width:min(720px,94vw);max-height:88vh;display:flex;flex-direction:column}.comments-track{font-size:12px;color:var(--muted);margin:15px 0;overflow-wrap:anywhere}.comments-tabs{display:flex;gap:8px;margin-bottom:12px}.comments-tabs .active{color:var(--accent);border-color:var(--accent)}.comments-list{overflow:auto;min-height:150px;max-height:58vh;padding-right:8px}.comments-empty,.comments-loading{font-size:12px;color:var(--muted);line-height:1.8;padding:35px 0;text-align:center}.comments-loading{display:flex;justify-content:center;align-items:center;gap:9px}.comments-error{padding:20px 0;font-size:12px;line-height:1.8}.comments-error strong{color:var(--danger,#ef606c)}.comments-error p{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}.comments-pagination{display:flex;justify-content:center;gap:16px;align-items:center;margin-top:18px;font-size:11px}.comments-note{color:var(--muted);font-size:10px;text-align:center;margin-top:12px;line-height:1.6}@media(max-width:600px){.comments-panel{max-height:94vh}.comments-list{max-height:64vh}}
</style>
