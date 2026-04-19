<template>
  <div class="settle-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">结算价</div>
        <div class="filter-actions">
          <el-upload
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".xlsx,.xls"
            :on-change="handleFileChange"
          >
            <el-button :loading="importing">导入</el-button>
          </el-upload>
          <el-button type="primary" @click="openCreateSettle">新增单据</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="购货方">
          <el-input v-model="filters.buyer" placeholder="请输入购货方" />
        </el-form-item>
        <el-form-item label="月度">
          <el-date-picker
            v-model="filters.month"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="请选择月度"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 单据列表 -->
    <el-card shadow="never">
      <el-table :data="settleList" stripe v-loading="loading">
        <el-table-column prop="buyer" label="购货方" min-width="120" />
        <el-table-column prop="seller" label="销售方" min-width="120" />
        <el-table-column prop="businessType" label="业务类型" width="100" align="center" />
        <el-table-column prop="productProperty" label="产品属性" width="100" align="center" />
        <el-table-column prop="copperPrice" label="铜价" width="120" align="right" />
        <el-table-column prop="month" label="月度" width="80" align="center" />
        <el-table-column prop="approvalContent" label="审批内容" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetail(row)">明细</el-button>
            <el-button type="primary" link @click="openEditSettle(row)">编辑</el-button>
            <el-button type="danger" link @click="removeSettle(row)">删除</el-button>
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

    <!-- 单据新增/编辑弹窗 -->
    <el-dialog v-model="settleDialogVisible" :title="settleDialogTitle" width="560px">
      <el-form :model="settleForm" label-width="100px">
        <el-form-item label="购货方">
          <el-input v-model="settleForm.buyer" />
        </el-form-item>
        <el-form-item label="销售方">
          <el-input v-model="settleForm.seller" />
        </el-form-item>
        <el-form-item label="业务类型">
          <el-input v-model="settleForm.businessType" />
        </el-form-item>
        <el-form-item label="产品属性">
          <el-input v-model="settleForm.productProperty" />
        </el-form-item>
        <el-form-item label="铜价">
          <el-input v-model="settleForm.copperPrice" />
        </el-form-item>
        <el-form-item label="月度">
          <el-date-picker
            v-model="settleForm.month"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="请选择月度"
          />
        </el-form-item>
        <el-form-item label="审批内容">
          <el-input v-model="settleForm.approvalContent" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitSettle">保存</el-button>
      </template>
    </el-dialog>

    <!-- 明细弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="结算价明细" width="1100px" top="5vh">
      <div class="detail-header" v-if="currentSettle">
        <span>{{ currentSettle.buyer }} → {{ currentSettle.seller }}</span>
        <span>{{ currentSettle.businessType }} / {{ currentSettle.productProperty }}</span>
        <span>铜价：{{ currentSettle.copperPrice }}</span>
        <span>月度：{{ currentSettle.month }}</span>
      </div>
      <div class="detail-actions">
        <el-button type="primary" size="small" @click="openCreateItem">新增明细</el-button>
      </div>
      <el-table :data="detailItems" stripe v-loading="detailLoading">
        <el-table-column prop="materialCode" label="料号" width="140" />
        <el-table-column prop="materialName" label="料品名称" min-width="160" />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column prop="plannedPrice" label="计划价" width="110" align="right" />
        <el-table-column prop="markupRatio" label="上浮比例" width="100" align="right" />
        <el-table-column prop="baseSettlePrice" label="基准结算价" width="120" align="right" />
        <el-table-column prop="linkedSettlePrice" label="联动结算价" width="120" align="right" />
        <el-table-column prop="remark" label="备注" min-width="120" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditItem(row)">编辑</el-button>
            <el-button type="danger" link @click="removeItem(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
    </el-dialog>

    <!-- 明细新增/编辑弹窗 -->
    <el-dialog v-model="itemDialogVisible" :title="itemDialogTitle" width="520px" append-to-body>
      <el-form :model="itemForm" label-width="100px">
        <el-form-item label="料号">
          <el-input v-model="itemForm.materialCode" />
        </el-form-item>
        <el-form-item label="料品名称">
          <el-input v-model="itemForm.materialName" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="itemForm.model" />
        </el-form-item>
        <el-form-item label="计划价">
          <el-input v-model="itemForm.plannedPrice" />
        </el-form-item>
        <el-form-item label="上浮比例">
          <el-input v-model="itemForm.markupRatio" />
        </el-form-item>
        <el-form-item label="基准结算价">
          <el-input v-model="itemForm.baseSettlePrice" />
        </el-form-item>
        <el-form-item label="联动结算价">
          <el-input v-model="itemForm.linkedSettlePrice" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchSettleList, fetchSettleDetail, createSettle, updateSettle, deleteSettle,
  importSettle, createSettleItem, updateSettleItem, deleteSettleItem,
} from '../api/priceSettleItems'

