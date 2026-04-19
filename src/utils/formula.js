const variableMap = {
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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const toChineseExpr = (expr, variables = variableMap) => {
  if (!expr) {
    return ''
  }
  let output = String(expr)
  Object.keys(variables).forEach((key) => {
    const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'g')
    output = output.replace(pattern, variables[key])
  })
  return output
}

const chineseAliasMap = {
  铜价: 'Cu',
  锌价: 'Zn',
  铝价: 'Al',
  不锈钢价: 'Sn',
  其他材料价: 'Cn',
  下料量: 'blank_weight',
  下料重量: 'blank_weight',
  '下料重量(g)': 'blank_weight',
  净重: 'net_weight',
  产品净重: 'net_weight',
  加工费: 'process_fee',
  代理费: 'agent_fee',
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

export const toCodeExpr = (expr, variables = variableMap) => {
  if (!expr) {
    return ''
  }
  let output = normalizeSymbols(String(expr))
  const chineseToCode = Object.entries(variables).reduce((acc, [code, name]) => {
    acc[name] = code
    return acc
  }, {})
  Object.assign(chineseToCode, chineseAliasMap)
  const orderedNames = Object.keys(chineseToCode).sort((a, b) => b.length - a.length)
  orderedNames.forEach((name) => {
    const pattern = new RegExp(escapeRegExp(name), 'g')
    output = output.replace(pattern, chineseToCode[name])
  })
  return output
}

export const formulaVariables = variableMap
