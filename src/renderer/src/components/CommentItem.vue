<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Comment, Track } from '../../../shared/types'
import { invoke, useMusic } from '../store'
import { t as translate } from '../i18n'
import '../domain/comment-translations'
import { canFetchCommentReplies, commentImageURL, commentRootId, CommentLoadEpoch } from '../domain/comments'
import Icon from './Icon.vue'

const props=withDefaults(defineProps<{comment:Comment;track:Track;depth?:number}>(),{depth:0})
const music=useMusic(),t=(phrase:string)=>translate(phrase,music.settings.language)
const avatarFailed=ref(false),failedImages=ref(new Set<string>()),opened=ref(false),loading=ref(false),error=ref(''),page=ref(1),replies=ref<Comment[]>([]),loaded=ref(false)
const epoch=new CommentLoadEpoch()
const avatar=computed(()=>avatarFailed.value?null:commentImageURL(props.comment.avatar))
const images=computed(()=>(props.comment.images||[]).map(commentImageURL).filter((url):url is string=>!!url&&!failedImages.value.has(url)).slice(0,12))
const embedded=computed(()=>Array.isArray(props.comment.reply)?props.comment.reply:[])
const canReply=computed(()=>canFetchCommentReplies(props.track.source,props.comment,props.depth))
const nextPage=computed(()=>loaded.value&&replies.value.length>=20&&!loading.value)
async function load(target=page.value):Promise<void> {
 if(!canReply.value)return
 const ticket=epoch.next(),track=JSON.parse(JSON.stringify(props.track)) as Track,rootId=commentRootId(props.comment)
 page.value=target;loading.value=true;error.value='';replies.value=[];loaded.value=false
 try{const result=await invoke<Comment[]>('comments',{track,page:target,kind:'reply',rootId});if(epoch.isCurrent(ticket)){if(!Array.isArray(result))throw new Error('评论接口没有返回数组');replies.value=result;loaded.value=true}}catch(failure){if(epoch.isCurrent(ticket))error.value=failure instanceof Error?failure.message:String(failure)}finally{if(epoch.isCurrent(ticket))loading.value=false}
}
function toggle():void {opened.value=!opened.value;if(opened.value&&!loaded.value&&!loading.value)void load(1)}
watch(()=>[props.track.id,props.track.source,props.comment.id,props.comment.rootId,props.comment.avatar],()=>{epoch.invalidate();avatarFailed.value=false;failedImages.value=new Set();opened.value=false;loading.value=false;error.value='';page.value=1;replies.value=[];loaded.value=false})
onUnmounted(()=>epoch.invalidate())
</script>

<template>
 <article class="comment-item" :class="{nested:depth>0}">
  <img v-if="avatar" class="comment-avatar" :src="avatar" :alt="t('评论头像')" loading="lazy" referrerpolicy="no-referrer" @error="avatarFailed=true" />
  <div class="comment-content">
   <div class="comment-meta" data-i18n-ignore><strong>{{ comment.author }}</strong><time>{{ comment.time }}</time><small v-if="comment.location">{{ comment.location }}</small></div>
   <p class="comment-body" data-i18n-ignore>{{ comment.text }}</p>
   <div v-if="images.length" class="comment-images"><img v-for="url in images" :key="url" :src="url" :alt="t('评论图片')" loading="lazy" referrerpolicy="no-referrer" @error="failedImages.add(url)" /></div>
   <div class="comment-actions"><span class="comment-likes" :aria-label="t('点赞数')"><Icon name="ThumbsUp" :size="13" /><span data-i18n-ignore>{{ comment.likes }}</span></span><button v-if="canReply" :aria-expanded="opened" @click="toggle">{{ t(opened?'收起回复':'查看回复') }}<span v-if="comment.replyCount" data-i18n-ignore> {{ comment.replyCount }}</span></button></div>
   <div v-if="embedded.length&&depth<4" class="comment-embedded" :aria-label="t('附带回复')"><CommentItem v-for="(reply,index) in embedded" :key="`${reply.id}-${index}`" :comment="reply" :track="track" :depth="depth+1" /></div>
   <small v-else-if="embedded.length" class="comment-depth-note">{{ t('回复嵌套已达到显示上限') }}</small>
   <section v-if="opened" class="comment-thread" :aria-label="t('回复内容')" :aria-busy="loading">
    <p v-if="loading" role="status">{{ t('正在读取回复…') }}</p>
    <div v-else-if="error" class="comment-error" role="alert"><strong>{{ t('回复加载失败') }}</strong><p data-i18n-ignore>{{ error }}</p><button @click="load()">{{ t('重试回复') }}</button></div>
    <template v-else><p v-if="loaded&&!replies.length">{{ t('暂无回复') }}</p><CommentItem v-for="(reply,index) in replies" :key="`${reply.id}-${index}`" :comment="reply" :track="track" :depth="depth+1" /></template>
    <div class="reply-pagination"><button :disabled="loading||page<=1" @click="load(page-1)">{{ t('上一页') }}</button><span :aria-label="t('回复页码')" data-i18n-ignore>{{ page }}</span><button :disabled="!nextPage" @click="load(page+1)">{{ t('下一页') }}</button></div>
   </section>
  </div>
 </article>
</template>

<style scoped>
.comment-item{display:flex;gap:12px;padding:18px 0;border-bottom:1px solid var(--border)}.comment-item.nested{padding:12px 0;font-size:11px}.comment-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0}.nested .comment-avatar{width:25px;height:25px}.comment-content{min-width:0;flex:1}.comment-meta{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:12px}.comment-meta time,.comment-meta small{font-size:10px;color:var(--muted)}.comment-body{font-size:12px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}.comment-images{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.comment-images img{max-width:150px;max-height:150px;object-fit:contain;border-radius:7px}.comment-actions{display:flex;align-items:center;gap:14px;color:var(--muted);font-size:10px}.comment-actions button{padding:3px 7px;font-size:10px}.comment-likes{display:inline-flex;align-items:center;gap:5px}.comment-embedded,.comment-thread{border-left:2px solid var(--border);padding-left:12px;margin-top:12px}.comment-thread>p,.comment-error p,.comment-depth-note{font-size:11px;color:var(--muted);line-height:1.7;overflow-wrap:anywhere}.comment-error strong{font-size:11px;color:var(--danger,#ef606c)}.reply-pagination{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:10px}.reply-pagination button{font-size:10px;padding:4px 8px}@media(max-width:600px){.comment-images img{max-width:100px;max-height:120px}.comment-embedded,.comment-thread{padding-left:8px}}
</style>
