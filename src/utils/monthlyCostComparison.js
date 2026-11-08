export const comparisonMetrics = [
  ['MATERIAL', '材料费'], ['DIRECT_LABOR', '直接人工工资'], ['INDIRECT_LABOR', '辅助人工工资'],
  ['MANUFACTURE', '制造费用'], ['LOSS', '净损失成本'], ['MANUFACTURE_COST', '制造成本'],
]
export const comparisonMonthFields = [
  ['unit', '计量单位'], ['completedAt', '生效时间'], ['financeCuPrice', '核算基价（元/公斤）'],
  ...comparisonMetrics.map(([key, label], i) => [key, `${label}（${i + 1}）`]),
  ['productProperty', '产品属性'], ['lossRate', '净损失率'], ['wageSource', '直接人工工资来源'], ['unapproved', '未审批项'],
]
export const comparisonChangeLabels = { UNCHANGED: '', CHANGED: '变化', ADDED: '新增', REMOVED: '减少', MONTH_MISSING: '该月未核算', IDENTITY_UNMATCHED: '客户身份缺失，无法匹配', PATH_UNMATCHED: '历史部品待匹配' }
export const comparisonStatusLabels = { SUCCESS: '已核算', FAILED: '核算失败', PENDING: '等待核算', RUNNING: '正在核算', WAIT_CUSTOMER: '客户待完善', DATA_ISSUE: '资料异常' }
export function comparisonDisplayRows(comparison, expandedObjects = new Set()) {
  if (!comparison) return []
  const grouped = new Map()
  for (const row of comparison.rows) {
    const key = row.objectKey
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }
  return comparison.products.flatMap(product => {
    const children = grouped.get(product.objectKey) || []
    const visibleChildren = expandedObjects.has(product.objectKey) ? children : []
    return [{ ...product, kind: 'PRODUCT', childCode: '', childName: '父件汇总', partCount: children.length, groupRows: visibleChildren.length + 1 },
      ...visibleChildren.map(row => ({ ...row, object: row.key.object, identity: product.identity,
        baselineState: product.baselineState, comparisonState: product.comparisonState, kind: 'COMPONENT', childCode: row.key.materialCode,
        childName: row.comparison?.name || row.baseline?.name || '', groupRows: 0 }))]
  })
}
export function comparisonCell(row, side, field) {
  const value = row[side]
  if (!value) return ''
  return value.amounts && Object.hasOwn(value.amounts, field) ? value.amounts[field] ?? '' : value[field] ?? ''
}
export const comparisonDifferenceCell = (row, metric, field) => row.differences?.[metric]?.[field] ?? ''
