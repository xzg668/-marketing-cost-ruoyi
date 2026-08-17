// EasyData BOM 的只读消费与报价上下文处理 API。
// 对接后端 Controller:
//   BomHierarchyController    GET /api/v1/bom/hierarchy/{topProductCode}
//   BomFlattenController      POST /api/v1/bom/flatten
//   BomSettlementRuleController GET/POST/PUT/DELETE /api/v1/bom/settlement-rules, POST /{id}/toggle
//
// 所有响应都经过 http.request() 的 CommonResult 解包，调用方直接拿到 data；
// 业务错误 / HTTP 错误由 errorHandler 统一弹 toast 并 throw Error。
import { request } from './http'

/**
 * 按顶层料号查询 EasyData 已准备好的嵌套树。
 *
 * @param {string} topProductCode 顶层产品料号
 * @param {object} query { bomPurpose?, asOfDate?(YYYY-MM-DD), sourceType?='U9' }
 */
export const getBomHierarchy = (topProductCode, query = {}) =>
  request(`/api/v1/bom/hierarchy/${encodeURIComponent(topProductCode)}`, {
    params: query,
  })

// ===== 报价上下文处理 =====

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
