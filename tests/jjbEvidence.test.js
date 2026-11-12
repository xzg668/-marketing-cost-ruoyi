import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectEvidenceRow, selectAmountComposition } from '../src/utils/jjbEvidence.js'
import { parse, babelParse } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'

test('clicking a child material selects that exact row even when its parent shares the part id', () => {
  const rows = [{ key: 'parent', code: 'BASE', partItemIds: [10] }, { key: 'child', code: 'RAW', partItemIds: [10] }]
  assert.equal(selectEvidenceRow(rows, { rowKey: 'child', partItemId: 10 }).code, 'RAW')
  assert.equal(selectEvidenceRow(rows, { rowKey: 'missing', partItemId: 10 }), undefined)
  assert.equal(selectEvidenceRow(rows, null).code, 'BASE')
})

test('a merged packaging fee opens its own amount even when several cost and part ids are attached', () => {
  assert.deepEqual(selectAmountComposition({ key: 'COST:45', code: 'OTHER_EXP_PACKAGE', costItemIds: [9,45], partItemIds: [7,8] }, 'SAVED'), { costItemId: '45' })
  assert.equal(selectAmountComposition({ key: 'COST:99', code: 'OTHER_EXP_PACKAGE', costItemIds: [9,45] }, 'SAVED'), null)
})

test('latest and older saved versions both open the selected saved result without preparation', () => {
  const script = parse(readFileSync(new URL('../src/pages/QuoteRequestDetailPage.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const nodes = babelParse(script, { sourceType: 'module' }).program.body
  const body = ['viewCostResult', 'openSelectedQuoteCostResult'].map(name => {
    const node = nodes.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
    return script.slice(node.start, node.end)
  }).join('\n')
  const calls = []
  const row = { id: 160, confirmedCostVersionId: 32 }
  const dialog = { visible: true, row }
  const view = new Function('costResultDialog', 'openCostingWorkbench', 'selectCostResult', `${body};return viewCostResult`)(dialog,
    (item, options) => calls.push({ item, options }), () => assert.fail('unexpected monthly result'))
  for (const versionId of [32, 31]) view({ resultType: 'QUOTE_COST', versionId })
  assert.equal(calls.length, 2)
  for (const [i, versionId] of [32, 31].entries()) {
    assert.equal(calls[i].options.tab, 'COST_RUN')
    assert.equal(calls[i].options.versionId, versionId)
    assert.equal(calls[i].options.historyResult, 'quote')
  }
})
