import { request } from './http'

export const fetchCostRunPartItems = (oaNo) =>
  request('/api/v1/cost-run/parts/result', { params: { oaNo } })
