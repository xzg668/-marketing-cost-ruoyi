// BOM 三层架构前端 API 封装（T6）
// 对接后端 Controller:
//   BomImportController       POST /api/v1/bom/import, GET /api/v1/bom/batches
//   BomHierarchyController    POST /api/v1/bom/build-hierarchy, GET /api/v1/bom/hierarchy/{topProductCode}
//   BomFlattenController      POST /api/v1/bom/flatten
//   BomSettlementRuleController GET/POST/PUT/DELETE /api/v1/bom/settlement-rules, POST /{id}/toggle
//
// 所有响应都经过 http.request() 的 CommonResult 解包，调用方直接拿到 data；
// 业务错误 / HTTP 错误由 errorHandler 统一弹 toast 并 throw Error。
import axios from 'axios'
import { request } from './http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ===== 阶段 A：Excel 导入 =====

/**
 * 财务一键导入：上传 Excel 后后端自动做"导入 + 按 purpose 批量构建层级"两步。
 *
 * 和 {@link importBomExcel} 的区别：importBomExcel 只做阶段 A（原始数据入库），
 * 这个合成版会连带做完阶段 B（展开层级树）；财务界面默认用这个，不需要再手工点构建。
 *
 * 超时开到 60 分钟（导入 2 分钟 + 大批量 BOM 层级构建可能超过 15 分钟）。
 *
 * @param {File} file 浏览器 File 对象（来自 el-upload 的 raw）
 * @returns {Promise<{importResult, builds, totalRawRowsWritten, purposesBuilt, status, errorMessage}>}
 */
export const importAndBuildBom = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return axios
    .post(`${API_BASE_URL}/api/v1/bom/import-and-build`, formData, {
      headers,
      timeout: 60 * 60 * 1000,
    })
    .then((resp) => {
      const payload = resp.data
      if (payload && typeof payload.code === 'number') {
        if (payload.code !== 0) {
          throw new Error(payload.msg || 'BOM 一键导入失败')
        }
        return payload.data
      }
      return payload
    })
}

/**
 * 上传 U9 BOM Excel 到 lp_bom_u9_source（仅阶段 A，不做构建）。
 *
 * <p>后端用 EasyExcel 流式读 34 万行约需 2 分钟，默认 axios 60s 不够；
 * 这里单独 new 一个 axios 实例把超时开到 15 分钟，避开 http.js 的默认 timeout。
 *
 * <p>注：新的财务一键入口已改走 {@link importAndBuildBom}；本函数保留给 /admin 高级页面
 * （单独测试或重跑某一阶段）。
 *
 * @param {File} file 浏览器 File 对象（来自 el-upload 的 raw）
 * @returns {Promise<{importBatchId:string,sourceFileName:string,totalRows:number,successRows:number,errors:Array,importedAt:string}>}
 */
export const importBomExcel = (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  // 单独实例：15 分钟超时，不走 http.js 的 pending GET 去重逻辑（上传都是 POST）
  return axios
    .post(`${API_BASE_URL}/api/v1/bom/import`, formData, {
      headers,
      timeout: 15 * 60 * 1000,
    })
    .then((resp) => {
      // 和 http.js 保持一致的 CommonResult 解包
      const payload = resp.data
      if (payload && typeof payload.code === 'number') {
        if (payload.code !== 0) {
          throw new Error(payload.msg || 'BOM 导入失败')
        }
        return payload.data
      }
      return payload
    })
}

/**
 * 查导入批次历史（按时间倒序分页）。
 *
 * @param {string} layer U9_SOURCE / RAW_HIERARCHY / COSTING_ROW
 * @param {number} page 1-based
 * @param {number} size 每页条数
 */
export const listBomBatches = (layer, page = 1, size = 20) =>
  request('/api/v1/bom/batches', { params: { layer, page, size } })

// ===== 阶段 B：层级构建 =====

/**
 * 触发层级构建，把 u9_source 行按 parent_code 编织成 raw_hierarchy 树。
 *
 * @param {object} payload { importBatchId, bomPurpose?, mode: 'ALL'|'BY_PRODUCT', topProductCode? }
 */
export const buildBomHierarchy = (payload) =>
  request('/api/v1/bom/build-hierarchy', { method: 'POST', body: payload })

