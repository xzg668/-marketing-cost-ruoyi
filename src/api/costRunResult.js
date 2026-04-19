import { request } from './http'

export const fetchCostRunResult = (oaNo, productCode) =>
  request('/api/v1/cost-run/result', { params: { oaNo, productCode } })
