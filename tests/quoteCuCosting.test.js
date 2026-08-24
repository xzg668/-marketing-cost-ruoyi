import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  canOperateMonthlyReprice,
  differenceAmountClass,
  formatSnapshotDecimal,
  isCostRunLockedByMonthlyReprice,
} from '../src/pages/quoteCuCostingUtils.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const CONTROLLER_FILE = path.resolve(
  import.meta.dirname,
  '../../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/controller/QuoteRequestController.java',
)
const pageSource = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiSource = fs.readFileSync(API_FILE, 'utf-8')
const controllerSource = fs.readFileSync(CONTROLLER_FILE, 'utf-8')

describe('FCQ-11 成本金额格式', () => {
  it('十进制字符串只做千分位显示，不经过浮点数换算', () => {
    assert.equal(formatSnapshotDecimal('102039.00000000'), '102,039')
    assert.equal(formatSnapshotDecimal('24.07800000'), '24.078')
    assert.equal(formatSnapshotDecimal('-0.00000001'), '-0.00000001')
    assert.equal(formatSnapshotDecimal(null), '—')
  })

  it('报价物料用量保留八位小数精度，不把微小正负用量显示成零', () => {
    assert.equal(formatSnapshotDecimal('0.00013000', 8), '0.00013')
    assert.equal(formatSnapshotDecimal('-0.00008800', 8), '-0.000088')
    assert.equal(formatSnapshotDecimal('0.00008220', 8), '0.0000822')
    assert.match(pageSource, /formatSnapshotDecimal\(row\.usageQty, 8\)/)
    assert.match(pageSource, /formatSnapshotDecimal\(row\.qtyPerTop, 8\)/)
    assert.doesNotMatch(pageSource, /formatMoney\(row\.usageQty\)/)
  })
})

describe('FCQ-11 价格差额展示', () => {
  it('正负零差额样式正确', () => {
    assert.equal(differenceAmountClass('24.07800000'), 'difference-positive')
    assert.equal(differenceAmountClass('-1.50'), 'difference-negative')
    assert.equal(differenceAmountClass('0.00000000'), 'difference-zero')
  })
})

describe('FCQ-11 页面与接口契约', () => {
  it('第六步只保留成本版本和结果入口，不重复第五步的Cu差额展示', () => {
    assert.doesNotMatch(apiSource, /fetchQuoteCuMaterialDifferences|cu-material-differences/)
    assert.match(apiSource, /\.xlsx`/)
    assert.doesNotMatch(apiSource, /cost-run\/batch|quote-batch/)
    assert.match(apiSource, /items\/\$\{encodePath\(itemId\)\}\/cost-runs/)
    assert.doesNotMatch(pageSource, /Cu差额与最终报价|最终报价 =|版本快照已锁定|Cu材料费差异明细/)
    assert.match(pageSource, /成本版本/)
    assert.match(pageSource, /查看完整成本表/)
    assert.match(pageSource, /@click="openCostRunDetail\(\)"/)
    assert.doesNotMatch(pageSource, /@click="openCostRunDetail"/)
    assert.match(pageSource, /selectCostRunVersion/)
    assert.match(pageSource, /versionId/)
    assert.doesNotMatch(pageSource, /整单核算|批次进度|一键核算/)
  })

  it('普通报价员受月度调价锁限制，调价操作人与总监可继续单产品核算', () => {
    const lock = { locked: true, message: '当前业务单元正在月度调价' }
    assert.equal(
      isCostRunLockedByMonthlyReprice(lock, {
        permissions: ['ingest:quote:list'],
        roles: ['bu_staff'],
      }),
      true,
    )
    assert.equal(canOperateMonthlyReprice({ permissions: ['price:monthly-reprice:operate'] }), true)
    assert.equal(canOperateMonthlyReprice({ permissions: ['*:*:*'] }), true)
    assert.equal(canOperateMonthlyReprice({ roles: ['bu_director'] }), true)
    assert.equal(
      isCostRunLockedByMonthlyReprice(lock, { roles: ['BU_DIRECTOR'] }),
      false,
    )
    assert.equal(isCostRunLockedByMonthlyReprice({ locked: false }, {}), false)
  })

  it('页面禁用锁定期试算且同步接口在后端再次强制校验', () => {
    assert.match(pageSource, /fetchMonthlyRepriceActiveLock/)
    assert.match(pageSource, /:disabled="costRunRepriceLocked"/)
    assert.match(pageSource, /submitProductCosting\('USER_REQUEST'\)/)
    assert.match(pageSource, /costRunRepriceLocked/)
    assert.match(pageSource, /当前业务单元正在月度调价，暂不能发起成本核算/)
    assert.match(controllerSource, /repriceLockGuard\.assertCostRunAllowed\(oaNo\)/)
    assert.match(controllerSource, /@PreAuthorize\("@ss\.hasAnyPermi\('ingest:quote:list'\)"\)/)
  })
})
