<template>
  <Teleport to="body">
    <div v-show="visible" class="fixed-table-scroll" :style="position">
      <input class="fixed-table-scroll__track" type="range" min="0" :max="maximum" step="1"
        :value="left" :style="{ '--thumb-width': `${thumbWidth}px` }"
        :aria-label="`${label}横向滚动，可用左右方向键移动`" @input="scrollTable"
        @pointerdown="startDrag" @pointermove="drag" @pointerup="endDrag" @pointercancel="endDrag" />
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ viewport: Object, content: Object, label: { type: String, default: '见机表' } })
const visible = ref(false), position = ref({}), maximum = ref(0), left = ref(0), thumbWidth = ref(32)
let dragging = null
function scrollTable(event) {
  if (props.viewport) props.viewport.scrollLeft = Number(event.target.value)
}
function startDrag(event) {
  if (event.button !== 0 || !props.viewport) return
  event.preventDefault()
  const input = event.currentTarget, rect = input.getBoundingClientRect()
  const travel = Math.max(1, rect.width - thumbWidth.value)
  const thumbLeft = left.value / maximum.value * travel
  const x = event.clientX - rect.left
  if (x < thumbLeft || x > thumbLeft + thumbWidth.value) {
    props.viewport.scrollLeft = Math.max(0, Math.min(maximum.value, (x - thumbWidth.value / 2) / travel * maximum.value))
  }
  dragging = { pointerId: event.pointerId, x: event.clientX, left: props.viewport.scrollLeft, factor: maximum.value / travel }
  input.focus({ preventScroll: true })
  input.setPointerCapture(event.pointerId)
}
function drag(event) {
  if (dragging?.pointerId === event.pointerId && props.viewport) {
    props.viewport.scrollLeft = Math.max(0, Math.min(maximum.value, dragging.left + (event.clientX - dragging.x) * dragging.factor))
  }
}
function endDrag(event) {
  if (dragging?.pointerId !== event.pointerId) return
  dragging = null
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
const stop = watch([() => props.viewport, () => props.content], async ([viewport, content], _, onCleanup) => {
  let cancelled = false, frame = 0, observer = null
  function place() {
    frame = 0
    if (cancelled || !viewport) return
    const rect = viewport.getBoundingClientRect()
    // Once the original scrollbar is on screen, it takes over without a duplicate bar.
    maximum.value = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    visible.value = maximum.value > 1 && rect.width > 0 && rect.top < window.innerHeight - 32 && rect.bottom > window.innerHeight
    position.value = { left: `${rect.left}px`, width: `${viewport.clientWidth}px` }
    thumbWidth.value = Math.max(32, viewport.clientWidth * viewport.clientWidth / Math.max(1, viewport.scrollWidth))
    if (viewport.clientWidth > 0) left.value = viewport.scrollLeft
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(place) }
  onCleanup(() => {
    cancelled = true
    dragging = null
    cancelAnimationFrame(frame)
    document.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule)
    observer?.disconnect()
  })
  visible.value = false
  if (!viewport || !content) return
  await nextTick()
  if (cancelled) return
  observer = new ResizeObserver(schedule)
  observer.observe(viewport)
  observer.observe(content)
  document.addEventListener('scroll', schedule, { capture: true, passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  schedule()
}, { immediate: true, flush: 'post' })
onBeforeUnmount(stop)
</script>

<style scoped>
.fixed-table-scroll { position:fixed; bottom:0; z-index:100; padding:4px 0; background:#fff; box-shadow:0 -2px 8px #0002; }
.fixed-table-scroll__track { display:block; appearance:none; width:100%; height:16px; margin:0; padding:0; background:#edf0f4; border-radius:8px; cursor:ew-resize; }
.fixed-table-scroll__track::-webkit-slider-thumb { appearance:none; width:var(--thumb-width); height:14px; background:#98a2b3; border:2px solid #edf0f4; border-radius:7px; }
.fixed-table-scroll__track::-moz-range-thumb { box-sizing:border-box; width:var(--thumb-width); height:14px; background:#98a2b3; border:2px solid #edf0f4; border-radius:7px; }
.fixed-table-scroll__track:hover::-webkit-slider-thumb { background:#667085; }
.fixed-table-scroll__track:hover::-moz-range-thumb { background:#667085; }
.fixed-table-scroll__track:focus-visible { outline:2px solid #409eff; outline-offset:-2px; }
@media print { .fixed-table-scroll { display:none !important; } }
</style>
