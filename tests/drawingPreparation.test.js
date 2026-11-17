import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed, effectScope, ref } from 'vue'
import { drawingReceipt, resolvedDrawingMismatch, hasCurrentDrawingSource, drawingPreparationView, drawingPreparationIssues } from '../src/utils/drawingPreparation.js'
import { useDrawingReceipt } from '../src/composables/useDrawingReceipt.js'
import { effectiveBomCanPrepare } from '../src/utils/quoteEffectiveBom.js'

const sourceError = '已接收明细中没有本产品图号的有效行：PRODUCT-MX'
const scope = { oaNo: 'OA', itemId: 7, month: '2026-11' }
const stored = () => ({ oaNo: 'OA', itemId: 7, accountingMonth: '2026-11', current: {
  localTaskId: 11, currentResultId: 31, drawingNo: 'PRODUCT-MX', taskState: 'RECEIVED',
  consumptionState: 'FAILED', errorMessage: sourceError,
} })
const detail = () => ({ localTaskId: 11, resultId: 31, productDrawingNo: 'PRODUCT-MX', productGroupKey: '_unknown_1',
  adoption: 'DIRECT_ACCEPTED', receivedAt: '2026-11-16T11:01:30', data: {
    _unknown_1: { params: { items: [{ no: '001', code: 'PART', qty: '2.5000', weight: null }] } },
  } })
const verified = () => ({ ...stored(), current: { ...stored().current, receivedDetailCount: 1, productGroupResolved: true } })
const blocked = () => ({ state: 'BLOCKED', nodes: [], blockIssues: [{ issueCode: 'SOURCE_INVALID', message: sourceError }] })

test('当前图号和结果核实后保留原文数量，旧失败转入待继续准备，核算门禁仍阻断', () => {
  const data = detail(), before = JSON.stringify(data)
  const receipt = drawingReceipt(stored(), data)
  assert.equal(receipt.receivedDetailCount, 1)
  assert.equal(receipt.rows[0].qty, '2.5000')
  assert.equal(JSON.stringify(data), before)
  const bom = blocked(), snapshot = JSON.stringify(bom)
  const view = drawingPreparationView({ drawing: verified(), effectiveBom: bom })
  assert.equal(view.pendingImport, true)
  assert.equal(view.issues.length, 0)
  assert.match(view.title, /待继续准备BOM/)
  assert.equal(JSON.stringify(bom), snapshot)
  assert.equal(effectiveBomCanPrepare(bom), false)
})

test('空结果、其他结果、其他任务、其他图号、未确认以及未匹配分组都不能证明当前明细', () => {
  for (const change of [{ resultId: 32 }, { localTaskId: 12 }, { productDrawingNo: 'OTHER' },
    { adoption: 'WAIT_REVIEW' }, { productGroupKey: null }, { data: {} }]) {
    assert.equal(drawingReceipt(stored(), { ...detail(), ...change }), null)
  }
  assert.equal(drawingReceipt({ ...stored(), current: { ...stored().current, taskState: 'WAIT_REVIEW' } }, detail()), null)
})

test('读取失败不能把旧错误视为解决；另一条真实错误原文保留', () => {
  const bom = blocked()
  const result = drawingPreparationIssues({ drawing: verified(), effectiveBom: bom, readError: '资料读取超时' })
  assert.equal(result.length, 2)
  assert.equal(result[0].type, 'error')
  const other = { ...bom, blockIssues: [{ issueCode: 'CHILD_RELATION_MISSING', materialCode: 'A', message: 'A缺少子件关系' }] }
  const view = drawingPreparationView({ drawing: verified(), effectiveBom: other })
  assert.equal(view.issues[0].message, 'A缺少子件关系')
  assert.equal(view.issues[0].title, '待补子件关系')
  assert.equal(view.type, 'warning')
})

test('真实工作台的旧未生成兜底只在本次未消费且明细已核实的已知分组失败下显示待准备', () => {
  const bom = { state: 'BLOCKED', nodes: [], blockIssues: [{ issueCode: 'MONTHLY_BOM_NOT_READY',
    message: '系统未能从已有原始BOM生成本次计价BOM，请联系管理员检查数据' }] }
  assert.equal(drawingPreparationView({ drawing: verified(), effectiveBom: bom }).issues.length, 0)
  assert.equal(drawingPreparationIssues({ drawing: stored(), effectiveBom: bom }).length, 1)
  assert.equal(drawingPreparationIssues({ drawing: verified(), effectiveBom: bom, readError: '读取失败' }).length, 2)
  const consumed = { ...verified(), sourceVersionId: 100, current: { ...verified().current, consumedResultId: 31 } }
  assert.equal(drawingPreparationView({ drawing: consumed, effectiveBom: bom }).type, 'error')
  assert.equal(drawingPreparationIssues({ drawing: verified(), effectiveBom: { ...bom, state: 'ERROR' } }).length, 1)
})

