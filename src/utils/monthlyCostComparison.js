export const comparisonMetrics = [
  ['MATERIAL', '材料费'], ['DIRECT_LABOR', '直接人工工资'], ['INDIRECT_LABOR', '辅助人工工资'],
  ['MANUFACTURE', '制造费用'], ['LOSS', '净损失成本'], ['MANUFACTURE_COST', '制造成本'],
]
export const comparisonMonthFields = [
  ['unit', '计量单位'], ['completedAt', '生效时间'], ['financeCuPrice', '核算基价（元/公斤）'],
  ...comparisonMetrics.map(([key, label], i) => [key, `${label}（${i + 1}）`]),
  ['productProperty', '产品属性'], ['lossRate', '净损失率'], ['wageSource', '直接人工工资来源'], ['unapproved', '未审批项'],
]
export const comparisonChangeLabels = { UNCHANGED: '', CHANGED: '变化', ADDED: '新增', REMOVED: '减少', MONTH_MISSING: '该月无成功核算' }
export const objectIdentity = object => JSON.stringify([object.businessUnitType, object.oaNo, object.oaFormItemId])
export function comparisonDisplayRows(comparison) {
  if (!comparison) return []
  const grouped = new Map()
  for (const row of comparison.rows) {
    const key = objectIdentity(row.key.object)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }
  return comparison.products.flatMap(product => {
    const children = grouped.get(objectIdentity(product.object)) || []
    return [{ ...product, kind: 'PRODUCT', childCode: '', childName: '父件汇总', groupRows: children.length + 1 },
      ...children.map(row => ({ ...row, object: row.key.object, kind: 'COMPONENT', childCode: row.key.materialCode,
        childName: row.comparison?.name || row.baseline?.name || '', groupRows: 0 }))]
  })
}
export function comparisonCell(row, side, field) {
  const value = row[side]
  if (!value) return ''
  return value.amounts && Object.hasOwn(value.amounts, field) ? value.amounts[field] ?? '' : value[field] ?? ''
}
export const comparisonDifferenceCell = (row, metric, field) => row.differences?.[metric]?.[field] ?? ''
