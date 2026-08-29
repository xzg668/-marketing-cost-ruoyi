<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div>
          <div class="filter-title">产品属性对照表</div>
          <div class="filter-tip">数据以财务业务清单为准，唯一键为年度 + 料号</div>
        </div>
        <el-button :loading="importing" @click="openImportDialog">导入</el-button>
      </div>
      <el-form :inline="true" label-width="88px" class="filter-form">
        <el-form-item label="年度" required>
          <el-date-picker
            v-model="filters.propertyYear"
            type="year"
            value-format="YYYY"
            placeholder="选择年度"
            @change="onYearChange"
          />
        </el-form-item>
        <el-form-item label="生产事业部">
          <el-input v-model="filters.businessDivision" placeholder="生产事业部" clearable />
        </el-form-item>
        <el-form-item label="料号">
          <el-input v-model="filters.productCode" placeholder="料号" clearable />
        </el-form-item>
        <el-form-item label="品名">
          <el-input v-model="filters.productName" placeholder="品名" clearable />
        </el-form-item>
        <el-form-item label="产品属性">
          <el-select v-model="filters.productAttr" placeholder="全部" clearable>
            <el-option v-for="item in attributeNames" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-form-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="rule-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ filters.propertyYear }} 年产品属性上浮规则</div>
            <div class="filter-tip">系数 = 1 + 上浮比例；规则变更会在重新核算时生效，已冻结结果不会被直接改写</div>
          </div>
          <el-button type="primary" :loading="savingRules" @click="saveRules">保存规则</el-button>
        </div>
      </template>
      <div class="rule-grid" v-loading="rulesLoading">
        <div v-for="rule in ruleRows" :key="rule.productAttr" class="rule-item">
          <span class="rule-name">{{ rule.productAttr }}</span>
          <el-input-number
            v-model="rule.upliftPercent"
            :min="0"
            :max="100"
            :precision="2"
            :step="0.5"
            controls-position="right"
          />
          <span class="percent">%</span>
          <span class="coefficient">系数 {{ formatCoefficient(rule.upliftPercent) }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column label="序号" width="70" align="center">
          <template #default="scope">{{ (pagination.page - 1) * pagination.pageSize + scope.$index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="propertyYear" label="年度" width="90" />
        <el-table-column prop="productCode" label="料号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productName" label="品名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productSpec" label="规格" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productModel" label="型号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productAttr" label="产品属性" width="110" />
        <el-table-column prop="businessDivision" label="生产事业部" min-width="170" show-overflow-tooltip />
        <el-table-column label="上浮比例" width="110" align="right">
          <template #default="{ row }">{{ formatPercent(row.upliftRate) }}</template>
        </el-table-column>
        <el-table-column label="系数" width="90" align="right">
          <template #default="{ row }">{{ formatStoredCoefficient(row.coefficient) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" /></template>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog v-model="importDialogVisible" title="导入产品属性" width="760px">
      <el-alert type="info" :closable="false" show-icon class="import-help">
        <template #title>支持原工作簿第二页或单独的 A–E / A–F 工作表</template>
        A–F 有生产事业部时以 Excel 为准；只有 A–E 或 F 为空时，系统按料号从料品档案匹配生产事业部。
      </el-alert>
      <el-form label-width="100px" class="import-form">
        <el-form-item label="导入年度" required>
          <el-date-picker v-model="importYear" type="year" value-format="YYYY" />
        </el-form-item>
        <el-form-item label="导入方式" required>
          <el-radio-group v-model="importMode">
            <el-radio value="INCREMENTAL">增量导入</el-radio>
            <el-radio value="FULL">全量导入</el-radio>
          </el-radio-group>
          <div class="mode-tip">
            {{ importMode === 'FULL' ? '全量会删除该年度未出现在文件中的料号' : '增量只新增或更新文件中的料号' }}
          </div>
        </el-form-item>
        <el-form-item label="上传文件" required>
          <el-upload
            class="upload-field"
            drag
            :limit="1"
            :auto-upload="false"
            accept=".xlsx,.xls"
            :on-change="handleImportFileChange"
            :on-remove="handleImportFileRemove"
          >
            <div class="upload-text">选择 Excel 文件</div>
          </el-upload>
        </el-form-item>
      </el-form>

      <section v-if="importResult" class="import-result">
        <el-alert
          :type="importResult.success ? 'success' : 'error'"
          :title="importResult.success ? '导入成功' : '校验未通过，数据库未写入'"
          :closable="false"
          show-icon
          class="result-alert"
        />
        <div class="result-grid">
          <div><span>文件数据</span><strong>{{ importResult.total || 0 }}</strong></div>
          <div><span>新增</span><strong>{{ importResult.inserted || 0 }}</strong></div>
          <div><span>更新</span><strong>{{ importResult.updated || 0 }}</strong></div>
          <div><span>全量删除</span><strong>{{ importResult.removed || 0 }}</strong></div>
          <div><span>Excel 事业部</span><strong>{{ importResult.excelDivision || 0 }}</strong></div>
          <div><span>档案匹配</span><strong>{{ importResult.resolvedDivision || 0 }}</strong></div>
        </div>
        <el-table v-if="importIssues.length" :data="importIssues" size="small" max-height="260">
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.type === '错误' ? 'danger' : 'warning'">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="明细" show-overflow-tooltip />
        </el-table>
      </section>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchProductProperties,
  fetchProductPropertyRules,
  importProductProperties,
  saveProductPropertyRules,
} from '../api/productProperties'

