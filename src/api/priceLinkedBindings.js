import { request } from './http'

/**
 * 行局部变量绑定 API —— 对接后端 {@code PriceVariableBindingController}（T3 落地）。
 *
 * <p>路由前缀：{@code /api/v1/price-linked/bindings}
 *
 * <ul>
 *   <li>{@link fetchBindings}    —— 取某联动行当前生效的绑定列表（expiry_date IS NULL）</li>
 *   <li>{@link fetchHistory}     —— 取某 token 的历史版本时间线（按 effective_date DESC）</li>
 *   <li>{@link saveBinding}      —— 新增 / 同 effective_date UPDATE / 更晚 effective_date 版本切换</li>
 *   <li>{@link deleteBinding}    —— 软删（deleted=1），历史仍可查</li>
 *   <li>{@link fetchPending}     —— 待绑定列表（公式含 B 组 token 但无当前绑定）</li>
 *   <li>{@link importBindings}   —— CSV 批量导入，multipart/form-data，字段名 file</li>
 * </ul>
 *
 * <p>权限：读接口 {@code price:linked:binding:view}；写接口 {@code price:linked:binding:admin}。
 * 读接口在 ROLE_VIEWER 用户下也能拉到数据；写接口会被后端 403 拒绝。
 */

/** 当前生效列表 —— 只返回 expiry_date IS NULL 且 deleted=0 的绑定 */
export const fetchBindings = (linkedItemId) =>
  request('/api/v1/price-linked/bindings', { params: { linkedItemId } })

/** 某 token 的历史版本时间线（含过期 / 当前），按 effective_date DESC */
export const fetchHistory = (linkedItemId, tokenName) =>
  request('/api/v1/price-linked/bindings/history', {
    params: { linkedItemId, tokenName },
  })

/**
 * 写入绑定 —— body 对齐后端 {@code PriceVariableBindingRequest}：
 * {linkedItemId, tokenName, factorCode, priceSource?, buScoped?, effectiveDate?, source?, remark?}
 *
 * <p>后端三态语义：
 * <ul>
 *   <li>(linkedItemId, tokenName, effectiveDate) 全相同 → UPDATE 原行</li>
 *   <li>effectiveDate 晚于当前生效版本 → 旧行 expiry=new-1d + INSERT 新行</li>
 *   <li>effectiveDate 早于当前生效版本 → 400，不允许倒挂</li>
 * </ul>
 */
export const saveBinding = (body) =>
  request('/api/v1/price-linked/bindings', { method: 'POST', body })

/** 软删 —— 置 deleted=1，list 不再返回，但 history 仍可查 */
export const deleteBinding = (id) =>
  request(`/api/v1/price-linked/bindings/${id}`, { method: 'DELETE' })

/** 待绑定列表（公式含 B 组 token 但无当前绑定）—— 顶部徽章 + 过滤联动用 */
export const fetchPending = () =>
  request('/api/v1/price-linked/bindings/pending')

/**
 * CSV 批量导入 —— multipart/form-data，字段名固定为 {@code file}。
 * 编码 UTF-8（BOM 可选），首行表头，列顺序固定（见 CSV 模板：物料编码,规格型号,token名,factor_code,价源,生效日期,备注）。
 *
 * @param {File|Blob} file 前端上传文件
 * @returns {Promise<{total,inserted,updated,expired,errors:[{line,materialCode,specModel,reason}]}>}
 */
export const importBindings = (file) => {
  const form = new FormData()
  form.append('file', file)
  return request('/api/v1/price-linked/bindings/import', {
    method: 'POST',
    body: form,
  })
}
