import { request } from '../http'

export const listRoles = () =>
  request('/api/v1/system/role')

export const getRole = (id) =>
  request(`/api/v1/system/role/${id}`)

export const createRole = (data) =>
  request('/api/v1/system/role', { method: 'POST', body: data })

export const updateRole = (id, data) =>
  request(`/api/v1/system/role/${id}`, { method: 'PUT', body: data })

export const deleteRole = (id) =>
  request(`/api/v1/system/role/${id}`, { method: 'DELETE' })

export const assignMenus = (id, data) =>
  request(`/api/v1/system/role/${id}/menus`, { method: 'PUT', body: data })

export const getRoleMenuIds = (id) =>
  request(`/api/v1/system/role/${id}/menus`)

export const getMenuTreeSelect = () =>
  request('/api/v1/system/menu/tree-select')
