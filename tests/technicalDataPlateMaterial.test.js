import test from 'node:test'
import assert from 'node:assert/strict'
import { PLATE_MATERIAL_OPTIONS, profileDraft, validatePlateMaterial, technicalProfilePayload, refreshProfilePlateMaterial, plateMaterialSummary } from '../src/utils/technicalDataPlateMaterial.js'

const manual = { mode: 'MANUAL_REQUIRED', value: null, revision: 'master-v1', source: { materialMasterIds: [1] }, historical: false }
const profile = { productProperty: '非标品', hasAdditionalFees: true, unitMouldFee: '0.3', unitToolingFee: '/', unitCertificationFee: '/', unitDepreciationFee: '1.234567', expectedVersion: 2, plateMaterial: manual }

test('six manual choices are valid, empty/old missing-L label invalid; hidden never requires a value', () => {
  assert.deepEqual(PLATE_MATERIAL_OPTIONS, ['水氟SUS304', '水氟316L', '氟氟SUS304', '氟氟316L', '水水SUS304', '水水316L'])
  for (const value of PLATE_MATERIAL_OPTIONS) assert.equal(validatePlateMaterial({ ...manual, value }), '')
  for (const value of ['', null, '水水316', '316L']) assert.match(validatePlateMaterial({ ...manual, value }), /必填/)
  assert.equal(validatePlateMaterial({ ...manual, mode: 'HIDDEN' }), '')
  assert.match(validatePlateMaterial(null), /未取得/)
  assert.match(validatePlateMaterial({ ...manual, mode: 'ERROR' }), /未取得/)
  assert.match(validatePlateMaterial({ ...manual, historical: true }), /不能修改/)
})
test('request only submits value and revision; never sends client mode, source, department or organization', () => {
  const body = technicalProfilePayload({ ...profile, department: 'fake', plateMaterial: { ...manual, value: '氟氟316L' } })
  assert.deepEqual(body, { productProperty: '非标品', hasAdditionalFees: true, unitMouldFee: '0.3',
    unitToolingFee: '/', unitCertificationFee: '/', unitDepreciationFee: '1.234567', expectedVersion: 2, plateMaterial: '氟氟316L', expectedPlateMaterialRevision: 'master-v1' })
  assert.equal(technicalProfilePayload({ ...profile, plateMaterial: { ...manual, mode: 'HIDDEN', value: '水水316L' } }).plateMaterial, null)
  assert.equal(technicalProfilePayload({ ...profile, plateMaterial: { ...manual, mode: 'CONFIG_LOCKED', value: '水水316L' } }).plateMaterial, '水水316L')
})
test('local choice does not mutate the server product object or shared evidence', () => {
  const draft = profileDraft(profile)
  draft.plateMaterial.value = '水水316L'
  assert.equal(profile.plateMaterial.value, null)
  assert.equal(profileDraft({ expectedVersion: 0 }).plateMaterial, null)
})
test('source refresh preserves unsaved fields and manual choice, replaces rule and revision', () => {
  const draft = { ...profile, productProperty: '标准品', unitMouldFee: '7.123456',
    plateMaterial: { ...manual, value: '氟氟SUS304' } }
  const latest = { ...profile, plateMaterial: { ...manual, revision: 'master-v2', value: '水水316L' } }
  const refreshed = refreshProfilePlateMaterial(draft, latest)
  assert.equal(refreshed.unitMouldFee, '7.123456')
  assert.equal(refreshed.unitDepreciationFee, '1.234567')
  assert.equal(refreshed.productProperty, '标准品')
  assert.equal(refreshed.plateMaterial.value, '氟氟SUS304')
  assert.equal(refreshed.plateMaterial.revision, 'master-v2')
  const locked = refreshProfilePlateMaterial(draft, { ...latest, plateMaterial: { ...latest.plateMaterial, mode: 'CONFIG_LOCKED', value: '水氟316L' } })
  assert.equal(locked.plateMaterial.value, '水氟316L')
  const hidden = refreshProfilePlateMaterial(draft, { ...latest, plateMaterial: { ...latest.plateMaterial, mode: 'HIDDEN', value: null } })
  assert.equal(hidden.plateMaterial.value, null)
  assert.equal(draft.plateMaterial.value, '氟氟SUS304')
})
test('concurrent draft edit/freeze refuses implicit row-version advancement; old unsaved data remain intact', () => {
  assert.throws(() => refreshProfilePlateMaterial(profile, { ...profile, expectedVersion: 3 }), /草稿也已/)
  assert.throws(() => refreshProfilePlateMaterial(profile, { ...profile, plateMaterial: { ...manual, historical: true } }), /不可继续编辑/)
  assert.throws(() => refreshProfilePlateMaterial(profile, { ...profile, plateMaterial: null }), /不可继续编辑/)
  assert.equal(profile.expectedVersion, 2)
})
test('history displays saved value only; old uncollected and hidden history do not fabricate a material', () => {
  assert.equal(plateMaterialSummary({ ...manual, historical: true, value: '水水316L' }), '板片材质：水水316L')
  assert.equal(plateMaterialSummary(manual), '板片材质待填写')
  assert.equal(plateMaterialSummary(null), '')
  assert.equal(plateMaterialSummary({ mode: 'HIDDEN', value: null }), '')
})