const currentYear = () => String(new Date().getFullYear())
const attributeNames = ['非标品', '标准品', '定制品', 'OEM']
const defaultRates = { 非标品: 5, 标准品: 0, 定制品: 5, OEM: 0 }

const loading = ref(false)
const rulesLoading = ref(false)
const savingRules = ref(false)
const importing = ref(false)
const importDialogVisible = ref(false)
const importYear = ref(currentYear())
const importMode = ref('INCREMENTAL')
const importFile = ref(null)
const importResult = ref(null)
const tableRows = ref([])
const ruleRows = ref(attributeNames.map((productAttr) => ({
  productAttr,
  upliftPercent: defaultRates[productAttr],
})))
const pagination = ref({ page: 1, pageSize: 20, total: 0 })
const filters = ref({
  propertyYear: currentYear(),
  businessDivision: '',
  productCode: '',
  productName: '',
  productAttr: '',
})

const importIssues = computed(() => [
  ...(importResult.value?.errors || []).map((message) => ({ type: '错误', message })),
  ...(importResult.value?.warnings || []).map((message) => ({ type: '提示', message })),
])

const buildParams = () => ({
  propertyYear: filters.value.propertyYear ? Number(filters.value.propertyYear) : undefined,
  businessDivision: filters.value.businessDivision.trim(),
  productCode: filters.value.productCode.trim(),
  productName: filters.value.productName.trim(),
  productAttr: filters.value.productAttr,
  page: pagination.value.page,
  pageSize: pagination.value.pageSize,
})

