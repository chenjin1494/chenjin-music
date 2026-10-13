<script setup lang="ts">
import { ref } from 'vue'
import { useMusic } from '../store'
import Icon from './Icon.vue'

const music = useMusic()
const kind = ref('song')
const name = ref('')
const singer = ref('')
const confirmClear = ref(false)
function add(): void {
  const song = name.value.trim(), artist = singer.value.trim()
  const rule = kind.value === 'artist' ? `@${artist}` : artist ? `${song}@${artist}` : song
  if (kind.value === 'artist' ? !artist : !song) return
  music.library.dislikes = [...new Set([...music.library.dislikes, rule])]
  name.value = ''; singer.value = ''
  music.notify('不喜欢规则已保存')
}
function label(rule: string): string {
  if (rule.startsWith('@')) return `歌手 · ${rule.slice(1)}`
  const split = rule.lastIndexOf('@')
  return split >= 0 ? `${rule.slice(0, split)} · ${rule.slice(split + 1) || '全部艺人'}` : rule
}
</script>

<template>
  <p class="dislike-help">播放时会跳过这些规则匹配的歌曲。歌曲名称与艺人规则适用于不同音源，也兼容旧资料库中的歌曲 ID。</p>
  <form class="dislike-form" @submit.prevent="add"><label class="setting-row"><span>规则类型</span><select v-model="kind"><option value="song">歌曲</option><option value="artist">歌手</option></select></label><label v-if="kind === 'song'" class="setting-row"><span>歌曲名称</span><input v-model="name" placeholder="要跳过的歌曲" required /></label><label class="setting-row"><span>{{ kind === 'artist' ? '歌手名称' : '艺人（可选）' }}</span><input v-model="singer" :required="kind === 'artist'" placeholder="艺人名称" /></label><button class="primary-button" type="submit"><Icon name="Plus" :size="14" />添加规则</button></form>
  <div class="section-title dislike-heading"><h3>已保存规则 <span class="count-pill">{{ music.library.dislikes.length }}</span></h3><button v-if="music.library.dislikes.length" @click="confirmClear = !confirmClear">清空全部</button></div>
  <div v-if="confirmClear" class="clear-confirm"><span>确认移除全部不喜欢规则？</span><button class="danger-button" @click="music.library.dislikes = []; confirmClear = false">确认清空</button><button @click="confirmClear = false">取消</button></div>
  <p v-if="!music.library.dislikes.length" class="dislike-help">没有不喜欢的规则。歌曲菜单也可以直接添加。</p>
  <div v-for="(rule, index) in music.library.dislikes" :key="rule" class="dislike-rule"><Icon name="ListFilter" :size="16" /><span>{{ label(rule) }}</span><button class="icon-button" :aria-label="`移除 ${label(rule)}`" @click="music.library.dislikes.splice(index, 1)"><Icon name="X" :size="16" /></button></div>
</template>

<style scoped>.dislike-help{font-size:11px;color:var(--muted);line-height:1.9;margin:20px 0}.dislike-form>.primary-button{margin-top:18px}.dislike-heading{margin-top:32px}.dislike-heading h3{font-size:14px}.dislike-heading button{font-size:10px;padding:5px 8px}.dislike-rule{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--border);font-size:12px}.dislike-rule>span{flex:1;overflow-wrap:anywhere}.dislike-rule>svg{color:var(--muted)}.clear-confirm{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:15px 0;padding:12px;border:1px solid var(--border);border-radius:8px;font-size:11px}</style>
