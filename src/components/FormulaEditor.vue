<template>
  <div class="formula-editor">
    <div class="formula-editor__body">
      <!-- 左栏：textarea + @ 补全下拉（保留 position: relative 锚点） -->
      <div class="formula-editor__input-col">
        <textarea
          ref="inputRef"
          class="formula-editor__textarea"
          :value="text"
          :placeholder="placeholder"
          rows="5"
          @input="onInput"
          @keydown="onKeyDown"
          @blur="onBlur"
        />
        <ul
          v-if="showSuggest && filteredSuggest.length"
          class="formula-editor__suggest"
        >
          <li
            v-for="s in filteredSuggest"
            :key="s.group + '::' + s.code"
            class="formula-editor__suggest-item"
            @mousedown.prevent="pickSuggest(s)"
          >
            <span class="formula-editor__code">[{{ s.code }}]</span>
            <span class="formula-editor__name">{{ s.name }}</span>
            <span class="formula-editor__group">{{ s.groupLabel }}</span>
          </li>
        </ul>
        <div
          v-else-if="showSuggest"
          class="formula-editor__suggest formula-editor__suggest--empty"
        >
          无匹配变量
        </div>
      </div>

      <!-- 右栏：预览面板（4 块）—— 失败降级为红条，不影响编辑 -->
      <div class="formula-editor__preview">
        <el-alert
          v-if="previewError"
          class="formula-editor__preview-alert"
          type="error"
          :title="previewError"
          show-icon
          :closable="false"
        />

        <!-- 1/4 规范化表达式 -->
        <section class="formula-editor__preview-block">
          <div class="formula-editor__preview-title">
            规范化表达式
            <span v-if="previewLoading" class="formula-editor__preview-loading">预览中…</span>
          </div>
          <pre class="formula-editor__preview-expr">{{
            previewData?.normalizedExpr || '—'
          }}</pre>
        </section>

        <!-- 2/4 变量赋值表 -->
        <section class="formula-editor__preview-block">
          <div class="formula-editor__preview-title">变量赋值</div>
          <el-table
            v-if="previewData?.variables?.length"
            :data="previewData.variables"
            size="small"
            border
            class="formula-editor__preview-table"
          >
            <el-table-column prop="code" label="变量" width="140" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="value" label="取值" width="120" align="right" />
            <el-table-column label="来源" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="sourceTagType(row.source)">
                  {{ row.source }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="formula-editor__preview-empty">暂无变量</div>
        </section>

        <!-- 3/4 计算结果 -->
        <section class="formula-editor__preview-block">
          <div class="formula-editor__preview-title">计算结果</div>
          <div class="formula-editor__preview-result">
            <span v-if="previewData && previewData.result != null">{{
              previewData.result
            }}</span>
            <span v-else class="formula-editor__preview-empty">—</span>
          </div>
        </section>

        <!-- 4/4 警告列表 -->
        <section
          v-if="previewData?.warnings?.length"
          class="formula-editor__preview-block"
        >
          <div class="formula-editor__preview-title">警告</div>
          <el-alert
            v-for="(w, i) in previewData.warnings"
            :key="i"
            class="formula-editor__warning"
            type="warning"
            :title="w"
            show-icon
            :closable="false"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * T20：公式编辑器组件
 *
 * 设计要点：
 * - Props {@code modelValue} 双向绑定公式文本；保留原样（含中文别名），不做自动替换。
 * - 挂载时拉 `/variables/catalog` 缓存 三组变量（FinanceFactor / PartContext / FormulaRef）。
 * - 键入 `@` 开始"补全态"：取 `@` 到光标之间的文本作为 query，在 catalog 中按
 *   name 前缀 / code 子串模糊匹配。
 * - 选中项把 `@query` 替换为 `[code]`（规范化表达式用的 token），便于后端 evaluator 直接消费。
 * - 不连接 Element Plus 的 el-autocomplete —— 这里用原生 textarea + 自绘下拉，避免
 *   在复合输入法（中文拼音）下被 el-input 吞掉 selectionStart 信息。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchCatalog } from '../api/priceVariables'
import { previewFormula } from '../api/priceLinkedItems'
import { debouncedCall, filterCatalog, sourceTagType } from './formulaEditorUtils'

/** T21：预览防抖延迟（ms）—— 任务约定 500ms */
const PREVIEW_DEBOUNCE_MS = 500

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  materialCode: {
    type: String,
    default: '',
  },
  pricingMonth: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '输入公式，@ 可唤起变量补全',
  },
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
const catalog = ref({ financeFactors: [], partContexts: [], formulaRefs: [] })
const showSuggest = ref(false)
const suggestQuery = ref('')
// `@` 在文本中的位置（绝对索引）。replace 时需要这个锚点。
const atAnchor = ref(-1)

const text = computed(() => props.modelValue ?? '')

const filteredSuggest = computed(() =>
  filterCatalog(catalog.value, suggestQuery.value)
)

onMounted(async () => {
  try {
    catalog.value = await fetchCatalog()
  } catch (_) {
    // 失败时保持空 catalog；业务 toast 已由 http.js 统一弹。
  }
  // 首次进入若已有初始公式，立刻跑一次预览（不等防抖）
  if (text.value && text.value.trim()) {
    runPreview()
  }
})

