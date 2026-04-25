import { request } from './http'

// BOM 数据页（/base/material）相关的 API 封装
// 查询走老的 /bom-manage 接口（T5.5 时底层已切到 lp_bom_costing_row）；
// "计算"按钮走新的 /bom/flatten 接口（T7.5 修复）—— 老 /bom-manage/refresh 已降级为 no-op。

export const fetchBomManageItems = (params) =>
  request('/api/v1/bom-manage', { params })

export const fetchBomManageItemDetails = (params) =>
  request('/api/v1/bom-manage/details', { params })

/**
 * T7.5：按 OA + 顶层料号触发 BOM 计算（Flatten）。
 *
 * 单次调用只处理一个 topProductCode；前端遇到"一个 OA 下多个产品"的场景时
 * 自行循环调用本函数。后端拍平能力参见 BomFlattenController。
 *
 * @param {object} body { oaNo, topProductCode, bomPurpose?, asOfDate?(YYYY-MM-DD) }
 * @returns {Promise<{costingRowsWritten:number, subtreeRequiredCount:number, warnings:string[]}>}
 */
export const flattenBomForOa = (body) =>
  request('/api/v1/bom/flatten', {
    method: 'POST',
    body: {
      mode: 'BY_OA',
      oaNo: body.oaNo,
      topProductCode: body.topProductCode,
      bomPurpose: body.bomPurpose || null,
      asOfDate: body.asOfDate || new Date().toISOString().slice(0, 10),
    },
  })

/**
 * 兼容旧签名：保留 refreshBomManageItems 函数名不破坏可能的其他引用，
 * 但内部只是转发到新的 flattenBomForOa（语义已变 —— 老 /refresh 端点是 no-op）。
 *
 * 如果外部已经用了这个函数，需要同步改调用方式：以前传
 * `{oaNo, bomCode}`，现在需要传 `{oaNo, topProductCode}`。
 *
 * @deprecated 请改用 flattenBomForOa
 */
export const refreshBomManageItems = (body) => flattenBomForOa(body)
