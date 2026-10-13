<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, Blocks, Captions,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert,
  Compass, Disc3, Download, FolderOpen, FolderPlus, Headphones, Heart, House,
  Info, Keyboard, Library, ListFilter, ListMusic, Lock, Maximize, MessageCircle,
  Minus, Monitor, Moon, MoreHorizontal, Music2, Mic2, Palette, PanelTop, Pause,
  Pencil, Pin, Play, Plus, Radio, RefreshCw, Repeat, Repeat1, Search,
  Settings2, ShieldCheck, Shuffle, SkipBack, SkipForward, Sparkles, Square,
  Sun, Trash2, Unlock, Upload, Volume2, VolumeX, X, GripVertical, GripHorizontal,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const icons: Record<string, Component> = {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, Blocks, Captions,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert,
  Compass, Disc3, Download, FolderOpen, FolderPlus, Headphones, Heart, House,
  Info, Keyboard, Library, ListFilter, ListMusic, Lock, Maximize, MessageCircle,
  Minus, Monitor, Moon, MoreHorizontal, Music2, Mic2, Palette, PanelTop, Pause,
  Pencil, Pin, Play, Plus, Radio, RefreshCw, Repeat, Repeat1, Search,
  Settings2, ShieldCheck, Shuffle, SkipBack, SkipForward, Sparkles, Square,
  Sun, Trash2, Unlock, Upload, Volume2, VolumeX, X, GripVertical, GripHorizontal,
}
const icon = computed(() => icons[props.name] || Music2)
</script>

<template><component :is="icon" :size="size" :stroke-width="1.7" aria-hidden="true" /></template>
