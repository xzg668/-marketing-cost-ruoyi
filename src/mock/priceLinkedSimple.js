const financeBasePrices = [
  {
    id: 1,
    priceMonth: '2025-11',
    seq: 5,
    factorName:
      '上月16日至本月15日中华商务网长江现货市场1#电解铜含税平均价格',
    shortName: '1#Cu',
    priceSource: '平均价',
    price: 86.638,
    unit: '公斤',
    linkType: '固定',
    factorCode: 'Cu',
    updatedAt: '2026-02-02 10:20',
  },
  {
    id: 2,
    priceMonth: '2025-11',
    seq: 6,
    factorName:
      '上月16日至本月15日中华商务网长江现货市场1#电解锌含税平均价格',
    shortName: '1#Zn',
    priceSource: '平均价',
    price: 22.215,
    unit: '公斤',
    linkType: '固定',
    factorCode: 'Zn',
    updatedAt: '2026-02-02 10:20',
  },
  {
    id: 3,
    priceMonth: '2025-11',
    seq: 7,
    factorName:
      '入库月上月16日至本月15日上海有色网(SMM)现货市场的1#电解铜含税平均价格',
    shortName: '1#Cu',
    priceSource: '平均价',
    price: 86.494,
    unit: '公斤',
    linkType: '固定',
    factorCode: 'Cu',
    updatedAt: '2026-02-02 10:20',
  },
  {
    id: 4,
    priceMonth: '2025-11',
    seq: 8,
    factorName:
      '入库月上月16日至本月15日上海有色网(SMM)现货市场的1#电解锌含税平均价格',
    shortName: '1#Zn',
    priceSource: '平均价',
    price: 22.23,
    unit: '公斤',
    linkType: '固定',
    factorCode: 'Zn',
    updatedAt: '2026-02-02 10:20',
  },
  {
    id: 5,
    priceMonth: '2025-11',
    seq: 18,
    factorName: '上月16日至本月15日灵通信息网佛山地区“美国柜装黄铜Fe<2%”不含税平均价格',
    shortName: '美国柜装黄铜',
    priceSource: '平均价',
    price: 53.564,
    unit: '公斤',
    linkType: '联动',
    factorCode: 'Cn',
    updatedAt: '2026-02-02 10:20',
  },
]

const oaForms = [
  {
    oaNo: 'FI-SR-005-20260116-0527',
    customer: 'YEONGJIN KOREA CO.,LTD.',
    applyDate: '2026-01-16',
    basePrices: {
      Cu: 100000,
      Zn: 24662,
      Sn: 18000,
      Cn: 5000,
    },
  },
  {
    oaNo: 'FI-SC-006-20260120-0118',
    customer: 'COMMERCIAL TECH CO.,LTD.',
    applyDate: '2026-01-20',
    basePrices: {
      Cu: 98000,
      Zn: 24200,
      Al: 22000,
    },
  },
]

const materialWeights = [
  {
    id: 1,
    materialCode: 'MAT-1001',
    materialName: '阀芯A',
    blankWeight: 0.667,
    netWeight: 0.367,
    unit: '千克/件',
    updatedAt: '2026-01-28 10:00',
  },
  {
    id: 2,
    materialCode: 'MAT-1002',
    materialName: '阀芯B',
    blankWeight: 0.52,
    netWeight: 0.33,
    unit: '千克/件',
    updatedAt: '2026-01-28 10:00',
  },
  {
    id: 3,
    materialCode: 'MAT-2001',
    materialName: '连接件A',
    blankWeight: 5.873,
    netWeight: 5.0,
    unit: '千克/件',
    updatedAt: '2026-01-28 10:00',
  },
]

const formulaList = [
  {
    id: 1,
    materialCode: 'MAT-1001',
    formulaName: '阀芯联动公式A',
    expr:
      '(Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee',
    status: 'active',
    updatedAt: '2026-02-02 09:20',
  },
  {
    id: 2,
    materialCode: 'MAT-2001',
    formulaName: '连接件公式B',
    expr: '(Cu*0.7+Al*0.3)*net_weight+process_fee+agent_fee',
    status: 'active',
    updatedAt: '2026-02-03 10:10',
  },
]

