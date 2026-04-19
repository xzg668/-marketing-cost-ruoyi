import { request } from './http'

export const fetchCostRunDetail = (oaNo, productCode) =>
  request('/api/v1/cost-run/detail', { params: { oaNo, productCode } })
