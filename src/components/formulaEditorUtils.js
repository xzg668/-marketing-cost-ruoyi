/**
 * T20：FormulaEditor 的纯函数辅助层 —— 和 Vue 组件解耦，便于 node:test 直接单测。
 *
 * 仅两个职责：
 *   1) 把三组变量展平成统一的 suggest item（带 group 标签）
 *   2) 按 query 做不区分大小写的前缀/子串模糊匹配
 */

/** 分组中文标签，渲染时显示在每个条目尾部。 */
const GROUP_LABELS = {
  finance: '财务因素',
  part: '部品上下文',
  formula: '公式引用',
}

/**
 * 把 catalog 三组合一 —— 每项结构 `{ group, groupLabel, code, name, extra }`。
 * extra 携带 group 特有字段：finance 的 unit/currentPrice、part 的 binding、formula 的 formulaExpr。
 */
export const flattenCatalog = (catalog) => {
  if (!catalog || typeof catalog !== 'object') return []
  const out = []
  for (const f of catalog.financeFactors || []) {
    out.push({
      group: 'finance',
      groupLabel: GROUP_LABELS.finance,
      code: f.code,
      name: f.name,
      extra: { unit: f.unit, currentPrice: f.currentPrice, source: f.source },
    })
  }
  for (const p of catalog.partContexts || []) {
    out.push({
      group: 'part',
      groupLabel: GROUP_LABELS.part,
      code: p.code,
      name: p.name,
      extra: { binding: p.binding },
    })
  }
  for (const r of catalog.formulaRefs || []) {
    out.push({
      group: 'formula',
      groupLabel: GROUP_LABELS.formula,
      code: r.code,
      name: r.name,
      extra: { formulaExpr: r.formulaExpr },
    })
  }
  return out
}

/**
 * T21：防抖包装器 —— 返回 `scheduled(...)` + `.cancel()`。
 *
 * 语义：
 *   - 每次调用 scheduled 会取消上一次未触发的计时器，重新开始计时
 *   - 只有在 `delayMs` 内没有新调用时，才真正触发 fn
 *   - 用途：textarea 输入变化 500ms 后再触发 `/formula/preview`，避免每次按键都请求
 */
export const debouncedCall = (fn, delayMs) => {
  let timer = null
  const scheduled = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delayMs)
  }
  scheduled.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  return scheduled
}

/** T21：preview 响应中 `variables[].source` 到 el-tag type 的映射。 */
export const SOURCE_TAG_TYPE = {
  FINANCE_FACTOR: 'success',
  PART_CONTEXT: '',
  FORMULA_REF: 'warning',
  CONST: 'info',
  MISSING: 'danger',
}

export const sourceTagType = (src) => SOURCE_TAG_TYPE[src] ?? 'info'

/**
 * 按 query 过滤：
 * - 空 query → 全量（至多前 30 条，避免下拉过长）
 * - 非空 query → name/code 任一包含（忽略大小写）命中即返
 * - 命中优先级：code 精确 > code 前缀 > name 前缀 > name 子串 > code 子串
 */
export const filterCatalog = (catalog, query) => {
  const flat = flattenCatalog(catalog)
  const q = (query || '').trim().toLowerCase()
  if (!q) return flat.slice(0, 30)
  const scored = []
  for (const item of flat) {
    const code = (item.code || '').toLowerCase()
    const name = (item.name || '').toLowerCase()
    let score = -1
    if (code === q) score = 0
    else if (code.startsWith(q)) score = 1
    else if (name.startsWith(q)) score = 2
    else if (name.includes(q)) score = 3
    else if (code.includes(q)) score = 4
    if (score >= 0) scored.push({ item, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, 30).map((s) => s.item)
}
