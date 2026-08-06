function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

/**
 * 上卷父件按命中子件拆成见机表展示行。
 *
 * 每条展示行仍指向同一条父件结算行：料号、图号取父件，品名显示“父件-子件”；
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
      // 上卷展示仍使用父件料号、父件图号，只把品名按命中子件区分。
      childCode: sourceRow.childCode,
      childName: `${firstText(sourceRow.childName, sourceRow.childCode, '父件')}-${firstText(component.childName, component.childCode, '上卷子件')}`,
      childModel: firstText(component.parentDrawingNo, sourceRow.childModel),
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
