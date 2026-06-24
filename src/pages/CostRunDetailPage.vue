<template>
  <div class="cost-run-detail">
    <div class="tool-row">
      <el-button @click="goBack">返回</el-button>
      <el-button :disabled="!effectiveCostRunNo" @click="openTraceDrawer()">核算底稿</el-button>
      <el-button type="primary" @click="exportSheet">导出</el-button>
    </div>

    <div class="sheet-wrapper">
      <table class="sheet-table">
        <colgroup>
          <col class="col-1" />
          <col class="col-2" />
          <col class="col-3" />
          <col class="col-4" />
          <col class="col-5" />
          <col class="col-6" />
          <col class="col-7" />
          <col class="col-8" />
          <col class="col-9" />
          <col class="col-10" />
        </colgroup>
        <tbody>
          <tr class="title-row no-left-strong">
            <td colspan="10">产品成本计算一览表</td>
          </tr>
          <tr class="blank-row no-left-strong">
            <td colspan="10">核算批次：{{ displayCostRunNo || '-' }}</td>
          </tr>
          <tr>
            <td class="meta-label">OA单号</td>
            <td></td>
            <td class="meta-label">报价员</td>
            <td></td>
            <td></td>
            <td class="meta-label">{{ materials[0] }}</td>
            <td></td>
            <td class="meta-label">{{ materials[4] }}</td>
            <td></td>
            <td>元/公斤</td>
          </tr>
          <tr>
            <td class="meta-label">客户名称</td>
            <td>{{ meta.customerName }}</td>
            <td class="meta-label">客户编码</td>
            <td>{{ meta.series }}</td>
            <td></td>
            <td class="meta-label">{{ materials[1] }}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="meta-label">产品名称</td>
            <td>{{ productName || meta.productName }}</td>
            <td class="meta-label">物料编码</td>
            <td>{{ meta.productCode }}</td>
            <td></td>
            <td class="meta-label">{{ materials[2] }}</td>
            <td>{{ copperPrice }}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="meta-label">产品型号</td>
            <td>{{ productModel || meta.productModel }}</td>
            <td class="meta-label">产品图号</td>
            <td>{{ meta.customerDrawing }}</td>
            <td></td>
            <td class="meta-label">{{ materials[3] }}</td>
            <td>{{ zincPrice }}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="part-header-row">
            <td>部品名</td>
            <td>部品料号</td>
            <td>部品图号</td>
            <td>部品单价</td>
            <td>部品用量</td>
            <td>部品价格</td>
            <td>材质</td>
            <td>形态属性</td>
            <td>价格来源</td>
            <td>备注</td>
          </tr>
          <!-- T13：NO_ROUTE / ERROR 整行红字，便于一眼锁定缺价 -->
          <tr
            v-for="(item, index) in partRows"
            :key="`${item.partCode}-${index}`"
            :class="{ 'row-miss': item.priceSource === 'NO_ROUTE' || item.priceSource === 'ERROR' }"
          >
            <td>{{ item.partName }}</td>
            <td class="part-code">{{ item.partCode }}</td>
            <td>{{ item.drawingNo }}</td>
            <td>{{ item.unitPrice }}</td>
            <td>{{ item.qty }}</td>
            <td>
              <button type="button" class="trace-link" @click="openPartTrace(item)">
                {{ item.amount }}
              </button>
            </td>
            <td>{{ item.material }}</td>
            <td>{{ item.shape }}</td>
            <td>{{ item.priceSource }}</td>
            <td>{{ item.remark }}</td>
          </tr>
          <tr class="left-blue">
            <td class="left-label">大修费</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openCostTrace('OVERHAUL')">
                {{ getCostAmount('OVERHAUL') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="left-blue">
            <td class="left-label">工装零星修理费</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openCostTrace('TOOLING_REPAIR')">
                {{ getCostAmount('TOOLING_REPAIR') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="left-blue">
            <td class="left-label">水电费</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openCostTrace('WATER_POWER')">
                {{ getCostAmount('WATER_POWER') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="left-blue">
            <td class="left-label">其他费用</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openCostTrace('DEPT_OTHER')">
                {{ getCostAmount('DEPT_OTHER') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr v-for="(item, index) in auxItems" :key="`${item.costCode}-${index}`">
            <td class="left-label">{{ item.costName }}</td>
            <td></td>
            <td>{{ getAuxCode(item.costCode) }}</td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openCostTrace(item.costCode)">
                {{ formatAmount(item.amount) }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="section-row">
            <td colspan="3" class="section-center">材料费</td>
            <td></td>
            <td></td>
            <td class="amount">
              <button type="button" class="trace-link strong" @click="openCostTrace('MATERIAL')">
                {{ getCostAmount('MATERIAL') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="row-label">直接人工工资</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('DIRECT_LABOR')">
                {{ getCostAmount('DIRECT_LABOR') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="row-label">辅助人工工资</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('INDIRECT_LABOR')">
                {{ getCostAmount('INDIRECT_LABOR') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="left-blue">
            <td class="row-label">净损失率</td>
            <td></td>
            <td class="rate">{{ getCostRate('LOSS') }}</td>
            <td class="formula"></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('LOSS')">
                {{ getCostAmount('LOSS') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="left-blue">
            <td class="row-label">制造费用</td>
            <td></td>
            <td class="rate">{{ getCostRate('MANUFACTURE') }}</td>
            <td class="formula"></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('MANUFACTURE')">
                {{ getCostAmount('MANUFACTURE') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="section-row">
            <td colspan="3" class="section-center">制造成本</td>
            <td class="formula"></td>
            <td></td>
            <td class="amount">
              <button type="button" class="trace-link strong" @click="openCostTrace('MANUFACTURE_COST')">
                {{ getCostAmount('MANUFACTURE_COST') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="left-blue">
            <td class="row-label">产品属性</td>
            <td>{{ productAttr }}</td>
            <td class="rate">{{ getCostCoefficient('ADJUSTED_MANUFACTURE_COST') }}</td>
            <td class="formula"></td>
            <td></td>
            <td class="amount">
              <button type="button" class="trace-link strong" @click="openCostTrace('ADJUSTED_MANUFACTURE_COST')">
                {{ getCostAmount('ADJUSTED_MANUFACTURE_COST') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="left-blue" rowspan="3">三项费用</td>
            <td>管理费用</td>
            <td>{{ getCostRate('MGMT_EXP') }}</td>
            <td></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('MGMT_EXP')">
                {{ getCostAmount('MGMT_EXP') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>营业费用</td>
            <td>{{ getCostRate('SALES_EXP') }}</td>
            <td></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('SALES_EXP')">
                {{ getCostAmount('SALES_EXP') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>财务费用</td>
            <td>{{ getCostRate('FIN_EXP') }}</td>
            <td></td>
            <td></td>
            <td>
              <button type="button" class="trace-link" @click="openCostTrace('FIN_EXP')">
                {{ getCostAmount('FIN_EXP') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <!-- 见机表 r58/r59/r60 顺序：运费 / 模具费 / 认证费。
               运费只有金额非 0 才展示；模具费/认证费按 costName 在 OTHER_EXP_<id> 系列里 lookup。
               注意：包装费已经计入材料费 (T24 见机表口径)，**不在这里展示**避免双重 -->
          <tr v-if="hasFreightCost" class="attr-row">
            <td class="left-label">运费</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openCostTrace('OTHER_EXP_FREIGHT')">
                {{ getCostAmount('OTHER_EXP_FREIGHT') || '-' }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="attr-row">
            <td class="left-label">模具费</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openOtherExpenseTrace('模具费')">
                {{ getOtherExpenseByName('模具费') || '-' }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="attr-row">
            <td class="left-label">认证费</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="formula">
              <button type="button" class="trace-link" @click="openOtherExpenseTrace('认证费')">
                {{ getOtherExpenseByName('认证费') || '-' }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="total-row">
            <td colspan="3" class="total-label">不含税总成本</td>
            <td></td>
            <td></td>
            <td class="amount">
              <button type="button" class="trace-link strong" @click="openCostTrace('TOTAL')">
                {{ getCostAmount('TOTAL') }}
              </button>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="footer-row">
            <td>编制：</td>
            <td></td>
            <td></td>
            <td></td>
            <td>审核：</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <CostRunTraceDrawer
      v-model="traceDrawerVisible"
      :cost-run-no="effectiveCostRunNo"
      :version-no="displayCostRunNo"
      :initial-trace="selectedTrace"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchCostRunDetail } from '../api/costRunDetail'
import CostRunTraceDrawer from '../components/CostRunTraceDrawer.vue'

const route = useRoute()
const router = useRouter()

const meta = computed(() => ({
  oaNo: String(route.params.oaNo || ''),
  customerName: String(route.query.customer || ''),
  productName: String(route.query.productName || ''),
  productModel: String(route.query.productModel || route.query.sunlModel || ''),
  productCode: String(route.query.productCode || route.query.materialCode || ''),
  costRunNo: String(route.query.costRunNo || ''),
  versionNo: String(route.query.versionNo || ''),
  series: String(route.query.series || ''),
  customerDrawing: String(route.query.customerDrawing || ''),
  // 见机表 r2 col 4 是空给业务方手填；OA 表当前没 owner 字段，留空
  owner: '',
  currency: 'CNY',
}))

const materials = ['不锈钢-316L', '不锈钢-304', '电解铜', '电解锌', '电解铝']

const partItems = ref([])
const costItems = ref([])
const productAttr = ref('')
const productName = ref('')
const productModel = ref('')
const copperPrice = ref('')
const zincPrice = ref('')
const currentCostRunNo = ref('')
const currentVersionNo = ref('')
const traceDrawerVisible = ref(false)
const selectedTrace = ref(null)

const partRows = computed(() => [...partItems.value])
const costMap = computed(() => {
  const map = {}
  for (const item of costItems.value) {
    if (item?.costCode) {
      map[item.costCode] = item
    }
  }
  return map
})
const auxItems = computed(() =>
  costItems.value.filter((item) => String(item?.costCode || '').startsWith('AUX_'))
)
const otherExpenseItems = computed(() =>
  costItems.value.filter((item) => String(item?.costCode || '').startsWith('OTHER_EXP_'))
)
const displayCostRunNo = computed(() =>
  currentVersionNo.value || currentCostRunNo.value || meta.value.versionNo || meta.value.costRunNo
)
const effectiveCostRunNo = computed(() => currentCostRunNo.value || meta.value.costRunNo)

const toText = (value) => (value === null || value === undefined ? '' : String(value))
const formatAmount = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return ''
  }
  return number.toFixed(3)
}

const formatRate = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return ''
  }
  return `${(number * 100).toFixed(2)}%`
}

// 产品属性系数语义是倍数（1.00=标准品，1.20=非标加价 20%），直接 2 位小数显示，不转百分比
const formatCoefficient = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return ''
  }
  return number.toFixed(2)
}

const getCostAmount = (code) => formatAmount(costMap.value?.[code]?.amount)
const getCostRate = (code) => formatRate(costMap.value?.[code]?.rate)
const getCostCoefficient = (code) => formatCoefficient(costMap.value?.[code]?.rate)
// 在 lp_other_expense_rate 派生的 OTHER_EXP_<id> 行里按 costName lookup
// （模具费/认证费等占位行用），找不到返空字符串
const getOtherExpenseByName = (name) => {
  const item = otherExpenseItems.value.find((i) => i.costName === name)
  return item ? formatAmount(item.amount) : ''
}
const getOtherExpenseItemByName = (name) => otherExpenseItems.value.find((i) => i.costName === name)
// 派生 OTHER_EXP_<id> amount（按 costName）— 导出 Excel 时用
const getOtherExpenseValueByName = (name) => {
  const item = otherExpenseItems.value.find((i) => i.costName === name)
  return item ? item.amount : null
}
const getAuxCode = (value) => String(value || '').replace(/^AUX_/, '')

const TEMPLATE_URL = new URL(
  '../../docs/templates/template.xlsx',
  import.meta.url,
).href

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const text = String(value).replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

const hasNonZeroAmount = (value) => {
  const number = toNumber(value)
  return number !== null && Math.abs(number) > 0
}

const getCostAmountValue = (code) => costMap.value?.[code]?.amount ?? null
const getCostRateValue = (code) => costMap.value?.[code]?.rate ?? null
const hasFreightCost = computed(() => hasNonZeroAmount(getCostAmountValue('OTHER_EXP_FREIGHT')))

const sanitizeFileName = (value) =>
  String(value || '产品成本计算一览表').replace(/[\\/:*?"<>|]/g, '_')

const loadDetail = async () => {
  if (!meta.value.oaNo || !meta.value.productCode) {
    ElMessage.error('缺少 OA 单号或物料编码')
    return
  }
  try {
    const data = await fetchCostRunDetail(meta.value.oaNo, meta.value.productCode, {
      costRunNo: meta.value.costRunNo || undefined,
    })
    const parts = Array.isArray(data?.partItems) ? data.partItems : []
    const costs = Array.isArray(data?.costItems) ? data.costItems : []
    productAttr.value = toText(data?.productAttr)
    productName.value = toText(data?.productName)
    productModel.value = toText(data?.productModel)
    copperPrice.value = toText(data?.copperPrice)
    zincPrice.value = toText(data?.zincPrice)
    currentCostRunNo.value = toText(data?.costRunNo)
    currentVersionNo.value = toText(data?.versionNo)
    partItems.value = parts.map((item) => ({
      id: item.id,
      partName: toText(item.partName),
      partCode: toText(item.partCode),
      drawingNo: toText(item.partDrawingNo),
      unitPrice: toText(item.unitPrice),
      qty: toText(item.partQty),
      amount: toText(item.amount),
      material: toText(item.material),
      shape: toText(item.shapeAttr),
      priceSource: toText(item.priceSource),
      remark: toText(item.remark),
    }))
    costItems.value = costs
  } catch (error) {
    ElMessage.error(error?.message || '试算结果加载失败')
  }
}

const goBack = () => {
  router.back()
}

const openTraceDrawer = (trace = null) => {
  if (!effectiveCostRunNo.value) {
    ElMessage.info('当前成本表缺少核算批次，无法查看底稿')
    return
  }
  selectedTrace.value = trace
  traceDrawerVisible.value = true
}

const openPartTrace = (item) => {
  const trace = {
    traceType: 'PART_PRICE',
    partItemId: item?.id,
    partCode: item?.partCode,
  }
  if (!trace.partItemId && !trace.partCode) {
    trace.partName = item?.partName || '部品价格'
  }
  openTraceDrawer(trace)
}

const openCostTrace = (costCode) => {
  const item = costMap.value?.[costCode]
  openTraceDrawer({
    traceType: costCode === 'TOTAL' ? 'TOTAL' : 'COST_ITEM',
    costItemId: item?.id,
    costCode,
  })
}

const openOtherExpenseTrace = (name) => {
  const item = getOtherExpenseItemByName(name)
  if (!item) {
    openTraceDrawer({
      traceType: 'COST_ITEM',
      expenseName: name,
    })
    return
  }
  openTraceDrawer({
    traceType: 'COST_ITEM',
    costItemId: item.id,
    costCode: item.costCode,
  })
}

const exportSheet = () => {
  const run = async () => {
    let ExcelJS = null
    try {
      const mod = await import('exceljs')
      ExcelJS = mod?.default || mod
    } catch (error) {
      ElMessage.error('未安装exceljs，请先运行 npm install exceljs')
      return
    }
    const response = await fetch(TEMPLATE_URL)
    if (!response.ok) {
      ElMessage.error('模板读取失败')
      return
    }
    const buffer = await response.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) {
      ElMessage.error('模板表格为空')
      return
    }
    const columnWidths = sheet.columns.map((column) => column?.width)

    const PART_START = 8
    const PART_TEMPLATE_ROWS = 12
    const PART_INSERT_BASE = PART_START + PART_TEMPLATE_ROWS
    const PRE_AUX_GAP_BASE = 24
    const AUX_START = 25
    const AUX_TEMPLATE_ROWS = 4
    const AUX_INSERT_BASE = AUX_START + AUX_TEMPLATE_ROWS
    const AUX_GAP_BASE = 29
    const OTHER_EXP_START = 40
    const OTHER_EXP_TEMPLATE_ROWS = 2
    const OTHER_EXP_INSERT_BASE = OTHER_EXP_START + OTHER_EXP_TEMPLATE_ROWS

    const partCount = partRows.value.length
    const auxCount = auxItems.value.length
    const otherExpenseCount = otherExpenseItems.value.length
    let partDelta = 0
    if (partCount > PART_TEMPLATE_ROWS) {
      const insertCount = partCount - PART_TEMPLATE_ROWS
      sheet.spliceRows(PART_INSERT_BASE, 0, ...Array(insertCount).fill([]))
      const styleRow = sheet.getRow(PART_START)
      for (let i = 0; i < insertCount; i += 1) {
        const targetRow = sheet.getRow(PART_INSERT_BASE + i)
        targetRow.height = styleRow.height
        for (let col = 1; col <= 10; col += 1) {
          const sourceCell = styleRow.getCell(col)
          const targetCell = targetRow.getCell(col)
          targetCell.style = { ...sourceCell.style }
        }
      }
      partDelta = insertCount
    } else if (partCount < PART_TEMPLATE_ROWS) {
      const removeCount = PART_TEMPLATE_ROWS - partCount
      sheet.spliceRows(PART_START + partCount, removeCount)
      partDelta = -removeCount
    }

    let auxDelta = 0
    const rowIndexAfterPart = (base) => {
      let row = base
      if (base >= PART_INSERT_BASE) {
        row += partDelta
      }
      return row
    }

    let preAuxGapDelta = 0
    sheet.spliceRows(rowIndexAfterPart(PRE_AUX_GAP_BASE), 1)
    preAuxGapDelta = -1

    const rowIndexAfterPreGap = (base) => {
      let row = base
      if (base >= PART_INSERT_BASE) {
        row += partDelta
      }
      if (base >= PRE_AUX_GAP_BASE) {
        row += preAuxGapDelta
      }
      return row
    }

    if (auxCount > AUX_TEMPLATE_ROWS) {
      const insertCount = auxCount - AUX_TEMPLATE_ROWS
      const auxInsertRow = rowIndexAfterPreGap(AUX_INSERT_BASE)
      sheet.spliceRows(auxInsertRow, 0, ...Array(insertCount).fill([]))
      const styleRow = sheet.getRow(rowIndexAfterPreGap(AUX_START + 1))
      for (let i = 0; i < insertCount; i += 1) {
        const targetRow = sheet.getRow(auxInsertRow + i)
        targetRow.height = styleRow.height
        for (let col = 1; col <= 10; col += 1) {
          const sourceCell = styleRow.getCell(col)
          const targetCell = targetRow.getCell(col)
          targetCell.style = { ...sourceCell.style }
        }
      }
      auxDelta = insertCount
    } else if (auxCount < AUX_TEMPLATE_ROWS) {
      const removeCount = AUX_TEMPLATE_ROWS - auxCount
      const auxDeleteRow = rowIndexAfterPreGap(AUX_START) + auxCount
      sheet.spliceRows(auxDeleteRow, removeCount)
      auxDelta = -removeCount
    }

    let gapDelta = 0
    const rowIndexAfterAux = (base) => {
      let row = base
      if (base >= PART_INSERT_BASE) {
        row += partDelta
      }
      if (base >= PRE_AUX_GAP_BASE) {
        row += preAuxGapDelta
      }
      if (base >= AUX_INSERT_BASE) {
        row += auxDelta
      }
      return row
    }
    sheet.spliceRows(rowIndexAfterAux(AUX_GAP_BASE), 1)
    gapDelta = -1

    const rowIndexAfterGap = (base) => {
      let row = base
      if (base >= PART_INSERT_BASE) {
        row += partDelta
      }
      if (base >= PRE_AUX_GAP_BASE) {
        row += preAuxGapDelta
      }
      if (base >= AUX_INSERT_BASE) {
        row += auxDelta
      }
      if (base >= AUX_GAP_BASE) {
        row += gapDelta
      }
      return row
    }

    // 模板有 3 个其他费用槽（r40 运费 / r41 模具费 / r42 认证费）。
    // 运费为 0 时删除 r40，让模具费、认证费、总成本行上移。
    let freightRowDelta = 0
    if (!hasFreightCost.value) {
      sheet.spliceRows(rowIndexAfterGap(40), 1)
      freightRowDelta = -1
    }
    const otherExpenseDelta = 0
    void otherExpenseCount  // 仅为了避免 lint 未使用变量警告
    void OTHER_EXP_TEMPLATE_ROWS
    void OTHER_EXP_INSERT_BASE

    const rowIndexFinal = (base) => {
      let row = rowIndexAfterGap(base)
      if (base > 40) {
        row += freightRowDelta
      }
      if (base >= OTHER_EXP_INSERT_BASE) {
        row += otherExpenseDelta
      }
      return row
    }

    const setCellValue = (row, col, value) => {
      const cell = sheet.getCell(row, col)
      if (value === null || value === undefined || value === '') {
        cell.value = null
        return
      }
      cell.value = value
    }

    const clearRow = (row) => {
      for (let col = 1; col <= 10; col += 1) {
        sheet.getCell(row, col).value = null
      }
    }

    const applyMergedRange = (topRow, leftCol, bottomRow, rightCol) => {
      const topCell = sheet.getCell(topRow, leftCol)
      const topValue = topCell.value
      for (let row = topRow; row <= bottomRow; row += 1) {
        for (let col = leftCol; col <= rightCol; col += 1) {
          if (row === topRow && col === leftCol) {
            continue
          }
          sheet.getCell(row, col).value = null
        }
      }
      try {
        sheet.unMergeCells(topRow, leftCol, bottomRow, rightCol)
      } catch (error) {
        // Ignore if the range is not merged.
      }
      sheet.mergeCells(topRow, leftCol, bottomRow, rightCol)
      topCell.value = topValue
    }

    const restoreTemplateMerges = (totalRow) => {
      applyMergedRange(rowIndexFinal(1), 1, rowIndexFinal(1), 10)
      applyMergedRange(rowIndexFinal(30), 1, rowIndexFinal(30), 3)
      applyMergedRange(rowIndexFinal(35), 1, rowIndexFinal(35), 3)
      // 三项费用大标签 rowspan：模板调整后挪到 r37-r39（产品属性占用 r36）
      applyMergedRange(rowIndexFinal(37), 1, rowIndexFinal(39), 1)
      applyMergedRange(totalRow, 1, totalRow, 3)

      const totalLabelCell = sheet.getCell(totalRow, 1)
      totalLabelCell.alignment = {
        ...(totalLabelCell.alignment || {}),
        horizontal: 'center',
        vertical: 'middle',
      }
    }

    setCellValue(rowIndexFinal(3), 2, meta.value.oaNo || '')
    setCellValue(rowIndexFinal(2), 1, displayCostRunNo.value ? `核算批次：${displayCostRunNo.value}` : '')
    sheet.getCell(rowIndexFinal(3), 2).font = {
      ...(sheet.getCell(rowIndexFinal(3), 2).font || {}),
      size: 10,
    }
    setCellValue(rowIndexFinal(3), 4, meta.value.owner || '')
    setCellValue(rowIndexFinal(3), 7, null)
    setCellValue(rowIndexFinal(3), 9, null)
    setCellValue(rowIndexFinal(4), 2, meta.value.customerName || '')
    setCellValue(rowIndexFinal(4), 4, meta.value.series || '')
    setCellValue(rowIndexFinal(4), 7, null)
    setCellValue(rowIndexFinal(5), 2, productName.value || meta.value.productName || '')
    setCellValue(rowIndexFinal(5), 4, meta.value.productCode || '')
    setCellValue(rowIndexFinal(5), 7, toNumber(copperPrice.value) ?? copperPrice.value)
    setCellValue(
      rowIndexFinal(6),
      2,
      productModel.value || meta.value.productModel || '',
    )
    setCellValue(rowIndexFinal(6), 4, meta.value.customerDrawing || '')
    setCellValue(rowIndexFinal(6), 7, toNumber(zincPrice.value) ?? zincPrice.value)

    const partStartRow = rowIndexFinal(PART_START)
    partRows.value.forEach((item, index) => {
      const row = partStartRow + index
      setCellValue(row, 1, item.partName)
      setCellValue(row, 2, item.partCode)
      setCellValue(row, 3, item.drawingNo)
      setCellValue(row, 4, toNumber(item.unitPrice) ?? item.unitPrice)
      setCellValue(row, 5, toNumber(item.qty) ?? item.qty)
      setCellValue(row, 6, toNumber(item.amount) ?? item.amount)
      setCellValue(row, 7, item.material)
      setCellValue(row, 8, item.shape)
      setCellValue(row, 9, item.priceSource)
      setCellValue(row, 10, item.remark)
    })

    setCellValue(rowIndexFinal(20), 6, toNumber(getCostAmountValue('OVERHAUL')))
    setCellValue(rowIndexFinal(21), 6, toNumber(getCostAmountValue('TOOLING_REPAIR')))
    setCellValue(rowIndexFinal(22), 6, toNumber(getCostAmountValue('WATER_POWER')))
    setCellValue(rowIndexFinal(23), 6, toNumber(getCostAmountValue('DEPT_OTHER')))

    const auxStartRow = rowIndexFinal(AUX_START)
    auxItems.value.forEach((item, index) => {
      const row = auxStartRow + index
      setCellValue(row, 1, item.costName || '')
      setCellValue(row, 3, getAuxCode(item.costCode))
      setCellValue(row, 6, toNumber(item.amount))
    })

    setCellValue(rowIndexFinal(30), 6, toNumber(getCostAmountValue('MATERIAL')))
    setCellValue(rowIndexFinal(31), 6, toNumber(getCostAmountValue('DIRECT_LABOR')))
    setCellValue(rowIndexFinal(32), 6, toNumber(getCostAmountValue('INDIRECT_LABOR')))
    setCellValue(rowIndexFinal(33), 3, formatRate(getCostRateValue('LOSS')))
    setCellValue(rowIndexFinal(33), 6, toNumber(getCostAmountValue('LOSS')))
    setCellValue(rowIndexFinal(34), 3, formatRate(getCostRateValue('MANUFACTURE')))
    setCellValue(rowIndexFinal(34), 6, toNumber(getCostAmountValue('MANUFACTURE')))
    setCellValue(rowIndexFinal(35), 6, toNumber(getCostAmountValue('MANUFACTURE_COST')))
    // 模板已调整：r36=产品属性 → r37/38/39=三项费用（与见机表 r54/r55-57 顺序一致）
    setCellValue(rowIndexFinal(36), 2, productAttr.value || '')
    setCellValue(
        rowIndexFinal(36), 3,
        formatCoefficient(getCostRateValue('ADJUSTED_MANUFACTURE_COST')))
    setCellValue(
        rowIndexFinal(36), 6,
        toNumber(getCostAmountValue('ADJUSTED_MANUFACTURE_COST')))
    setCellValue(rowIndexFinal(37), 3, formatRate(getCostRateValue('MGMT_EXP')))
    setCellValue(rowIndexFinal(37), 6, toNumber(getCostAmountValue('MGMT_EXP')))
    setCellValue(rowIndexFinal(38), 3, formatRate(getCostRateValue('SALES_EXP')))
    setCellValue(rowIndexFinal(38), 6, toNumber(getCostAmountValue('SALES_EXP')))
    setCellValue(rowIndexFinal(39), 3, formatRate(getCostRateValue('FIN_EXP')))
    setCellValue(rowIndexFinal(39), 6, toNumber(getCostAmountValue('FIN_EXP')))
    // 模板 r40/r41/r42 对应运费/模具费/认证费；运费为 0 时整行已删除。
    // 仅填 col6 金额；包装费已在材料费里（T24）不在这里展示
    if (hasFreightCost.value) {
      setCellValue(rowIndexFinal(40), 6, toNumber(getCostAmountValue('OTHER_EXP_FREIGHT')))
    }
    setCellValue(rowIndexFinal(41), 6, toNumber(getOtherExpenseValueByName('模具费')))
    setCellValue(rowIndexFinal(42), 6, toNumber(getOtherExpenseValueByName('认证费')))
    const totalRow = rowIndexFinal(43)
    setCellValue(totalRow, 6, toNumber(getCostAmountValue('TOTAL')))
    setCellValue(totalRow, 2, null)
    setCellValue(totalRow, 3, null)
    restoreTemplateMerges(totalRow)

    if (columnWidths.length > 0) {
      sheet.columns.forEach((column, index) => {
        if (!column) {
          return
        }
        const width = columnWidths[index]
        if (width !== undefined) {
          column.width = width
        }
      })
    }

    const outBuffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([outBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const fileName = sanitizeFileName(
      `${meta.value.oaNo || ''}_${meta.value.productCode || ''}_产品成本计算一览表.xlsx`,
    )
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }
  run().catch((err) => {
    // 暴露真实错误到 console + toast，方便定位（比单纯"导出失败"友好）
    // eslint-disable-next-line no-console
    console.error('[exportSheet] failed:', err)
    ElMessage.error('导出失败：' + (err?.message || String(err)))
  })
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.cost-run-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.sheet-wrapper {
  overflow-x: auto;
  background: #fff;
}

.sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #1f2a37;
  table-layout: fixed;
  min-width: 980px;
  border: none;
}

.meta-label {
  font-weight: 600;
}

.sheet-table th,
.sheet-table td {
  border: 1px solid #8b8b8b;
  padding: 6px 8px;
  text-align: center;
}

.sheet-table th:first-child,
.sheet-table td:first-child {
  border-left: 2px solid #111;
}

.no-left-strong td:first-child {
  border-left: 1px solid #8b8b8b;
}

.sheet-table th:last-child,
.sheet-table td:last-child {
  border-right: 2px solid #111;
}

.sheet-table th {
  font-weight: 600;
}

.title-row td {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  padding: 12px 0 6px;
}

.blank-row td {
  height: 10px;
}

.part-header-row td {
  background: #49a8ff;
  color: #fff;
  font-weight: 600;
}

.part-code {
  white-space: nowrap;
  font-size: 11px;
}

.section-row td {
  background: #fff;
  font-weight: 600;
}

.section-row .section-center {
  text-align: center;
}

.section-center {
  text-align: center;
  font-weight: 700;
}

.left-label {
  text-align: left;
  font-weight: 600;
}

.row-label {
  text-align: left;
  font-weight: 600;
}

.left-blue td:first-child,
.left-blue .left-label,
td.left-blue {
  font-weight: 700;
}

.attr-row td:nth-child(-n + 3) {
  font-weight: 700;
}

.attr-warn {
  font-weight: 600;
}

.formula {
  text-align: left;
  white-space: nowrap;
}

.rate {
  font-weight: 600;
}

.amount {
  font-weight: 700;
}

.trace-link {
  max-width: 100%;
  border: 0;
  background: transparent;
  color: #1f2a37;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.trace-link:hover,
.trace-link:focus {
  color: #409eff;
  outline: none;
}

.trace-link.strong {
  font-weight: 700;
}

.dash-row td {
  color: #9ca3af;
}

.footer-row td {
  font-weight: 600;
  text-align: left;
  border-bottom: 2px solid #111;
}

.col-1 {
  width: 90px;
}
.col-2 {
  width: 90px;
}
.col-3 {
  width: 90px;
}
.col-4 {
  width: 90px;
}
.col-5 {
  width: 90px;
}
.col-6 {
  width: 90px;
}
.col-7 {
  width: 90px;
}
.col-8 {
  width: 90px;
}
.col-9 {
  width: 90px;
}
.col-10 {
  width: 110px;
}

.total-row td {
  font-weight: 700;
  background: #fff;
}

.total-label {
  text-align: center;
}

/* T13：缺价行（NO_ROUTE / ERROR）整行红色背景 + 红字 */
.row-miss td {
  background: #fde2e2 !important;
  color: #c0392b !important;
}
</style>
