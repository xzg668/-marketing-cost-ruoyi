<template>
  <div v-show="overflow" class="table-top-scroll">
    <div ref="bar" class="table-top-scroll__track" tabindex="0" :aria-label="`${label}横向滚动，可用左右方向键移动`">
      <div ref="spacer" class="table-top-scroll__spacer" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { connectTableHorizontalScroll } from '../utils/tableHorizontalScroll'

const props = defineProps({
  table: Object, active: Boolean, label: { type: String, default: '表格' },
  viewportSelector: { type: String, default: '.el-scrollbar__wrap' },
  contentSelector: { type: String, default: '.el-table__body' },
})
const bar = ref(null), spacer = ref(null), overflow = ref(false)
let binding = null
const stop = watch([() => props.table, () => props.active], async ([table, active], _, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true; binding?.destroy(); binding = null })
  overflow.value = false
  if (!active || !table) return
  await nextTick()
  if (cancelled) return
  const viewport = table.$el?.querySelector(props.viewportSelector)
  if (!viewport || !bar.value || !spacer.value) return
  binding = connectTableHorizontalScroll({
    viewport, bar: bar.value, spacer: spacer.value,
    content: table.$el.querySelector(props.contentSelector),
    onOverflow: value => { overflow.value = value },
  })
}, { immediate: true, flush: 'post' })
watch(overflow, async visible => {
  if (visible) { await nextTick(); binding?.refresh() }
})
onBeforeUnmount(stop)
</script>

<style scoped>
.table-top-scroll {
  padding: 8px 0;
  min-width: 0;
  background: #fff;
}
.table-top-scroll__track {
  max-width: 100%;
  height: 14px;
  overflow-x: scroll;
  overflow-y: hidden;
  border-radius: 4px;
}
.table-top-scroll__spacer { height: 1px; }
.table-top-scroll__track::-webkit-scrollbar { height: 12px; }
.table-top-scroll__track::-webkit-scrollbar-track { background: #edf0f4; border-radius: 4px; }
.table-top-scroll__track::-webkit-scrollbar-thumb { background: #98a2b3; border: 2px solid #edf0f4; border-radius: 6px; }
.table-top-scroll__track::-webkit-scrollbar-thumb:hover { background: #667085; }
.table-top-scroll__track:focus-visible { outline: 2px solid #409eff; outline-offset: 2px; }
@supports not selector(::-webkit-scrollbar) {
  .table-top-scroll__track { scrollbar-color: #98a2b3 #edf0f4; scrollbar-width: thin; }
}
</style>
