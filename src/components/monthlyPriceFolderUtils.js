export function folderPath(file) {
  const path = file.webkitRelativePath || file.name
  return file.webkitRelativePath && path.includes('/') ? path.slice(path.indexOf('/') + 1) : path
}

export function canCompleteFolder(report) {
  return report && report.status !== 'COMPLETE' && report.summary.pendingFiles === 0 &&
    report.summary.errorRows === 0 && report.groups.every(group => ['IMPORTED', 'PREPARED'].includes(group.status))
}

export function folderReceiptRows(report) {
  const rows = []
  for (const group of report.groups || []) {
    const seen = new Set()
    for (const candidate of group.candidates.filter(candidate => candidate.fileId != null)) {
      const stored = group.candidates.find(row => row.fileId == null && row.signature === candidate.signature)
      let status = stored?.sourceState === 'PUBLISHED' ? '已采用' : stored ? '待整体生效' : '待处理'
      if (seen.has(candidate.signature)) status = '重复合并'
      seen.add(candidate.signature)
      rows.push([candidate.fileName, candidate.sheet, candidate.row, candidate.identity.orgCode,
        candidate.identity.materialCode, candidate.identity.supplierCode || candidate.identity.supplierName,
        candidate.kind === 'LINKED' ? '联动价' : '区间价', status, candidate.formula])
    }
  }
  for (const file of report.files || []) {
    for (const note of file.notices || []) rows.push([file.path, note.sheet, note.row, '', note.materialCode, '', '',
      note.code === 'NO_PRICE' ? '无价跳过' : '识别提示', note.message])
    for (const error of file.errors || []) rows.push([file.path, error.sheet, error.row, '', error.materialCode, '', '', '待处理', error.message])
    if (file.kind === 'REFERENCE' || file.rowCount < 0) rows.push([file.path, '', '', '', '', '', '',
      file.kind === 'REFERENCE' ? '参考资料跳过' : '未读取', file.message])
  }
  for (const carried of report.completion?.carried || []) rows.push([`沿用${carried.sourceMonth}规则`, '', '', carried.identity.orgCode,
    carried.identity.materialCode, carried.identity.supplierCode || carried.identity.supplierName,
    carried.kind === 'LINKED' ? '联动价' : '区间价', '上月补齐', `来源规则${carried.sourceId}，本月规则${carried.targetId}`])
  return rows
}

export function folderReceiptCsv(report) {
  const cell = value => {
    let text = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\ufeff' + [['文件', '工作表', '行号', '组织', '料号', '供应商', '价格类型', '处理结果', '依据或原因'],
    ...folderReceiptRows(report)].map(row => row.map(cell).join(',')).join('\r\n')
}
