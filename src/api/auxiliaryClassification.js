import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
const path = (oaNo, itemId) => `/api/v1/quote-requests/${encodeURIComponent(oaNo)}/items/${itemId}/auxiliary-classification`
export const fetchAuxiliaryClassifications = oaNo => request(`/api/v1/quote-requests/${encodeURIComponent(oaNo)}/auxiliary-classifications`)
export const fetchAuxiliaryClassification = (oaNo, itemId, accountingMonth) => request(path(oaNo, itemId), { params: { accountingMonth } })
export const downloadAuxiliaryClassification = (oaNo, itemId, accountingMonth) => downloadAuthenticatedBlob(`${path(oaNo,itemId)}/export?accountingMonth=${encodeURIComponent(accountingMonth)}`, `辅料归类_${itemId}_${accountingMonth}.xlsx`)
const upload = (oaNo,itemId,month,file,action,fingerprint) => {
  const body = new FormData()
  body.append('file',file)
  body.append('accountingMonth',month)
  if (fingerprint) body.append('previewFingerprint',fingerprint)
  return request(`${path(oaNo,itemId)}/${action}`, { method: 'POST', body })
}
export const previewAuxiliaryClassification = (oaNo,itemId,month,file) => upload(oaNo,itemId,month,file,'preview')
export const confirmAuxiliaryClassification = (oaNo,itemId,month,file,fingerprint) => upload(oaNo,itemId,month,file,'confirm',fingerprint)
