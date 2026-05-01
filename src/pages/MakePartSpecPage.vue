<template>
  <div class="make-spec-page">
    <!-- 顶部筛选 + 操作 -->
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">自制件工艺规格</div>
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
            v-model="filters.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="2026-03"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="203250749" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格：列分组（基础 / 重量 / 原材料 / 废料 / 加工） -->
    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="materialCode" label="自制件料号" width="140" fixed />
        <el-table-column prop="materialName" label="名称" width="140" />
        <el-table-column prop="drawingNo" label="图号" width="140" />
        <el-table-column prop="period" label="结算期间" width="100" />
        <el-table-column label="重量 / 比例" align="center">
          <el-table-column prop="blankWeight" label="毛重" width="100" />
          <el-table-column prop="netWeight" label="净重" width="100" />
          <el-table-column prop="scrapRate" label="废料率" width="100" />
        </el-table-column>
        <el-table-column label="原材料" align="center">
          <el-table-column prop="rawMaterialCode" label="代号" width="120" />
          <el-table-column prop="rawMaterialSpec" label="规格" width="160" show-overflow-tooltip />
          <el-table-column prop="rawUnitPrice" label="单价" width="110" />
        </el-table-column>
        <el-table-column label="废料 (回收)" align="center">
          <el-table-column prop="recycleCode" label="代号" width="120" />
          <el-table-column prop="recycleUnitPrice" label="单价" width="110" />
          <el-table-column prop="recycleRatio" label="比例" width="100" />
        </el-table-column>
        <el-table-column label="费用" align="center">
          <el-table-column prop="processFee" label="加工费" width="100" />
          <el-table-column prop="outsourceFee" label="外发费" width="100" />
        </el-table-column>
        <el-table-column prop="formulaId" label="公式 ID" width="100" />
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

    <!-- 编辑/新增对话框 —— 字段较多，分组排版 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="800px">
      <el-form :model="formModel" label-width="100px">
        <el-divider content-position="left">基础</el-divider>
        <el-form-item label="自制件料号" required>
          <el-input v-model="formModel.materialCode" placeholder="203250749" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="图号">
          <el-input v-model="formModel.drawingNo" />
        </el-form-item>
        <el-form-item label="结算期间" required>
          <el-date-picker
            v-model="formModel.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            style="width: 100%"
          />
        </el-form-item>

        <el-divider content-position="left">重量 / 废料率</el-divider>
        <el-form-item label="毛重">
          <el-input-number v-model="formModel.blankWeight" :precision="6" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input-number v-model="formModel.netWeight" :precision="6" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="废料率">
          <el-input-number v-model="formModel.scrapRate" :precision="6" :step="0.01" style="width: 100%" />
        </el-form-item>

        <el-divider content-position="left">原材料</el-divider>
        <el-form-item label="原料代号">
          <el-input v-model="formModel.rawMaterialCode" />
        </el-form-item>
        <el-form-item label="原料规格">
          <el-input v-model="formModel.rawMaterialSpec" />
        </el-form-item>
        <el-form-item label="原料单价">
          <el-input-number v-model="formModel.rawUnitPrice" :precision="8" :step="0.01" style="width: 100%" />
        </el-form-item>

        <el-divider content-position="left">废料 (回收)</el-divider>
        <el-form-item label="废料代号">
          <el-input v-model="formModel.recycleCode" placeholder="对应 lp_price_scrap.scrap_code" />
        </el-form-item>
        <el-form-item label="废料单价">
          <el-input-number v-model="formModel.recycleUnitPrice" :precision="8" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="废料比例">
          <el-input-number v-model="formModel.recycleRatio" :precision="6" :step="0.01" style="width: 100%" />
        </el-form-item>

        <el-divider content-position="left">费用 / 公式</el-divider>
        <el-form-item label="加工费">
          <el-input-number v-model="formModel.processFee" :precision="6" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="外发费">
          <el-input-number v-model="formModel.outsourceFee" :precision="6" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="公式 ID">
          <el-input-number v-model="formModel.formulaId" :precision="0" :min="0" style="width: 100%" />
        </el-form-item>

        <el-divider content-position="left">有效期 / 备注</el-divider>
        <el-form-item label="生效日期">
          <el-date-picker v-model="formModel.effectiveFrom" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker v-model="formModel.effectiveTo" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width: 100%" />
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
  fetchMakeSpecs,
  createMakeSpec,
  updateMakeSpec,
  deleteMakeSpec,
  importMakeSpecs,
} from '../api/makePartSpec'

const getCurrentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const filters = ref({
  materialCode: '',
  period: '',
  page: 1,
  pageSize: 20,
})
const tableRows = ref([])
const total = ref(0)
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('新增自制件')
const editingId = ref(null)
const saving = ref(false)
const importing = ref(false)

const emptyForm = () => ({
  materialCode: '',
  materialName: '',
  drawingNo: '',
  period: getCurrentMonth(),
  blankWeight: null,
  netWeight: null,
  scrapRate: null,
  rawMaterialCode: '',
  rawMaterialSpec: '',
  rawUnitPrice: null,
  recycleCode: '',
  recycleUnitPrice: null,
  recycleRatio: null,
  processFee: null,
  outsourceFee: null,
  formulaId: null,
  effectiveFrom: null,
  effectiveTo: null,
  remark: '',
})
const formModel = ref(emptyForm())

