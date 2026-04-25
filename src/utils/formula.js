/**
 * 公式中英文双向渲染工具。
 *
 * 设计原则（V36+）：
 * - 不再硬编码变量/别名映射。所有变量和行局部占位符的元数据是后端的权威：
 *   - 变量：GET /api/v1/price-linked/variables → variableCode / variableName / aliasesJson
 *   - 行局部占位符：GET /api/v1/price-linked/row-local-placeholders → code / displayName / tokenNames
 * - 调用方（页面/组件）在 mounted 时拉取两者，用 buildFormulaIndex() 构建一次性索引，
 *   传给 toChineseExpr / toCodeExpr。
 * - 本文件保留一个**最小**的"离线兜底"映射，仅在后端数据未到达时渲染一些最基础变量
 *   （Cu/Zn/blank_weight 等）；实际展示以后端数据为准。
 *
 * 为什么不让这里纯函数化、完全移除默认值？
 * - 老代码中有若干 toChineseExpr(expr)（一个参数）调用点未显式传 map，移除默认会让它们
 *   直接显示裸 code。保留极简兜底可平滑迁移，新代码应显式传 index。
 */

/** 离线兜底：仅系统"祖宗变量"——Cu/Zn/权重/费用。SUS / H 系列等动态变量不放这里 */
const FALLBACK_VARIABLE_NAMES = {
  Cu: '铜基价',
  Zn: '锌基价',
  Al: '铝基价',
  Sn: '不锈钢基价',
  Cn: '其他材料价',
  blank_weight: '下料重量',
  net_weight: '产品净重',
  process_fee: '加工费',
  agent_fee: '代理费',
}

/** 离线兜底：用户打老中文别名也能识别（下料量→blank_weight 这类人用的简写） */
const FALLBACK_CHINESE_ALIASES = {
  铜价: 'Cu',
  锌价: 'Zn',
  铝价: 'Al',
  不锈钢价: 'Sn',
  下料量: 'blank_weight',
  '下料重量(g)': 'blank_weight',
  净重: 'net_weight',
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toObject = (entries) =>
  entries.reduce((acc, [k, v]) => {
    if (k && v) acc[k] = v
    return acc
  }, {})

/**
 * 构建公式渲染索引 —— 合并后端动态数据 + 最小离线兜底。
 *
 * @param {Object} opts
 * @param {Array<{variableCode:string, variableName:string, aliasesJson?:string}>} opts.variables
 *        后端 /price-linked/variables 返回的变量列表
 * @param {Array<{code:string, displayName:string, tokenNames:string[]}>} opts.placeholders
 *        后端 /price-linked/row-local-placeholders 返回的占位符列表
 * @returns {{codeToName: Record<string,string>, aliasToCode: Record<string,string>}}
 *   - codeToName：code → 中文名（给 toChineseExpr）
 *   - aliasToCode：中文/别名 → 代号（给 toCodeExpr；占位符的代号带方括号，确保后端不会
 *     把它当作未登记变量）
 */
export const buildFormulaIndex = ({ variables = [], placeholders = [] } = {}) => {
  const codeToName = { ...FALLBACK_VARIABLE_NAMES }
  const aliasToCode = { ...FALLBACK_CHINESE_ALIASES }

  // 变量表：code→name；aliasesJson 数组里每个别名也可作反向输入
  for (const v of variables) {
    const code = v?.variableCode
    const name = v?.variableName
    if (!code) continue
    if (name) codeToName[code] = name

    // aliasesJson 是 JSON 字符串，解析失败容错
    let aliases = []
    if (typeof v?.aliasesJson === 'string' && v.aliasesJson.trim()) {
      try {
        const parsed = JSON.parse(v.aliasesJson)
        if (Array.isArray(parsed)) aliases = parsed
      } catch {
        // 忽略坏 JSON，不影响其他变量
      }
    }
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim()) {
        aliasToCode[alias] = code
      }
    }
    // variableName 本身也作为反向别名（用户直接打显示名最常见）
    if (name) aliasToCode[name] = code
  }

  // 行局部占位符：code 带两下划线前缀，反向映射**必须**包方括号——因为 __material 不在
  // 变量表里，后端阶段 4 tagVariables 识别不到，不会自动包方括号；如果前端转成裸
  // __material 最终落库就是坏公式。
  for (const p of placeholders) {
    const code = p?.code
    const display = p?.displayName
    const tokens = Array.isArray(p?.tokenNames) ? p.tokenNames : []
    if (!code) continue
    if (display) codeToName[code] = display
    const bracketed = `[${code}]`
    if (display) aliasToCode[display] = bracketed
    for (const t of tokens) {
      if (typeof t === 'string' && t.trim()) {
        aliasToCode[t] = bracketed
      }
    }
  }

  return { codeToName, aliasToCode }
}

/** 渲染：把公式里的 [code] 替换成中文显示名 */
export const toChineseExpr = (expr, variables = FALLBACK_VARIABLE_NAMES) => {
  if (!expr) return ''
  // 允许两种入参：要么直接给 codeToName 扁平 map（老调用点），要么给 buildFormulaIndex 的返回对象
  const map = variables?.codeToName ? variables.codeToName : variables
  let output = String(expr)
  // 按 key 长度倒序替换，避免短名先替换吞掉长名（__material 包含 material）
  const orderedCodes = Object.keys(map).sort((a, b) => b.length - a.length)
  orderedCodes.forEach((key) => {
    const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'g')
    output = output.replace(pattern, map[key])
  })
  return output
}

const normalizeSymbols = (value) =>
  value
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/×/g, '*')
    .replace(/＊/g, '*')
    .replace(/·/g, '*')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/／/g, '/')
    .replace(/÷/g, '/')

/** 反向：把用户输入的中文公式转成 code 形式 */
export const toCodeExpr = (expr, variables = FALLBACK_VARIABLE_NAMES) => {
  if (!expr) return ''
  let output = normalizeSymbols(String(expr))

  // 两种入参：(A) index 对象 {codeToName, aliasToCode} —— 新调用点
  //           (B) 扁平 code→name —— 老调用点；此时现场拼反向 + 合并 FALLBACK 中文别名
  let aliasToCode
  if (variables?.aliasToCode) {
    aliasToCode = variables.aliasToCode
  } else {
    const flat = variables || {}
    aliasToCode = {
      ...FALLBACK_CHINESE_ALIASES,
      ...toObject(Object.entries(flat).map(([code, name]) => [name, code])),
    }
  }

  const orderedNames = Object.keys(aliasToCode).sort((a, b) => b.length - a.length)
  orderedNames.forEach((name) => {
    const pattern = new RegExp(escapeRegExp(name), 'g')
    output = output.replace(pattern, aliasToCode[name])
  })
  return output
}

/** 离线兜底的 code→name 映射（老调用点入口；保持向后兼容） */
export const formulaVariables = FALLBACK_VARIABLE_NAMES
