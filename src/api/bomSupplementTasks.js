import { request } from './http.js'

const BASE_URL = '/api/v1/bom-supplement/tasks'

export const TASK_STATUS_LABELS = {
  TODO_PENDING: '待推送',
  TODO_PUSHED: '已推送',
  IN_PROGRESS: '技术处理中',
  FINANCE_REVIEW: '财务审核',
  APPROVED: '已确认',
}

export const REVIEW_STATUS_LABELS = {
  NOT_SUBMITTED: '未提交',
  PENDING: '待审核',
  APPROVED: '已通过',
  RETURNED: '已退回',
}

export const SOURCE_TYPE_LABELS = {
  FORMAL_BODY_BOM: '正式本体 BOM',
  TECH_SUPPLEMENT_BODY: '技术补录 BOM',
  PACKAGE_REFERENCE: '包装参考',
}

export function fetchBomSupplementTasks(params) {
  return request(BASE_URL, { params })
}

export function fetchBomSupplementTaskDetail(taskId) {
  return request(`${BASE_URL}/${taskId}`)
}

export function reviewBomSupplementTask(taskId, body) {
  return request(`${BASE_URL}/${taskId}/review`, { method: 'POST', body })
}

export function returnBomSupplementTask(taskId, body) {
  return request(`${BASE_URL}/${taskId}/return`, { method: 'POST', body })
}

export function labelForTaskStatus(status) {
  return TASK_STATUS_LABELS[status] || status || '-'
}

export function labelForReviewStatus(status) {
  return REVIEW_STATUS_LABELS[status] || status || '-'
}

export function labelForSourceType(sourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType || '-'
}

export function statusTagType(status) {
  if (status === 'APPROVED') return 'success'
  if (status === 'FINANCE_REVIEW' || status === 'PENDING') return 'warning'
  if (status === 'RETURNED') return 'danger'
  return 'info'
}

export function normalizeTaskQueryResponse(raw) {
  return {
    total: Number(raw?.total || 0),
    rows: Array.isArray(raw?.rows) ? raw.rows : [],
  }
}
