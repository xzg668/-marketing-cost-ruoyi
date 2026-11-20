import { request } from './http'

const base = '/api/v1/oem-product-configs'
export const listOemProducts = () => request(base)
export const createOemProduct = (body) => request(base, { method: 'POST', body })
export const updateOemProduct = (id, body) => request(`${base}/${id}`, { method: 'PUT', body })
export const deleteOemProduct = (id, revision) => request(`${base}/${id}`, { method: 'DELETE', params: { revision } })
