import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  calcPercentChange,
  formatNumber,
  formatPercentChange,
  shortBatchId,
} from '../src/pages/financeBasePriceUtils.js'

/**
 * T22：finance-base 页改造 —— 组件静态契约 + 纯函数单测。
 *
 * 组件层用文本断言（项目 node --test 不带 JSDOM），
 * 辅助层（financeBasePriceUtils）走真实函数调用。
 */

// ============================ 组件静态契约 ============================
const FILE = path.resolve(
  import.meta.dirname,
  '../src/pages/PriceLinkedFinanceBasePage.vue'
)
const content = fs.readFileSync(FILE, 'utf-8')

describe('PriceLinkedFinanceBasePage.vue V5-09 契约', () => {
  it('导入 V5 月度调价查询、导出、导入接口', () => {
    assert.match(content, /fetchFactorMonthlyPrices/)
    assert.match(content, /fetchFactorAdjustBatches/)
    assert.match(content, /fetchFactorAdjustPrices/)
    assert.match(content, /exportFactorAdjustTemplate/)
    assert.match(content, /importFactorAdjustExcel/)
  })

  it('不再客户端解析 Excel —— 移除 xlsx 依赖', () => {
    assert.ok(
      !/from\s*['"]xlsx['"]/.test(content) && !/import\(['"]xlsx['"]/.test(content),
      '应完全移除 xlsx 客户端解析'
    )
  })

  it('表格展示日常价、最近调价价、调价用途和最近调价批次', () => {
    assert.match(content, /label="日常报价生效价"/)
    assert.match(content, /label="最近调价价"/)
    assert.match(content, /label="原价\/上月价"/)
    assert.match(content, /label="涨跌幅"/)
    assert.match(content, /label="调价用途"/)
    assert.match(content, /label="最近调价批次"/)
  })

  it('顶部展示导出调价模板、导入月度调价 Excel 和刷新动作', () => {
    assert.match(content, />\s*导出调价模板\s*</)
    assert.match(content, />\s*导入月度调价 Excel\s*</)
    assert.match(content, />刷新</)
    assert.doesNotMatch(content, /单独导入影响因素 Excel/)
    assert.doesNotMatch(content, /补导影响因素 Excel/)
  })

  it('按月度列表接口查询：月份、业务单元、关键词和调价用途', () => {
    assert.match(content, /fetchFactorMonthlyPrices\(\{/)
    assert.match(content, /pricingMonth:\s*filters\.value\.priceMonth/)
    assert.match(content, /businessUnitType:\s*filters\.value\.businessUnitType/)
    assert.match(content, /keyword:\s*filters\.value\.keyword/)
    assert.match(content, /latestAdjustUsageScope:\s*filters\.value\.latestAdjustUsageScope/)
  })

  it('调价批次默认最近 10 条，并支持查看更多到最多 50 条', () => {
    assert.match(content, /const\s+historyLimit\s*=\s*ref\(10\)/)
    assert.match(content, /loadMoreBatches/)
    assert.match(content, /Math\.min\(historyLimit\.value\s*\+\s*10,\s*50\)/)
    assert.match(content, /adjustType:\s*'MONTHLY'/)
    assert.match(content, /普通用户只看自己的记录/)
  })

  it('支持从联动价格表跳转时带入月份和业务单元', () => {
    assert.match(content, /useRoute\(\)/)
    assert.match(content, /route\.query\.priceMonth/)
    assert.match(content, /route\.query\.businessUnitType/)
    assert.match(content, /firstQueryText/)
  })

  it('月度列表来自后端，可刷新恢复最近调价字段', () => {
    assert.match(content, /normalizeFactorRow/)
    assert.match(content, /dailyEffectivePrice/)
    assert.match(content, /latestAdjustPrice/)
    assert.match(content, /latestAdjustBatchNo/)
    assert.match(content, /latestAdjustedAt/)
    assert.match(content, /factorMonthlyPriceId/)
    assert.match(content, /factorIdentityId/)
  })

  it('调价批次下拉来自后端批次列表', () => {
    assert.match(content, /v-model="filters\.batchId"/)
    assert.match(content, /availableBatches/)
    assert.match(content, /batchRows\.value\.map/)
  })

  it('支持查看来源追溯抽屉', () => {
    assert.match(content, /sourceDrawerVisible/)
    assert.match(content, /影响因素来源追溯/)
    assert.match(content, /openSourceDrawer\(row\)/)
  })

  it('支持页面手工调价，并保留绑定关系不变的边界', () => {
    assert.match(content, /adjustFactorMonthlyPrice/)
    assert.match(content, />\s*调价\s*</)
    assert.match(content, /影响因素调价/)
    assert.match(content, /绑定关系仍靠 factorIdentityId 保持不变/)
  })

  it('支持导入弹窗用途选择和调价结果展示', () => {
    assert.match(content, /importDialogVisible/)
    assert.match(content, /adjustType:\s*'MONTHLY'/)
    assert.match(content, /REPRICE_ONLY/)
    assert.match(content, /REPRICE_AND_DAILY/)
    assert.match(content, /importResult/)
    assert.match(content, /识别总数/)
    assert.match(content, /变化数/)
    assert.match(content, /失败数/)
    assert.match(content, /是否同步日常报价/)
  })

  it('支持查看调价历史入口', () => {
    assert.match(content, /openAdjustHistoryDrawer\(row\)/)
    assert.match(content, />\s*查看调价历史\s*</)
    assert.match(content, /fetchFactorAdjustPrices/)
    assert.match(content, /影响因素调价历史/)
  })

  it('V4-07：支持从影响因素反查引用联动价', () => {
    assert.match(content, /fetchFactorLinkedItems/)
    assert.match(content, />\s*查看引用联动价\s*</)
    assert.match(content, /引用联动价/)
    assert.match(content, /token 名称/)
    assert.match(content, /绑定来源/)
    assert.match(content, /标准公式/)
    assert.match(content, /中文公式/)
    assert.match(content, /pricingMonth:\s*filters\.value\.priceMonth/)
    assert.match(content, /businessUnitType:\s*filters\.value\.businessUnitType/)
    assert.match(content, /避免调价前看到其他月份或其他业务单元/)
  })

  it('影响因素操作按钮有权限控制，不展示旧补导入口', () => {
    assert.match(content, /price:factor-adjust:export/)
    assert.match(content, /price:factor-adjust:import/)
    assert.match(content, /v-hasPermi="\['price:finance-base:batch:list'\]"/)
    assert.match(content, /v-hasPermi="\['price:finance-base:list'\]"/)
    assert.match(content, /v-hasPermi="\['price:finance-base:edit'\]"/)
    assert.doesNotMatch(content, /importInfluenceFactors\(/)
    assert.doesNotMatch(content, /补导影响因素 Excel/)
  })
})

// ============================ calcPercentChange ============================
describe('calcPercentChange', () => {
  it('标准涨幅', () => {
    assert.ok(Math.abs(calcPercentChange(110, 100) - 0.1) < 1e-9)
  })

  it('标准跌幅', () => {
    assert.ok(Math.abs(calcPercentChange(90, 100) - -0.1) < 1e-9)
  })

  it('持平', () => {
    assert.equal(calcPercentChange(100, 100), 0)
  })

  it('原价 0 → null（避免除 0）', () => {
    assert.equal(calcPercentChange(100, 0), null)
  })

  it('任一侧缺失/非数字 → null', () => {
    assert.equal(calcPercentChange(null, 100), null)
    assert.equal(calcPercentChange(100, null), null)
    assert.equal(calcPercentChange('abc', 100), null)
    assert.equal(calcPercentChange(100, 'xx'), null)
    assert.equal(calcPercentChange(undefined, undefined), null)
  })

  it('接受字符串数字（后端 BigDecimal 通常序列化为字符串）', () => {
    assert.ok(Math.abs(calcPercentChange('120', '100') - 0.2) < 1e-9)
  })
})

// ============================ formatPercentChange ============================
describe('formatPercentChange', () => {
  it('null → "—"', () => {
    assert.equal(formatPercentChange(null), '—')
    assert.equal(formatPercentChange(undefined), '—')
  })

  it('正数带 + 号', () => {
    assert.equal(formatPercentChange(0.1), '+10.00%')
    assert.equal(formatPercentChange(0.12345), '+12.35%')
  })

  it('负数保留负号', () => {
    assert.equal(formatPercentChange(-0.05), '-5.00%')
  })

  it('0 不带符号', () => {
    assert.equal(formatPercentChange(0), '0.00%')
  })

  it('非有限数 → "—"', () => {
    assert.equal(formatPercentChange(Infinity), '—')
    assert.equal(formatPercentChange(NaN), '—')
  })
})

// ============================ shortBatchId ============================
describe('shortBatchId', () => {
  it('取 UUID 前 8 位', () => {
    assert.equal(shortBatchId('abcd1234-ef56-7890-abcd-ef1234567890'), 'abcd1234')
  })

  it('空/null → 空串', () => {
    assert.equal(shortBatchId(''), '')
    assert.equal(shortBatchId(null), '')
    assert.equal(shortBatchId(undefined), '')
  })

  it('短于 8 位原样返回', () => {
    assert.equal(shortBatchId('abc'), 'abc')
  })
})

// ============================ formatNumber ============================
describe('formatNumber', () => {
  it('数字千分位', () => {
    // 不同 ICU 数据下中文 locale 可能用不同分隔符；只断言包含 "1" 与 "234" 片段
    const s = formatNumber(1234567)
    assert.ok(s.startsWith('1') && s.includes('234'))
  })

  it('null/空 → "—"', () => {
    assert.equal(formatNumber(null), '—')
    assert.equal(formatNumber(''), '—')
    assert.equal(formatNumber(undefined), '—')
  })

  it('非数字字符串原样返回', () => {
    assert.equal(formatNumber('abc'), 'abc')
  })

  it('字符串数字能解析', () => {
    const s = formatNumber('99.5')
    assert.ok(s.startsWith('99'))
  })
})