const linkedItems = [
  {
    id: 1,
    priceMonth: '2025-11',
    orgCode: '210',
    sourceName: '供管处',
    supplierName: '供应商A',
    supplierCode: 'SUP-A',
    purchaseClass: '部品联动',
    materialName: '阀芯A',
    materialCode: 'MAT-1001',
    specModel: 'E',
    unit: '只',
    processFee: 7.7744,
    agentFee: 0,
    taxIncluded: false,
    effectiveFrom: '2025-11-01',
    effectiveTo: '2025-11-30',
    orderType: 'VMI采购',
    quota: 3000,
    manualPrice: null,
    calcPrice: 29.4193,
    calcStatus: 'fresh',
    updatedAt: '2026-02-02 10:30',
  },
  {
    id: 2,
    priceMonth: '2025-11',
    orgCode: '210',
    sourceName: '供管处',
    supplierName: '供应商A',
    supplierCode: 'SUP-A',
    purchaseClass: '部品联动',
    materialName: '阀芯B',
    materialCode: 'MAT-1002',
    specModel: 'E',
    unit: '只',
    processFee: 5.0,
    agentFee: 0,
    taxIncluded: false,
    effectiveFrom: '2025-11-01',
    effectiveTo: '2025-11-30',
    orderType: '标准采购',
    quota: 1500,
    manualPrice: 12.5,
    calcPrice: 12.5,
    calcStatus: 'fresh',
    updatedAt: '2026-02-01 16:12',
  },
  {
    id: 3,
    priceMonth: '2025-11',
    orgCode: '210',
    sourceName: '供管处',
    supplierName: '供应商B',
    supplierCode: 'SUP-B',
    purchaseClass: '结构件联动',
    materialName: '连接件A',
    materialCode: 'MAT-2001',
    specModel: 'D',
    unit: '只',
    processFee: 5.0,
    agentFee: 0.5,
    taxIncluded: false,
    effectiveFrom: '2025-11-01',
    effectiveTo: '2025-11-30',
    orderType: 'VMI采购',
    quota: 800,
    manualPrice: null,
    calcPrice: 330.688,
    calcStatus: 'fresh',
    updatedAt: '2026-02-03 11:05',
  },
]

const priceVariables = [
  {
    id: 1,
    variableCode: 'Cu',
    variableName: '铜基价',
    sourceTable: 'oa_form',
    sourceField: 'copper_price',
  },
  {
    id: 2,
    variableCode: 'Zn',
    variableName: '锌基价',
    sourceTable: 'oa_form',
    sourceField: 'zinc_price',
  },
  {
    id: 3,
    variableCode: 'Al',
    variableName: '铝基价',
    sourceTable: 'oa_form',
    sourceField: 'aluminum_price',
  },
  {
    id: 4,
    variableCode: 'Sn',
    variableName: '不锈钢基价',
    sourceTable: 'oa_form',
    sourceField: 'steel_price',
  },
  {
    id: 5,
    variableCode: 'Cn',
    variableName: '其他材料价',
    sourceTable: 'oa_form',
    sourceField: 'other_material',
  },
  {
    id: 6,
    variableCode: 'blank_weight',
    variableName: '下料重量',
    sourceTable: 'lp_price_linked_item',
    sourceField: 'blank_weight',
  },
  {
    id: 7,
    variableCode: 'net_weight',
    variableName: '产品净重',
    sourceTable: 'lp_price_linked_item',
    sourceField: 'net_weight',
  },
  {
    id: 8,
    variableCode: 'process_fee',
    variableName: '加工费',
    sourceTable: 'lp_price_linked_item',
    sourceField: 'process_fee',
  },
  {
    id: 9,
    variableCode: 'agent_fee',
    variableName: '代理费',
    sourceTable: 'lp_price_linked_item',
    sourceField: 'agent_fee',
  },
  {
    id: 10,
    variableCode: 'us_brass_price',
    variableName: '美国柜装黄铜',
    sourceTable: 'lp_finance_base_price',
    sourceField: 'price',
  },
]

const linkedCalcItems = [
  {
    id: 1,
    oaNo: 'FI-SR-005-20260116-0527',
    itemCode: 'MAT-1001',
    shapeAttr: '制造件',
    bomQty: 2,
    partUnitPrice: null,
    partAmount: null,
  },
  {
    id: 2,
    oaNo: 'FI-SR-005-20260116-0527',
    itemCode: 'MAT-2001',
    shapeAttr: '采购件',
    bomQty: 1.5,
    partUnitPrice: null,
    partAmount: null,
  },
  {
    id: 3,
    oaNo: 'FI-SC-006-20260120-0118',
    itemCode: 'MAT-1002',
    shapeAttr: '制造件',
    bomQty: 4,
    partUnitPrice: null,
    partAmount: null,
  },
]