// ============================ T21：实时预览面板 ============================
/** 最近一次预览响应（结构见后端 PriceLinkedFormulaPreviewResponse） */
const previewData = ref(null)
/** 预览红条文案 —— 网络/后端错误；有值则展示红条但不阻塞编辑 */
const previewError = ref('')
/** 预览 loading 文案（标题旁小字） */
const previewLoading = ref(false)
/**
 * 单调递增的请求 id —— 处理并发：后发但先返回的响应不能覆盖最新一次。
 * 每次发请求前 ++，回调里对比 id 不等于当前值就丢弃结果。
 */
let previewReqId = 0

/** 真正的预览请求逻辑；空公式直接清空状态避免打到后端。 */
const runPreview = async () => {
  const expr = text.value
  if (!expr || !expr.trim()) {
    previewData.value = null
    previewError.value = ''
    previewLoading.value = false
    return
  }
  const myId = ++previewReqId
  previewLoading.value = true
  try {
    const resp = await previewFormula({
      formulaExpr: expr,
      materialCode: props.materialCode || '',
      pricingMonth: props.pricingMonth || '',
    })
    // 老请求的响应被新请求盖过 —— 直接丢弃
    if (myId !== previewReqId) return
    previewData.value = resp || null
    // 后端解析致命错误（error 字段）走红条
    previewError.value = resp?.error || ''
  } catch (err) {
    if (myId !== previewReqId) return
    previewError.value = err?.message || '预览失败'
    previewData.value = null
  } finally {
    if (myId === previewReqId) previewLoading.value = false
  }
}

/** 500ms 防抖的预览调度器；取消逻辑在组件卸载时调用。 */
const schedulePreview = debouncedCall(runPreview, PREVIEW_DEBOUNCE_MS)

// 任一输入变化都重排防抖计时器
watch(
  () => [text.value, props.materialCode, props.pricingMonth],
  () => schedulePreview()
)

onBeforeUnmount(() => {
  schedulePreview.cancel()
})

/** textarea 输入事件 —— 更新文本 + 维护 `@补全` 状态 */
const onInput = (event) => {
  const value = event.target.value
  emit('update:modelValue', value)

  const caret = event.target.selectionStart ?? value.length
  const before = value.slice(0, caret)
  const lastAt = before.lastIndexOf('@')
  // `@` 之后若遇到空白/括号/运算符则退出补全
  if (lastAt >= 0 && !/[\s()+\-*/,]/.test(before.slice(lastAt + 1))) {
    atAnchor.value = lastAt
    suggestQuery.value = before.slice(lastAt + 1)
    showSuggest.value = true
  } else {
    showSuggest.value = false
    atAnchor.value = -1
    suggestQuery.value = ''
  }
}

/** Esc 关闭下拉；Enter 默认让 textarea 换行（不拦截） */
const onKeyDown = (event) => {
  if (event.key === 'Escape' && showSuggest.value) {
    showSuggest.value = false
    event.preventDefault()
  }
}

/** 失焦时延迟关闭，让 click 事件先触发 pickSuggest */
const onBlur = () => {
  setTimeout(() => {
    showSuggest.value = false
  }, 120)
}

/** 选中补全项：把 `@<query>` 替换为 `[code]` */
const pickSuggest = (item) => {
  const src = text.value
  if (atAnchor.value < 0) {
    showSuggest.value = false
    return
  }
  const endOfQuery = atAnchor.value + 1 + suggestQuery.value.length
  const next = src.slice(0, atAnchor.value) + `[${item.code}]` + src.slice(endOfQuery)
  emit('update:modelValue', next)
  showSuggest.value = false
  atAnchor.value = -1
  suggestQuery.value = ''
}
</script>

<style scoped>
.formula-editor {
  width: 100%;
}

/* T21：两栏布局 —— 左 textarea，右预览面板 */
.formula-editor__body {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.formula-editor__input-col {
  position: relative;
  flex: 1 1 50%;
  min-width: 0;
}

.formula-editor__preview {
  flex: 1 1 50%;
  min-width: 0;
  padding: 12px 14px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 360px;
  overflow-y: auto;
}

.formula-editor__preview-alert {
  margin-bottom: 4px;
}

.formula-editor__preview-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formula-editor__preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 8px;
}

.formula-editor__preview-loading {
  font-size: 11px;
  font-weight: normal;
  color: #909399;
}

.formula-editor__preview-expr {
  margin: 0;
  padding: 8px 10px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #303133;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}

.formula-editor__preview-empty {
  color: #c0c4cc;
  font-size: 12px;
  padding: 4px 0;
}

.formula-editor__preview-result {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 20px;
  font-weight: 600;
  color: #409eff;
  padding: 4px 0;
}

.formula-editor__warning {
  margin-bottom: 6px;
}

.formula-editor__textarea {
  width: 100%;
  min-height: 72px;
  padding: 8px 10px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  resize: vertical;
  outline: none;
}

.formula-editor__textarea:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
}

.formula-editor__suggest {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  list-style: none;
}

.formula-editor__suggest-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}

.formula-editor__suggest-item:hover {
  background: #f5f7fa;
}

.formula-editor__code {
  color: #409eff;
  font-family: 'JetBrains Mono', Menlo, monospace;
  font-weight: 600;
  min-width: 64px;
}

.formula-editor__name {
  flex: 1;
  color: #303133;
}

.formula-editor__group {
  font-size: 11px;
  color: #909399;
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.formula-editor__suggest--empty {
  padding: 12px;
  color: #909399;
  font-size: 12px;
  text-align: center;
}
</style>
