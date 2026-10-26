import { request } from './http'

const base = '/api/v1/monthly-material-prices'
const quiet = { suppressErrorToast: true }
export const fetchMonthlyMaterialPrices = params => request(base, { ...quiet, params })
export const fetchMonthlyMaterialPrice = id => request(`${base}/${id}`, quiet)
export const fetchMonthlyMaterialReferences = ({ id, ...params }) => request(`${base}/${id}/references`, { ...quiet, params })