/**
 * 按顶层料号查嵌套树（T6 树查看器专用）。
 *
 * @param {string} topProductCode 顶层产品料号
 * @param {object} query { bomPurpose?, asOfDate?(YYYY-MM-DD), sourceType?='U9' }
 */
export const getBomHierarchy = (topProductCode, query = {}) =>
  request(`/api/v1/bom/hierarchy/${encodeURIComponent(topProductCode)}`, {
    params: query,
  })

// ===== 阶段 C：拍平 =====

/**
 * 触发拍平 —— 把 raw_hierarchy + 结算规则合成 lp_bom_costing_row。
 *
 * @param {object} payload { bomPurpose?, mode:'BY_OA'|'BY_PRODUCT'|'ALL', oaNo?, topProductCode?, asOfDate(YYYY-MM-DD)必填 }
 */
export const flattenBom = (payload) =>
  request('/api/v1/bom/flatten', { method: 'POST', body: payload })

// ===== BOM 结算规则 CRUD（lp_bom_settlement_rule）=====

export const listSettlementRules = (params = {}) =>
  request('/api/v1/bom/settlement-rules', { params })

export const createSettlementRule = (payload) =>
  request('/api/v1/bom/settlement-rules', { method: 'POST', body: payload })

export const updateSettlementRule = (id, payload) =>
  request(`/api/v1/bom/settlement-rules/${id}`, { method: 'PUT', body: payload })

export const deleteSettlementRule = (id) =>
  request(`/api/v1/bom/settlement-rules/${id}`, { method: 'DELETE' })

export const toggleSettlementRule = (id) =>
  request(`/api/v1/bom/settlement-rules/${id}/toggle`, { method: 'POST' })

export const listByproductCostRules = (params = {}) =>
  request('/api/v1/bom/byproduct-cost-rules', { params })

// ===== 字典查询（yudao 原生接口）=====

/**
 * 拉取某字典类型的全量条目，用于前端下拉候选值。
 * 复用 yudao 自带 `/api/v1/system/dict-data/type/{type}`。
 *
 * @param {string} dictType 字典类型，例如 'bom_material_category'
 * @returns {Promise<Array<{value:string,label:string}>>}
 */
export const fetchDictData = (dictType) =>
  request(`/api/v1/system/dict-data/type/${encodeURIComponent(dictType)}`)

export const SETTLEMENT_RULE_CATEGORY_OPTIONS = [
  { value: 'SPECIAL_PURCHASE_ROLLUP', label: '特殊采购分类上卷' },
  { value: 'AUXILIARY_EXCLUDE', label: '辅料排除' },
  { value: 'PACKAGE_STOP', label: '包装组件截断' },
  { value: 'OUTSOURCED_PROCESS_FEE', label: '委外加工费' },
]

export const SETTLEMENT_ACTION_OPTIONS = [
  { value: 'ROLLUP_TO_PARENT', label: '上卷父件结算' },
  { value: 'EXCLUDE', label: '排除结算行' },
  { value: 'STOP_AS_PACKAGE', label: '包装父件结算' },
  { value: 'ADD_PROCESS_FEE', label: '追加加工费行' },
]

export const SETTLEMENT_ROW_TYPE_OPTIONS = [
  { value: 'SPECIAL_ROLLUP_PARENT', label: '特殊采购上卷父件' },
  { value: 'PACKAGE_PARENT', label: '包装父件' },
  { value: 'OUTSOURCED_PROCESS_FEE', label: '委外加工费' },
  { value: 'DEFAULT_LEAF', label: '默认叶子' },
  { value: 'EXCLUDED', label: '排除' },
]

/** 构建层级 mode 选项 */
export const BUILD_MODE_OPTIONS = [
  { value: 'ALL', label: '全量（该批次所有顶层产品）' },
  { value: 'BY_PRODUCT', label: '按产品（指定 topProductCode）' },
]

/** 拍平 mode 选项 */
export const FLATTEN_MODE_OPTIONS = [
  { value: 'BY_OA', label: '按 OA 单（需填 oaNo）' },
  { value: 'BY_PRODUCT', label: '按产品（需填 topProductCode）' },
  { value: 'ALL', label: '全量（该 asOfDate 全部顶层）' },
]
