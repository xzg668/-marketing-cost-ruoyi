import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPackage, packageRow, packageSourceRow, packagePayload, packageQuantityPerProduct } from '../src/utils/technicalDataPackage.js'

test('new packaging requires a base and never sends the obsolete parent multiplier', () => {
  const form = emptyPackage()
  assert.equal(form.parentQuantity, undefined)
  assert.equal(form.parentBaseQuantity, '')
  assert.equal(packagePayload('MANUAL', form, 3).parentQuantity, undefined)
  assert.equal(packagePayload('MANUAL', form, 3).parentBaseQuantity, null)
})

test('BOM child usage is divided by the package base only and is sent without predivision', () => {
  const form = { ...emptyPackage(), parentQuantity: '99', parentBaseQuantity: '150', items: [packageRow({ quantity: '150' })] }
  assert.equal(packageQuantityPerProduct(form, form.items[0]), 1)
  assert.equal(packagePayload('MANUAL', form, 0).parentBaseQuantity, '150')
  assert.equal(packagePayload('MANUAL', form, 0).items[0].quantity, '150')
  assert.equal(packageQuantityPerProduct({ ...form, parentBaseQuantity: '6' }, { quantity: '2' }), 0.33333333)
  assert.equal(packageQuantityPerProduct({ ...form, parentBaseQuantity: '6' }, { quantity: '3' }), 0.5)
  assert.equal(packageQuantityPerProduct({ ...form, parentBaseQuantity: '1' }, { quantity: '2' }), 2)
  for (const base of ['', '0', '-1', 'bad']) assert.equal(packageQuantityPerProduct({ ...form, parentBaseQuantity: base }, form.items[0]), null)
})

test('switching payload modes preserves child quantity and excludes inactive reference and legacy price fields', () => {
  const source = { parentNodeId: 17, fingerprint: 'reference' }
  const form = { parentBaseQuantity: '2', source,
    items: [packageSourceRow(source, { sourceNodeId: 19, materialNo: 'PAPER', name: '纸箱', model: 'BOX', quantity: 0.5, unit: '张' })] }
  form.items[0].priceBasisType = 'old'
  const before = structuredClone(form)
  const manual = packagePayload('MANUAL', form, 5)
  const reference = packagePayload('REFERENCE', form, 5)
  assert.deepEqual(form, before)
  assert.equal(manual.referenceParentNodeId, null)
  assert.equal(reference.referenceParentNodeId, 17)
  assert.equal(reference.parentQuantity, undefined)
  assert.equal(reference.parentBaseQuantity, '2')
  assert.equal(reference.items[0].quantity, '0.5')
  assert.equal(reference.items[0].sourceNodeId, 19)
  assert.equal(reference.items[0].priceBasisType, undefined)
})

test('manual model edits send one identity and restored reference retains its exact parent node', () => {
  const row = packageRow({ componentMaterialNo: 'OLD', componentModel: 'OLD', quantity: 0.5, unit: '只' })
  row.componentModel = 'NEW'
  const payload = packagePayload('MANUAL', { ...emptyPackage(), parentBaseQuantity: '2', items: [row] }, 4)
  assert.equal(payload.items[0].componentModel, 'NEW')
  assert.equal(payload.items[0].componentMaterialNo, undefined)
  const saved = packageRow({ componentMaterialNo: 'X', quantity: '0.12345678',
    evidence: { parentNodeId: 100, sourceNodeId: 101, sourceFingerprint: 'kept' } })
  assert.equal(saved.sourceParentNodeId, 100)
  assert.equal(saved.sourceNodeId, 101)
  assert.equal(saved.quantity, '0.12345678')
})
