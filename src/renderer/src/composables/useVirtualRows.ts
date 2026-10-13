import { computed, nextTick, onUnmounted, ref, watch, type Ref } from 'vue'

/** Fixed-height list window; indexes always refer to the complete source array. */
export function useVirtualRows<T>(items: Ref<T[]> | (() => T[]), rowHeight: number | (()=>number), threshold = 80) {
  const height = computed(()=>Math.max(1,typeof rowHeight==='function'?rowHeight():rowHeight))
  const viewport = ref<HTMLElement>()
  const scrollTop = ref(0)
  const viewportHeight = ref(500)
  const source = computed(() => typeof items === 'function' ? items() : items.value)
  const enabled = computed(() => source.value.length > threshold)
  const start = computed(() => enabled.value ? Math.max(0, Math.floor(scrollTop.value / height.value) - 6) : 0)
  const end = computed(() => enabled.value ? Math.min(source.value.length, Math.ceil((scrollTop.value + viewportHeight.value) / height.value) + 6) : source.value.length)
  const rows = computed(() => source.value.slice(start.value, end.value).map((item, offset) => ({ item, index: start.value + offset })))
  const topPadding = computed(() => start.value * height.value)
  const bottomPadding = computed(() => Math.max(0, (source.value.length - end.value) * height.value))
  let observer: ResizeObserver | undefined

  function onScroll(): void { scrollTop.value = viewport.value?.scrollTop || 0 }
  function scrollToIndex(index: number): void {
    if (!viewport.value || !enabled.value) return
    const top = index * height.value, bottom = top + height.value
    if (top < viewport.value.scrollTop) viewport.value.scrollTop = top
    else if (bottom > viewport.value.scrollTop + viewport.value.clientHeight) viewport.value.scrollTop = bottom - viewport.value.clientHeight
    onScroll()
  }
  watch(viewport, element => {
    observer?.disconnect()
    if (!element) return
    viewportHeight.value = element.clientHeight || 500
    observer = new ResizeObserver(() => viewportHeight.value = element.clientHeight || 500)
    observer.observe(element)
  }, { flush: 'post' })
  watch([() => source.value.length,height], async ([,nextHeight],[,previousHeight]) => {
    const position=viewport.value?.scrollTop??0
    const target=nextHeight!==previousHeight?position*nextHeight/previousHeight:position
    await nextTick()
    if (viewport.value) {
      viewport.value.scrollTop = Math.min(target, Math.max(0, source.value.length * height.value - viewport.value.clientHeight))
      onScroll()
    }
  })
  onUnmounted(() => observer?.disconnect())
  return { viewport, enabled, rows, topPadding, bottomPadding, onScroll, scrollToIndex }
}
