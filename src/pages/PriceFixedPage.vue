<template>
  <div class="fixed-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">固定采购价</div>
        <div class="filter-actions">
          <el-button v-if="returnToWorkbenchVisible" @click="returnToWorkbench">
            返回核算工作台
          </el-button>
          <el-upload
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".xlsx,.xls,.csv"
            :on-change="handleFileChange"
          >
            <el-button :loading="importing">导入</el-button>
          </el-upload>
          <el-button type="primary" @click="openCreate">新增</el-button>
        </div>
      </div>
      <!-- 固定采购价页面只展示 PURCHASE_FIXED，结算固定价后续独立页面维护。 -->
      <el-form :inline="true" label-width="90px">
        <el-form-item label="结算期间">
          <el-date-picker
            v-model="filters.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="2026-03"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="1008000300944" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="filters.supplierCode" placeholder="1004" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <!-- FPT-04：固定采购价页面只查 PURCHASE_FIXED。 -->
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <el-tag :type="sourceTagType(row.sourceType)" size="small">
              {{ sourceLabel(row.sourceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pricingMonth" label="结算期间" width="100" />
        <el-table-column prop="materialName" label="物料名称" min-width="140" />
        <el-table-column prop="materialCode" label="物料代码" width="160" />
        <el-table-column prop="specModel" label="规格型号" width="140" />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column prop="fixedPrice" label="现不含税价格" width="120" />
        <el-table-column label="是否含税" width="80">
          <template #default="{ row }">
            {{ row.taxIncluded ? '含税' : '未税' }}
          </template>
        </el-table-column>
        <el-table-column prop="externalRowId" label="id" width="100" />
        <el-table-column prop="srmDocNo" label="SRM单据编号" width="160" />
        <el-table-column prop="processStatus" label="流程状态" width="100" />
        <!-- 采购件专属：供应商 + 流程编号 -->
        <el-table-column prop="supplierName" label="供应商名称" min-width="140" />
        <el-table-column prop="currentSupplierName" label="现供方名称" min-width="140" />
        <el-table-column prop="processNo" label="流程编号" width="180" />
        <el-table-column prop="blankWeight" label="下料重" width="100" />
        <el-table-column prop="netWeight" label="净重" width="100" />
        <el-table-column prop="currentTaxIncludedPrice" label="现含税价格" width="110" />
        <el-table-column prop="executionPeriodText" label="执行日期" width="180" />
        <el-table-column prop="remark" label="备注" min-width="120" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link @click="removeRow(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px">
      <el-form :model="formModel" label-width="90px">
        <!-- 本页固定写入 PURCHASE_FIXED，避免和结算固定价混用。 -->
        <el-form-item label="结算期间" required>
          <el-date-picker v-model="formModel.pricingMonth" type="month"
                          format="YYYY-MM" value-format="YYYY-MM" placeholder="2026-03"
                          style="width: 100%" />
        </el-form-item>
        <el-form-item label="组织">
          <el-input v-model="formModel.orgCode" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="formModel.sourceName" />
        </el-form-item>
        <el-form-item label="供应商名称">
          <el-input v-model="formModel.supplierName" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="formModel.supplierCode" />
        </el-form-item>
        <el-form-item label="采购分类">
          <el-input v-model="formModel.purchaseClass" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="规格型号">
          <el-input v-model="formModel.specModel" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" />
        </el-form-item>
        <el-form-item label="联动公式">
          <el-input v-model="formModel.formulaExpr" />
        </el-form-item>
        <el-form-item label="下料重">
          <el-input v-model="formModel.blankWeight" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input v-model="formModel.netWeight" />
        </el-form-item>
        <el-form-item label="加工费">
          <el-input v-model="formModel.processFee" />
        </el-form-item>
        <el-form-item label="代理费">
          <el-input v-model="formModel.agentFee" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="formModel.fixedPrice" />
        </el-form-item>
        <el-form-item label="是否含税">
          <el-select v-model="formModel.taxIncluded" placeholder="含税">
            <el-option label="含税" :value="true" />
            <el-option label="未税" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="formModel.effectiveFrom"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker
            v-model="formModel.effectiveTo"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-input v-model="formModel.orderType" />
        </el-form-item>
        <el-form-item label="配额">
          <el-input v-model="formModel.quota" />
        </el-form-item>
        <!-- V46 新字段：根据 sourceType 隐式分组 -->
        <el-form-item label="流程编号">
          <el-input v-model="formModel.processNo" placeholder="SC-SC-001-20260227-001" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formModel.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchFixedItems,
  importFixedItems,
  createFixedItem,
  updateFixedItem,
  deleteFixedItem,
} from '../api/priceFixedItems'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const FIXED_PURCHASE_SOURCE_TYPE = 'PURCHASE_FIXED'

// FPT-04：本页面只展示固定采购价，结算固定价后续单独菜单维护。
const SOURCE_TYPE_OPTIONS = [
  { value: FIXED_PURCHASE_SOURCE_TYPE, label: '固定采购价', tag: 'primary' },
  { value: 'PURCHASE', label: '固定采购价(旧)', tag: 'info' },
]
const sourceLabel = (v) =>
  SOURCE_TYPE_OPTIONS.find((o) => o.value === v)?.label || v || '-'
const sourceTagType = (v) =>
  SOURCE_TYPE_OPTIONS.find((o) => o.value === v)?.tag || ''

const filters = ref({
  pricingMonth: '2026-03',
  materialCode: '',
  supplierCode: '',
})
const returnToWorkbenchVisible = computed(() => Boolean(route.query.returnTo))

const returnToWorkbench = () => {
  const target = String(route.query.returnTo || '')
  if (!target) return
  router.push(target)
}

const applyRouteContext = () => {
  const materialCode = String(route.query.materialCode || '').trim()
  const pricingMonth = String(route.query.pricingMonth || route.query.periodMonth || '').trim()
  if (materialCode) filters.value.materialCode = materialCode
  if (pricingMonth) filters.value.pricingMonth = pricingMonth
}

const formModel = ref({
  orgCode: '',
  sourceName: '',
  supplierName: '',
  supplierCode: '',
  purchaseClass: '',
  materialName: '',
  materialCode: '',
  specModel: '',
  unit: '',
  formulaExpr: '',
  blankWeight: '',
  netWeight: '',
  processFee: '',
  agentFee: '',
  fixedPrice: '',
  taxIncluded: true,
  effectiveFrom: '',
  effectiveTo: '',
  orderType: '',
  quota: '',
  // V46 新字段
  sourceType: FIXED_PURCHASE_SOURCE_TYPE,
  pricingMonth: '2026-03',
  processNo: '',
  remark: '',
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑固定采购价' : '新增固定采购价',
)

const buildParams = () => ({
  sourceType: FIXED_PURCHASE_SOURCE_TYPE,
  pricingMonth: filters.value.pricingMonth || undefined,// V46：月份选择器
  materialCode: filters.value.materialCode.trim(),
  supplierCode: filters.value.supplierCode.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchFixedItems(buildParams())
    tableRows.value = data?.list || []
    total.value = data?.total || 0
  } catch (error) {
    tableRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

watch(currentPage, () => {
  fetchList()
})

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

const applyFilters = () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    pricingMonth: '2026-03',
    materialCode: '',
    supplierCode: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    orgCode: '',
    sourceName: '',
    supplierName: '',
    supplierCode: '',
    purchaseClass: '',
    materialName: '',
    materialCode: '',
    specModel: '',
    unit: '',
    formulaExpr: '',
    blankWeight: '',
    netWeight: '',
    processFee: '',
    agentFee: '',
    fixedPrice: '',
    taxIncluded: true,
    effectiveFrom: '',
    effectiveTo: '',
    orderType: '',
    quota: '',
    sourceType: FIXED_PURCHASE_SOURCE_TYPE,
    pricingMonth: filters.value.pricingMonth || '2026-03',
    processNo: '',
    remark: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    orgCode: row.orgCode ?? '',
    sourceName: row.sourceName ?? '',
    supplierName: row.supplierName ?? '',
    supplierCode: row.supplierCode ?? '',
    purchaseClass: row.purchaseClass ?? '',
    materialName: row.materialName ?? '',
    materialCode: row.materialCode ?? '',
    specModel: row.specModel ?? '',
    unit: row.unit ?? '',
    formulaExpr: row.formulaExpr ?? '',
    blankWeight: row.blankWeight ?? '',
    netWeight: row.netWeight ?? '',
    processFee: row.processFee ?? '',
    agentFee: row.agentFee ?? '',
    fixedPrice: row.fixedPrice ?? '',
    taxIncluded: row.taxIncluded === null ? true : !!row.taxIncluded,
    effectiveFrom: row.effectiveFrom ?? '',
    effectiveTo: row.effectiveTo ?? '',
    orderType: row.orderType ?? '',
    quota: row.quota ?? '',
    // V46 新字段
    sourceType: row.sourceType ?? FIXED_PURCHASE_SOURCE_TYPE,
    pricingMonth: row.pricingMonth ?? '2026-03',
    processNo: row.processNo ?? '',
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

const parseExcelDateParts = (value) => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hour = String(value.getHours()).padStart(2, '0')
    const minute = String(value.getMinutes()).padStart(2, '0')
    const second = String(value.getSeconds()).padStart(2, '0')
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}:${second}` }
  }
  const text = String(value).trim()
  if (!text) {
    return null
  }
  const fullYearMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (fullYearMatch) {
    const time = fullYearMatch[4]
      ? `${fullYearMatch[4].padStart(2, '0')}:${fullYearMatch[5].padStart(2, '0')}:${(fullYearMatch[6] || '0').padStart(2, '0')}`
      : '00:00:00'
    return {
      date: `${fullYearMatch[1]}-${fullYearMatch[2].padStart(2, '0')}-${fullYearMatch[3].padStart(2, '0')}`,
      time,
    }
  }
  const shortYearMatch = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (shortYearMatch) {
    const rawYear = shortYearMatch[3]
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    const time = shortYearMatch[4]
      ? `${shortYearMatch[4].padStart(2, '0')}:${shortYearMatch[5].padStart(2, '0')}:${(shortYearMatch[6] || '0').padStart(2, '0')}`
      : '00:00:00'
    return {
      date: `${year}-${shortYearMatch[1].padStart(2, '0')}-${shortYearMatch[2].padStart(2, '0')}`,
      time,
    }
  }
  return null
}

const normalizeDate = (value) => {
  const parts = parseExcelDateParts(value)
  return parts ? parts.date : ''
}

const normalizeDateTime = (value) => {
  const parts = parseExcelDateParts(value)
  if (!parts) {
    return ''
  }
  return `${parts.date}T${parts.time}`
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const submitRow = async () => {
  if (!formModel.value.materialCode || formModel.value.fixedPrice === '') {
    ElMessage.warning('物料代码和单价必填')
    return
  }
  const payload = {
    orgCode: formModel.value.orgCode,
    sourceName: formModel.value.sourceName,
    supplierName: formModel.value.supplierName,
    supplierCode: formModel.value.supplierCode,
    purchaseClass: formModel.value.purchaseClass,
    materialName: formModel.value.materialName,
    materialCode: formModel.value.materialCode,
    specModel: formModel.value.specModel,
    unit: formModel.value.unit,
    formulaExpr: formModel.value.formulaExpr,
    blankWeight: parseNumber(formModel.value.blankWeight),
    netWeight: parseNumber(formModel.value.netWeight),
    processFee: parseNumber(formModel.value.processFee),
    agentFee: parseNumber(formModel.value.agentFee),
    fixedPrice: parseNumber(formModel.value.fixedPrice),
    taxIncluded: formModel.value.taxIncluded,
    effectiveFrom: formModel.value.effectiveFrom || null,
    effectiveTo: formModel.value.effectiveTo || null,
    orderType: formModel.value.orderType,
    quota: parseNumber(formModel.value.quota),
    // V46 新字段
    sourceType: FIXED_PURCHASE_SOURCE_TYPE,
    pricingMonth: formModel.value.pricingMonth,
    processNo: formModel.value.processNo,
    remark: formModel.value.remark,
  }
  try {
    if (editingId.value) {
      await updateFixedItem(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createFixedItem(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (error) {
    return
  }
  try {
    await deleteFixedItem(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const normalizeHeader = (value) =>
  String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()

const parseExecutionPeriod = (value) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return { effectiveFrom: null, effectiveTo: null }
  }
  const matches = [...text.matchAll(/(\d{4})(?:[-/.年])(\d{1,2})(?:[-/.月])(\d{1,2})(?:日)?/g)]
  const toDate = (match) => match
    ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    : null
  return {
    effectiveFrom: toDate(matches[0]),
    effectiveTo: toDate(matches[1]),
  }
}

const isU9ProcessNo = (value) => String(value || '').trim().toUpperCase().startsWith('U9')

const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  importing.value = true
  try {
    let XLSX = null
    try {
      const mod = await import('xlsx')
      XLSX = mod
    } catch (error) {
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }
    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === normalizeHeader('固定采购价5'))
    if (!sheetName) {
      ElMessage.error('未找到固定采购价5 sheet')
      return
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    const headerAliases = {
      externalRowId: ['id'],
      processStatus: ['流程状态'],
      srmDocNo: ['SRM单据编号'],
      processNo: ['流程编号'],
      materialCategory: ['物料类别'],
      materialCode: ['物料代码'],
      materialName: ['物料名称'],
      specModel: ['规格型号', '型号'],
      unit: ['价格单位'],
      taxRate: ['税率'],
      blankWeight: ['下料重量'],
      netWeight: ['产品净重'],
      originalProcessFee: ['原不含税加工费'],
      originalProcessFeeTaxIncluded: ['原含税加工费'],
      originalTaxExcludedPrice: ['原不含税价格'],
      originalTaxIncludedPrice: ['原含税价格'],
      originalSupplierName: ['原供方名称'],
      currentProcessFee: ['现不含税加工费'],
      currentProcessFeeTaxIncluded: ['现含税加工费'],
      fixedPrice: ['现不含税价格'],
      currentTaxIncludedPrice: ['现含税价格'],
      currentSupplierName: ['现供方名称'],
      changeAmount: ['上涨额'],
      changeRate: ['幅度'],
      executionPeriodText: ['执行日期'],
      annualUsageText: ['预计年用量'],
      applicant: ['申请人'],
      applyDept: ['申请部门'],
      marketSituation: ['市场行情'],
      similarCompare: ['类似物比较'],
      approvalConclusion: ['结论'],
      approvalType: ['审批表类型'],
      businessDivision: ['涉及事业部'],
      generalManagerApprovedAt: ['总经理批准时间'],
      trackingDate: ['板分法跟踪日期'],
      printFlag: ['是否打印'],
      remark: ['备注'],
    }
    const headerMap = Object.entries(headerAliases).reduce((acc, [key, values]) => {
      values.forEach((value) => {
        acc[normalizeHeader(value)] = key
      })
      return acc
    }, {})
    const headerKeys = Object.keys(headerMap).sort((a, b) => b.length - a.length)
    const resolveHeaderField = (cell) => {
      const normalized = normalizeHeader(cell)
      if (!normalized) {
        return null
      }
      if (headerMap[normalized]) {
        return headerMap[normalized]
      }
      const matched = headerKeys.find((key) => normalized.includes(key))
      return matched ? headerMap[matched] : null
    }
    const headerIndex = rows.reduce(
      (best, row, index) => {
        const hitCount = row.reduce((count, cell) => {
          return resolveHeaderField(cell) ? count + 1 : count
        }, 0)
        if (hitCount > best.count) {
          return { index, count: hitCount }
        }
        return best
      },
      { index: -1, count: 0 },
    ).index
    if (headerIndex === -1) {
      ElMessage.error('固定采购价5 未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerIndex]
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field) {
        fieldIndex[field] = index
      }
    })

    const requiredFields = ['externalRowId', 'materialCode', 'materialName', 'fixedPrice']
    const requiredLabels = {
      externalRowId: 'id',
      materialCode: '物料代码',
      materialName: '物料名称',
      fixedPrice: '现不含税价格',
    }
    const missing = requiredFields.filter((field) => fieldIndex[field] === undefined)
    if (missing.length > 0) {
      const names = missing.map((field) => requiredLabels[field] || field)
      ElMessage.error(`缺少表头：${names.join('、')}`)
      return
    }
    let skippedInvalid = 0
    const dataRows = rows.slice(headerIndex + 1).map((row, offset) => {
      const processNo = String(row[fieldIndex.processNo] || '').trim()
      const executionPeriodText = String(row[fieldIndex.executionPeriodText] || '').trim()
      const { effectiveFrom, effectiveTo } = parseExecutionPeriod(executionPeriodText)
      const srmDocNo = String(row[fieldIndex.srmDocNo] || '').trim()
      const currentTaxExcludedPrice = parseNumber(row[fieldIndex.fixedPrice])
      const u9Source = isU9ProcessNo(processNo)
      return {
        externalRowId: String(row[fieldIndex.externalRowId] || '').trim(),
        processStatus: String(row[fieldIndex.processStatus] || '').trim(),
        srmDocNo,
        processNo,
        materialCategory: String(row[fieldIndex.materialCategory] || '').trim(),
        materialCode: String(row[fieldIndex.materialCode] || '').trim(),
        materialName: String(row[fieldIndex.materialName] || '').trim(),
        specModel: String(row[fieldIndex.specModel] || '').trim(),
        unit: String(row[fieldIndex.unit] || '').trim(),
        taxRate: parseNumber(row[fieldIndex.taxRate]),
        blankWeight: parseNumber(row[fieldIndex.blankWeight]),
        netWeight: parseNumber(row[fieldIndex.netWeight]),
        originalProcessFee: parseNumber(row[fieldIndex.originalProcessFee]),
        originalProcessFeeTaxIncluded: parseNumber(row[fieldIndex.originalProcessFeeTaxIncluded]),
        originalTaxExcludedPrice: parseNumber(row[fieldIndex.originalTaxExcludedPrice]),
        originalTaxIncludedPrice: parseNumber(row[fieldIndex.originalTaxIncludedPrice]),
        originalSupplierName: String(row[fieldIndex.originalSupplierName] || '').trim(),
        currentProcessFee: parseNumber(row[fieldIndex.currentProcessFee]),
        currentProcessFeeTaxIncluded: parseNumber(row[fieldIndex.currentProcessFeeTaxIncluded]),
        // 现不含税价格对齐当前系统固定价主价格字段 fixedPrice，参与成本计算取价。
        currentTaxExcludedPrice,
        fixedPrice: currentTaxExcludedPrice,
        currentTaxIncludedPrice: parseNumber(row[fieldIndex.currentTaxIncludedPrice]),
        currentSupplierName: String(row[fieldIndex.currentSupplierName] || '').trim(),
        supplierName: String(row[fieldIndex.currentSupplierName] || '').trim(),
        changeAmount: parseNumber(row[fieldIndex.changeAmount]),
        changeRate: parseNumber(row[fieldIndex.changeRate]),
        executionPeriodText,
        effectiveFrom,
        effectiveTo,
        annualUsageText: String(row[fieldIndex.annualUsageText] || '').trim(),
        applicant: String(row[fieldIndex.applicant] || '').trim(),
        applyDept: String(row[fieldIndex.applyDept] || '').trim(),
        marketSituation: String(row[fieldIndex.marketSituation] || '').trim(),
        similarCompare: String(row[fieldIndex.similarCompare] || '').trim(),
        approvalConclusion: String(row[fieldIndex.approvalConclusion] || '').trim(),
        approvalType: String(row[fieldIndex.approvalType] || '').trim(),
        businessDivision: String(row[fieldIndex.businessDivision] || '').trim(),
        generalManagerApprovedAt: normalizeDateTime(row[fieldIndex.generalManagerApprovedAt]) || null,
        trackingDate: normalizeDate(row[fieldIndex.trackingDate]) || null,
        printFlag: String(row[fieldIndex.printFlag] || '').trim(),
        sourceType: FIXED_PURCHASE_SOURCE_TYPE,
        sourceSystem: u9Source ? 'U9' : srmDocNo ? 'SRM' : 'EXCEL',
        sourceSheetName: sheetName,
        sourceRowNo: headerIndex + offset + 2,
        pricingMonth: filters.value.pricingMonth || '2026-03',
        taxIncluded: false,
      }
    }).filter((row) => {
      // U9C-应付单列表没有稳定 id，按料号幂等导入；SRM/OA 行仍要求 id。
      const hasStableKey = row.sourceSystem === 'U9' ? row.materialCode : row.externalRowId
      const valid = hasStableKey && row.materialCode && row.materialName && row.fixedPrice !== null
      if (!valid) {
        skippedInvalid += 1
      }
      return valid
    })
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importFixedItems({
      importFileName: rawFile.name,
      sourceBatchNo: `FIXED_PURCHASE_${Date.now()}`,
      rows: dataRows,
    })
    const created = result?.createdCount ?? 0
    const updated = result?.updatedCount ?? 0
    const skipped = (result?.skippedCount ?? 0) + skippedInvalid
    ElMessage.success(`固定采购价导入完成：新增${created}条，更新${updated}条，跳过${skipped}条`)
    if (currentPage.value === 1) {
      fetchList()
    } else {
      currentPage.value = 1
    }
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  applyRouteContext()
  fetchList()
})
</script>

<style scoped>
.fixed-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

</style>