const state = {
  financeBasePrices,
  oaForms,
  materialWeights,
  formulaList,
  linkedItems,
  priceVariables,
  linkedCalcItems,
}

let idSeed = 1000

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

const nextId = () => {
  idSeed += 1
  return idSeed
}

const cloneList = (list) => list.map((item) => ({ ...item }))

const toCamelCase = (value) =>
  String(value).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const readFieldValue = (record, field) => {
  if (!record || !field) {
    return null
  }
  if (Object.prototype.hasOwnProperty.call(record, field)) {
    return record[field]
  }
  const camel = toCamelCase(field)
  if (Object.prototype.hasOwnProperty.call(record, camel)) {
    return record[camel]
  }
  return null
}

const findRecordByItemCode = (list, itemCode) => {
  if (!Array.isArray(list) || !itemCode) {
    return null
  }
  return (
    list.find((row) => row.itemCode === itemCode) ||
    list.find((row) => row.materialCode === itemCode) ||
    list.find((row) => row.material_code === itemCode) ||
    null
  )
}

const extractFormulaTokens = (expr) => {
  const matches = String(expr || '').match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  return Array.from(new Set(matches))
}

const oaFieldCodeMap = {
  copper_price: 'Cu',
  zinc_price: 'Zn',
  aluminum_price: 'Al',
  steel_price: 'Sn',
  other_material: 'Cn',
}

const inferFactorCode = (shortName, factorName) => {
  const text = `${shortName || ''} ${factorName || ''}`.toUpperCase()
  if (text.includes('CU')) {
    return 'Cu'
  }
  if (text.includes('ZN')) {
    return 'Zn'
  }
  if (text.includes('AL')) {
    return 'Al'
  }
  if (text.includes('SN')) {
    return 'Sn'
  }
  if (text.includes('CN')) {
    return 'Cn'
  }
  return ''
}

const defaultFactorCodes = ['Cu', 'Zn', 'Al', 'Sn', 'Cn']

const getFinanceFactorMap = (priceMonth) => {
  const map = {}
  state.financeBasePrices
    .filter((row) => row.priceMonth === priceMonth)
    .slice()
    .sort((a, b) => (a.seq || 0) - (b.seq || 0))
    .forEach((row) => {
      const factorCode =
        row.factorCode || inferFactorCode(row.shortName, row.factorName)
      if (!factorCode || Object.prototype.hasOwnProperty.call(map, factorCode)) {
        return
      }
      map[factorCode] = Number(row.price) || 0
    })
  defaultFactorCodes.forEach((code) => {
    if (!Object.prototype.hasOwnProperty.call(map, code)) {
      map[code] = 0
    }
  })
  return map
}

const buildFactorMap = (priceMonth, overrideMap) => {
  const map = getFinanceFactorMap(priceMonth)
  if (!overrideMap) {
    return map
  }
  Object.entries(overrideMap).forEach(([code, value]) => {
    if (value !== null && value !== undefined) {
      map[code] = Number(value)
    }
  })
  return map
}

const hasOverride = (overrideMap) =>
  !!overrideMap &&
  Object.values(overrideMap).some((value) => value !== null && value !== undefined)

const getWeights = (materialCode) =>
  state.materialWeights.find((row) => row.materialCode === materialCode) || {
    blankWeight: 0,
    netWeight: 0,
  }

const getFormula = (materialCode) =>
  state.formulaList.find(
    (row) => row.materialCode === materialCode && row.status === 'active',
  ) || null

const getFormulaExpr = (materialCode, linkedItem) => {
  const directExpr = linkedItem?.formulaExpr
  if (directExpr) {
    return directExpr
  }
  const formula = getFormula(materialCode)
  return formula ? formula.expr : ''
}

const getLinkedItemSnapshot = (linkedItem) => {
  if (!linkedItem) {
    return null
  }
  const weights = getWeights(linkedItem.materialCode)
  const blankWeight =
    linkedItem.blankWeight ?? weights.blankWeight ?? 0
  const netWeight =
    linkedItem.netWeight ?? weights.netWeight ?? 0
  return {
    ...linkedItem,
    blankWeight,
    netWeight,
    blank_weight: blankWeight,
    net_weight: netWeight,
    process_fee: linkedItem.processFee ?? 0,
    agent_fee: linkedItem.agentFee ?? 0,
  }
}

