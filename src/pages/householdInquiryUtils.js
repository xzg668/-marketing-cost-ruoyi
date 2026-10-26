/** Source amounts stay decimal strings through preview, history and display. */
export function inquiryDecimal(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error('询价金额格式异常，请刷新后重试')
  return value
}
export function inquiryPercent(value) {
  const decimal = inquiryDecimal(value)
  if (!decimal) return ''
  const [integer, fraction = ''] = decimal.split('.')
  const padded = fraction.padEnd(2, '0')
  const whole = (integer + padded.slice(0, 2)).replace(/^0+(?=\d)/, '')
  const tail = padded.slice(2).replace(/0+$/, '')
  return `${whole}${tail ? `.${tail}` : ''}%`
}
export function inquiryMetadata(input) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input?.sourceMonth || '') || input.sourceMonth.startsWith('0000')) throw new Error('请明确选择来源年月，文件月份不代表核算月份')
  const unit = String(input.unit || '').trim(), currency = String(input.currency || '').trim().toUpperCase()
  if (!unit || unit.length > 255) throw new Error('请填写财务确认的来源计价单位')
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('请填写来源币种，如 CNY')
  if (!['EXCLUDED', 'INCLUDED'].includes(input.taxBasis)) throw new Error('请选择来源含税口径')
  return { sourceMonth: input.sourceMonth, priceContext: { unit, currency, taxBasis: input.taxBasis } }
}
export function inquiryPublishIdentity(preview) {
  if (!preview || ![preview.previewId, preview.publishRequestId].every(v => typeof v === 'string' && v.length > 0 && v.length <= 64) || !/^[a-f0-9]{64}$/.test(preview.previewFingerprint || '')) throw new Error('预览标识不完整，请重新预览')
  return Object.freeze({ previewId: preview.previewId, publishRequestId: preview.publishRequestId, previewFingerprint: preview.previewFingerprint })
}
export function inquiryScope(user) {
  if (typeof user?.userId === 'number' && !Number.isSafeInteger(user.userId)) throw new Error('账号标识无法可靠读取，请重新登录')
  if (!user || !/^[1-9]\d{0,18}$/.test(String(user.userId || '')) || !user.username || !['COMMERCIAL', 'HOUSEHOLD'].includes(user.businessUnitType)) throw new Error('请使用有效账号并选择业务单元')
  return JSON.stringify([String(user.userId), user.username, user.businessUnitType])
}
export function inquiryPreviewForm(file, metadata) {
  if (!file || !file.size || file.size > 10 * 1024 * 1024 || !/\.xlsx?$/i.test(file.name || '')) throw new Error('请上传非空且不超过10 MB的xls或xlsx文件')
  const input = inquiryMetadata(metadata), body = new FormData()
  body.append('file', file)
  body.append('sourceMonth', input.sourceMonth)
  body.append('priceContext', new Blob([JSON.stringify(input.priceContext)], { type: 'application/json' }))
  return body
}
export const inquiryActionLabel = action => ({ CREATE: '新建来源', NEW_VERSION: '新建版本', UNCHANGED: '同值保留版本' }[action] || action)
export const inquiryTaxLabel = value => ({ EXCLUDED: '不含税', INCLUDED: '含税' }[value] || '未提供')
export const inquiryMessage = error => String(error?.message || '操作失败，请重试').replace(/^[A-Z_]+:\s*/, '')
