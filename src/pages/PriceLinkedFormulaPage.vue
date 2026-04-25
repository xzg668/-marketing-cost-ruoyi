<template>
  <div class="formula-page">
    <!-- T23：三栏布局 —— 左（公式列表）/ 中（FormulaEditor）/ 右（变量目录） -->
    <div class="formula-layout">
      <!-- ====================== 左：公式列表 ====================== -->
      <el-card class="col-left" shadow="never">
        <div class="panel-header">
          <div class="panel-title">公式列表</div>
          <el-button type="primary" size="small" @click="openCreate">
            新增
          </el-button>
        </div>
        <el-form :inline="false" label-position="top" class="filter-form">
          <el-form-item label="物料代码">
            <el-input
              v-model="filters.materialCode"
              placeholder="MAT-1001"
              clearable
              @keyup.enter="fetchList"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="filters.status" clearable placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="启用" value="active" />
              <el-option label="停用" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" @click="fetchList">
              查询
            </el-button>
            <el-button size="small" @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
        <el-divider />
        <div class="formula-list" v-loading="loading">
          <div v-if="!tableRows.length" class="list-empty">暂无公式</div>
          <div
            v-for="row in tableRows"
            :key="row.id"
            class="list-item"
            :class="{ 'list-item--active': editingId === row.id }"
            @click="openEdit(row)"
          >
            <div class="list-item__head">
              <span class="list-item__code">{{ row.materialCode }}</span>
              <el-tag
                size="small"
                :type="row.status === 'active' ? 'success' : 'info'"
              >
                {{ row.status === 'active' ? '启用' : '停用' }}
              </el-tag>
            </div>
            <div class="list-item__name">{{ row.formulaName }}</div>
            <div class="list-item__expr">{{ row.expr }}</div>
          </div>
        </div>
      </el-card>

      <!-- ====================== 中：FormulaEditor ====================== -->
      <el-card class="col-mid" shadow="never">
        <div class="panel-header">
          <div class="panel-title">{{ dialogTitle }}</div>
          <div>
            <el-button v-if="editingId" type="danger" link @click="removeCurrent">
              删除
            </el-button>
            <el-button size="small" @click="cancelEdit">取消</el-button>
            <el-button type="primary" size="small" @click="submitForm">
              保存
            </el-button>
          </div>
        </div>
        <el-form :model="formModel" label-width="90px" class="edit-form">
          <el-form-item label="物料代码">
            <el-input
              v-model="formModel.materialCode"
              placeholder="MAT-1001"
            />
          </el-form-item>
          <el-form-item label="公式名称">
            <el-input v-model="formModel.formulaName" placeholder="公式名称" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="formModel.status" style="width: 160px">
              <el-option label="启用" value="active" />
              <el-option label="停用" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item label="表达式">
            <!-- 直接接入 T20/T21 的 FormulaEditor：@ 补全 + 500ms 防抖预览 -->
            <FormulaEditor
              v-model="formModel.expr"
              :material-code="formModel.materialCode"
              :pricing-month="filters.pricingMonth"
              placeholder="输入公式，@ 可唤起变量补全"
            />
          </el-form-item>
          <el-form-item label="中文说明">
            <el-input
              :model-value="formulaPreview"
              type="textarea"
              :rows="2"
              readonly
            />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- ====================== 右：变量目录 ====================== -->
      <el-card class="col-right" shadow="never">
        <div class="panel-header">
          <div class="panel-title">变量目录</div>
          <el-button size="small" :loading="catalogLoading" @click="loadCatalog">
            刷新
          </el-button>
        </div>
        <el-input
          v-model="catalogQuery"
          size="small"
          clearable
          placeholder="搜索变量名 / code"
          class="catalog-search"
        />
        <div class="catalog-list" v-loading="catalogLoading">
          <div v-if="!filteredCatalog.length" class="list-empty">
            无匹配变量
          </div>
          <div
            v-for="item in filteredCatalog"
            :key="item.group + '::' + item.code"
            class="catalog-item"
            @click="insertVariable(item)"
          >
            <div class="catalog-item__row">
              <span class="catalog-code">[{{ item.code }}]</span>
              <el-tag size="small" :type="groupTagType(item.group)">
                {{ item.groupLabel }}
              </el-tag>
            </div>
            <div class="catalog-name">{{ item.name || '—' }}</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import FormulaEditor from '../components/FormulaEditor.vue'
import { toChineseExpr } from '../utils/formula'
import {
  fetchFormulaList,
  createFormula,
  updateFormula,
  deleteFormula,
} from '../mock/priceLinkedSimple'
// T23：右栏变量目录复用 T19/T20 的 catalog 接口 + T20 的扁平化/过滤纯函数
import { fetchCatalog } from '../api/priceVariables'
import { filterCatalog } from '../components/formulaEditorUtils'

const route = useRoute()
const loading = ref(false)
const tableRows = ref([])
const editingId = ref(null)
/** T23：不再有 dialog —— 中栏永远挂着一个 formModel，editingId 仅区分新建/编辑 */
const hasDraft = ref(false)

const filters = ref({
  materialCode: '',
  status: '',
  /** 预留给 FormulaEditor.preview —— 当前页不强制选月，空串即可（后端会回退到最新月） */
  pricingMonth: '',
})

const emptyForm = () => ({
  materialCode: '',
  formulaName: '',
  expr: '',
  status: 'active',
})

const formModel = ref(emptyForm())

const dialogTitle = computed(() => {
  if (editingId.value) return '编辑公式'
  if (hasDraft.value) return '新增公式'
  return '未选择公式'
})

