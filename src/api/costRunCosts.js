import { request } from './http'

export const fetchCostRunCostItems = (oaNo, productCode) =>
  request('/api/v1/cost-run/cost-items/result', { params: { oaNo, productCode } })