const evaluateFormula = (expr, vars) => {
  if (!expr) {
    return null
  }
  try {
    const keys = Object.keys(vars)
    const values = keys.map((key) => vars[key])
    const fn = new Function(...keys, `return ${expr}`)
    const result = fn(...values)
    if (typeof result !== 'number' || Number.isNaN(result)) {
      return null
    }
    return Number(result.toFixed(4))
  } catch (error) {
    return null
  }
}

const resolveOaFieldValue = (form, sourceField) => {
  if (!form || !sourceField) {
    return null
  }
  const directValue = readFieldValue(form, sourceField)
  if (directValue !== null && directValue !== undefined) {
    return directValue
  }
  const factorCode = oaFieldCodeMap[sourceField]
  if (factorCode && form.basePrices) {
    return form.basePrices[factorCode]
  }
  return null
}

const resolveFinanceBasePrice = (variable, priceMonth) => {
  const candidates = priceMonth
    ? state.financeBasePrices.filter((row) => row.priceMonth === priceMonth)
    : state.financeBasePrices
  const variableName = variable?.variableName || ''
  let match = candidates.find((row) => row.shortName === variableName)
  if (!match && variableName) {
    match = candidates.find(
      (row) =>
        row.shortName?.includes(variableName) ||
        variableName.includes(row.shortName || ''),
    )
  }
  if (!match && variable?.variableCode) {
    match = candidates.find((row) => row.factorCode === variable.variableCode)
  }
  return match ? parseNumber(match.price) : null
}

const resolveVariableValue = (variable, context) => {
  const sourceTable = variable?.sourceTable
  if (!sourceTable) {
    return null
  }
  if (sourceTable === 'oa_form') {
    const value = resolveOaFieldValue(context.oaForm, variable.sourceField)
    const parsed = parseNumber(value)
    return parsed === null ? null : parsed / 1000
  }
  if (sourceTable === 'lp_finance_base_price') {
    return resolveFinanceBasePrice(variable, context.priceMonth)
  }
  let record = null
  if (sourceTable === 'lp_price_linked_item') {
    record = context.linkedItem
  } else if (sourceTable === 'lp_price_linked_calc_item') {
    record = context.calcItem
  } else if (sourceTable === 'lp_material_weight') {
    record = context.materialWeight
  } else {
    const list = context.tableMap[sourceTable]
    record = findRecordByItemCode(list, context.itemCode)
  }
  const raw = readFieldValue(record, variable.sourceField)
  return parseNumber(raw)
}

const buildFormulaVariables = (expr, context) => {
  const tokens = extractFormulaTokens(expr)
  const variableMap = {}
  const configMap = context.variableConfigMap
  tokens.forEach((token) => {
    const variable = configMap[token]
    const value = variable
      ? resolveVariableValue(variable, context)
      : null
    variableMap[token] = value ?? 0
  })
  return variableMap
}

const refreshLinkedCalcItem = (calcItem) => {
  const linkedItem = state.linkedItems.find(
    (item) => item.materialCode === calcItem.itemCode,
  )
  const linkedSnapshot = getLinkedItemSnapshot(linkedItem)
  const formulaExpr = getFormulaExpr(calcItem.itemCode, linkedSnapshot)
  const oaForm = state.oaForms.find((form) => form.oaNo === calcItem.oaNo)
  const materialWeight = getWeights(calcItem.itemCode)
  const context = {
    calcItem,
    linkedItem: linkedSnapshot,
    oaForm,
    materialWeight,
    itemCode: calcItem.itemCode,
    priceMonth: linkedSnapshot?.priceMonth || linkedItem?.priceMonth || '',
    variableConfigMap: state.priceVariables.reduce((acc, row) => {
      acc[row.variableCode] = row
      return acc
    }, {}),
    tableMap: {
      lp_price_linked_item: state.linkedItems,
      lp_price_linked_calc_item: state.linkedCalcItems,
      lp_material_weight: state.materialWeights,
    },
  }
  const vars = buildFormulaVariables(formulaExpr, context)
  const partUnitPrice = formulaExpr
    ? evaluateFormula(formulaExpr, vars)
    : null
  const bomQty = parseNumber(calcItem.bomQty)
  const partAmount =
    partUnitPrice !== null && bomQty !== null
      ? Number((partUnitPrice * bomQty).toFixed(6))
      : null
  return {
    ...calcItem,
    partUnitPrice,
    partAmount,
    updatedAt: nowText(),
  }
}

