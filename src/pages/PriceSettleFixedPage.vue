<template>
  <div class="settle-fixed-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">结算固定价</div>
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
        </div>
      </div>
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
        <el-form-item label="料号">
          <el-input v-model="filters.materialCode" placeholder="203259840" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <el-tag :type="sourceSystemTag(row.sourceSystem)" size="small">
              {{ row.sourceSystem || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pricingMonth" label="结算期间" width="100" />
        <el-table-column prop="materialCode" label="料号" width="150" />
        <el-table-column prop="materialName" label="料品名称" min-width="140" />
        <el-table-column prop="specModel" label="型号" min-width="160" />
        <el-table-column prop="plannedPrice" label="计划价" width="100" />
        <el-table-column prop="markupRatio" label="上浮比例" width="100" />
        <el-table-column prop="baseSettlePrice" label="基准结算价" width="120" />
        <el-table-column prop="linkedSettlePrice" label="联动结算价" width="120" />
        <el-table-column prop="fixedPrice" label="结算固定价" width="120" />
        <el-table-column prop="settleReferenceText" label="价格备注" min-width="120" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
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
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import { fetchFixedItems, importFixedItems } from '../api/priceFixedItems'

const SETTLE_FIXED_SOURCE_TYPE = 'SETTLE_FIXED'

const loading = ref(false)
const importing = ref(false)
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const filters = ref({
  pricingMonth: '2026-03',
  materialCode: '',
})

const buildParams = () => ({
  sourceType: SETTLE_FIXED_SOURCE_TYPE,
  pricingMonth: filters.value.pricingMonth || undefined,
  materialCode: filters.value.materialCode.trim(),
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

watch(currentPage, fetchList)
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
  }
  applyFilters()
}

const sourceSystemTag = (value) => {
  if (value === 'U9') return 'warning'
  if (value === 'EXCEL') return 'primary'
  return 'info'
}

const normalizeHeader = (value) =>
  String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text || text === '-') {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const textAt = (row, index) => String(row[index] ?? '').trim()

const buildHeaderIndex = (headerRow, aliases) => {
  const headerMap = Object.entries(aliases).reduce((acc, [key, labels]) => {
    labels.forEach((label) => {
      acc[normalizeHeader(label)] = key
    })
    return acc
  }, {})
  const keys = Object.keys(headerMap).sort((a, b) => b.length - a.length)
  const fieldIndex = {}
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell)
    if (!normalized) return
    const exact = headerMap[normalized]
    const matched = exact || keys.find((key) => normalized.includes(key))
    if (matched && fieldIndex[headerMap[matched] || matched] === undefined) {
      fieldIndex[headerMap[matched] || matched] = index
    }
  })
  return fieldIndex
}

const findHeaderIndex = (rows, labels) => {
  const normalizedLabels = labels.map(normalizeHeader)
  return rows.reduce((best, row, index) => {
    const hits = row.reduce((count, cell) => {
      return normalizedLabels.includes(normalizeHeader(cell)) ? count + 1 : count
    }, 0)
    return hits > best.count ? { index, count: hits } : best
  }, { index: -1, count: 0 }).index
}

const parseHouseholdSettleRows = (workbook, XLSX) => {
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === normalizeHeader('家用结算价9'))
  if (!sheetName) {
    return []
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
  const headerIndex = findHeaderIndex(rows, ['料号', '料品名称', '型号', '计划价', '上浮比例'])
  if (headerIndex < 0) {
    throw new Error('家用结算价9 未找到表头')
  }
  const headerRow = rows[headerIndex]
  const fieldIndex = buildHeaderIndex(headerRow, {
    materialCode: ['料号'],
    materialName: ['料品名称'],
    specModel: ['型号'],
    plannedPrice: ['计划价'],
    markupRatio: ['上浮比例'],
    baseSettlePrice: ['基准结算价'],
    linkedSettlePrice: ['联动结算价'],
    remark: ['备注'],
  })
  const referenceIndex = headerRow.findIndex((cell) => {
    const normalized = normalizeHeader(cell)
    return normalized.includes('铜价') || normalized.includes('锌价')
  })
  if ([fieldIndex.materialCode, fieldIndex.materialName, fieldIndex.specModel, referenceIndex].some((i) => i === undefined || i < 0)) {
    throw new Error('家用结算价9 缺少料号、料品名称、型号或最后一列价格/备注表头')
  }
  return rows.slice(headerIndex + 1).map((row, offset) => {
    const materialCode = textAt(row, fieldIndex.materialCode)
    const referenceRaw = textAt(row, referenceIndex)
    const referencePrice = parseNumber(referenceRaw)
    // 家用结算价最后一列：数字是价格，非数字是备注。
    const referenceText = referenceRaw && referencePrice === null ? referenceRaw : ''
    return {
      sourceType: SETTLE_FIXED_SOURCE_TYPE,
      sourceSystem: 'EXCEL',
      sourceSheetName: sheetName,
      sourceRowNo: headerIndex + offset + 2,
      pricingMonth: filters.value.pricingMonth || '2026-03',
      materialCode,
      materialName: textAt(row, fieldIndex.materialName),
      specModel: textAt(row, fieldIndex.specModel),
      plannedPrice: parseNumber(row[fieldIndex.plannedPrice]),
      markupRatio: parseNumber(row[fieldIndex.markupRatio]),
      baseSettlePrice: parseNumber(row[fieldIndex.baseSettlePrice]),
      linkedSettlePrice: parseNumber(row[fieldIndex.linkedSettlePrice]),
      remark: textAt(row, fieldIndex.remark),
      settleReferenceHeader: textAt(headerRow, referenceIndex),
      settleReferencePrice: referencePrice,
      settleReferenceText: referenceText,
      fixedPrice: referencePrice,
      taxIncluded: false,
    }
  }).filter((row) => row.materialCode && row.materialName)
}

