import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { auxiliaryFromCms, auxiliaryAmountText, auxiliaryFromUpload, auxiliaryPayload, auxiliaryTotal } from '../src/utils/technicalDataAuxiliary.js'

const source = { materialNo: 'REFERENCE-PRODUCT', name: '参考成品', model: 'MODEL', fingerprint: 'abc',
  items: [{ sourceId: 1, subjectCode: '01', subjectName: '清洗类', sourcePeriod: '2026-08', sourceAmount: 10 }] }

test('TW-11 edits 10 to 12 directly, keeps the original and only sends identity and current amount', () => {
  const form = auxiliaryFromCms(source)
  assert.equal(form.items[0].amount, '10')
  form.items[0].amount = '12'
  assert.equal(form.items[0].sourceAmount, 10)
  assert.equal(source.items[0].sourceAmount, 10)
  assert.deepEqual(auxiliaryPayload('REFERENCE', form, 3), { expectedVersion: 3, entryMode: 'REFERENCE',
    referenceMaterialNo: 'REFERENCE-PRODUCT', referenceFingerprint: 'abc', items: [{ itemKey: 'CMS:1', amount: '12' }] })
})

test('TW-11 blank stays incomplete, explicit zero is accepted and decimal totals remain exact', () => {
  assert.equal(auxiliaryAmountText(1e-8), '0.00000001')
  assert.equal(auxiliaryAmountText(null), '')
  const form = auxiliaryFromCms(source)
  form.items[0].amount = ''
  assert.equal(auxiliaryPayload('REFERENCE', form, 0).items[0].amount, null)
  assert.equal(auxiliaryTotal(form.items), '待填完整')
  form.items[0].amount = '0'
  assert.equal(auxiliaryPayload('REFERENCE', form, 0).items[0].amount, '0')
  assert.equal(auxiliaryTotal(form.items), '0')
  assert.equal(auxiliaryTotal([{ amount: '.1' }]), '待填完整')
  assert.equal(auxiliaryTotal([{ amount: '0.1' }, { amount: '0.2' }]), '0.3')
  assert.equal(auxiliaryTotal([{ amount: '0.08157002' }, { amount: '0.25' }, { amount: '0.00673167' }]), '0.33830169')
  for (const amount of ['-1', '1e100', '0.000000001', '1000000000000']) {
    form.items[0].amount = amount
    assert.throws(() => auxiliaryPayload('REFERENCE', form, 0), /本次金额/)
  }
})

test('TW-11 upload preserves category and allows an empty finance subject, switching mode isolates sources', () => {
  const upload = { fileName: '辅料.xlsx', fileSha256: 'def', sheetName: '辅料', items: [
    { itemKey: 'UPLOAD:辅料:1', name: '清洗液', amountPerProduct: 0.25, category: '清洗类', secondarySubjectName: null } ] }
  const form = auxiliaryFromUpload(upload)
  form.items[0].amount = '0.5'
  assert.equal(form.items[0].source.upload.item.category, '清洗类')
  assert.equal(form.items[0].source.upload.item.secondarySubjectName, null)
  assert.deepEqual(auxiliaryPayload('UPLOAD', form, 1), { expectedVersion: 1, entryMode: 'UPLOAD', fileSha256: 'def',
    items: [{ itemKey: 'UPLOAD:辅料:1', amount: '0.5' }] })
  assert.equal(auxiliaryFromCms(source).items[0].amount, '10')
})

test('TW-11 uses the reviewed direct amount form and removes abandoned manual pricing routes', () => {
  const form = readFileSync(new URL('../src/components/technical-data/TechnicalDataAuxiliaryForm.vue', import.meta.url), 'utf8')
  const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
  assert.match(form, /上传辅料表/)
  assert.match(form, /v-model="row.amount"/)
  assert.doesNotMatch(form, /multiplier|用量倍数|lossRate/)
  assert.doesNotMatch(router, /TechnicalDataAuxiliaryPage|auxiliary\/entry|auxiliary\/reference/)
})
