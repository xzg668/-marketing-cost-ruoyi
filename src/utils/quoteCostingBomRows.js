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
 * 每条展示行仍指向同一条父件结算行：品名、料号、图号都按“父件\n【子件】”显示；
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
      childModel: parentChildDisplay(
        firstText(component.parentDrawingNo, sourceRow.childModel),
        component.childDrawingNo,
      ),
      usageQty: component.usageQty ?? sourceRow.usageQty,
      qtyPerTop: component.qtyPerTop ?? sourceRow.qtyPerTop,
      unit: firstText(component.unit, sourceRow.unit),
      materialAttribute: sourceRow.materialAttribute || '',
      shapeAttribute: sourceRow.shapeAttribute || '',
      rollupDisplay: true,
      rollupDisplayIndex: componentIndex,
      rollupDisplayCount: components.length,
    }))
  })
}
