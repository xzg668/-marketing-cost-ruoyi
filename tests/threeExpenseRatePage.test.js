import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { parseThreeExpenseRateRows } from '../src/pages/threeExpenseRateImportUtils.js'

const content = readFileSync(new URL('../src/pages/ThreeExpenseRatePage.vue', import.meta.url), 'utf8')

const { descriptor } = parse(content)
const script = compileScript(descriptor, { id: 'three-expense-commercial-test' }).content
  .replace(/import\s*\{([^}]+)\}\s*from 'vue'/, 'const {$1} = Vue')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '')
  .replace('export default', 'return')
const renderer = Vue.createRenderer({
  createComment: () => ({}), insert: () => {}, remove: () => {},
  parentNode: () => null, nextSibling: () => null,
})

describe('ThreeExpenseRatePage', () => {
  for (const productCategory of ['商用直销产品', '家代商代销产品']) {
    it(`新增及编辑 ${productCategory} 都提交 COMMERCIAL，保留产品口径和费率`, async () => {
      const calls = []
      const messages = []
      const bindings = {
        Vue,
        ElMessage: { success() {}, error: text => messages.push(text), warning: text => messages.push(text) },
        ElMessageBox: {},
        fetchThreeExpenseRates: async () => ({ list: [] }),
        importThreeExpenseRates: async () => ({}),
        createThreeExpenseRate: async body => calls.push({ body }),
        updateThreeExpenseRate: async (id, body) => calls.push({ id, body }),
        deleteThreeExpenseRate: async () => {},
        parseThreeExpenseRateRows,
      }
      const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings))
      component.render = () => null
      const app = renderer.createApp(component)
      try {
        const state = app.mount({}).$.setupState
        const row = {
          id: 17, businessUnitType: 'HOUSEHOLD', periodYear: 2026, productCategory,
          productLine: '国内产线', applicantDepartment: '美洲事务所-代销', applicantOffice: '',
          managementExpenseRate: 0.1, financeExpenseRate: 0.02, salesExpenseRate: 0.08,
          threeExpenseTotalRate: 0.2, oemExpenseRate: 0.1,
        }
        state.openCreate()
        Object.assign(state.formModel, row)
        await state.submitRow()
        state.openEdit(row)
        await state.submitRow()
        assert.deepEqual(messages, [])
        assert.equal(calls.length, 2)
        assert.equal(calls[1].id, 17)
        for (const { body } of calls) {
          assert.equal(body.businessUnitType, 'COMMERCIAL')
          assert.equal(body.productCategory, productCategory)
          assert.equal(body.managementExpenseRate, 0.1)
          assert.equal(body.salesExpenseRate, 0.08)
          assert.equal(body.financeExpenseRate, 0.02)
        }
      } finally {
        app.unmount()
      }
    })
  }

  it('exposes new title-matrix filters and columns', () => {
    for (const text of ['年度', '产品口径', '产线', '申请部门', '申请处室']) {
      assert.ok(content.includes(text), `missing ${text}`)
    }
    for (const prop of [
      'periodYear',
      'productCategory',
      'productLine',
      'applicantDepartment',
      'threeExpenseTotalRate',
      'oemExpenseRate',
      'sourceType',
    ]) {
      assert.ok(content.includes(prop), `missing ${prop}`)
    }
  })

  it('does not show raw period or grouped table headers', () => {
    for (const text of ['原始期间', 'rawPeriod', '标题解析字段', '配置表字段']) {
      assert.ok(!content.includes(text), `unexpected ${text}`)
    }
  })

  it('renders the office-less template marker and percentage rates', () => {
    assert.match(content, /displayApplicantOffice/)
    assert.ok(content.includes("return text || '/'"))
    assert.match(content, /formatRate/)
    assert.match(content, /parsed \* 100/)
  })

  it('shows structured import result counts', () => {
    assert.match(content, /insertedCount/)
    assert.match(content, /updatedCount/)
    assert.match(content, /duplicateOverrideCount/)
  })
})
