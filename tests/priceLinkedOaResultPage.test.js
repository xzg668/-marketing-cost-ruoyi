import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceLinkedOaResultPage.vue')
const COST_RESULT_FILE = path.resolve(import.meta.dirname, '../src/pages/CostRunResultPage.vue')

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const costResultContent = fs.readFileSync(COST_RESULT_FILE, 'utf-8')

describe('V3-11 联动价计算追溯页', () => {
  it('支持按 OA、料号、场景、月份、批次、状态和结果来源筛选', () => {
    assert.match(pageContent, /label="OA单号"/)
    assert.match(pageContent, /label="客户"/)
    assert.match(pageContent, /label="业务单元"/)
    assert.match(pageContent, /label="物料编码"/)
    assert.match(pageContent, /label="计算场景"/)
    assert.match(pageContent, /label="价格月份"/)
    assert.match(pageContent, /label="调价批次"/)
    assert.match(pageContent, /label="计算状态"/)
    assert.match(pageContent, /label="结果来源"/)
    assert.match(pageContent, /calcScene/)
    assert.match(pageContent, /adjustBatchId/)
    assert.match(pageContent, /factorSource/)
    assert.match(pageContent, /OA_LOCKED/)
    assert.match(pageContent, /MONTHLY_ADJUST/)
  })

  it('集中展示本单汇总和变量来源明细', () => {
    assert.match(pageContent, /联动价物料数/)
    assert.match(pageContent, /计算成功数/)
    assert.match(pageContent, /计算失败数/)
    assert.match(pageContent, /OA锁价变量/)
    assert.match(pageContent, /月度影响因素变量/)
    assert.match(pageContent, /quoteBaseVariables/)
    assert.match(pageContent, /variableDetails/)
    assert.match(pageContent, /来源类型/)
    assert.match(pageContent, /OA_LOCKED/)
  })

  it('主表直接展示 OA 锁价变量数量，避免必须逐行点明细', () => {
    assert.match(pageContent, /label="OA锁价变量"/)
    assert.match(pageContent, /oaLockedCount/)
    assert.match(pageContent, /variableSourceSummary\?\.OA_LOCKED/)
  })

  it('查询使用只读结果接口，不在列表查询时触发计算', () => {
    assert.match(pageContent, /fetchPriceLinkedCalcResults/)
    assert.doesNotMatch(pageContent, /fetchPriceLinkedCalc\(/)
  })

  it('成本试算结果页只提供本单联动价计算记录入口', () => {
    assert.match(costResultContent, /查看本单联动价计算记录/)
    assert.match(costResultContent, /path:\s*'\/price\/linked\/oa-result'/)
    assert.match(costResultContent, /query:\s*\{\s*oaNo:\s*meta\.value\.oaNo\s*\}/)
  })
})
