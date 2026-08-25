function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function parentChildDisplay(parentValue, childValue) {
  const parent = firstText(parentValue)
  const child = firstText(childValue)
  if (!child) return parent
  if (!parent) return `【${child}】`
  return `${parent}\n【${child}】`
}

/**
 * 上卷父件按命中子件拆成见机表展示行。
 *
 * 每条展示行仍指向同一条父件结算行：物料字段按“父件\n【子件】”显示；
 * 不额外生成原材料行或废料行，也不改变后台结算行数量。
 */
export function expandQuoteBomDisplayRows(rows) {
  const sourceRows = Array.isArray(rows) ? rows : []
  return sourceRows.flatMap((sourceRow, sourceIndex) => {
    const components = Array.isArray(sourceRow?.rollupComponents)
      ? sourceRow.rollupComponents.filter(Boolean)
      : []
    const sourceKey = firstText(sourceRow?.id, `index-${sourceIndex}`)
    if (components.length === 0) {
      return [{
        ...sourceRow,
        displayKey: `bom-${sourceKey}`,
        sourceRow,
        rollupDisplay: false,
        rollupDisplayIndex: 0,
      }]
    }
    return components.map((component, componentIndex) => ({
      ...sourceRow,
      displayKey: `bom-${sourceKey}-rollup-${firstText(component.childCode, componentIndex)}-${componentIndex}`,
      sourceRow,
      childCode: parentChildDisplay(sourceRow.childCode, component.childCode),
      childName: parentChildDisplay(
        firstText(sourceRow.childName, sourceRow.childCode, '父件'),
        firstText(component.childName, component.childCode, '上卷子件'),
      ),
      childSpec: parentChildDisplay(
        firstText(component.parentSpec, sourceRow.childSpec),
        component.childSpec,
      ),
      childModel: parentChildDisplay(
        firstText(component.parentModel, sourceRow.childModel),
        component.childModel,
      ),
      usageQty: component.usageQty ?? sourceRow.usageQty,
      qtyPerTop: component.qtyPerTop ?? sourceRow.qtyPerTop,
      unit: parentChildDisplay(
        firstText(component.parentUnit, sourceRow.unit),
        component.childUnit,
      ),
      materialAttribute: parentChildDisplay(
        firstText(component.parentMaterialAttribute, sourceRow.materialAttribute),
        component.childMaterialAttribute,
      ),
      shapeAttribute: parentChildDisplay(
        firstText(component.parentShapeAttribute, sourceRow.shapeAttribute),
        component.childShapeAttribute,
      ),
      rollupDisplay: true,
      rollupDisplayIndex: componentIndex,
      rollupDisplayCount: components.length,
    }))
  })
}
