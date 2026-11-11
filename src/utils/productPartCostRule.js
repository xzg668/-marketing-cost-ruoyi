import { ratePercent } from './jjbSheet.js'

export const partCostFields = Object.freeze([
  ['productCode', '成品料号'], ['productName', '成品名称'], ['productSpec', '成品规格'],
  ['productModel', '成品型号'], ['partCode', '零件料号'], ['partName', '零件名称'], ['partModel', '零件型号'],
])

export const canMaintainPartCosts = (roles = []) => roles.some(role => ['admin', 'bu_director'].includes(String(role).toLowerCase()))
// The API rate has at most 12 decimal places; expand small JSON numbers before displaying/editing.
export const manufacturePercent = (rate) => rate == null ? '' : ratePercent(typeof rate === 'number' ? rate.toFixed(12) : String(rate)).replace(/%$/, '')

export function productPartCostPayload(form) {
  const payload = Object.fromEntries(partCostFields.map(([key]) => [key, String(form[key] || '').trim() || null]))
  if (!payload.productCode) throw new Error('请填写成品料号')
  if (!payload.partCode && !payload.partModel) throw new Error('零件料号、零件型号至少填写一项')
  if (!['采购件', '制造件'].includes(form.shape)) throw new Error('请选择零件形态属性')
  const match = /^(\d+)(?:\.(\d{1,10}))?$/.exec(String(form.manufacturePercent ?? '').trim())
  if (!match || BigInt(match[1]) >= 100n) throw new Error('零件制造费用率须为0至小于100的百分数，最多10位小数')
  // Decimal-point shift, without floating-point rounding of a business rate.
  const digits = match[1].replace(/^0+(?=\d)/, '').padStart(2, '0')
  const rate = `0.${digits}${match[2] || ''}`.replace(/0+$/, '').replace(/\.$/, '')
  return { ...payload, shape: form.shape, manufactureRate: rate, revision: form.revision ?? null }
}
