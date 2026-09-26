import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  ELECTRONIC_DRAWING_SEARCH_TYPES,
  buildElectronicDrawingResolutionRequest,
  isElectronicDrawingVersionConflict,
  nextUnselectedElectronicDrawingItem,
  pendingElectronicDrawingItems,
  sourceSearchKeyword,
} from '../src/utils/electronicDrawingMaterialResolution.js'
import { workflowStatusTagType } from '../src/utils/workflowStatus.js'

const page = fs.readFileSync(
  new URL('../src/pages/ElectronicDrawingMaterialResolutionPage.vue', import.meta.url),
  'utf8',
)
const detailPage = fs.readFileSync(
  new URL('../src/pages/QuoteRequestDetailPage.vue', import.meta.url),
  'utf8',
)
const router = fs.readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../src/api/quoteRequests.js', import.meta.url), 'utf8')

const state = {
  taskVersion: 7,
  sourceVersionId: 91,
  items: [
    { sourceNodeId: 1, requiresAction: false, matchStatus: 'AUTO_MATCHED' },
    { sourceNodeId: 2, requiresAction: true, drawingCode: 'S040', sourceName: '垫片' },
    { sourceNodeId: 3, requiresAction: true, drawingCode: 'M8', sourceName: '六角螺母' },
  ],
}

test('只把未匹配和歧义物料放入财务选择清单，正常自动匹配项不出现', () => {
  assert.deepEqual(pendingElectronicDrawingItems(state).map((item) => item.sourceNodeId), [2, 3])
  assert.doesNotMatch(page, /系统推荐|推荐结果|确认正常物料/)
})

test('搜索类型只提供图号、U9料号和物料名称，并按当前源物料带出查询词', () => {
  assert.deepEqual(ELECTRONIC_DRAWING_SEARCH_TYPES.map((item) => item.value), [
    'DRAWING_NO', 'MATERIAL_CODE', 'MATERIAL_NAME',
  ])
  assert.equal(sourceSearchKeyword(state.items[1], 'DRAWING_NO'), 'S040')
  assert.equal(sourceSearchKeyword(state.items[1], 'MATERIAL_NAME'), '垫片')
  assert.equal(sourceSearchKeyword(state.items[1], 'MATERIAL_CODE'), '')
  assert.match(page, /尚未搜索/)
  assert.match(page, /searchPerformed/)
})

test('同一次可保存多个选择，也可只保存其中一项', () => {
  const partial = buildElectronicDrawingResolutionRequest(state, {
    2: { materialCode: ' 100200 ' },
  })
  assert.deepEqual(partial, {
    expectedTaskVersion: 7,
    expectedSourceVersionId: 91,
    selections: [{ sourceNodeId: 2, materialCode: '100200' }],
  })
  const multiple = buildElectronicDrawingResolutionRequest(state, {
    2: { materialCode: '100200' },
    3: { materialCode: '100300' },
  })
  assert.equal(multiple.selections.length, 2)
})

test('切换物料会保留已选结果并定位下一个尚未选择的物料', () => {
  assert.equal(nextUnselectedElectronicDrawingItem(
    pendingElectronicDrawingItems(state),
    { 2: { materialCode: '100200' } },
    2,
  ).sourceNodeId, 3)
})

test('版本冲突可识别并触发服务端状态恢复', () => {
  assert.equal(isElectronicDrawingVersionConflict({ resultCode: 409 }), true)
  assert.equal(isElectronicDrawingVersionConflict({ domainCode: 'TASK_VERSION_CONFLICT' }), true)
  assert.equal(isElectronicDrawingVersionConflict(new Error('network failed')), false)
  assert.match(page, /await loadState\(\)/)
})

test('页面只从报价单产品行进入，不新增菜单或上传入口', () => {
  assert.match(detailPage, /RESOLVE_ELECTRONIC_DRAWING_MATERIAL/)
  assert.match(router, /electronic-drawing\/:taskId\/material-resolution/)
  assert.match(api, /electronic-drawing\/tasks\/\$\{encodePath\(taskId\)\}\/material-options/)
  assert.doesNotMatch(page, /上传|Excel 文件|系统推荐|二次审核/)
  assert.match(detailPage, /最近一次整单核算结果/)
  assert.match(detailPage, /该次业务结果/)
})

test('产品行可区分处理中、后台重试、无数据、待选料、完成和缺价状态', () => {
  assert.equal(workflowStatusTagType('QUERYING_E_DRAWING'), 'info')
  assert.equal(workflowStatusTagType('E_DRAWING_RETRY'), 'warning')
  assert.equal(workflowStatusTagType('E_DRAWING_NOT_FOUND'), 'danger')
  assert.equal(workflowStatusTagType('MAPPING_PENDING'), 'warning')
  assert.equal(workflowStatusTagType('E_DRAWING_COMPOSED'), 'success')
  assert.equal(workflowStatusTagType('MISSING_PRICE'), 'danger')
})

test('最后一项保存后清理一次性返回标记并自动续跑当前产品核算', () => {
  assert.match(detailPage, /route\.query\.electronicDrawing !== 'resolved'/)
  assert.match(detailPage, /delete nextQuery\.electronicDrawing/)
  assert.match(detailPage, /fetchQuoteRequestDetail\(scope\.oaNo\)/)
  assert.match(detailPage, /row\?\.workflow\?\.nextAction === 'START_COSTING'/)
  assert.match(detailPage, /submitSingleProductCosting\(row, 'ELECTRONIC_DRAWING_RESOLVED'\)/)
})