const upsertFormulaForMaterial = (materialCode, expr) => {
  const trimmed = String(expr || '').trim()
  const existing = state.formulaList.find(
    (row) => row.materialCode === materialCode,
  )
  if (!trimmed) {
    if (existing) {
      existing.status = 'inactive'
      existing.updatedAt = nowText()
    }
    return null
  }
  if (existing) {
    existing.expr = trimmed
    existing.status = 'active'
    existing.updatedAt = nowText()
    return existing
  }
  const record = {
    id: nextId(),
    materialCode,
    formulaName: `${materialCode}公式`,
    expr: trimmed,
    status: 'active',
    updatedAt: nowText(),
  }
  state.formulaList.unshift(record)
  return record
}

const recalcItem = (item) => {
  const formula = getFormula(item.materialCode)
  const weights = getWeights(item.materialCode)
  const factors = buildFactorMap(item.priceMonth, null)
  const baseSource = 'FIN'
  const vars = {
    ...factors,
    blank_weight: Number(weights.blankWeight || 0),
    net_weight: Number(weights.netWeight || 0),
    process_fee: Number(item.processFee || 0),
    agent_fee: Number(item.agentFee || 0),
  }
  const calcPrice = formula
    ? evaluateFormula(formula.expr, vars)
    : Number(item.manualPrice || 0)
  return {
    ...item,
    calcPrice: calcPrice ?? 0,
    calcStatus: 'fresh',
    baseSource,
    updatedAt: nowText(),
  }
}

const recalcByMaterial = (materialCode) => {
  state.linkedItems = state.linkedItems.map((item) =>
    item.materialCode === materialCode ? recalcItem(item) : item,
  )
}

const recalcByPriceMonth = (priceMonth) => {
  state.linkedItems = state.linkedItems.map((item) =>
    item.priceMonth === priceMonth ? recalcItem(item) : item,
  )
}

const withDerived = (item) => {
  const formula = getFormula(item.materialCode)
  const weights = getWeights(item.materialCode)
  return {
    ...item,
    formulaName: formula ? formula.formulaName : '手工价',
    formulaExpr: formula ? formula.expr : '-',
    blankWeight: weights.blankWeight,
    netWeight: weights.netWeight,
    baseSource: 'FIN',
  }
}

export const fetchFinanceBasePrices = async (params = {}) => {
  const priceMonth = params.priceMonth ? String(params.priceMonth).trim() : ''
  const keyword = params.keyword ? String(params.keyword).trim() : ''
  return cloneList(state.financeBasePrices)
    .filter((row) => {
      if (priceMonth && row.priceMonth !== priceMonth) {
        return false
      }
      if (keyword) {
        const haystack = `${row.factorName || ''} ${row.shortName || ''}`
        if (!haystack.toLowerCase().includes(keyword.toLowerCase())) {
          return false
        }
      }
      return true
    })
    .sort((a, b) => (a.seq || 0) - (b.seq || 0))
}

export const createFinanceBasePrice = async (payload) => {
  const factorCode =
    payload.factorCode ||
    inferFactorCode(payload.shortName, payload.factorName)
  const record = {
    id: nextId(),
    priceMonth: payload.priceMonth,
    seq: Number(payload.seq) || 0,
    factorName: payload.factorName || '',
    shortName: payload.shortName || '',
    priceSource: payload.priceSource || '',
    price: Number(payload.price),
    unit: payload.unit || '公斤',
    linkType: payload.linkType || '固定',
    factorCode,
    updatedAt: nowText(),
  }
  state.financeBasePrices.unshift(record)
  recalcByPriceMonth(record.priceMonth)
  return record
}

export const updateFinanceBasePrice = async (payload) => {
  const target = state.financeBasePrices.find((row) => row.id === payload.id)
  if (!target) {
    return null
  }
  const factorCode =
    payload.factorCode ||
    inferFactorCode(payload.shortName || target.shortName, payload.factorName || target.factorName)
  Object.assign(target, {
    priceMonth: payload.priceMonth,
    seq: Number(payload.seq) || target.seq,
    factorName: payload.factorName || target.factorName,
    shortName: payload.shortName || target.shortName,
    priceSource: payload.priceSource || target.priceSource,
    price: Number(payload.price),
    unit: payload.unit || target.unit,
    linkType: payload.linkType || target.linkType,
    factorCode,
    updatedAt: nowText(),
  })
  recalcByPriceMonth(target.priceMonth)
  return target
}