const formulaPreview = computed(() => toChineseExpr(formModel.value.expr))

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchFormulaList({
      materialCode: filters.value.materialCode?.trim(),
      status: filters.value.status,
    })
    tableRows.value = Array.isArray(data) ? data : []
    // 刷新后若之前选中行还在，保持选中；否则清空
    if (editingId.value) {
      const still = tableRows.value.find((r) => r.id === editingId.value)
      if (!still) {
        resetDraft()
      } else {
        // 以列表最新数据同步表单（避免显示过期字段）
        syncFormFromRow(still)
      }
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取公式失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    materialCode: '',
    status: '',
    pricingMonth: '',
  }
  fetchList()
}

const syncFormFromRow = (row) => {
  formModel.value = {
    materialCode: row.materialCode,
    formulaName: row.formulaName,
    expr: row.expr,
    status: row.status,
  }
}

const openCreate = () => {
  editingId.value = null
  hasDraft.value = true
  formModel.value = emptyForm()
}

const openEdit = (row) => {
  editingId.value = row.id
  hasDraft.value = true
  syncFormFromRow(row)
}

const resetDraft = () => {
  editingId.value = null
  hasDraft.value = false
  formModel.value = emptyForm()
}

const cancelEdit = () => {
  resetDraft()
}

const submitForm = async () => {
  if (!hasDraft.value) {
    ElMessage.info('请从左侧选择一条公式，或点击"新增"')
    return
  }
  if (!formModel.value.materialCode || !formModel.value.expr) {
    ElMessage.warning('物料代码和表达式必填')
    return
  }
  if (editingId.value) {
    await updateFormula({ id: editingId.value, ...formModel.value })
    ElMessage.success('公式已更新')
  } else {
    const created = await createFormula(formModel.value)
    ElMessage.success('公式已新增')
    // 新增成功后自动选中新行 —— 列表刷新里会重新 syncFormFromRow
    if (created?.id) editingId.value = created.id
  }
  fetchList()
}

const removeCurrent = async () => {
  if (!editingId.value) return
  try {
    await ElMessageBox.confirm('确定删除该公式吗？', '提示', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  try {
    await deleteFormula(editingId.value)
    ElMessage.success('已删除')
    resetDraft()
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

// ====================== 右：变量目录 ======================
const catalog = ref({
  financeFactors: [],
  partContexts: [],
  formulaRefs: [],
})
const catalogLoading = ref(false)
const catalogQuery = ref('')

const filteredCatalog = computed(() =>
  filterCatalog(catalog.value, catalogQuery.value)
)

const groupTagType = (group) => {
  switch (group) {
    case 'finance':
      return 'success'
    case 'part':
      return ''
    case 'formula':
      return 'warning'
    default:
      return 'info'
  }
}

const loadCatalog = async () => {
  catalogLoading.value = true
  try {
    catalog.value = (await fetchCatalog()) || {
      financeFactors: [],
      partContexts: [],
      formulaRefs: [],
    }
  } catch (_) {
    // 静默失败 —— http.js 已统一弹 toast
  } finally {
    catalogLoading.value = false
  }
}

/** 右栏点击变量：把 `[code]` 追加到当前表达式末尾（不抢光标） */
const insertVariable = (item) => {
  if (!hasDraft.value) {
    ElMessage.info('请先从左侧选择一条公式，或点击"新增"')
    return
  }
  const prev = formModel.value.expr || ''
  const needSpace = prev && !/[\s+\-*/(,]$/.test(prev)
  formModel.value.expr = `${prev}${needSpace ? ' ' : ''}[${item.code}]`
}

const syncQueryFilters = () => {
  if (route.query?.materialCode) {
    filters.value.materialCode = String(route.query.materialCode)
  }
}

watch(
  () => route.query,
  () => {
    syncQueryFilters()
    fetchList()
  },
  { immediate: true }
)

// 进入页面即加载变量目录 —— 与公式列表并行
loadCatalog()
</script>

<style scoped>
.formula-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* T23：三栏网格 —— 左窄、中宽、右窄；小屏自动堆叠 */
.formula-layout {
  display: grid;
  grid-template-columns: 320px 1fr 280px;
  gap: 16px;
  align-items: stretch;
  min-height: calc(100vh - 120px);
}

@media (max-width: 1280px) {
  .formula-layout {
    grid-template-columns: 280px 1fr 260px;
  }
}

@media (max-width: 1024px) {
  .formula-layout {
    grid-template-columns: 1fr;
  }
}

.col-left,
.col-mid,
.col-right {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

/* ---- 左栏 列表 ---- */
.formula-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 70vh;
}

.list-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 32px 0;
}

.list-item {
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.15s, background 0.15s;
}

.list-item:hover {
  border-color: #c6e2ff;
  background: #f8fbff;
}

.list-item--active {
  border-color: #409eff;
  background: #ecf5ff;
}

.list-item__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.list-item__code {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-weight: 600;
  color: #409eff;
}

.list-item__name {
  font-size: 13px;
  color: #303133;
}

.list-item__expr {
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 中栏 编辑区 ---- */
.edit-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

/* ---- 右栏 变量目录 ---- */
.catalog-search {
  margin-bottom: 8px;
}

.catalog-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 70vh;
}

.catalog-item {
  padding: 6px 10px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
}

.catalog-item:hover {
  border-color: #c6e2ff;
  background: #f8fbff;
}

.catalog-item__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.catalog-code {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-weight: 600;
  color: #409eff;
  font-size: 12px;
}

.catalog-name {
  margin-top: 2px;
  font-size: 12px;
  color: #606266;
}
</style>
