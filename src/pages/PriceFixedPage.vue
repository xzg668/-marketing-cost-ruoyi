<template>
  <div class="fixed-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">固定价</div>
        <div class="filter-actions">
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
      <!-- V46：source_type tab 切换 + 结算期间 + 物料/供应商 筛选 -->
      <el-tabs v-model="filters.sourceType" class="source-type-tabs" @tab-change="applyFilters">
        <el-tab-pane
          v-for="opt in SOURCE_TYPE_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :name="opt.value"
        />
      </el-tabs>
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
        <!-- V46 新加：来源类型 tag + 结算期间 -->
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
        <el-table-column prop="fixedPrice" label="单价" width="100" />
        <el-table-column label="是否含税" width="80">
          <template #default="{ row }">
            {{ row.taxIncluded ? '含税' : '未税' }}
          </template>
        </el-table-column>
        <!-- 采购件专属：供应商 + 流程编号 -->
        <el-table-column prop="supplierName" label="供应商名称" min-width="140" />
        <el-table-column prop="processNo" label="流程编号" width="180" />
        <!-- 自制件专属：下料重 / 净重 -->
        <el-table-column prop="blankWeight" label="下料重" width="100" />
        <el-table-column prop="netWeight" label="净重" width="100" />
        <!-- 结算价专属：计划价 + 上浮比例 + V47 双口径 -->
        <el-table-column prop="plannedPrice" label="计划价" width="100" />
        <el-table-column prop="markupRatio" label="上浮比例" width="90" />
        <el-table-column prop="baseSettlePrice" label="基准结算价" width="110" />
        <el-table-column prop="linkedSettlePrice" label="联动结算价" width="110" />
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
        <!-- V46 新字段优先放前面：来源类型 + 结算期间是核心维度 -->
        <el-form-item label="来源类型" required>
          <el-select v-model="formModel.sourceType" style="width: 100%">
            <el-option v-for="opt in SOURCE_TYPE_OPTIONS" :key="opt.value"
                       :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
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
        <el-form-item v-if="formModel.sourceType === 'PURCHASE'" label="流程编号">
          <el-input v-model="formModel.processNo" placeholder="SC-SC-001-20260227-001" />
        </el-form-item>
        <el-form-item v-if="formModel.sourceType === 'SETTLE'" label="计划价">
          <el-input v-model="formModel.plannedPrice" placeholder="0.4202" />
        </el-form-item>
        <el-form-item v-if="formModel.sourceType === 'SETTLE'" label="上浮比例">
          <el-input v-model="formModel.markupRatio" placeholder="1.2000" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchFixedItems,
  importFixedItems,
  createFixedItem,
  updateFixedItem,
  deleteFixedItem,
} from '../api/priceFixedItems'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

// V46/V48：source_type 仅保留 PURCHASE/SETTLE 两类（自制件归 lp_make_part_spec、废料归 lp_price_scrap，
// 各自独立页面，不再在固定价 tab 里展示）
const SOURCE_TYPE_OPTIONS = [
  { value: 'PURCHASE', label: '采购件', tag: 'primary' },
  { value: 'SETTLE',   label: '结算价', tag: 'warning' },
]
const sourceLabel = (v) =>
  SOURCE_TYPE_OPTIONS.find((o) => o.value === v)?.label || v || '-'
const sourceTagType = (v) =>
  SOURCE_TYPE_OPTIONS.find((o) => o.value === v)?.tag || ''

const filters = ref({
  sourceType: 'PURCHASE',
  pricingMonth: '2026-03',
  materialCode: '',
  supplierCode: '',
})

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
  sourceType: 'PURCHASE',
  pricingMonth: '2026-03',
  processNo: '',
  plannedPrice: '',
  markupRatio: '',
  remark: '',
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑固定价' : '新增固定价',
)

