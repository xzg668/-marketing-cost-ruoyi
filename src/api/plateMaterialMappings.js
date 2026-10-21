import { request } from './http'

const base = '/api/v1/plate-material-mappings'
export const fetchPlateMaterialMappings = (params) => request(base, { params })
export const fetchPlateMaterialOptions = () => request(`${base}/options`)
export const createPlateMaterialMapping = (body) => request(base, { method: 'POST', body, suppressErrorToast: true })
export const updatePlateMaterialMapping = (id, body) => request(`${base}/${id}`, { method: 'PUT', body, suppressErrorToast: true })

function upload(file, fingerprint) {
  const body = new FormData()
  body.append('file', file)
  if (fingerprint) body.append('fingerprint', fingerprint)
  return body
}
export const previewPlateMaterialImport = (file) =>
  request(`${base}/import-preview`, { method: 'POST', body: upload(file), suppressErrorToast: true })
export const confirmPlateMaterialImport = (file, fingerprint) =>
  request(`${base}/import-confirm`, { method: 'POST', body: upload(file, fingerprint), suppressErrorToast: true })
