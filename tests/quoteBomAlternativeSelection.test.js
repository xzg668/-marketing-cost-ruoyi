import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  alternativeCandidateTags,
  alternativeErrorMessage,
  alternativeReviewWarning,
  alternativeSelectionDisabled,
  canSelectQuoteBomAlternative,
  formatAlternativeRebuildSummary,
  isAlternativeCandidateSelected,
  sortAlternativeCandidates,
} from '../src/utils/quoteBomAlternativeUtils.js'

const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const DRAWER_FILE = path.resolve(import.meta.dirname, '../src/components/QuoteBomAlternativeDrawer.vue')
const WORKBENCH_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const UTILS_FILE = path.resolve(import.meta.dirname, '../src/utils/quoteBomAlternativeUtils.js')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const drawerContent = fs.readFileSync(DRAWER_FILE, 'utf-8')
const workbenchContent = fs.readFileSync(WORKBENCH_FILE, 'utf-8')
const utilsContent = fs.readFileSync(UTILS_FILE, 'utf-8')

describe('QBA-11 标准/替代选择纯函数', () => {
  it('只按后端 childType 排序候选，不修改原数组也不从料号推断标准件', () => {
    const candidates = [
      { materialCode: 'ALT-2', childType: 'ALTERNATIVE' },
      { materialCode: 'STD-1', childType: 'STANDARD' },
      { materialCode: 'ALT-1', childType: 'ALTERNATIVE' },
    ]

    assert.deepEqual(
      sortAlternativeCandidates(candidates).map((row) => row.materialCode),
      ['STD-1', 'ALT-1', 'ALT-2'],
    )
    assert.deepEqual(candidates.map((row) => row.materialCode), ['ALT-2', 'STD-1', 'ALT-1'])
    assert.deepEqual(sortAlternativeCandidates([{ materialCode: 'STD-LIKE' }]), [{ materialCode: 'STD-LIKE' }])
  })

  it('标准、替代、默认和本次报价使用标签完全取后端类型及选择结果', () => {
    const group = { selectedMaterialCode: 'ALT-1' }
    assert.deepEqual(
      alternativeCandidateTags({ materialCode: 'STD-1', childType: 'STANDARD' }, group),
      [
        { text: '标准', type: 'primary' },
        { text: '默认', type: 'info' },
      ],
    )
    assert.deepEqual(
      alternativeCandidateTags({ materialCode: 'ALT-1', childType: 'ALTERNATIVE', selected: true }, group),
      [
        { text: '替代', type: 'warning' },
        { text: '本次报价使用', type: 'success' },
      ],
    )
  })

  it('当前选择优先使用后端 selected，并兼容 selectedMaterialCode', () => {
    assert.equal(
      isAlternativeCandidateSelected(
        { materialCode: 'ALT-1', selected: true },
        { selectedMaterialCode: 'STD-1' },
      ),
      true,
    )
    assert.equal(
      isAlternativeCandidateSelected(
        { materialCode: 'ALT-1' },
        { selectedMaterialCode: 'ALT-1' },
      ),
      true,
    )
  })

  it('无权限和 STALE 均禁用选择，历史确认状态不再参与当前方案编辑', () => {
    assert.equal(alternativeSelectionDisabled({ canSelect: false }), true)
    assert.equal(
      alternativeSelectionDisabled({
        canSelect: true,
        summary: { reviewRequired: true },
      }),
      true,
    )
    assert.equal(
      alternativeSelectionDisabled({
        canSelect: true,
        group: { selectionStatus: 'STALE' },
      }),
      true,
    )
    assert.equal(alternativeSelectionDisabled({ canSelect: true }), false)
  })

  it('权限只接受超级权限或标准/替代选择权限', () => {
    assert.equal(canSelectQuoteBomAlternative(['*:*:*']), true)
    assert.equal(canSelectQuoteBomAlternative(['quote:costing:bom:alternative-select']), true)
    assert.equal(canSelectQuoteBomAlternative(['ingest:quote:list']), false)
  })

  it('STALE 和并发错误提示可直接指导业务处理', () => {
    assert.match(alternativeReviewWarning({ reviewRequired: true }), /BOM 版本或来源批次已变化/)
    assert.match(alternativeErrorMessage(new Error('ALT_SELECTION_CONFLICT: 选择版本已变化')), /刷新/)
    assert.match(alternativeErrorMessage(new Error('ALT_SOURCE_STALE: 来源已变化')), /重新确认/)
  })

  it('保存摘要明确要求用户重算，并说明受影响的下游步骤', () => {
    const text = formatAlternativeRebuildSummary({
      recalculationRequired: true,
      workflowInvalidated: ['PRICE_TYPE_CONFIRMATION', 'PRICE_PREPARE', 'COST_RUN'],
    })
    assert.match(text, /按当前规则重新生成/)
    assert.match(text, /价格类型识别、最终价格、成本核算/)
    assert.equal(formatAlternativeRebuildSummary({ idempotent: true }), '当前方案未变化')
  })
})