const fetchList = async () => {
  if (!filters.value.propertyYear) return
  loading.value = true
  try {
    const data = await fetchProductProperties(buildParams())
    tableRows.value = data?.list || []
    pagination.value.total = Number(data?.total || 0)
  } catch (error) {
    tableRows.value = []
    pagination.value.total = 0
    ElMessage.error(error?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

const fetchRules = async () => {
  if (!filters.value.propertyYear) return
  rulesLoading.value = true
  try {
    const rows = await fetchProductPropertyRules({ propertyYear: Number(filters.value.propertyYear) })
    const rates = Object.fromEntries((rows || []).map((row) => [
      row.productAttr,
      Number(row.upliftRate || 0) * 100,
    ]))
    ruleRows.value = attributeNames.map((productAttr) => ({
      productAttr,
      upliftPercent: Object.hasOwn(rates, productAttr) ? rates[productAttr] : defaultRates[productAttr],
    }))
  } catch (error) {
    ElMessage.error(error?.message || '规则查询失败')
  } finally {
    rulesLoading.value = false
  }
}

const applyFilters = () => {
  pagination.value.page = 1
  fetchList()
}

const onYearChange = () => {
  importYear.value = filters.value.propertyYear || currentYear()
  pagination.value.page = 1
  Promise.all([fetchList(), fetchRules()])
}

const resetFilters = () => {
  filters.value = {
    propertyYear: currentYear(),
    businessDivision: '',
    productCode: '',
    productName: '',
    productAttr: '',
  }
  importYear.value = filters.value.propertyYear
  pagination.value.page = 1
  Promise.all([fetchList(), fetchRules()])
}

const saveRules = async () => {
  if (!filters.value.propertyYear) {
    ElMessage.warning('请先选择年度')
    return
  }
  savingRules.value = true
  try {
    await saveProductPropertyRules({
      propertyYear: Number(filters.value.propertyYear),
      rules: ruleRows.value.map((row) => ({
        productAttr: row.productAttr,
        upliftRate: Number(row.upliftPercent || 0) / 100,
      })),
    })
    ElMessage.success('上浮规则已保存，重新核算时生效')
    await fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '规则保存失败')
  } finally {
    savingRules.value = false
  }
}

const openImportDialog = () => {
  importYear.value = filters.value.propertyYear || currentYear()
  importMode.value = 'INCREMENTAL'
  importFile.value = null
  importResult.value = null
  importDialogVisible.value = true
}

const handleImportFileChange = (uploadFile) => {
  importFile.value = uploadFile.raw || null
  importResult.value = null
}

const handleImportFileRemove = () => { importFile.value = null }

const submitImport = async () => {
  if (!importYear.value) {
    ElMessage.warning('请先选择导入年度')
    return
  }
  if (!importFile.value) {
    ElMessage.warning('请先选择 Excel 文件')
    return
  }
  if (importMode.value === 'FULL') {
    try {
      await ElMessageBox.confirm(
        `全量导入会删除 ${importYear.value} 年未出现在文件中的料号，确定继续吗？`,
        '确认全量导入',
        { type: 'warning', confirmButtonText: '继续导入' },
      )
    } catch {
      return
    }
  }
  importing.value = true
  try {
    const result = await importProductProperties({
      file: importFile.value,
      propertyYear: Number(importYear.value),
      importMode: importMode.value,
    })
    importResult.value = result
    if (result?.success) {
      ElMessage.success(`导入成功：新增 ${result.inserted || 0}，更新 ${result.updated || 0}`)
      filters.value.propertyYear = importYear.value
      pagination.value.page = 1
      await Promise.all([fetchList(), fetchRules()])
    } else {
      ElMessage.error(result?.errors?.[0] || '导入校验未通过，数据库未写入')
    }
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const formatPercent = (rate) => rate === null || rate === undefined
  ? '-'
  : `${(Number(rate) * 100).toFixed(2).replace(/\.00$/, '')}%`
const formatCoefficient = (percent) => (1 + Number(percent || 0) / 100).toFixed(4)
const formatStoredCoefficient = (value) => value === null || value === undefined
  ? '-'
  : Number(value).toFixed(4)

onMounted(() => Promise.all([fetchList(), fetchRules()]))
</script>

<style scoped>
.base-page { display: flex; flex-direction: column; gap: 16px; }
.filter-header, .card-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.filter-header { margin-bottom: 16px; }
.filter-title, .card-title { color: #1f2a37; font-size: 15px; font-weight: 600; }
.filter-tip, .mode-tip { color: #8a919f; font-size: 12px; line-height: 20px; margin-top: 3px; }
.filter-form { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; }
.filter-form :deep(.el-form-item) { margin: 0; }
.filter-form :deep(.el-input), .filter-form :deep(.el-select), .filter-form :deep(.el-date-editor) { width: 220px; }
.filter-form-actions { margin-left: auto !important; }
.rule-grid { display: grid; grid-template-columns: repeat(4, minmax(220px, 1fr)); gap: 12px; }
.rule-item { align-items: center; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; display: grid; grid-template-columns: 58px 110px 18px 1fr; gap: 6px; padding: 12px; }
.rule-name { color: #303846; font-weight: 600; }
.percent, .coefficient { color: #6b7280; font-size: 12px; }
.pagination-wrap { display: flex; justify-content: flex-end; padding-top: 16px; }
.import-help, .result-alert { margin-bottom: 16px; }
.import-form :deep(.el-date-editor) { width: 220px; }
.upload-field { width: 100%; }
.upload-text { color: #1f2a37; font-size: 14px; line-height: 88px; }
.mode-tip { margin-left: 14px; }
.import-result { margin-top: 16px; }
.result-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.result-grid > div { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
.result-grid span { color: #6b7280; display: block; font-size: 12px; }
.result-grid strong { color: #111827; font-size: 18px; line-height: 24px; }
@media (max-width: 1180px) { .rule-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
@media (max-width: 760px) {
  .filter-header, .card-header { align-items: flex-start; flex-direction: column; }
  .rule-grid, .result-grid { grid-template-columns: 1fr 1fr; }
  .filter-form-actions { margin-left: 0 !important; }
}
</style>
