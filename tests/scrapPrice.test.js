import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { displayPrice, importCanConfirm, scrapEditForm, scrapEditPayload, scrapFactorDetails } from '../src/pages/scrapPriceUtils.js'

const fixed = {
  id: 7, materialCode: '301990752', materialName: '废软磁不锈铁沫', unit: 'KG',
  supplierCode: null, supplierName: null, priceType: 'FIXED', fixedPrice: '2.628318584070800000',
  rowVersion: 8, factorBindingsJson: '{}',
}
const linked = {
  ...fixed, materialCode: '301990135', materialName: '废漆包线', priceType: 'LINKED', fixedPrice: null,
  expression: '[Cu]*0.9845/1.13', sourceFormula: '($M$1*0.9845)/1.13',
  factorBindingsJson: '{"Cu":"AVG|1#CU"}',
}

describe('废料维护的金额、规则和导入边界', () => {
  it('展示保留原金额精度，零与未取得价格不同', () => {
    assert.equal(displayPrice(fixed.fixedPrice), '2.6283185840708')
    assert.equal(displayPrice('0.000000000000000001'), '0.000000000000000001')
    assert.equal(displayPrice('0.000000000000000000'), '0')
    assert.equal(displayPrice(null), '—')
  })
  it('固定价原样编辑不转浮点，身份和修订取已加载记录，空供应商保持空', () => {
    const form = scrapEditForm(fixed)
    form.materialCode = 'unexpected'
    const request = scrapEditPayload(fixed, form)
    assert.equal(request.expectedVersion, 8)
    assert.equal(request.rule.materialCode, fixed.materialCode)
    assert.equal(request.rule.fixedPrice, fixed.fixedPrice)
    assert.equal(request.rule.supplierCode, null)
    assert.equal(request.rule.supplierName, null)
    assert.equal(request.rule.expression, null)
  })
  it('无改动联动价保留实际系数和原始 Excel 公式，修改后保存新公式', () => {
    const form = scrapEditForm(linked)
    let request = scrapEditPayload(linked, form)
    assert.equal(request.rule.expression, '[Cu]*0.9845/1.13')
    assert.equal(request.rule.sourceFormula, '($M$1*0.9845)/1.13')
    form.expression = ' [Cu] * 0.98 / 1.13 '
    request = scrapEditPayload(linked, form)
    assert.equal(request.rule.sourceFormula, '[Cu]*0.98/1.13')
    assert.deepEqual(request.rule.factorBindings, { Cu: 'AVG|1#CU' })
  })
  it('类型切换不会带入另一类型的金额或公式，供应商可选填', () => {
    const form = { ...scrapEditForm(linked), priceType: 'FIXED', fixedPrice: '0', supplierCode: ' S1 ', supplierName: ' 回收商 ' }
    const request = scrapEditPayload(linked, form)
    assert.equal(request.rule.fixedPrice, '0')
    assert.equal(request.rule.expression, null)
    assert.deepEqual(request.rule.factorBindings, {})
    assert.equal(request.rule.supplierCode, 'S1')
    assert.equal(request.rule.supplierName, '回收商')
  })
  it('拒绝负数、科学计数、超精度和缺金额，允许最大精度', () => {
    for (const value of ['', '-1', 'NaN', '1e3', '123456789012345678901', '0.0000000000000000001']) {
      assert.throws(() => scrapEditPayload(fixed, { ...scrapEditForm(fixed), fixedPrice: value }))
    }
    const value = '99999999999999999999.123456789123456789'
    assert.equal(scrapEditPayload(fixed, { ...scrapEditForm(fixed), fixedPrice: value }).rule.fixedPrice, value)
  })
  it('变量必须与公式逐项对应，重复或未选基价会阻止提交', () => {
    const form = scrapEditForm(linked)
    form.expression = '[Cu]+[Al]'
    assert.throws(() => scrapEditPayload(linked, form), /每个变量/)
    form.bindings.push({ variable: 'Al', factor: 'AVG|A00' })
    assert.deepEqual(scrapEditPayload(linked, form).rule.factorBindings, { Cu: 'AVG|1#CU', Al: 'AVG|A00' })
    form.bindings.push({ variable: 'Cu', factor: 'AVG|1#CU' })
    assert.throws(() => scrapEditPayload(linked, form), /重复/)
    form.bindings = [{ variable: 'Cu', factor: 'UNKNOWN' }]
    assert.throws(() => scrapEditPayload(linked, form), /请选择/)
  })
  it('更换月份、错误预检、空文件或提交中不能确认导入', () => {
    const file = {}, preview = { canConfirm: true, previewFingerprint: 'version', priceMonth: '2026-10', rows: [{}], errors: [] }
    assert.equal(importCanConfirm(preview, file, '2026-10', false), true)
    for (const [p, f, month, busy] of [
      [preview, file, '2026-11', false], [preview, null, '2026-10', false],
      [preview, file, '2026-10', true], [{ ...preview, errors: [{}] }, file, '2026-10', false],
      [{ ...preview, rows: [] }, file, '2026-10', false], [{ ...preview, canConfirm: false }, file, '2026-10', false],
    ]) assert.equal(importCanConfirm(p, f, month, busy), false)
  })
  it('详情从商用财务快照读取精确基价，缺基价不伪造为零', () => {
    const row = { ...linked, calculationJson: JSON.stringify({
      variables: { Cu: 90.123456789123456789 },
      factors: { financial: { factors: { 'AVG|1#CU': { price: '90.123456789123456789' } } } },
    }) }
    assert.equal(scrapFactorDetails(row)[0].price, '90.123456789123456789')
    assert.equal(scrapFactorDetails({ ...row, calculationJson: '{}' })[0].price, null)
  })
})
