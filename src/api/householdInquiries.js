import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
import { inquiryPreviewForm, inquiryPublishIdentity } from '../pages/householdInquiryUtils'

const base = '/api/v1/household-inquiries'
const quiet = { suppressErrorToast: true }
export const fetchHouseholdInquiries = params => request(base, { ...quiet, params })
export const fetchHouseholdInquiry = id => request(`${base}/${id}`, quiet)
export const fetchHouseholdHistory = params => request(`${base}/history`, { ...quiet, params })
export const fetchHouseholdFinancial = id => request(`${base}/${id}/financial-reference`, quiet)
export const fetchHouseholdImport = id => request(`${base}/imports/${id}`, quiet)
export const downloadHouseholdOriginal = (id, filename = '家用询价原件.xls', options) => downloadAuthenticatedBlob(`${base}/${id}/original`, filename, options)
export const downloadHouseholdImportOriginal = (id, filename = '家用询价原件.xls', options) => downloadAuthenticatedBlob(`${base}/imports/${id}/original`, filename, options)
export const householdImportApi = {
  preview: (file, metadata) => request(`${base}/import-preview`, { ...quiet, method: 'POST', body: inquiryPreviewForm(file, metadata) }),
  publish: identity => request(`${base}/import-publish`, { ...quiet, method: 'POST', body: inquiryPublishIdentity(identity) }),
  readPreview: id => request(`${base}/import-previews/${encodeURIComponent(id)}`, quiet),
  cancel: id => request(`${base}/import-previews/${encodeURIComponent(id)}/cancel`, { ...quiet, method: 'POST' }),
}
