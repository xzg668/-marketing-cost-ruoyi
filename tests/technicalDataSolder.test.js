import test from 'node:test'
import assert from 'node:assert/strict'
import { solderRow, solderPayload, solderQuantityText } from '../src/utils/technicalDataSolder.js'

const reference = { materialNo: 'TOP', fingerprint: 'source' }
const sourceRow = { itemKey: 'U9:1', materialNo: 'WELD', drawingNo: 'DRAWING', name: '焊丝', quantityPerProduct: 0.0001,
  evidence: { material: { materialNo: 'WELD', drawingNo: 'DRAWING', fingerprint: 'master' }, sourceQuantityKg: 0.0001 } }

test('参考用量可改且原用量不变，发送内容只能包含来源身份和本次用量', () => {
  const row = solderRow(sourceRow); row.quantityPerProduct = '0.0002'
  const payload = solderPayload('REFERENCE', { reference, items: [row] }, 3)
  assert.deepEqual(payload, { expectedVersion: 3, entryMode: 'REFERENCE', referenceMaterialNo: 'TOP', referenceFingerprint: 'source', items: [{ itemKey: 'U9:1', quantityPerProduct: '0.0002' }] })
  assert.equal(row.evidence.sourceQuantityKg, 0.0001)
  assert.equal(sourceRow.quantityPerProduct, 0.0001)
})

test('草稿空用量与零不同，克制小用量转换后不会被截成零', () => {
  assert.equal(solderQuantityText(1e-11), '0.00000000001')
  const row = solderRow(sourceRow); row.quantityPerProduct = ''
  assert.equal(solderPayload('REFERENCE', { reference, items: [row] }, 0).items[0].quantityPerProduct, null)
  for (const quantity of ['0', '-1', '1e-4', '0.000000000001', '1000000000000']) {
    row.quantityPerProduct = quantity
    assert.throws(() => solderPayload('REFERENCE', { reference, items: [row] }, 0), /用量须大于/)
  }
})

test('新增料号必须查询成功，档案缺图号可以保存，查询错误不可假装已完成', () => {
  const row = solderRow({ ...sourceRow, drawingNo: null, evidence: { material: { materialNo: 'WELD', drawingNo: null, fingerprint: 'master' } } })
  assert.equal(row.lookupStatus, 'NO_DRAWING')
  assert.deepEqual(solderPayload('MANUAL', { reference: null, items: [row] }, 0).items[0], { materialNo: 'WELD', materialFingerprint: 'master', quantityPerProduct: '0.0001' })
  assert.throws(() => solderPayload('MANUAL', { items: [row, { ...row }] }, 0), /重复/)
  row.lookupStatus = 'ERROR'; row.lookupMessage = '查询失败'
  assert.throws(() => solderPayload('MANUAL', { items: [row] }, 0), /查询失败/)
})

test('同料号不同 BOM 发生位置保留，删除一个位置不会删除另外一个', () => {
  const first = solderRow(sourceRow), second = solderRow({ ...sourceRow, itemKey: 'U9:2' })
  const form = { reference, items: [first, second] }
  assert.equal(solderPayload('REFERENCE', form, 0).items.length, 2)
  form.items.splice(0, 1)
  assert.deepEqual(solderPayload('REFERENCE', form, 0).items, [{ itemKey: 'U9:2', quantityPerProduct: '0.0001' }])
})
