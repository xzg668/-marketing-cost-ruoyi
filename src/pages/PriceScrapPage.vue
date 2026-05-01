<template>
  <div class="scrap-page">
    <!-- 顶部筛选 + 操作 -->
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">废料回收价</div>
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
        <el-form-item label="废料代号">
          <el-input v-model="filters.scrapCode" placeholder="废紫铜" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="scrapCode" label="废料代号" width="160" />
        <el-table-column prop="scrapName" label="名称" width="180" />
        <el-table-column prop="specModel" label="规格" width="160" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="recyclePrice" label="回收单价" width="120">
          <template #default="{ row }">{{ row.recyclePrice ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="含税" width="80">
          <template #default="{ row }">
            <el-tag :type="row.taxIncluded === 1 ? 'success' : 'info'" size="small">
              {{ row.taxIncluded === 1 ? '含税' : '不含税' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pricingMonth" label="结算期间" width="110" />
        <el-table-column prop="effectiveFrom" label="生效" width="110" />
        <el-table-column prop="effectiveTo" label="失效" width="110" />
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pagination"
        v-model:current-page="filters.page"
        v-model:page-size="filters.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="fetchList"
        @size-change="fetchList"
      />
    </el-card>

    <!-- 编辑/新增对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px">
      <el-form :model="formModel" label-width="100px">
        <el-form-item label="结算期间" required>
          <el-date-picker
            v-model="formModel.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="2026-03"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="废料代号" required>
          <el-input v-model="formModel.scrapCode" placeholder="废紫铜" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="formModel.scrapName" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formModel.specModel" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" placeholder="kg" />
        </el-form-item>
        <el-form-item label="回收单价" required>
          <el-input-number
            v-model="formModel.recyclePrice"
            :precision="6"
            :step="0.1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="含税">
          <el-switch
            v-model="formModel.taxIncluded"
            active-text="含税"
            inactive-text="不含税"
          />
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="formModel.effectiveFrom"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker
            v-model="formModel.effectiveTo"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formModel.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchScrapItems,
  createScrapItem,
  updateScrapItem,
  deleteScrapItem,
  importScrapItems,
} from '../api/priceScrap'

// 当前月份默认值（YYYY-MM）
const getCurrentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const filters = ref({
  scrapCode: '',
  pricingMonth: '',
  page: 1,
  pageSize: 20,
})
const tableRows = ref([])
const total = ref(0)
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('新增废料价')
const editingId = ref(null)
const saving = ref(false)
const importing = ref(false)

const emptyForm = () => ({
  pricingMonth: getCurrentMonth(),
  scrapCode: '',
  scrapName: '',
  specModel: '',
  unit: 'kg',
  recyclePrice: null,
  taxIncluded: true,
  effectiveFrom: null,
  effectiveTo: null,
  remark: '',
})
const formModel = ref(emptyForm())

const fetchList = async () => {
  loading.value = true
  try {
    const resp = await fetchScrapItems({
      scrapCode: filters.value.scrapCode || undefined,
      pricingMonth: filters.value.pricingMonth || undefined,
      page: filters.value.page,
      pageSize: filters.value.pageSize,
    })
    tableRows.value = resp?.list || []
    total.value = resp?.total || 0
  } catch (e) {
    ElMessage.error(e?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  filters.value.page = 1
  fetchList()
}

const resetFilters = () => {
  filters.value.scrapCode = ''
  filters.value.pricingMonth = ''
  filters.value.page = 1
  fetchList()
}

const openCreate = () => {
  editingId.value = null
  dialogTitle.value = '新增废料价'
  formModel.value = emptyForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  dialogTitle.value = `编辑废料价 #${row.id}`
  formModel.value = {
    pricingMonth: row.pricingMonth || getCurrentMonth(),
    scrapCode: row.scrapCode || '',
    scrapName: row.scrapName || '',
    specModel: row.specModel || '',
    unit: row.unit || 'kg',
    recyclePrice: row.recyclePrice ?? null,
    taxIncluded: row.taxIncluded !== 0,
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    remark: row.remark || '',
  }
  dialogVisible.value = true
}

const onSave = async () => {
  if (!formModel.value.scrapCode) {
    ElMessage.warning('废料代号必填')
    return
  }
  if (formModel.value.recyclePrice == null) {
    ElMessage.warning('回收单价必填')
    return
  }
  saving.value = true
  try {
    const body = { ...formModel.value }
    if (editingId.value) {
      await updateScrapItem(editingId.value, body)
      ElMessage.success('修改成功')
    } else {
      await createScrapItem(body)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const onDelete = (row) => {
  ElMessageBox.confirm(`确定删除废料 [${row.scrapCode}]?`, '确认', {
    type: 'warning',
  })
    .then(async () => {
      await deleteScrapItem(row.id)
      ElMessage.success('删除成功')
      fetchList()
    })
    .catch(() => {})
}

// Excel 导入：前端解析后批量 POST
const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) return
  importing.value = true
  try {
    let XLSX = null
    try {
      const mod = await import('xlsx')
      XLSX = mod
    } catch {
      ElMessage.error('未安装 xlsx，请先 npm install xlsx')
      return
    }
    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    // 表头映射：中文表头 → 字段名
    const headerMap = {
      结算期间: 'pricingMonth',
      价格月份: 'pricingMonth',
      废料代号: 'scrapCode',
      代号: 'scrapCode',
      废料名称: 'scrapName',
      名称: 'scrapName',
      规格型号: 'specModel',
      规格: 'specModel',
      单位: 'unit',
      回收单价: 'recyclePrice',
      单价: 'recyclePrice',
      是否含税: 'taxIncluded',
      含税: 'taxIncluded',
      生效日期: 'effectiveFrom',
      失效日期: 'effectiveTo',
      备注: 'remark',
    }
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => headerMap[String(cell).trim()]),
    )
    if (headerIndex === -1) {
      ElMessage.error('未找到表头')
      return
    }
    const headerRow = rows[headerIndex]
    const fieldIndex = {}
    headerRow.forEach((cell, i) => {
      const f = headerMap[String(cell).trim()]
      if (f) fieldIndex[f] = i
    })
    const fallbackMonth = filters.value.pricingMonth || getCurrentMonth()
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((r) => ({
        pricingMonth: String(r[fieldIndex.pricingMonth] || '').trim() || fallbackMonth,
        scrapCode: String(r[fieldIndex.scrapCode] || '').trim(),
        scrapName: String(r[fieldIndex.scrapName] || '').trim(),
        specModel: String(r[fieldIndex.specModel] || '').trim(),
        unit: String(r[fieldIndex.unit] || '').trim(),
        recyclePrice: parseFloat(r[fieldIndex.recyclePrice]) || null,
        taxIncluded: parseTax(r[fieldIndex.taxIncluded]),
        effectiveFrom: parseDate(r[fieldIndex.effectiveFrom]),
        effectiveTo: parseDate(r[fieldIndex.effectiveTo]),
        remark: String(r[fieldIndex.remark] || '').trim(),
      }))
      .filter((r) => r.scrapCode && r.recyclePrice != null)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    await importScrapItems({ rows: dataRows })
    ElMessage.success(`已导入 ${dataRows.length} 条`)
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const parseTax = (v) => {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (['1', 'Y', 'y', '是', '含税', 'true', 'TRUE'].includes(s)) return true
  if (['0', 'N', 'n', '否', '不含税', 'false', 'FALSE'].includes(s)) return false
  return null
}
const parseDate = (v) => {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

onMounted(fetchList)
</script>

<style scoped>
.scrap-page {
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
.upload-btn {
  display: inline-block;
}
.pagination {
  margin-top: 12px;
  justify-content: flex-end;
  display: flex;
}
</style>
