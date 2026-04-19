import { request } from '../http'

export const listDepts = () =>
  request('/api/v1/system/dept')

export const getDept = (id) =>
  request(`/api/v1/system/dept/${id}`)

export const createDept = (data) =>
  request('/api/v1/system/dept', { method: 'POST', body: data })

export const updateDept = (id, data) =>
  request(`/api/v1/system/dept/${id}`, { method: 'PUT', body: data })

export const deleteDept = (id) =>
  request(`/api/v1/system/dept/${id}`, { method: 'DELETE' })

export const getDeptTreeSelect = () =>
  request('/api/v1/system/dept/tree-select')
