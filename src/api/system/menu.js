import { request } from '../http'

export const listMenus = () =>
  request('/api/v1/system/menu')

export const getMenu = (id) =>
  request(`/api/v1/system/menu/${id}`)

export const createMenu = (data) =>
  request('/api/v1/system/menu', { method: 'POST', body: data })

export const updateMenu = (id, data) =>
  request(`/api/v1/system/menu/${id}`, { method: 'PUT', body: data })

export const deleteMenu = (id) =>
  request(`/api/v1/system/menu/${id}`, { method: 'DELETE' })

export const getMenuTreeSelect = () =>
  request('/api/v1/system/menu/tree-select')
