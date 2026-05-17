export const SOURCE_TYPE_OPTIONS = [
  { value: 'OA', label: 'OA' },
  { value: 'EXCEL', label: 'Excel' },
  { value: 'MANUAL', label: '人工录入' },
  { value: 'TECH', label: '技术补充' },
]

export function normalizeQuoteIngestLogPage(data) {
  return {
    list: Array.isArray(data?.list) ? data.list : [],
    total: Number(data?.total || 0),
  }
}

export function prettyJsonText(value) {
  if (value == null || value === '') return '-'
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  const text = String(value)
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function hasLogFailure(row) {
  return ['REJECTED', 'FAILED'].includes(row?.ingestStatus) || Boolean(row?.errorMessage)
}

export function hasLogDiagnostics(detail) {
  return Boolean(
    detail?.validationErrors ||
      detail?.warningMessages ||
      detail?.errorMessage
  )
}