test('已续接当前结果后的真实缺项替代未生成兜底，其他版本和真实读取错误仍保留', () => {
  const drawing = { ...verified(), sourceVersionId: 100, current: { ...verified().current,
    consumptionState: 'COMPLETE', consumedResultId: 31, errorMessage: null } }
  const bom = { state: 'BLOCKED', nodes: [], blockIssues: [{ issueCode: 'MONTHLY_BOM_NOT_READY',
    message: '系统未能从已有原始BOM生成本次计价BOM，请联系管理员检查数据' }] }
  const resolution = { productTaskId: 7, sourceVersionId: 100, accountingMonth: '2026-11', items: [
    { sourceSequence: '1', requiresAction: true, processingState: 'WAIT_FINANCE', processingMessage: '待财务确认 U9 料号，确认后检查实际下级' },
    { sourceSequence: '2', resolvedMaterialCode: '202052345', processingState: 'MISSING_RAW', processingMessage: '实际保留的制造件缺原材料关系，请补录' },
  ] }
  const view = drawingPreparationView({ drawing, effectiveBom: bom, resolution })
  assert.equal(view.issues.length, 2)
  assert.equal(view.type, 'warning')
  assert.equal(view.issues[1].materialCode, '202052345')
  assert.equal(drawingPreparationView({ drawing, effectiveBom: bom, resolution: { ...resolution, sourceVersionId: 99 } }).type, 'error')
  assert.equal(drawingPreparationView({ drawing, effectiveBom: bom, resolution, readError: '读取失败' }).type, 'error')
  assert.equal(drawingPreparationView({ drawing, effectiveBom: { ...bom, state: 'ERROR' }, resolution }).type, 'error')
})

test('子件关系、图库制造件明细、物料匹配同时列出，重复料号保留各自分支', () => {
  const issues = drawingPreparationIssues({ resolution: { items: [
    { sourceSequence: 'P1', drawingCode: 'PARENT-1', processingState: 'DRAWING_READY' },
    { sourceSequence: 'P2', drawingCode: 'PARENT-2', processingState: 'DRAWING_READY' },
    { sourceSequence: 'A', parentSourceSequence: 'P1', resolvedMaterialCode: 'MAKE', sourceName: '制造件', processingState: 'MISSING_RAW', processingMessage: '实际保留的制造件缺原材料关系，请补录' },
    { sourceSequence: 'B', parentSourceSequence: 'P2', resolvedMaterialCode: 'MAKE', sourceName: '制造件', processingState: 'MISSING_RAW', processingMessage: '实际保留的制造件缺原材料关系，请补录' },
    { sourceSequence: 'C', resolvedMaterialCode: 'OUT', processingState: 'ERROR', processingMessage: '委外或虚拟件缺少可用下级' },
    { sourceSequence: 'D', drawingCode: 'PART-DRAW', requiresAction: true },
    { sourceSequence: 'E', processingState: 'EXCLUDED', requiresAction: true },
  ] } })
  assert.equal(issues.length, 4)
  assert.equal(issues.filter(x => x.kind === 'MANUFACTURING').length, 2)
  assert.notEqual(issues[0].sourcePath, issues[1].sourcePath)
  assert.equal(issues[2].kind, 'CHILD_RELATION')
  assert.equal(issues[3].kind, 'MATERIAL_MATCH')
  assert.equal(issues[3].action, 'RESOLVE')
})

test('真实查询异常用红色，业务待补用橙色，保留已有树节点', () => {
  const bom = { state: 'BLOCKED', nodes: [{ nodeKey: 'P', materialCode: 'P' }], blockIssues: [] }
  const original = JSON.stringify(bom)
  const resolution = { items: [{ sourceSequence: 'A', processingState: 'ERROR', processingMessage: 'U9 下级查询未取得明确结论' }] }
  const view = drawingPreparationView({ drawing: verified(), effectiveBom: bom, resolution })
  assert.equal(view.type, 'error')
  assert.equal(view.title, '资料读取或处理异常')
  assert.equal(view.pendingImport, false)
  assert.equal(JSON.stringify(bom), original)
})

