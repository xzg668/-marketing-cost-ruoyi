import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { computed, reactive } from 'vue'
import { canAdjustMaterialShape, isOriginalManufactured, shapeSelections } from '../src/utils/quotationMaterialShapes.js'
const source = parse(readFileSync(new URL('../src/components/QuoteMaterialShapeSelector.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const setup = source.replace(/^import .*$/gm, '')
function selector(node) {
  const props = reactive({ node })
  const state = new Function('canAdjustMaterialShape', 'isOriginalManufactured', 'computed', 'defineProps', 'defineEmits', `${setup}; return { visible, options }`)(
    canAdjustMaterialShape, isOriginalManufactured, computed, () => props, () => () => {},
  )
  return { ...state, props }
}
const original = (shape, extra = {}) => ({ multiPriceSource: true,
  sourceMaterialShape: shape, effectiveMaterialShape: shape, availableMaterialShapes: [],
  sourceHasChildren: false, shapeResolutionSource: 'U9', ...extra })
test('original manufactured and outsourced materials remain editable without classified alternatives', () => {
  for (const shape of ['MANUFACTURE', '制造件', '自制件', 'OUTSOURCE', '委外加工件'])
    assert.equal(selector(original(shape)).visible.value, true)
})
test('original purchase materials never expose switching or restore', () => {
  for (const shape of ['PURCHASE', '采购件']) for (const children of [false, true]) {
    const state = selector(original(shape, { sourceHasChildren: children,
      availableMaterialShapes: ['MANUFACTURE', 'OUTSOURCE'], shapeResolutionSource: 'QUOTATION_SELECTION' }))
    assert.equal(state.visible.value, false)
  }
})
test('changing current shape does not change eligibility determined by the original BOM', () => {
  const state = selector(original('委外加工件'))
  for (const shape of ['MANUFACTURE', 'PURCHASE', 'OUTSOURCE']) {
    state.props.node.effectiveMaterialShape = shape
    state.props.node.shapeResolutionSource = 'QUOTATION_SELECTION'
    assert.equal(state.visible.value, true)
  }
  assert.deepEqual(state.options.value, ['PURCHASE', 'OUTSOURCE'])
})
test('noncatalog materials never expose selection or batch checkboxes', () => {
  for (const shape of ['制造件', '委外加工件', '采购件']) {
    assert.equal(selector(original(shape, { multiPriceSource: false })).visible.value, false)
    assert.equal(canAdjustMaterialShape(original(shape, { multiPriceSource: false })), false)
  }
})
test('structural roots and unrelated shapes remain uneditable', () => {
  for (const shape of ['', 'VIRTUAL', '未知']) assert.equal(selector(original(shape)).visible.value, false)
  assert.equal(selector(original('制造件', { shapeResolutionSource: 'STRUCTURE_ROOT' })).visible.value, false)
})
test('batch deduplicates material identity, preserves individual versions and rejects forbidden manufacture', () => {
  const a = original('制造件', { priceOrgCode: '210', materialCode: 'A', shapeSelectionVersion: 3 })
  const b = original('委外加工件', { priceOrgCode: '210', materialCode: 'B', shapeSelectionVersion: 4 })
  assert.deepEqual(shapeSelections([a, a, b], 'PURCHASE').map(row => row.expectedVersion), [3, 4])
  assert.throws(() => shapeSelections([a, b], 'MANUFACTURE'), /不能改成制造件/)
  assert.throws(() => shapeSelections([{ ...a, multiPriceSource: false }], 'PURCHASE'), /公共多源/)
  assert.equal(shapeSelections([a], 'MANUFACTURE')[0].selectedShape, 'MANUFACTURE')
})
