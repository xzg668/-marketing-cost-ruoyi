import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  FINANCE_CU_DEFAULT_PRICE_PER_TON,
  FINANCE_CU_MAX_PRICE_PER_TON,
  addMonths,
  currentMonthText,
  formatDateTime,
  formatPricePerTon,
  hasFinanceCuEditPermission,
  initializationResultMessage,
  validateChangeReason,
  validateMonthRange,
  validatePricePerTon,
} from '../src/pages/financeCuBasePriceUtils.js'

const apiFile = path.resolve(import.meta.dirname, '../src/api/financeQuoteBasePrice.js')
const pageFile = path.resolve(import.meta.dirname, '../src/pages/FinanceCuBasePricePage.vue')
const menuSqlFile = path.resolve(
  import.meta.dirname,
  '../../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V189__finance_cu_quote_base_page_menu.sql',
)
const apiSource = fs.readFileSync(apiFile, 'utf-8')
const pageSource = fs.readFileSync(pageFile, 'utf-8')
const menuSql = fs.readFileSync(menuSqlFile, 'utf-8')

describe('FCQ-03 财务 Cu 基准 API 契约', () => {
  it('列表使用专用 GET 接口并只传筛选参数', () => {
    assert.match(
      apiSource,
      /BASE_PATH\s*=\s*['"]\/api\/v1\/finance-quote-base-prices\/cu['"]/
    )
    assert.match(apiSource, /fetchFinanceCuBasePrices\s*=\s*\(params\)[\s\S]{0,80}request\(BASE_PATH,\s*\{\s*params\s*\}\)/)
  })

  it('初始化使用 POST /initialize', () => {
    assert.match(
      apiSource,
      /request\(`\$\{BASE_PATH\}\/initialize`,\s*\{[\s\S]{0,100}method:\s*['"]POST['"]/
    )
  })

  it('初始化把页面月份字段映射为后端 startMonth/endMonth', () => {
    assert.match(apiSource, /startMonth:\s*monthFrom/)
    assert.match(apiSource, /endMonth:\s*monthTo/)
    assert.match(apiSource, /pricePerTon,/)
  })

  it('单月调整使用 PUT /{id}，价格原值透传并清理原因空格', () => {
    assert.match(
      apiSource,
      /request\(`\$\{BASE_PATH\}\/\$\{id\}`,\s*\{[\s\S]{0,100}method:\s*['"]PUT['"]/
    )
    assert.match(apiSource, /buildFinanceCuAdjustPayload[\s\S]{0,140}pricePerTon,[\s\S]{0,80}changeReason:[\s\S]{0,80}\.trim\(\)/)
  })

  it('前端接口封装不保存元/公斤，也不自行做除以 1000 换算', () => {
    assert.doesNotMatch(apiSource, /pricePerKg/)
    assert.doesNotMatch(apiSource, /\/\s*1000/)
  })
})

describe('FCQ-03 月份与金额规则', () => {
  it('默认价固定为 90,000 元/吨，首阶段上限为 1,000,000 元/吨', () => {
    assert.equal(FINANCE_CU_DEFAULT_PRICE_PER_TON, 90000)
    assert.equal(FINANCE_CU_MAX_PRICE_PER_TON, 1000000)
  })

  it('当前月份格式固定为 YYYY-MM', () => {
    assert.equal(currentMonthText(new Date(2026, 6, 15)), '2026-07')
  })

  it('批量默认六个月可正确跨年', () => {
    assert.equal(addMonths('2026-10', 5), '2027-03')
    assert.equal(addMonths('2026-01', 0), '2026-01')
  })

  it('非法月份或非法偏移不生成月份', () => {
    assert.equal(addMonths('2026-13', 1), '')
    assert.equal(addMonths('2026-07', 1.5), '')
  })

  it('月份范围接受合法同月和顺序范围', () => {
    assert.equal(validateMonthRange('2026-07', '2026-07'), '')
    assert.equal(validateMonthRange('2026-07', '2027-01'), '')
  })

  it('月份范围拒绝格式错误和倒序', () => {
    assert.match(validateMonthRange('2026-7', '2026-08'), /YYYY-MM/)
    assert.match(validateMonthRange('2026-07', '2026-13'), /YYYY-MM/)
    assert.match(validateMonthRange('2026-08', '2026-07'), /不能早于/)
  })

  it('90,000 元/吨为合法输入', () => {
    assert.equal(validatePricePerTon(90000), '')
    assert.equal(validatePricePerTon('90000.50'), '')
  })

  it('空值、非数字、零和负数均被拒绝', () => {
    assert.match(validatePricePerTon(''), /不能为空/)
    assert.match(validatePricePerTon('九万'), /有效数字/)
    assert.match(validatePricePerTon(0), /大于0/)
    assert.match(validatePricePerTon(-1), /大于0/)
  })

  it('超过首阶段上限的异常大价格被拒绝', () => {
    assert.match(validatePricePerTon(1000000.01), /不能超过/)
    assert.equal(validatePricePerTon(1000000), '')
  })

  it('金额仅按元/吨格式化，不改变数值口径', () => {
    assert.equal(formatPricePerTon(90000), '90,000.00')
    assert.equal(formatPricePerTon(null), '—')
    assert.equal(formatPricePerTon('invalid'), '—')
  })

  it('后端时间格式适配页面展示', () => {
    assert.equal(formatDateTime('2026-07-15T09:08:07'), '2026-07-15 09:08:07')
    assert.equal(formatDateTime(''), '—')
  })
})

describe('FCQ-03 调整原因、结果和权限', () => {
  it('单月调整原因必填，纯空格也不允许', () => {
    assert.match(validateChangeReason(''), /不能为空/)
    assert.match(validateChangeReason('   '), /不能为空/)
    assert.equal(validateChangeReason('财务确认本月特殊调整'), '')
  })

  it('初始化结果同时说明新增和重复跳过月份', () => {
    assert.equal(
      initializationResultMessage({ createdCount: 4, skippedCount: 2 }),
      '初始化完成：新增4个月，跳过已存在2个月',
    )
  })

  it('只有编辑权限或超级权限可修改', () => {
    assert.equal(hasFinanceCuEditPermission(['cost:finance-cu-base:edit']), true)
    assert.equal(hasFinanceCuEditPermission(['*:*:*']), true)
    assert.equal(hasFinanceCuEditPermission(['cost:finance-cu-base:query']), false)
    assert.equal(hasFinanceCuEditPermission(null), false)
  })
})

describe('FCQ-03 财务 Cu 基准页面契约', () => {
  it('展示月份、业务单元、元/吨、修改人、修改时间和原因', () => {
    for (const label of [
      '月份',
      '业务单元',
      'Cu基准（元/吨）',
      '最近修改人',
      '最近修改时间',
      '调整原因',
    ]) {
      assert.ok(pageSource.includes(label), `缺少页面字段：${label}`)
    }
  })

  it('批量初始化默认六个月和 90,000 元/吨', () => {
    assert.match(pageSource, /monthTo:\s*addMonths\(currentMonth,\s*5\)/)
    assert.match(pageSource, /pricePerTon:\s*defaultPricePerTon/)
    assert.match(pageSource, /initializeFinanceCuBasePrices\(initializeForm\.value\)/)
  })

  it('重复月份明确提示跳过且不会覆盖', () => {
    assert.match(pageSource, /已存在月份会自动跳过，不会覆盖原有财务基准/)
    assert.match(pageSource, /skippedCount/)
    assert.match(pageSource, /ElMessage\.warning\(message\)/)
  })

  it('单月调整先校验价格和必填原因，再调用专用接口', () => {
    assert.match(pageSource, /validatePricePerTon\(adjustForm\.value\.pricePerTon\)/)
    assert.match(pageSource, /validateChangeReason\(adjustForm\.value\.changeReason\)/)
    assert.match(pageSource, /adjustFinanceCuBasePrice\(adjustingRow\.value\.id,\s*adjustForm\.value\)/)
  })

  it('查询、初始化和调整失败都有明确兜底提示', () => {
    assert.match(pageSource, /获取财务 Cu 基准失败/)
    assert.match(pageSource, /批量初始化财务 Cu 基准失败/)
    assert.match(pageSource, /调整财务 Cu 基准失败/)
  })

  it('只读用户看不到初始化和调整按钮并显示只读状态', () => {
    assert.match(pageSource, /v-if="!canEdit"[\s\S]{0,80}>只读权限</)
    assert.match(pageSource, /v-if="canEdit"[\s\S]{0,100}>\s*批量初始化\s*</)
    assert.match(pageSource, /v-if="canEdit"[\s\S]{0,100}@click="openAdjustDialog\(row\)"/)
    assert.match(pageSource, /v-else class="readonly-text">只读</)
  })

  it('页面写入字段只使用 pricePerTon，不出现 pricePerKg', () => {
    assert.match(pageSource, /initializeForm[\s\S]{0,180}pricePerTon/)
    assert.match(pageSource, /adjustForm[\s\S]{0,120}pricePerTon/)
    assert.doesNotMatch(pageSource, /pricePerKg/)
  })
})

describe('FCQ-03 动态菜单与权限 SQL', () => {
  it('菜单指向新页面并挂在价格数据源菜单下', () => {
    assert.match(menuSql, /40477[\s\S]{0,160}'财务Cu报价基准'[\s\S]{0,100}400[\s\S]{0,100}'finance-cu-base'[\s\S]{0,100}'pages:FinanceCuBasePricePage'/)
  })

  it('查询和编辑按钮都归属新页面', () => {
    assert.match(menuSql, /menu_id\s+IN\s*\(40475,\s*40476\)/i)
    assert.match(menuSql, /parent_id\s*=\s*40477/i)
  })

  it('迁移只维护菜单权限，不新建业务表', () => {
    assert.doesNotMatch(menuSql, /CREATE\s+TABLE/i)
    assert.match(menuSql, /cost:finance-cu-base:query/)
  })
})
