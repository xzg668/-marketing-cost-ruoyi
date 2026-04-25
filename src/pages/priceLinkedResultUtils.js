/**
 * T24：PriceLinkedResultPage 的纯函数辅助层 —— 与 Vue 组件解耦。
 *
 * 职责：
 *   1) 解析 /items/{id}/trace 返回的 `traceJson` 字符串为结构化对象
 *   2) 把扁平 trace map 拉平为时间轴 step（normalize / resolve / evaluate / error）
 *   3) 计算系统结果 vs Excel 金标的差异 + 是否超阈值（0.01）
 */

/** T24：差异阈值 —— DoD 要求 > 0.01 红色高亮 */
export const DIFF_THRESHOLD = 0.01

/**
 * 把后端 traceJson 字符串安全 parse；非法 JSON / null → null。
 * 用 try/catch 是因为历史数据里 trace_json 可能为空或损坏。
 */
export const parseTraceJson = (traceJson) => {
  if (traceJson == null || traceJson === '') return null
  if (typeof traceJson !== 'string') return traceJson
  try {
    return JSON.parse(traceJson)
  } catch (_) {
    return null
  }
}

/**
 * 把 trace 对象扁平化为时间轴 steps —— 按业务语义分四段：
 *   - normalize: 原始表达式 + 规范化后表达式
 *   - resolve:   变量赋值列表（vars 键值对）
 *   - evaluate:  最终结果 + 可能的 legacyResult / diff（dual 模式）
 *   - error:     致命错误（如果有）
 */
export const buildTraceTimeline = (trace) => {
  if (!trace || typeof trace !== 'object') return []
  const steps = []

  // normalize
  if (trace.rawExpr || trace.normalizedExpr) {
    steps.push({
      step: 'normalize',
      title: '规范化',
      rawExpr: trace.rawExpr || '',
      normalizedExpr: trace.normalizedExpr || '',
    })
  }

  // resolve
  if (trace.variables && typeof trace.variables === 'object') {
    const entries = Object.entries(trace.variables).map(([code, value]) => ({
      code,
      value,
    }))
    steps.push({
      step: 'resolve',
      title: '变量解析',
      variables: entries,
    })
  }

  // evaluate
  if (
    trace.result !== undefined ||
    trace.legacyResult !== undefined ||
    trace.newResult !== undefined ||
    trace.diff !== undefined
  ) {
    steps.push({
      step: 'evaluate',
      title: '表达式求值',
      result: trace.result ?? trace.newResult ?? null,
      legacyResult: trace.legacyResult ?? null,
      diff: trace.diff ?? null,
      mode: trace.mode || '',
    })
  }

  // error（致命错误放最后，便于 UI 突出显示）
  if (trace.error) {
    steps.push({
      step: 'error',
      title: '错误',
      error: trace.error,
    })
  }

  return steps
}

/**
 * 计算差异 = |system - golden|，并判断是否超阈值。
 * 任一侧缺失 → {diff: null, exceeds: false}
 */
export const diffWithGolden = (system, golden) => {
  if (system == null || system === '' || golden == null || golden === '') {
    return { diff: null, exceeds: false }
  }
  const s = Number(system)
  const g = Number(golden)
  if (!Number.isFinite(s) || !Number.isFinite(g)) {
    return { diff: null, exceeds: false }
  }
  const diff = Math.abs(s - g)
  return { diff, exceeds: diff > DIFF_THRESHOLD }
}