export const deleteFinanceBasePrice = async (id) => {
  const index = state.financeBasePrices.findIndex((row) => row.id === id)
  if (index >= 0) {
    state.financeBasePrices.splice(index, 1)
  }
}

export const importFinanceBasePrices = async (payload = {}) => {
  const priceMonth = payload.priceMonth ? String(payload.priceMonth).trim() : ''
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  if (!priceMonth || rows.length === 0) {
    return []
  }
  const imported = []
  rows.forEach((row) => {
    const seq = Number(row.seq) || 0
    const shortName = row.shortName || ''
    const factorName = row.factorName || ''
    const factorCode = row.factorCode || inferFactorCode(shortName, factorName)
    const match = state.financeBasePrices.find((item) => {
      if (item.priceMonth !== priceMonth) {
        return false
      }
      if (seq && item.seq === seq) {
        return true
      }
      if (shortName && factorName) {
        return item.shortName === shortName && item.factorName === factorName
      }
      if (shortName && !factorName) {
        return item.shortName === shortName
      }
      if (!shortName && factorName) {
        return item.factorName === factorName
      }
      return false
    })
    const record = {
      priceMonth,
      seq,
      factorName,
      shortName,
      priceSource: row.priceSource || '',
      price: Number(row.price) || 0,
      unit: row.unit || '公斤',
      linkType: row.linkType || '固定',
      factorCode,
      updatedAt: nowText(),
    }
    if (match) {
      Object.assign(match, record)
      imported.push(match)
    } else {
      const created = {
        id: nextId(),
        ...record,
      }
      state.financeBasePrices.unshift(created)
      imported.push(created)
    }
  })
  recalcByPriceMonth(priceMonth)
  return imported
}

export const fetchMaterialWeights = async (params = {}) => {
  const materialCode = params.materialCode ? String(params.materialCode).trim() : ''
  return cloneList(state.materialWeights).filter((row) => {
    if (materialCode && row.materialCode !== materialCode) {
      return false
    }
    return true
  })
}

export const createMaterialWeight = async (payload) => {
  const record = {
    id: nextId(),
    materialCode: payload.materialCode,
    materialName: payload.materialName || '',
    blankWeight: Number(payload.blankWeight || 0),
    netWeight: Number(payload.netWeight || 0),
    unit: payload.unit || '千克/件',
    updatedAt: nowText(),
  }
  state.materialWeights.unshift(record)
  recalcByMaterial(record.materialCode)
  return record
}

export const updateMaterialWeight = async (payload) => {
  const target = state.materialWeights.find((row) => row.id === payload.id)
  if (!target) {
    return null
  }
  Object.assign(target, {
    materialCode: payload.materialCode,
    materialName: payload.materialName || target.materialName,
    blankWeight: Number(payload.blankWeight || 0),
    netWeight: Number(payload.netWeight || 0),
    unit: payload.unit || target.unit,
    updatedAt: nowText(),
  })
  recalcByMaterial(target.materialCode)
  return target
}

export const deleteMaterialWeight = async (id) => {
  const index = state.materialWeights.findIndex((row) => row.id === id)
  if (index >= 0) {
    state.materialWeights.splice(index, 1)
  }
}

export const fetchFormulaList = async (params = {}) => {
  const materialCode = params.materialCode ? String(params.materialCode).trim() : ''
  const status = params.status ? String(params.status).trim() : ''
  return cloneList(state.formulaList).filter((row) => {
    if (materialCode && row.materialCode !== materialCode) {
      return false
    }
    if (status && row.status !== status) {
      return false
    }
    return true
  })
}

export const createFormula = async (payload) => {
  const record = {
    id: nextId(),
    materialCode: payload.materialCode,
    formulaName: payload.formulaName,
    expr: payload.expr,
    status: payload.status || 'active',
    updatedAt: nowText(),
  }
  state.formulaList.unshift(record)
  recalcByMaterial(record.materialCode)
  return record
}

