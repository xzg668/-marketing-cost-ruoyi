import { request } from './http'

const encodePath = (value) => encodeURIComponent(String(value || '').trim())

const toFileFormData = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

export const ingestQuoteRequest = (body) =>
  request('/api/v1/quote-ingest/requests', { method: 'POST', body })

export const previewQuoteExcel = (file) =>
  request('/api/v1/quote-ingest/excel/preview', {
    method: 'POST',
    body: toFileFormData(file),
  })

export const commitQuoteExcel = (file) =>
  request('/api/v1/quote-ingest/excel/commit', {
    method: 'POST',
    body: toFileFormData(file),
  })

export const fetchQuoteBomStatus = (oaNo) =>
  request('/api/v1/quote-ingest/bom-status', { params: { oaNo } })

export const checkQuoteBomStatus = (oaNo) =>
  request('/api/v1/quote-ingest/bom-status/check', {
    method: 'POST',
    body: { oaNo },
  })

export const batchSyncQuoteBomStatus = (oaFormItemIds) =>
  request('/api/v1/quote-ingest/bom-status/batch-sync', {
    method: 'POST',
    body: { oaFormItemIds },
  })

export const batchCreateBomSupplementOaTasks = (quoteBomStatusIds, options = {}) =>
  request('/api/v1/bom-supplement/tasks/batch-oa-task', {
    method: 'POST',
    body: {
      quoteBomStatusIds,
      dueAt: options.dueAt,
      remark: options.remark || 'OA报价单无BOM，请补录',
    },
  })

export const fetchQuoteIngestLogs = (params) =>
  request('/api/v1/quote-ingest/logs', { params })

export const fetchQuoteIngestLogDetail = (id) =>
  request(`/api/v1/quote-ingest/logs/${encodePath(id)}`)
