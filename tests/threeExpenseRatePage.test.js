import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const content = readFileSync(new URL('../src/pages/ThreeExpenseRatePage.vue', import.meta.url), 'utf8')

describe('ThreeExpenseRatePage', () => {
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
