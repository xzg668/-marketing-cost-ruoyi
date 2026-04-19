/**
 * 岗位管理 API
 */
import { request } from '../http'

/** 分页查询岗位列表 */
export const listPosts = (params) =>
  request('/api/v1/system/post', { params })

/** 查询所有岗位（下拉用） */
export const listAllPosts = () =>
  request('/api/v1/system/post/all')

/** 查询岗位详情 */
export const getPost = (id) =>
  request(`/api/v1/system/post/${id}`)

/** 新增岗位 */
export const createPost = (data) =>
  request('/api/v1/system/post', { method: 'POST', body: data })

/** 修改岗位 */
export const updatePost = (id, data) =>
  request(`/api/v1/system/post/${id}`, { method: 'PUT', body: data })

/** 删除岗位 */
export const deletePost = (id) =>
  request(`/api/v1/system/post/${id}`, { method: 'DELETE' })