const loading = ref(false)
const importing = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)

// 单据列表
const settleList = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = ref({ buyer: '', month: '' })

// 单据弹窗
const settleDialogVisible = ref(false)
const editingSettleId = ref(null)
const emptySettleForm = () => ({
  buyer: '', seller: '', businessType: '', productProperty: '',
  copperPrice: '', month: '', approvalContent: '',
})
const settleForm = ref(emptySettleForm())
const settleDialogTitle = computed(() => editingSettleId.value ? '编辑单据' : '新增单据')

// 明细弹窗
const detailDialogVisible = ref(false)
const currentSettle = ref(null)
const detailItems = ref([])

// 明细编辑弹窗
const itemDialogVisible = ref(false)
const editingItemId = ref(null)
const emptyItemForm = () => ({
  materialCode: '', materialName: '', model: '',
  plannedPrice: '', markupRatio: '',
  baseSettlePrice: '', linkedSettlePrice: '', remark: '',
})
const itemForm = ref(emptyItemForm())
const itemDialogTitle = computed(() => editingItemId.value ? '编辑明细' : '新增明细')

const parseNumber = (v) => {
  const t = String(v ?? '').replace(/,/g, '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

// --- 单据列表 ---
const buildParams = () => ({
  buyer: filters.value.buyer.trim(),
  month: filters.value.month.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchSettleList(buildParams())
    settleList.value = data?.list || []
    total.value = data?.total || 0
  } catch (e) {
    settleList.value = []
    total.value = 0
    ElMessage.error(e?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

watch(currentPage, () => fetchList())
watch(pageSize, () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
})
const applyFilters = () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
}
const resetFilters = () => {
  filters.value = { buyer: '', month: '' }
  applyFilters()
}

// --- 单据 CRUD ---
const openCreateSettle = () => {
  editingSettleId.value = null
  settleForm.value = emptySettleForm()
  settleDialogVisible.value = true
}
const openEditSettle = (row) => {
  editingSettleId.value = row.id
  settleForm.value = {
    buyer: row.buyer ?? '', seller: row.seller ?? '',
    businessType: row.businessType ?? '', productProperty: row.productProperty ?? '',
    copperPrice: row.copperPrice ?? '', month: row.month ?? '',
    approvalContent: row.approvalContent ?? '',
  }
  settleDialogVisible.value = true
}
const submitSettle = async () => {
  if (submitting.value) return
  submitting.value = true
  const payload = {
    buyer: settleForm.value.buyer,
    seller: settleForm.value.seller,
    businessType: settleForm.value.businessType,
    productProperty: settleForm.value.productProperty,
    copperPrice: parseNumber(settleForm.value.copperPrice),
    month: settleForm.value.month,
    approvalContent: settleForm.value.approvalContent,
  }
  try {
    if (editingSettleId.value) {
      await updateSettle(editingSettleId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createSettle(payload)
      ElMessage.success('已新增')
    }
    settleDialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}
const removeSettle = async (row) => {
  try {
    await ElMessageBox.confirm('删除单据将同时删除所有明细，确定？', '提示', { type: 'warning' })
  } catch { return }
  try {
    await deleteSettle(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// --- 明细 ---
const openDetail = async (row) => {
  currentSettle.value = row
  detailItems.value = []
  detailDialogVisible.value = true
  detailLoading.value = true
  try {
    const data = await fetchSettleDetail(row.id)
    detailItems.value = data?.items || []
  } catch (e) {
    ElMessage.error(e?.message || '查询明细失败')
  } finally {
    detailLoading.value = false
  }
}
const refreshDetail = async () => {
  if (!currentSettle.value) return
  detailLoading.value = true
  try {
    const data = await fetchSettleDetail(currentSettle.value.id)
    detailItems.value = data?.items || []
  } catch (e) {
    ElMessage.error(e?.message || '刷新失败')
  } finally {
    detailLoading.value = false
  }
}
const openCreateItem = () => {
  editingItemId.value = null
  itemForm.value = emptyItemForm()
  itemDialogVisible.value = true
}
const openEditItem = (row) => {
  editingItemId.value = row.id
  itemForm.value = {
    materialCode: row.materialCode ?? '', materialName: row.materialName ?? '',
    model: row.model ?? '', plannedPrice: row.plannedPrice ?? '',
    markupRatio: row.markupRatio ?? '', baseSettlePrice: row.baseSettlePrice ?? '',
    linkedSettlePrice: row.linkedSettlePrice ?? '', remark: row.remark ?? '',
  }
  itemDialogVisible.value = true
}
const submitItem = async () => {
  if (submitting.value) return
  if (!itemForm.value.materialCode) {
    ElMessage.warning('料号必填')
    return
  }
  submitting.value = true
  const payload = {
    materialCode: itemForm.value.materialCode,
    materialName: itemForm.value.materialName,
    model: itemForm.value.model,
    plannedPrice: parseNumber(itemForm.value.plannedPrice),
    markupRatio: parseNumber(itemForm.value.markupRatio),
    baseSettlePrice: parseNumber(itemForm.value.baseSettlePrice),
    linkedSettlePrice: parseNumber(itemForm.value.linkedSettlePrice),
    remark: itemForm.value.remark,
  }
  try {
    if (editingItemId.value) {
      await updateSettleItem(editingItemId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createSettleItem(currentSettle.value.id, payload)
      ElMessage.success('已新增')
    }
    itemDialogVisible.value = false
    refreshDetail()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}
const removeItem = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该明细行吗？', '提示', { type: 'warning' })
  } catch { return }
  try {
    await deleteSettleItem(row.id)
    ElMessage.success('已删除')
    refreshDetail()
  } catch (e) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// --- Excel 导入 ---
const HEADER_ALIASES = {
  materialCode: ['料号', '料品代号'],
  materialName: ['料品名称', '名称'],
  model: ['型号'],
  plannedPrice: ['计划价'],
  markupRatio: ['上浮比例'],
  baseSettlePrice: ['基准结算价'],
  linkedSettlePrice: ['联动结算价', '联动价'],
  remark: ['备注'],
}

const matchCol = (headerRow) => {
  const colMap = {}
  headerRow.forEach((cell, idx) => {
    const s = String(cell || '').replace(/[\s\u3000]+/g, '')
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(a => s.includes(a)) && colMap[field] === undefined) {
        colMap[field] = idx
      }
    }
  })
  return colMap
}

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
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }
    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    if (allRows.length < 2) {
      ElMessage.warning('Excel无有效数据')
      return
    }

    // 解析头部基础信息
    let buyer = '', seller = '', businessType = '', productProperty = ''
    let copperPrice = null, month = '', approvalContent = ''
    for (const r of allRows) {
      const cells = r.map(c => String(c || '').replace(/[\s\u3000]+/g, ''))
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].includes('购货方') && i + 1 < cells.length) buyer = String(r[i + 1] || '').trim()
        if (cells[i].includes('销售方') && i + 1 < cells.length) seller = String(r[i + 1] || '').trim()
        if (cells[i].includes('业务类型') && i + 1 < cells.length) businessType = String(r[i + 1] || '').trim()
        if (cells[i].includes('产品属性') && i + 1 < cells.length) productProperty = String(r[i + 1] || '').trim()
        if (cells[i].includes('铜价') && i + 1 < cells.length) copperPrice = parseNumber(r[i + 1])
        if (cells[i].includes('月度') && i + 1 < cells.length) month = String(r[i + 1] || '').trim()
        if (cells[i].includes('审批内容') && i + 1 < cells.length) approvalContent = String(r[i + 1] || '').trim()
      }
    }

    // 找到明细表头行
    let headerIdx = -1
    for (let i = 0; i < allRows.length; i++) {
      const joined = allRows[i].map(c => String(c || '')).join('')
      if (joined.includes('料号') && joined.includes('料品名称')) {
        headerIdx = i
        break
      }
    }
    if (headerIdx < 0) {
      ElMessage.error('未找到明细表头行（需包含"料号"和"料品名称"）')
      return
    }
    const colMap = matchCol(allRows[headerIdx])
    if (colMap.materialCode === undefined) {
      ElMessage.error('未找到料号列')
      return
    }

    const items = []
    for (let i = headerIdx + 1; i < allRows.length; i++) {
      const r = allRows[i]
      const code = String(r[colMap.materialCode] || '').trim()
      if (!code) continue
      items.push({
        materialCode: code,
        materialName: colMap.materialName !== undefined ? String(r[colMap.materialName] || '').trim() : '',
        model: colMap.model !== undefined ? String(r[colMap.model] || '').trim() : '',
        plannedPrice: colMap.plannedPrice !== undefined ? parseNumber(r[colMap.plannedPrice]) : null,
        markupRatio: colMap.markupRatio !== undefined ? parseNumber(r[colMap.markupRatio]) : null,
        baseSettlePrice: colMap.baseSettlePrice !== undefined ? parseNumber(r[colMap.baseSettlePrice]) : null,
        linkedSettlePrice: colMap.linkedSettlePrice !== undefined ? parseNumber(r[colMap.linkedSettlePrice]) : null,
        remark: colMap.remark !== undefined ? String(r[colMap.remark] || '').trim() : '',
      })
    }
    if (items.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importSettle({
      buyer, seller, businessType, productProperty, copperPrice, month, approvalContent, items,
    })
    const count = result?.items?.length || items.length
    ElMessage.success(`已导入${count}条结算价明细`)
    if (currentPage.value === 1) fetchList()
    else currentPage.value = 1
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
.settle-page {
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
.detail-header {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px 16px;
}
.detail-actions {
  margin-bottom: 12px;
}
</style>