test('形态待确认指向本单形态，不把财务或报价确认任务引到技术补录', () => {
  const [issue] = drawingPreparationIssues({ resolution: { items: [
    { sourceSequence: 'A', resolvedMaterialCode: 'MAKE', processingState: 'ERROR', processingMessage: '物料形态未确定' },
  ] } })
  assert.equal(issue.kind, 'MATERIAL_SHAPE')
  assert.equal(issue.action, 'SHAPE')
  assert.equal(issue.type, 'warning')
  const [matching] = drawingPreparationIssues({ resolution: { items: [{ sourceSequence: 'B',
    processingState: 'WAIT_FINANCE', processingMessage: '待财务确认 U9 料号，确认后检查实际下级' }] } })
  assert.equal(matching.kind, 'MATERIAL_MATCH')
  assert.equal(matching.action, 'RESOLVE')
})

test('旧来源版本不能代表新任务已导入；当前结果指针一致才可读取匹配状态', () => {
  const state = { ...verified(), sourceVersionId: 100 }
  assert.equal(hasCurrentDrawingSource(state), false)
  state.current.consumedResultId = 30
  assert.equal(hasCurrentDrawingSource(state), false)
  state.current.consumedResultId = 31
  assert.equal(hasCurrentDrawingSource(state), true)
  state.current.taskState = 'WAIT_REVIEW'
  assert.equal(hasCurrentDrawingSource(state), false)
})

test('历史成本入口不读取或重写当前资料，未核实明细不能屏蔽旧错误', () => {
  assert.equal(resolvedDrawingMismatch(stored().current), false)
  assert.equal(drawingPreparationIssues({ drawing: verified(), effectiveBom: blocked(), historyView: true }).length, 0)
  assert.equal(drawingPreparationView({ drawing: verified(), historyView: true }).applies, false)
  assert.equal(drawingPreparationIssues({ drawing: stored(), effectiveBom: blocked() }).length, 1)
})

test('当前计价BOM已就绪时，原始来源预览的待办不能覆盖当前就绪结论', () => {
  const bom = { state: 'DRAFT', nodes: [{ nodeKey: 'P', materialCode: 'P' }], blockIssues: [] }
  const view = drawingPreparationView({ drawing: verified(), effectiveBom: bom,
    resolution: { items: [{ sourceSequence: 'P', processingState: 'MISSING_RAW', processingMessage: '原始来源待补' }] } })
  assert.equal(view.applies, false)
  assert.equal(effectiveBomCanPrepare(bom), true)
  assert.equal(bom.nodes[0].materialCode, 'P')
})

test('补录制造件明细未提交明确显示，不把已有图库接收当成技术资料已生效', () => {
  const view = drawingPreparationView({ drawing: verified(), supplement: { pendingModules: ['MANUFACTURING', 'DRAWING_BOM'] } })
  assert.equal(view.issues.length, 2)
  assert.match(view.issues[0].message, /尚未完成提交或生效/)
  assert.equal(view.issues[1].title, '图纸明细待修正')
})

const flush = () => new Promise(resolve => setImmediate(resolve))
const pending = () => { let resolve; return { promise: new Promise(r => { resolve = r }), resolve: value => resolve(value) } }
test('切产品或月份忽略迟到结果，已接收详情读取全程无业务写入', async () => {
  const effect = effectScope(), product = ref(7), month = ref('2026-11'), response = pending(), calls = []
  const selected = computed(() => ({ ...scope, itemId: product.value, month: month.value }))
  const state = ref(stored())
  const hook = effect.run(() => useDrawingReceipt(selected, state, (...args) => { calls.push(args); return response.promise }, ref(true)))
  assert.equal(calls.length, 1)
  product.value = 8; month.value = '2026-12'; await flush()
  response.resolve(detail()); await flush()
  assert.equal(hook.receipt.value, null)
  assert.equal(calls.length, 1)
  effect.stop()
})

test('当前详情读取失败可只读重试，关闭页面后不回填', async () => {
  const effect = effectScope(); let reads = 0
  const hook = effect.run(() => useDrawingReceipt(ref(scope), ref(stored()), async () => {
    if (++reads === 1) throw new Error('读取失败')
    return detail()
  }, ref(true)))
  await flush(); assert.equal(hook.receipt.value, null); assert.equal(hook.error.value, '读取失败')
  await hook.refresh(); assert.equal(hook.receipt.value.receivedDetailCount, 1)
  assert.equal(reads, 2)
  effect.stop()
})
