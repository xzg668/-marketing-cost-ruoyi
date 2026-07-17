import { request } from './http'

const BASE_PATH = '/api/v1/finance-quote-base-prices/cu'

/** 列表只传月份范围；业务单元始终由后端登录上下文确定。 */
export const fetchFinanceCuBasePrices = (params) =>
  request(BASE_PATH, { params })

/**
 * 页面口径固定为元/吨。这里只做字段映射，不做除以1000换算，
 * 元/公斤换算必须由后端统一完成。
 */
export const buildFinanceCuInitializePayload = ({ monthFrom, monthTo, pricePerTon }) => ({
  startMonth: monthFrom,
  endMonth: monthTo,
  pricePerTon,
})

export const initializeFinanceCuBasePrices = (form) =>
  request(`${BASE_PATH}/initialize`, {
    method: 'POST',
    body: buildFinanceCuInitializePayload(form),
  })

export const buildFinanceCuAdjustPayload = ({ pricePerTon, changeReason }) => ({
  pricePerTon,
  changeReason: String(changeReason || '').trim(),
})

export const adjustFinanceCuBasePrice = (id, form) =>
  request(`${BASE_PATH}/${id}`, {
    method: 'PUT',
    body: buildFinanceCuAdjustPayload(form),
  })
