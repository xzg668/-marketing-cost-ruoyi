import { request } from './http'

export const runCostTrial = (oaNo) =>
  request('/api/v1/cost-run/trial', {
    method: 'POST',
    body: { oaNo },
  })

export const fetchCostRunProgress = (oaNo) =>
  request('/api/v1/cost-run/progress', {
    params: { oaNo },
  })
