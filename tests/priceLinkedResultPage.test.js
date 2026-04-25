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
