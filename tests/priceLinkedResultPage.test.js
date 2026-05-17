import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  DIFF_THRESHOLD,
  buildTraceTimeline,
  diffWithGolden,
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

  it('导入 priceLinkedResultUtils 四个纯函数', () => {
    assert.match(content, /parseTraceJson/)
    assert.match(content, /buildTraceTimeline/)
    assert.match(content, /diffWithGolden/)
    assert.match(
      content,
      /from\s*['"]\.\/priceLinkedResultUtils['"]/
    )
  })

  it('表格列：Excel 金标 / 系统结果 / 差异', () => {
    assert.match(content, /label="Excel 金标"/)
    assert.match(content, /label="系统结果"/)
    assert.match(content, /label="差异"/)
  })

  it('差异列在超阈值时挂 diff-exceeds class（红色高亮）', () => {
    assert.match(content, /diff-exceeds/)
    assert.match(content, /\.diff-exceeds\s*\{[\s\S]{0,120}color:\s*#dc2626/)
  })

  it('操作列新增 "查看 Trace" 按钮并调用 openTrace(row)', () => {
    assert.match(content, /查看\s*Trace/)
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

  it('derivedRows 计算 diffValue / diffExceeds（用于列高亮）', () => {
    assert.match(content, /diffValue/)
    assert.match(content, /diffExceeds/)
    assert.match(content, /diffWithGolden\(/)
  })
})

describe('PriceLinkedResultPage.vue V2-14 月度导入和结果页契约', () => {
  it('主导入按钮文案为“导入月度联动价与影响因素 Excel”', () => {
    assert.match(content, /导入月度联动价与影响因素 Excel/)
  })

  it('V4-08：主导入、导入历史和行操作按钮有清晰权限控制', () => {
    assert.match(
      content,
      /v-hasPermi="\['price:linked-item:import'\]"[\s\S]{0,180}导入月度联动价与影响因素 Excel/
    )
    assert.match(
      content,
      /v-hasPermi="\['price:linked-item:import-history:list'\]"[\s\S]{0,180}导入历史和日志/
    )
    assert.match(content, /v-hasPermi="\['price:linked-item:add'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked-item:edit'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked-item:remove'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked:binding:view'\]"/)
    assert.match(content, /v-hasPermi="\['price:linked:binding:admin'\]"/)
  })

  it('导入入口走 importLinkedItemsExcel multipart，不再走 importLinkedItems JSON', () => {
    assert.match(content, /\bimportLinkedItemsExcel\b/)
    assert.doesNotMatch(
      content,
      /import\s*\{[\s\S]*\bimportLinkedItems\b[\s\S]*\}\s*from\s*['"]\.\.\/api\/priceLinkedItems['"]/
    )
  })

  it('导入弹窗包含月份、业务单元、处理方式和 Excel 文件校验', () => {
    assert.match(content, /v-model="importForm\.pricingMonth"/)
    assert.match(content, /v-model="importForm\.businessUnitType"/)
    assert.match(content, /v-model="importForm\.effectiveStrategy"/)
    assert.match(content, /APPEND_ONLY/)
    assert.match(content, /OVERRIDE_EFFECTIVE/)
    assert.match(content, /accept="\.xlsx,\.xls"/)
    assert.match(content, /isExcelFile/)
  })

  it('V5-10：默认仅新增，并向 importLinkedItemsExcel 传 effectiveStrategy', () => {
    assert.match(content, /effectiveStrategy:\s*'APPEND_ONLY'/)
    assert.match(content, /effectiveStrategy:\s*importForm\.value\.effectiveStrategy/)
    assert.match(content, /仅新增：只新增系统没有的料号/)
    assert.match(content, /覆盖生效：本次 Excel 涉及的料号/)
  })

  it('导入结果区展示新增、覆盖、跳过、自动绑定、冲突和失败数量', () => {
    for (const key of [
      'linkedCreatedCount',
      'linkedUpdatedCount',
      'linkedSkippedCount',
      'monthlyPriceSkippedCount',
      'autoBindingCount',
      'consistentHistoryBindingCount',
      'conflictBindingCount',
      'manualSkippedCount',
      'bindingErrorCount',
    ]) {
      assert.match(content, new RegExp(key))
    }
  })

  it('页面包含影响因素预览、冲突处理、失败明细、导入历史入口', () => {
    assert.match(content, /本次影响因素预览/)
    assert.match(content, /冲突处理/)
    assert.match(content, /失败明细/)
    assert.match(content, /导入历史和日志/)
  })

  it('V3-09：导入结果展示公共基价识别统计和明细', () => {
    assert.match(content, /公共基价识别/)
    assert.match(content, /quoteBaseRecognizedCount/)
    assert.match(content, /quoteBaseConflictCount/)
    assert.match(content, /quoteBaseUnrecognizedCount/)
    assert.match(content, /quoteBaseDetectRows/)
    assert.match(content, /label="影响因素简称"/)
    assert.match(content, /label="影响因素名称"/)
    assert.match(content, /label="命中报价单字段"/)
    assert.match(content, /label="命中关键词"/)
    assert.match(content, /label="识别来源"/)
    assert.match(content, /quoteBaseStatusText/)
  })

  it('V3-09：导入后不让历史详情覆盖本次公共基价识别结果', () => {
    assert.match(content, /const\s+fetchList\s*=\s*async\s*\(\{\s*loadLatestImport\s*=\s*true\s*\}\s*=\s*\{\}\)/)
    assert.match(content, /fetchList\(\{\s*loadLatestImport:\s*false\s*\}\)/)
    assert.match(content, /loadImportHistory\(\{\s*loadLatest:\s*false\s*\}\)/)
  })

  it('V4-04：导入结果区提示这里只核对本次导入，不做长期维护', () => {
    assert.match(content, /本区只用于核对本次导入和自动绑定结果/)
    assert.match(content, /影响因素长期维护请进入影响因素表/)
  })

  it('V4-04：提供跳转到影响因素表本月汇总的入口', () => {
    assert.match(content, /去影响因素表查看本月汇总/)
    assert.match(content, /goFactorMonthlySummary/)
    assert.match(content, /path:\s*['"]\/price\/linked\/finance-base['"]/)
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

  it('V4-04：本次影响因素预览补齐上传人和上传时间，只读展示', () => {
    assert.match(content, /prop="uploadedBy"\s+label="上传人"/)
    assert.match(content, /prop="uploadedAt"\s+label="上传时间"/)
    assert.match(content, /uploadedBy:\s*row\?\.uploadedBy/)
    assert.match(content, /uploadedAt:\s*row\?\.uploadedAt/)
  })

  it('V4-05：导入历史默认最近 10 条，并支持查看更多到最多 50 条', () => {
    assert.match(content, /const\s+importHistoryLimit\s*=\s*ref\(10\)/)
    assert.match(content, /limit:\s*importHistoryLimit\.value/)
    assert.match(content, /loadMoreImportHistory/)
    assert.match(content, /Math\.min\(importHistoryLimit\.value\s*\+\s*10,\s*50\)/)
    assert.match(content, /普通用户只看自己的记录/)
  })

  it('冲突和失败行可进入现有人工绑定抽屉', () => {
    assert.match(content, /openBindingByMaterial/)
    assert.match(content, /openBinding\(target\)/)
  })
})

// ============================ DIFF_THRESHOLD ============================
describe('DIFF_THRESHOLD', () => {
  it('阈值为 0.01（DoD 要求）', () => {
    assert.equal(DIFF_THRESHOLD, 0.01)
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

// ============================ diffWithGolden ============================
describe('diffWithGolden', () => {
  it('任一侧缺失 → {diff:null, exceeds:false}', () => {
    assert.deepEqual(diffWithGolden(null, 100), { diff: null, exceeds: false })
    assert.deepEqual(diffWithGolden(100, null), { diff: null, exceeds: false })
    assert.deepEqual(diffWithGolden('', 100), { diff: null, exceeds: false })
    assert.deepEqual(diffWithGolden(100, ''), { diff: null, exceeds: false })
    assert.deepEqual(diffWithGolden(undefined, undefined), {
      diff: null,
      exceeds: false,
    })
  })

  it('非数字字符串 → {diff:null, exceeds:false}', () => {
    assert.deepEqual(diffWithGolden('abc', 100), {
      diff: null,
      exceeds: false,
    })
    assert.deepEqual(diffWithGolden(100, 'xx'), {
      diff: null,
      exceeds: false,
    })
  })

  it('小于阈值（0.005）→ exceeds false', () => {
    const { diff, exceeds } = diffWithGolden(100.005, 100)
    assert.ok(Math.abs(diff - 0.005) < 1e-9)
    assert.equal(exceeds, false)
  })

  it('恰好等于阈值（0.01）→ exceeds false（严格大于）', () => {
    // 注：用 (0.01, 0) 避免 100.01-100 的浮点误差（实际为 0.010000000000005）
    const { diff, exceeds } = diffWithGolden(0.01, 0)
    assert.equal(diff, 0.01)
    assert.equal(exceeds, false)
  })

  it('超过阈值（0.02）→ exceeds true', () => {
    const { diff, exceeds } = diffWithGolden(0.02, 0)
    assert.ok(Math.abs(diff - 0.02) < 1e-9)
    assert.equal(exceeds, true)
  })

  it('差值取绝对值（system < golden 也能算）', () => {
    const { diff, exceeds } = diffWithGolden(99, 100)
    assert.equal(diff, 1)
    assert.equal(exceeds, true)
  })

  it('接受字符串数字', () => {
    const { diff, exceeds } = diffWithGolden('100.5', '100')
    assert.ok(Math.abs(diff - 0.5) < 1e-9)
    assert.equal(exceeds, true)
  })
})
