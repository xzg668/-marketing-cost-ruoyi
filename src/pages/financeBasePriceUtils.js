/**
 * T22：影响因素表页的纯函数辅助层 —— 与 Vue 组件解耦，便于 node:test 直接单测。
 *
 * 职责：
 *   1) 涨跌幅计算（含 orig 为 0/缺失时的降级）
 *   2) 涨跌幅格式化（带 + 号 / %）
 *   3) 批次 UUID 短展示（取前 8 位）
 *   4) 数字显示（多位小数 + 千分位）
 */

/**
 * 涨跌幅 = (current - original) / original
 * 原价为 0 或任一侧非数字 → 返回 null，由 UI 显示"—"。
 */
export const calcPercentChange = (current, original) => {
  // null/undefined/空串/非数字串 一律视为缺失 —— Number(null)=0 会误判为合法输入
  if (current == null || current === '' || original == null || original === '') {
    return null
  }
  const cur = Number(current)
  const orig = Number(original)
  if (!Number.isFinite(cur) || !Number.isFinite(orig) || orig === 0) {
    return null
  }
  return (cur - orig) / orig
}

/** 将涨跌幅比率格式化为显示文本；null → "—"；正数前加 "+"。 */
export const formatPercentChange = (ratio) => {
  if (ratio === null || ratio === undefined) return '—'
  if (!Number.isFinite(ratio)) return '—'
  const pct = (ratio * 100).toFixed(2)
  return `${ratio > 0 ? '+' : ''}${pct}%`
}

/** 批次 UUID 取前 8 位展示。null/空串返回空串。 */
export const shortBatchId = (bid) => {
  if (!bid) return ''
  return String(bid).slice(0, 8)
}

/** 数字显示：最多 4 位小数 + 千分位；null/空 → "—"。 */
export const formatNumber = (value) => {
  if (value == null || value === '') return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}
