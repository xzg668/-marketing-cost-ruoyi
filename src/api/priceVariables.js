import { request } from './http'

/**
 * 价格变量查询与 CRUD —— 对接后端 {@code PriceVariableController}。
 *
 * <p>路由前缀：{@code /api/v1/price-linked/variables}
 *
 * <ul>
 *   <li>{@link fetchPriceVariables} —— 列表（管理页用，可按 status 过滤）</li>
 *   <li>{@link fetchCatalog} —— 三分组目录（公式编辑器 `@` 唤起）</li>
 *   <li>{@link fetchPriceVariableById} —— 编辑态初始化</li>
 *   <li>{@link createPriceVariable}/{@link updatePriceVariable}/{@link deletePriceVariable} —— 运维 CRUD</li>
 * </ul>
 */

/** 平铺列表 —— 管理页。可传 {status: 'active'|'inactive'}。 */
export const fetchPriceVariables = (params) =>
  request('/api/v1/price-linked/variables', { params })

/**
 * T19：三组变量目录（FinanceFactor / PartContext / FormulaRef）—— 供公式编辑器 `@` 唤起时用。
 * 对应后端 GET /api/v1/price-linked/variables/catalog（T15）。
 */
export const fetchCatalog = () =>
  request('/api/v1/price-linked/variables/catalog')

/** 单条详情 —— 编辑对话框打开时用，返回原始 entity（含原始 resolver_params JSON 字符串）。 */
export const fetchPriceVariableById = (id) =>
  request(`/api/v1/price-linked/variables/${id}`)

/**
 * 新增 —— body 严格对齐后端 PriceVariableRequest：
 * {variableCode, variableName, aliasesJson, factorType, resolverKind, resolverParams, ...}
 */
export const createPriceVariable = (body) =>
  request('/api/v1/price-linked/variables', { method: 'POST', body })

/** 更新 —— variableCode 不可改，后端会 400 拒。 */
export const updatePriceVariable = (id, body) =>
  request(`/api/v1/price-linked/variables/${id}`, { method: 'PUT', body })

/** 软删 —— 置 status=inactive。 */
export const deletePriceVariable = (id) =>
  request(`/api/v1/price-linked/variables/${id}`, { method: 'DELETE' })

/**
 * V36：行局部占位符视图 —— 前端构造中英文映射的权威数据源。
 * 返回 [{code, displayName, tokenNames}]；通常和 fetchPriceVariables 一起调，
 * 把两者喂给 utils/formula.js 的 buildFormulaIndex() 得到运行时索引。
 */
export const fetchRowLocalPlaceholders = () =>
  request('/api/v1/price-linked/row-local-placeholders')