const fetchList = async () => {
  loading.value = true
  try {
    const resp = await fetchMakeSpecs({
      materialCode: filters.value.materialCode || undefined,
      period: filters.value.period || undefined,
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
  filters.value.materialCode = ''
  filters.value.period = ''
  filters.value.page = 1
  fetchList()
}

const openCreate = () => {
  editingId.value = null
  dialogTitle.value = '新增自制件'
  formModel.value = emptyForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  dialogTitle.value = `编辑自制件 #${row.id}`
  formModel.value = {
    materialCode: row.materialCode || '',
    materialName: row.materialName || '',
    drawingNo: row.drawingNo || '',
    period: row.period || getCurrentMonth(),
    blankWeight: row.blankWeight ?? null,
    netWeight: row.netWeight ?? null,
    scrapRate: row.scrapRate ?? null,
    rawMaterialCode: row.rawMaterialCode || '',
    rawMaterialSpec: row.rawMaterialSpec || '',
    rawUnitPrice: row.rawUnitPrice ?? null,
    recycleCode: row.recycleCode || '',
    recycleUnitPrice: row.recycleUnitPrice ?? null,
    recycleRatio: row.recycleRatio ?? null,
    processFee: row.processFee ?? null,
    outsourceFee: row.outsourceFee ?? null,
    formulaId: row.formulaId ?? null,
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    remark: row.remark || '',
  }
  dialogVisible.value = true
}

const onSave = async () => {
  if (!formModel.value.materialCode) {
    ElMessage.warning('物料代码必填')
    return
  }
  saving.value = true
  try {
    const body = { ...formModel.value }
    if (editingId.value) {
      await updateMakeSpec(editingId.value, body)
      ElMessage.success('修改成功')
    } else {
      await createMakeSpec(body)
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
  ElMessageBox.confirm(`确定删除自制件 [${row.materialCode}]?`, '确认', {
    type: 'warning',
  })
    .then(async () => {
      await deleteMakeSpec(row.id)
      ElMessage.success('删除成功')
      fetchList()
    })
    .catch(() => {})
}

// Excel 导入
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
    const headerMap = {
      物料代码: 'materialCode',
      料号: 'materialCode',
      物料名称: 'materialName',
      图号: 'drawingNo',
      结算期间: 'period',
      价格月份: 'period',
      下料重: 'blankWeight',
      下料重量: 'blankWeight',
      毛重: 'blankWeight',
      净重: 'netWeight',
      废料率: 'scrapRate',
      原料代号: 'rawMaterialCode',
      原材料代号: 'rawMaterialCode',
      原料规格: 'rawMaterialSpec',
      原料单价: 'rawUnitPrice',
      原材料单价: 'rawUnitPrice',
      废料代号: 'recycleCode',
      回收代号: 'recycleCode',
      废料单价: 'recycleUnitPrice',
      回收单价: 'recycleUnitPrice',
      废料比例: 'recycleRatio',
      回收比例: 'recycleRatio',
      加工费: 'processFee',
      外发费: 'outsourceFee',
      外协费: 'outsourceFee',
      公式ID: 'formulaId',
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
    const fallbackPeriod = filters.value.period || getCurrentMonth()
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((r) => ({
        materialCode: String(r[fieldIndex.materialCode] || '').trim(),
        materialName: String(r[fieldIndex.materialName] || '').trim(),
        drawingNo: String(r[fieldIndex.drawingNo] || '').trim(),
        period: String(r[fieldIndex.period] || '').trim() || fallbackPeriod,
        blankWeight: parseFloat(r[fieldIndex.blankWeight]) || null,
        netWeight: parseFloat(r[fieldIndex.netWeight]) || null,
        scrapRate: parseFloat(r[fieldIndex.scrapRate]) || null,
        rawMaterialCode: String(r[fieldIndex.rawMaterialCode] || '').trim(),
        rawMaterialSpec: String(r[fieldIndex.rawMaterialSpec] || '').trim(),
        rawUnitPrice: parseFloat(r[fieldIndex.rawUnitPrice]) || null,
        recycleCode: String(r[fieldIndex.recycleCode] || '').trim(),
        recycleUnitPrice: parseFloat(r[fieldIndex.recycleUnitPrice]) || null,
        recycleRatio: parseFloat(r[fieldIndex.recycleRatio]) || null,
        processFee: parseFloat(r[fieldIndex.processFee]) || null,
        outsourceFee: parseFloat(r[fieldIndex.outsourceFee]) || null,
        formulaId: parseInt(r[fieldIndex.formulaId]) || null,
        effectiveFrom: parseDate(r[fieldIndex.effectiveFrom]),
        effectiveTo: parseDate(r[fieldIndex.effectiveTo]),
        remark: String(r[fieldIndex.remark] || '').trim(),
      }))
      .filter((r) => r.materialCode)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    await importMakeSpecs({ rows: dataRows })
    ElMessage.success(`已导入 ${dataRows.length} 条`)
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
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
.make-spec-page {
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