const buildParams = () => ({
  sourceType: filters.value.sourceType || undefined,    // V46：tab 切换
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
    sourceType: 'PURCHASE',
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
    sourceType: row.sourceType ?? 'PURCHASE',
    pricingMonth: row.pricingMonth ?? '2026-03',
    processNo: row.processNo ?? '',
    plannedPrice: row.plannedPrice ?? '',
    markupRatio: row.markupRatio ?? '',
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

const normalizeDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return text.replace(/\//g, '-')
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseBoolean = (value) => {
  if (value === true || value === false) {
    return value
  }
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) {
    return null
  }
  if (['1', 'true', 'yes', 'y', '是', '含税'].includes(text)) {
    return true
  }
  if (['0', 'false', 'no', 'n', '否', '未税'].includes(text)) {
    return false
  }
  return null
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
    sourceType: formModel.value.sourceType,
    pricingMonth: formModel.value.pricingMonth,
    processNo: formModel.value.processNo,
    plannedPrice: parseNumber(formModel.value.plannedPrice),
    markupRatio: parseNumber(formModel.value.markupRatio),
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
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    const headerAliases = {
      orgCode: ['组织'],
      sourceName: ['来源'],
      supplierName: ['供应商名称', '现供方名称'],         // V46：固定采购价 sheet 用"现供方名称"
      supplierCode: ['供应商代码'],
      purchaseClass: ['采购分类'],
      materialName: ['物料名称', '料品名称'],           // V46：家用结算价 sheet 用"料品名称"
      materialCode: ['物料代码', '物料编码', '料号'],    // V46：自制件/家用结算价用"料号"
      specModel: ['规格型号', '型号', '图号'],           // V46：自制件 sheet 用"图号"
      unit: ['单位'],
      formulaExpr: ['联动公式'],
      blankWeight: ['下料重', '下料量', '下料重量'],     // V46：自制件 sheet 用"下料重量"
      netWeight: ['净重'],
      processFee: ['加工费'],
      agentFee: ['代理费'],
      // 注意：'基准结算价' / '联动结算价' **故意不放在这里**，否则会在 SETTLE sheet 跟
      //   baseSettlePrice/linkedSettlePrice 抢 alias，导致 fixedPrice 误命中 C5。
      //   SETTLE sheet 的真实取价列是"铜价（90000元/吨）"，由下方 settle 分支专门处理
      fixedPrice: ['单价', '固定价', '现不含税价格', '零件价格'],  // V46 3 个非 SETTLE sheet 的价格列
      taxIncluded: ['是否含税'],
      effectiveFrom: ['生效日期'],
      effectiveTo: ['失效日期'],
      orderType: ['订单类型'],
      quota: ['配额'],
      // V46 新字段
      processNo: ['流程编号'],                          // 来自固定采购价5
      plannedPrice: ['计划价'],                         // 来自家用结算价9 C3
      markupRatio: ['上浮比例'],                        // 来自家用结算价9 C4
      baseSettlePrice: ['基准结算价'],                  // V47：家用结算价9 C5
      linkedSettlePrice: ['联动结算价'],                // V47：家用结算价9 C6
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
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerIndex]
    const nextHeaderRow = rows[headerIndex + 1] || []
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field) {
        fieldIndex[field] = index
      }
    })
    nextHeaderRow.forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field && fieldIndex[field] === undefined) {
        fieldIndex[field] = index
      }
    })
    // V47 + A 方案：当用户在 SETTLE tab 上传家用结算价 sheet 时，
    //   fixedPrice 不从通用 alias 取，而是按"含'铜价' 关键字" 找列（VLOOKUP 公式真正命中的列）
    //   同时把"基准结算价" / "联动结算价" 列识别为 baseSettlePrice / linkedSettlePrice
    if (filters.value.sourceType === 'SETTLE') {
      const findHeaderIdx = (kw) => {
        const i = headerRow.findIndex((c) => normalizeHeader(c).includes(kw))
        return i >= 0 ? i : nextHeaderRow.findIndex((c) => normalizeHeader(c).includes(kw))
      }
      // SETTLE 真取价列：表头含"铜价"（家用结算价9 C8 = "铜价（90000元/吨...）"）
      const settlePriceIdx = findHeaderIdx('铜价')
      if (settlePriceIdx >= 0) {
        fieldIndex.fixedPrice = settlePriceIdx
      }
      // 顺手把基准 / 联动结算价识别出来
      const baseIdx = findHeaderIdx('基准结算价')
      if (baseIdx >= 0 && fieldIndex.baseSettlePrice === undefined) {
        fieldIndex.baseSettlePrice = baseIdx
      }
      const linkedIdx = findHeaderIdx('联动结算价')
      if (linkedIdx >= 0 && fieldIndex.linkedSettlePrice === undefined) {
        fieldIndex.linkedSettlePrice = linkedIdx
      }
    }

    const requiredFields = ['materialCode', 'fixedPrice']
    const requiredLabels = {
      materialCode: '物料代码',
      fixedPrice: filters.value.sourceType === 'SETTLE' ? '铜价（取价列）' : '单价',
    }
    const missing = requiredFields.filter((field) => fieldIndex[field] === undefined)
    if (missing.length > 0) {
      const names = missing.map((field) => requiredLabels[field] || field)
      ElMessage.error(`缺少表头：${names.join('、')}`)
      return
    }
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => ({
        orgCode: String(row[fieldIndex.orgCode] || '').trim(),
        sourceName: String(row[fieldIndex.sourceName] || '').trim(),
        supplierName: String(row[fieldIndex.supplierName] || '').trim(),
        supplierCode: String(row[fieldIndex.supplierCode] || '').trim(),
        purchaseClass: String(row[fieldIndex.purchaseClass] || '').trim(),
        materialName: String(row[fieldIndex.materialName] || '').trim(),
        materialCode: String(row[fieldIndex.materialCode] || '').trim(),
        specModel: String(row[fieldIndex.specModel] || '').trim(),
        unit: String(row[fieldIndex.unit] || '').trim(),
        formulaExpr: String(row[fieldIndex.formulaExpr] || '').trim(),
        blankWeight: parseNumber(row[fieldIndex.blankWeight]),
        netWeight: parseNumber(row[fieldIndex.netWeight]),
        processFee: parseNumber(row[fieldIndex.processFee]),
        agentFee: parseNumber(row[fieldIndex.agentFee]),
        fixedPrice: parseNumber(row[fieldIndex.fixedPrice]),
        taxIncluded: parseBoolean(row[fieldIndex.taxIncluded]),
        effectiveFrom: normalizeDate(row[fieldIndex.effectiveFrom]) || null,
        effectiveTo: normalizeDate(row[fieldIndex.effectiveTo]) || null,
        orderType: String(row[fieldIndex.orderType] || '').trim(),
        quota: parseNumber(row[fieldIndex.quota]),
        // V46：源类型 / 月份从 filter tab 取（用户在哪个 tab 上传就归到哪类）
        sourceType: filters.value.sourceType,
        pricingMonth: filters.value.pricingMonth || '2026-03',
        processNo: String(row[fieldIndex.processNo] || '').trim(),
        plannedPrice: parseNumber(row[fieldIndex.plannedPrice]),
        markupRatio: parseNumber(row[fieldIndex.markupRatio]),
        baseSettlePrice: parseNumber(row[fieldIndex.baseSettlePrice]),
        linkedSettlePrice: parseNumber(row[fieldIndex.linkedSettlePrice]),
        remark: String(row[fieldIndex.remark] || '').trim(),
      }))
      .filter((row) => row.materialCode && row.fixedPrice !== null)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importFixedItems({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条固定价`)
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

onMounted(fetchList)
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

/* V46：source_type tabs 上移嵌入 filter-card */
.source-type-tabs {
  margin-bottom: 8px;
}
.source-type-tabs :deep(.el-tabs__nav-wrap)::after {
  height: 1px;
}
</style>
