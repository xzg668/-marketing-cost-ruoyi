import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildTraceTimeline,
  parseTraceJson,
} from '../src/pages/priceLinkedResultUtils.js'

/**
 * T24：result 页 trace drawer + 金标/系统结果/差异 三列改造。
 *
 * 组件层走文本契约（node --test 不带 JSDOM），
 * 辅助层（priceLinkedResultUtils）走真实函数调用。
 */

// ============================ 组件静态契约 ============================
const FILE = path.resolve(
  import.meta.dirname,
  '../src/pages/PriceLinkedResultPage.vue'
)
const content = fs.readFileSync(FILE, 'utf-8')
describe('PriceLinkedResultPage.vue T24 契约', () => {
  it('导入 fetchTrace 端点', () => {
    assert.match(
      content,
      /import\s*\{[^}]*\bfetchTrace\b[^}]*\}\s*from\s*['"]\.\.\/api\/priceLinkedItems['"]/
    )
  })

  it('导入 priceLinkedResultUtils 结果页纯函数', () => {
    assert.match(content, /parseTraceJson/)
    assert.match(content, /buildTraceTimeline/)
    assert.match(
      content,
      /from\s*['"]\.\/priceLinkedResultUtils['"]/
    )
  })

  it('原稿单价和财务复算价并列，输入不同不标红', () => {
    assert.match(content, /label="原稿未税单价"/)
    assert.match(content, /label="财务未税单价"/)
    assert.doesNotMatch(content, /diff-exceeds|diffWithGolden/)
  })

  it('现有记录的计算依据仍可查看', () => {
    assert.match(content, /计算依据/)
    assert.match(content, /@click="openTrace\(row\)"/)
  })

  it('模板中包含 el-drawer 抽屉（取代原弹窗展示 trace）', () => {
    assert.match(content, /<el-drawer\b[\s\S]{0,200}v-model="traceDrawerVisible"/)
  })

  it('抽屉内有 el-timeline 用于展示 trace 步骤', () => {
    assert.match(content, /<el-timeline\b/)
    assert.match(content, /<el-timeline-item\b/)
  })

  it('openTrace 调用 fetchTrace(row.id) 并解析 traceJson', () => {
    assert.match(
      content,
      /const\s+openTrace\s*=\s*async[\s\S]*?fetchTrace\(row\.id\)/m
    )
    assert.match(content, /parseTraceJson\(/)
    assert.match(content, /buildTraceTimeline\(/)
  })

})

describe('PriceLinkedResultPage.vue V2-14 月度导入和结果页契约', () => {
  it('主导入按钮文案为“导入联动原稿”', () => {
    assert.match(content, /导入联动原稿/)
  })

  it('V4-08：新增、编辑、删除和变量绑定操作有清晰权限控制', () => {
    assert.match(content, /v-hasPermi="\['price:linked-item:add'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked-item:edit'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked-item:remove'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked:binding:view'\]"/)
  })

  it('导入入口走 importLinkedItemsExcel multipart，不再走 importLinkedItems JSON', () => {
    assert.match(content, /\bimportLinkedItemsExcel\b/)
    assert.doesNotMatch(
      content,
      /import\s*\{[\s\S]*\bimportLinkedItems\b[\s\S]*\}\s*from\s*['"]\.\.\/api\/priceLinkedItems['"]/
    )
  })

  it('技术补录弹窗包含月份、业务单元、公式生效日期、价格冲突策略和 Excel 文件校验', () => {
    assert.match(content, /v-model="importForm\.pricingMonth"/)
    assert.match(content, /v-model="importForm\.businessUnitType"/)
    assert.match(content, /v-model="importForm\.formulaEffectiveDate"/)
    assert.match(content, /v-model="importForm\.factorPriceConflictStrategy"/)
    assert.match(content, /KEEP_EXISTING/)
    assert.match(content, /OVERWRITE/)
    assert.match(content, /accept="\.xlsx,\.xls"/)
    assert.match(content, /isExcelFile/)
  })

  it('T1：导入月份为 2026-05 时公式生效日期默认 2026-05-01', () => {
    assert.match(content, /const\s+firstDayOfMonth\s*=\s*\(monthText\)/)
    assert.match(content, /`\$\{value\}-01`/)
    assert.match(content, /formulaEffectiveDate:\s*firstDayOfMonth\(pricingMonth\)/)
    assert.match(content, /formulaEffectiveDate:\s*firstDayOfMonth\(queryString\('pricingMonth',\s*currentMonthText\(\)\)\)/)
  })

  it('技术补录默认保留已有影响因素价格，并提交新参数', () => {
    assert.match(content, /factorPriceConflictStrategy:\s*'KEEP_EXISTING'/)
    assert.match(content, /formulaEffectiveDate:\s*importForm\.value\.formulaEffectiveDate/)
    assert.match(content, /factorPriceConflictStrategy:\s*importForm\.value\.factorPriceConflictStrategy/)
    assert.match(content, /影响因素：缺失新增，相同跳过，价格不同按上方策略处理/)
    assert.match(content, /联动公式：新料号新增，公式变化生成新版本，公式相同跳过/)
  })

  it('T1：新导入弹窗不再提交 effectiveStrategy', () => {
    assert.doesNotMatch(content, /v-model="importForm\.effectiveStrategy"/)
    assert.doesNotMatch(content, /effectiveStrategy:\s*importForm\.value\.effectiveStrategy/)
  })

  it('T1：页面不再出现旧处理方式文案', () => {
    assert.doesNotMatch(content, /仅新增/)
    assert.doesNotMatch(content, /覆盖生效/)
  })

  it('V4-11：联动价格主表使用服务端分页，不一次性加载全部料号', () => {
    assert.match(content, /BasePagination/)
    assert.match(content, /fetchLinkedItemsPage/)
    assert.match(content, /const\s+currentPage\s*=\s*ref\(1\)/)
    assert.match(content, /const\s+pageSize\s*=\s*ref\(20\)/)
    assert.match(content, /const\s+total\s*=\s*ref\(0\)/)
    assert.match(content, /page:\s*currentPage\.value/)
    assert.match(content, /pageSize:\s*pageSize\.value/)
    assert.match(content, /v-model:current-page="currentPage"/)
    assert.match(content, /v-model:page-size="pageSize"/)
    assert.match(content, /<el-table\s+:data="visibleRows"[\s\S]*?<BasePagination/)
  })

  it('V4-04：提供跳转到影响因素表本月汇总的入口', () => {
    assert.match(content, /财务基价/)
    assert.match(content, /goFactorMonthlySummary/)
    assert.match(content, /path:\s*['"]\/rules\/finance-cu-base['"]/)
    assert.match(content, /priceMonth:\s*filters\.value\.pricingMonth/)
    assert.match(content, /businessUnitType:\s*filters\.value\.businessUnitType/)
  })

  it('V4-10：支持 URL query 直接打开历史月份和业务单元', () => {
    assert.match(content, /useRoute/)
    assert.match(content, /const\s+route\s*=\s*useRoute\(\)/)
    assert.match(content, /queryString\('pricingMonth',\s*currentMonthText\(\)\)/)
    assert.match(content, /queryString\('businessUnitType',\s*userStore\.businessUnitType\s*\|\|\s*''\)/)
    assert.match(content, /queryString\('materialCode',\s*''\)/)
  })

})

// ============================ parseTraceJson ============================
describe('parseTraceJson', () => {
  it('null / undefined / 空串 → null', () => {
    assert.equal(parseTraceJson(null), null)
    assert.equal(parseTraceJson(undefined), null)
    assert.equal(parseTraceJson(''), null)
  })

  it('非法 JSON → null（不抛异常）', () => {
    assert.equal(parseTraceJson('{not valid'), null)
    assert.equal(parseTraceJson('undefined'), null)
  })

  it('合法 JSON 字符串 → 解析为对象', () => {
    const parsed = parseTraceJson('{"mode":"dual","result":3.14}')
    assert.deepEqual(parsed, { mode: 'dual', result: 3.14 })
  })

  it('已经是对象时原样返回（某些历史接口已自动反序列化）', () => {
    const obj = { mode: 'new' }
    assert.equal(parseTraceJson(obj), obj)
  })
})

// ============================ buildTraceTimeline ============================
describe('buildTraceTimeline', () => {
  it('null / 非对象 → 空数组', () => {
    assert.deepEqual(buildTraceTimeline(null), [])
    assert.deepEqual(buildTraceTimeline(undefined), [])
    assert.deepEqual(buildTraceTimeline('string'), [])
    assert.deepEqual(buildTraceTimeline(123), [])
  })

  it('normalize 段：仅当存在 rawExpr / normalizedExpr 才出现', () => {
    const steps = buildTraceTimeline({
      rawExpr: 'Cu+Zn',
      normalizedExpr: 'Cu + Zn',
    })
    assert.equal(steps.length, 1)
    assert.equal(steps[0].step, 'normalize')
    assert.equal(steps[0].rawExpr, 'Cu+Zn')
    assert.equal(steps[0].normalizedExpr, 'Cu + Zn')
  })

  it('resolve 段：variables 键值对拍平为数组', () => {
    const steps = buildTraceTimeline({ variables: { Cu: 100, Zn: 20 } })
    assert.equal(steps.length, 1)
    assert.equal(steps[0].step, 'resolve')
    assert.deepEqual(steps[0].variables, [
      { code: 'Cu', value: 100 },
      { code: 'Zn', value: 20 },
    ])
  })

  it('evaluate 段：result / legacyResult / diff / mode 全部回填', () => {
    const steps = buildTraceTimeline({
      result: 120.5,
      legacyResult: 120.4,
      diff: 0.1,
      mode: 'dual',
    })
    assert.equal(steps.length, 1)
    assert.equal(steps[0].step, 'evaluate')
    assert.equal(steps[0].result, 120.5)
    assert.equal(steps[0].legacyResult, 120.4)
    assert.equal(steps[0].diff, 0.1)
    assert.equal(steps[0].mode, 'dual')
  })

  it('evaluate 段：result 缺失时回退 newResult', () => {
    const steps = buildTraceTimeline({ newResult: 42 })
    assert.equal(steps[0].result, 42)
  })

  it('error 段放最后（便于 UI 突出显示）', () => {
    const steps = buildTraceTimeline({
      rawExpr: 'x',
      variables: { x: 1 },
      result: 1,
      error: '未知变量 Y',
    })
    assert.equal(steps.length, 4)
    assert.equal(steps[3].step, 'error')
    assert.equal(steps[3].error, '未知变量 Y')
  })

  it('空对象 → 空 steps', () => {
    assert.deepEqual(buildTraceTimeline({}), [])
  })
})