export const updateFormula = async (payload) => {
  const target = state.formulaList.find((row) => row.id === payload.id)
  if (!target) {
    return null
  }
  Object.assign(target, {
    materialCode: payload.materialCode,
    formulaName: payload.formulaName,
    expr: payload.expr,
    status: payload.status || target.status,
    updatedAt: nowText(),
  })
  recalcByMaterial(target.materialCode)
  return target
}

export const deleteFormula = async (id) => {
  const index = state.formulaList.findIndex((row) => row.id === id)
  if (index >= 0) {
    const [removed] = state.formulaList.splice(index, 1)
    if (removed?.materialCode) {
      recalcByMaterial(removed.materialCode)
    }
  }
}

export const fetchLinkedResults = async (params = {}) => {
  const priceMonth = params.priceMonth ? String(params.priceMonth).trim() : ''
  const materialCode = params.materialCode ? String(params.materialCode).trim() : ''
  return cloneList(state.linkedItems)
    .map(withDerived)
    .filter((row) => {
      if (priceMonth && row.priceMonth !== priceMonth) {
        return false
      }
      if (materialCode && row.materialCode !== materialCode) {
        return false
      }
      return true
    })
}

export const recalcLinkedResult = async (id) => {
  const target = state.linkedItems.find((row) => row.id === id)
  if (!target) {
    return null
  }
  const updated = recalcItem(target)
  state.linkedItems = state.linkedItems.map((row) =>
    row.id === id ? updated : row,
  )
  return withDerived(updated)
}

const recalcItemWithOverride = (item, priceMonth, overrideMap) => {
  const formula = getFormula(item.materialCode)
  const weights = getWeights(item.materialCode)
  const factors = buildFactorMap(priceMonth, overrideMap)
  const baseSource = hasOverride(overrideMap) ? 'OA' : 'FIN'
  const vars = {
    ...factors,
    blank_weight: Number(weights.blankWeight || 0),
    net_weight: Number(weights.netWeight || 0),
    process_fee: Number(item.processFee || 0),
    agent_fee: Number(item.agentFee || 0),
  }
  const calcPrice = formula
    ? evaluateFormula(formula.expr, vars)
    : Number(item.manualPrice || 0)
  return {
    ...item,
    calcPrice: calcPrice ?? 0,
    baseSource,
    formulaName: formula ? formula.formulaName : '手工价',
    formulaExpr: formula ? formula.expr : '-',
    blankWeight: weights.blankWeight,
    netWeight: weights.netWeight,
    priceMonth,
    updatedAt: nowText(),
  }
}

export const fetchOaLinkedResults = async (params = {}) => {
  const priceMonth = params.priceMonth ? String(params.priceMonth).trim() : ''
  const oaNo = params.oaNo ? String(params.oaNo).trim() : ''
  const materialCode = params.materialCode ? String(params.materialCode).trim() : ''
  const targetForms = oaNo
    ? state.oaForms.filter((form) => form.oaNo === oaNo)
    : state.oaForms
  const results = []
  targetForms.forEach((form) => {
    state.linkedItems.forEach((item) => {
      if (materialCode && item.materialCode !== materialCode) {
        return
      }
      const useMonth = priceMonth || item.priceMonth
      const computed = recalcItemWithOverride(item, useMonth, form.basePrices)
      results.push({
        ...computed,
        oaNo: form.oaNo,
        customer: form.customer,
        applyDate: form.applyDate,
      })
    })
  })
  return results
}

export const updateLinkedItem = async (payload) => {
  const target = state.linkedItems.find((row) => row.id === payload.id)
  if (!target) {
    return null
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'formulaExpr')) {
    upsertFormulaForMaterial(target.materialCode, payload.formulaExpr)
  }
  const toNumber = (value) => {
    if (value === '' || value === null || value === undefined) {
      return null
    }
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  const updatedFields = {
    processFee: toNumber(payload.processFee) ?? target.processFee,
    agentFee: toNumber(payload.agentFee) ?? target.agentFee,
    manualPrice: toNumber(payload.manualPrice),
  }
  Object.assign(target, updatedFields)
  const updated = recalcItem(target)
  state.linkedItems = state.linkedItems.map((row) =>
    row.id === payload.id ? updated : row,
  )
  return withDerived(updated)
}

export const updateLinkedOaOverride = async (oaNo, factors) => {
  const target = state.oaForms.find((form) => form.oaNo === oaNo)
  if (!target) {
    return null
  }
  target.basePrices = {
    ...target.basePrices,
    ...factors,
  }
  return target
}
