import { request } from './http'

// BOM 数据页（/base/material）相关的 API 封装
// 查询走 /bom-manage，只读消费报价上下文产生的 lp_bom_costing_row；
// “计算”按钮走 /bom/flatten，不提供源 BOM 导入或重建能力。

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