const parseU9Rows = (workbook, XLSX) => {
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === normalizeHeader('固定采购价5'))
  if (!sheetName) {
    return []
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
  const headerIndex = findHeaderIndex(rows, ['流程编号', '物料代码', '物料名称', '现不含税价格'])
  if (headerIndex < 0) {
    return []
  }
  const fieldIndex = buildHeaderIndex(rows[headerIndex], {
    processNo: ['流程编号'],
    materialCode: ['物料代码'],
    materialName: ['物料名称'],
    specModel: ['规格型号', '型号'],
    unit: ['价格单位'],
    fixedPrice: ['现不含税价格'],
    currentTaxIncludedPrice: ['现含税价格'],
    currentSupplierName: ['现供方名称'],
  })
  return rows.slice(headerIndex + 1).map((row, offset) => {
    const processNo = textAt(row, fieldIndex.processNo)
    return {
      sourceType: SETTLE_FIXED_SOURCE_TYPE,
      sourceSystem: 'U9',
      sourceSheetName: sheetName,
      sourceRowNo: headerIndex + offset + 2,
      pricingMonth: filters.value.pricingMonth || '2026-03',
      processNo,
      materialCode: textAt(row, fieldIndex.materialCode),
      materialName: textAt(row, fieldIndex.materialName),
      specModel: textAt(row, fieldIndex.specModel),
      unit: textAt(row, fieldIndex.unit),
      fixedPrice: parseNumber(row[fieldIndex.fixedPrice]),
      currentTaxExcludedPrice: parseNumber(row[fieldIndex.fixedPrice]),
      currentTaxIncludedPrice: parseNumber(row[fieldIndex.currentTaxIncludedPrice]),
      currentSupplierName: textAt(row, fieldIndex.currentSupplierName),
      supplierName: textAt(row, fieldIndex.currentSupplierName),
      taxIncluded: false,
    }
  }).filter((row) => row.processNo === 'U9' && row.materialCode && row.fixedPrice !== null)
}

const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) return
  importing.value = true
  try {
    let XLSX = null
    try {
      XLSX = await import('xlsx')
    } catch (error) {
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }
    const workbook = XLSX.read(await rawFile.arrayBuffer(), { type: 'array', cellDates: true })
    const householdRows = parseHouseholdSettleRows(workbook, XLSX)
    const u9Rows = parseU9Rows(workbook, XLSX)
    const rows = [...householdRows, ...u9Rows]
    if (!rows.length) {
      ElMessage.warning('未解析到结算固定价数据')
      return
    }
    // 当前 Excel 已核实家用结算价9料号唯一；后端按 source_type + source_system + material_code 幂等。
    const result = await importFixedItems({
      importFileName: rawFile.name,
      sourceBatchNo: `SETTLE_FIXED_${Date.now()}`,
      rows,
    })
    const pricedCount = rows.filter((row) => row.fixedPrice !== null && row.fixedPrice !== undefined).length
    const remarkCount = rows.filter((row) => row.fixedPrice === null || row.fixedPrice === undefined).length
    ElMessage.success(
      `结算固定价导入完成：新增${result?.createdCount ?? 0}条，更新${result?.updatedCount ?? 0}条，` +
      `有价${pricedCount}条，备注${remarkCount}条`
    )
    applyFilters()
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
.settle-fixed-page {
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
</style>
