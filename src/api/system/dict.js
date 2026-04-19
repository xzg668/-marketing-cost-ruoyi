/**
 * 字典管理 API
 */
import { request } from '../http'

// ==================== 字典类型 ====================

/** 分页查询字典类型 */
export const listDictTypes = (params) =>
  request('/api/v1/system/dict-type', { params })

/** 查询所有字典类型（下拉用） */
export const listAllDictTypes = () =>
  request('/api/v1/system/dict-type/all')

/** 查询字典类型详情 */
export const getDictType = (id) =>
  request(`/api/v1/system/dict-type/${id}`)

/** 新增字典类型 */
export const createDictType = (data) =>
  request('/api/v1/system/dict-type', { method: 'POST', body: data })

/** 修改字典类型 */
export const updateDictType = (id, data) =>
  request(`/api/v1/system/dict-type/${id}`, { method: 'PUT', body: data })

/** 删除字典类型 */
export const deleteDictType = (id) =>
  request(`/api/v1/system/dict-type/${id}`, { method: 'DELETE' })

// ==================== 字典数据 ====================

/** 按字典类型拉取字典项（无需登录） */
export const fetchDictDataByType = (dictType) =>
  request(`/api/v1/system/dict-data/type/${encodeURIComponent(dictType)}`)

/** 分页查询字典数据 */
export const listDictData = (params) =>
  request('/api/v1/system/dict-data', { params })

/** 查询字典数据详情 */
export const getDictData = (id) =>
  request(`/api/v1/system/dict-data/${id}`)

/** 新增字典数据 */
export const createDictData = (data) =>
  request('/api/v1/system/dict-data', { method: 'POST', body: data })

/** 修改字典数据 */
export const updateDictData = (id, data) =>
  request(`/api/v1/system/dict-data/${id}`, { method: 'PUT', body: data })

/** 删除字典数据 */
export const deleteDictData = (id) =>
  request(`/api/v1/system/dict-data/${id}`, { method: 'DELETE' })
