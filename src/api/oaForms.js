import { request } from './http'

export const fetchOaForms = (params) => request('/api/v1/oa-forms', { params })

export const fetchOaFormDetail = (oaNo) => {
  const encodedNo = encodeURIComponent(String(oaNo || '').trim())
  return request(`/api/v1/oa-forms/${encodedNo}`)
}
