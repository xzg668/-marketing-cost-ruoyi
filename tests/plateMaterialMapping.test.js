import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mappingPayload, canConfirmMappingImport } from '../src/pages/plateMaterialMappingUtils.js'

const options = ['水氟SUS304', '水氟316L', '氟氟SUS304', '氟氟316L', '水水SUS304', '水水316L']
describe('型号材质维护边界', () => {
  it('六种完整材质允许保存，缺 L 及空值拒绝', () => {
    for (const plateMaterial of options) assert.equal(mappingPayload({ model: 'B12-8H-V20', plateMaterial }, null, options).plateMaterial, plateMaterial)
    for (const plateMaterial of ['', '水水316', '316L', '水水316L ']) assert.throws(() => mappingPayload({ model: 'B12', plateMaterial }, null, options))
  })
  it('只去边界普通空格，保留大小写、内部空格、后缀与全角空格', () => {
    const body = mappingPayload({ model: '  b12 -8H-V20　  ', plateMaterial: options[0], expectedVersion: 999, businessUnitType: 'forged' }, { rowVersion: 7 }, options)
    assert.deepEqual(body, { model: 'b12 -8H-V20　', plateMaterial: '水氟SUS304', expectedVersion: 7 })
  })
  it('拒绝空型号与超过 255 字符的型号，按字符而不是 UTF-16 长度限制', () => {
    for (const model of ['', '   ', 'A'.repeat(256)]) assert.throws(() => mappingPayload({ model, plateMaterial: options[0] }, null, options))
    assert.equal([...mappingPayload({ model: '𠮷'.repeat(255), plateMaterial: options[0] }, null, options).model].length, 255)
  })
  it('更换文件、预览错误、空记录、缺指纹或忙碌时不能确认', () => {
    const file = {}, preview = { canConfirm: true, fingerprint: 'revision', changes: [{}], errors: [] }
    assert.equal(canConfirmMappingImport(preview, file, file, false), true)
    for (const [p, selected, original, busy] of [
      [preview, {}, file, false], [preview, null, null, false], [preview, file, file, true],
      [null, file, file, false], [{ ...preview, errors: [{}] }, file, file, false],
      [{ ...preview, changes: [] }, file, file, false], [{ ...preview, fingerprint: '' }, file, file, false],
      [{ ...preview, canConfirm: false }, file, file, false],
    ]) assert.equal(canConfirmMappingImport(p, selected, original, busy), false)
  })
})
