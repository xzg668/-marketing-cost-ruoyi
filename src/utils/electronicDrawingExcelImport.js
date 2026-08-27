const MAX_FILE_BYTES = 10 * 1024 * 1024

export function validateElectronicDrawingExcelFile(file) {
  if (!file) return '请选择电子图库下载的 .xlsx 文件'
  if (!String(file.name || '').toLowerCase().endsWith('.xlsx')) {
    return '请选择电子图库下载的 .xlsx 文件'
  }
  if (Number(file.size || 0) > MAX_FILE_BYTES) {
    return '电子图库 Excel 不能超过 10 MB'
  }
  return ''
}

export function pendingElectronicDrawingMappings(mappings) {
  return (mappings || []).filter(row => ['UNMATCHED', 'AMBIGUOUS'].includes(row?.status))
}

export function buildElectronicDrawingMappingSelections(mappings, selections) {
  return pendingElectronicDrawingMappings(mappings)
    .filter(row => String(selections?.[row.nodeId] || '').trim())
    .map(row => ({ nodeId: row.nodeId, materialCode: String(selections[row.nodeId]).trim() }))
}

export function mergeElectronicDrawingMaterialOptions(...groups) {
  const values = new Map()
  groups.flat().forEach(option => {
    if (option?.materialCode) values.set(option.materialCode, option)
  })
  return [...values.values()]
}