describe('QBA-11 标准/替代选择页面契约', () => {
  it('封装替代组查询、单组选用和历史查询接口', () => {
    assert.match(apiContent, /fetchQuoteBomAlternativeFeatureStatus/)
    assert.match(apiContent, /\/feature-status/)
    assert.match(apiContent, /fetchQuoteBomAlternativeGroups/)
    assert.match(apiContent, /selectQuoteBomAlternative/)
    assert.match(apiContent, /fetchQuoteBomAlternativeHistory/)
    assert.match(apiContent, /costing-bom\/alternative-groups/)
    assert.match(apiContent, /\/selection/)
    assert.match(apiContent, /\/history/)
    assert.match(apiContent, /method:\s*'PUT'/)
  })

  it('右侧抽屉按后端替代组单选，不提供料品库搜索或前端拼组', () => {
    assert.match(drawerContent, /el-drawer/)
    assert.match(drawerContent, /标准\/替代选择/)
    assert.match(drawerContent, /:modal="false"/)
    assert.match(drawerContent, /el-radio-group/)
    assert.match(drawerContent, /父件/)
    assert.match(drawerContent, /当前位置/)
    assert.match(utilsContent, /本次报价使用/)
    assert.match(drawerContent, /选择即预览，应用后生效/)
    assert.match(drawerContent, /预览不会写入数据库/)
    assert.match(drawerContent, /应用此方案/)
    assert.doesNotMatch(drawerContent, />\s*ACTIVE\s*</)
    assert.doesNotMatch(drawerContent, /应用选择并重建/)
    assert.doesNotMatch(drawerContent, /fetchU9MaterialOptions/)
    assert.doesNotMatch(drawerContent, /料品库搜索/)
    assert.doesNotMatch(drawerContent, /el-checkbox/)
  })

  it('工作台显示两个汇总，保存选择后刷新为待重算且不隐式重建', () => {
    assert.match(workbenchContent, /可替代组/)
    assert.match(workbenchContent, /已选替代/)
    assert.match(workbenchContent, /选择计价方案/)
    assert.match(workbenchContent, /QuoteBomAlternativeDrawer/)
    assert.match(workbenchContent, /loadAlternativeGroups/)
    assert.match(workbenchContent, /refreshAfterAlternativeSelection/)
    assert.match(workbenchContent, /alternativeSummary\.value\.reviewRequired/)
    assert.match(workbenchContent, /按当前规则重新生成/)
    assert.doesNotMatch(workbenchContent, /isBomConfirmed|confirmDiscardManualChanges/)
    assert.match(workbenchContent, /expectedSelectionVersion/)
    assert.match(workbenchContent, /expectedBuildBatchId/)
  })

  it('运行时开关关闭时隐藏入口并停止替代组查询和保存', () => {
    assert.match(workbenchContent, /alternativeFeatureEnabled/)
    assert.match(workbenchContent, /v-if="alternativeFeatureEnabled"/)
    assert.match(workbenchContent, /loadAlternativeFeatureStatus/)
    assert.match(workbenchContent, /if \(!alternativeFeatureEnabled\.value\) return/)
    assert.match(workbenchContent, /alternativeSummary\.value = emptyAlternativeSummary\(\)/)
  })
})
