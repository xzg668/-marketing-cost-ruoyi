<template>
  <section class="quote-base-page">
    <div class="page-head">
      <div>
        <h1>报价单基价映射规则</h1>
        <p>维护影响因素识别为 OA 报价单铜基价、锌基价、铝基价的关键词规则。</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
        <el-button
          v-hasPermi="['price:quote-base-mapping:add', 'price:finance-base:edit']"
          type="primary"
          :icon="Plus"
          @click="openCreate"
        >
          新增规则
        </el-button>
      </div>
    </div>

    <div class="filter-panel">
      <el-form :model="filters" label-width="90px">
        <div class="filter-grid">
          <el-form-item label="业务单元">
            <el-input
              v-model="filters.businessUnitType"
              clearable
              placeholder="为空表示默认"
              @keyup.enter="applyFilters"
            />
          </el-form-item>
          <el-form-item label="报价单字段">
            <el-select v-model="filters.quoteFieldCode" clearable placeholder="全部字段">
              <el-option
                v-for="item in QUOTE_FIELD_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="变量编码">
            <el-input
              v-model="filters.variableCode"
              clearable
              placeholder="Cu / Zn / Al"
              @keyup.enter="applyFilters"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="filters.enabled" clearable placeholder="全部">
              <el-option label="启用" :value="true" />
              <el-option label="停用" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="铜基价 / 电解铜"
              @keyup.enter="applyFilters"
            />
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
            <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          </el-form-item>
        </div>
      </el-form>
    </div>

    <el-table :data="rows" border stripe v-loading="loading">
      <el-table-column prop="quoteFieldName" label="报价单字段" width="130">
        <template #default="{ row }">
          {{ row.quoteFieldName || quoteFieldLabel(row.quoteFieldCode) }}
        </template>
      </el-table-column>
      <el-table-column prop="variableCode" label="变量编码" width="110" />
      <el-table-column label="匹配关键词" min-width="300">
        <template #default="{ row }">
          <div class="keyword-list">
            <el-tag
              v-for="keyword in parseKeywords(row.matchKeywordsJson)"
              :key="keyword"
              size="small"
              effect="plain"
            >
              {{ keyword }}
            </el-tag>
            <span v-if="parseKeywords(row.matchKeywordsJson).length === 0" class="muted">-</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="businessUnitType" label="业务单元" width="130">
        <template #default="{ row }">
          {{ row.businessUnitType || '默认' }}
        </template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="90" align="right" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled === 1 ? 'success' : 'info'" effect="plain">
            {{ row.enabled === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedBy" label="最近修改人" width="130">
        <template #default="{ row }">{{ row.updatedBy || '-' }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="最近修改时间" width="170">
        <template #default="{ row }">{{ row.updatedAt || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button
            v-hasPermi="['price:quote-base-mapping:edit', 'price:finance-base:edit']"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-hasPermi="['price:quote-base-mapping:edit', 'price:finance-base:edit']"
            link
            :type="row.enabled === 1 ? 'warning' : 'success'"
            @click="toggleEnabled(row)"
          >
            {{ row.enabled === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button
            v-hasPermi="['price:quote-base-mapping:remove', 'price:finance-base:edit']"
            link
            type="danger"
            @click="removeRow(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无映射规则" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
    />

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="报价单字段" required>
          <el-select v-model="form.quoteFieldCode" style="width: 100%" @change="syncQuoteField">
            <el-option
              v-for="item in QUOTE_FIELD_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="变量编码" required>
          <el-input v-model="form.variableCode" placeholder="Cu / Zn / Al" />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-input v-model="form.businessUnitType" placeholder="为空表示全业务单元默认规则" />
        </el-form-item>
        <el-form-item label="匹配关键词" required>
          <el-select
            v-model="form.matchKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            style="width: 100%"
            placeholder="输入后回车，可添加多个关键词"
          />
        </el-form-item>
        <el-form-item label="匹配模式">
          <el-select v-model="form.matchMode" style="width: 100%">
            <el-option label="命中任一关键词" value="ANY_KEYWORD" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="form.enabled"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import BasePagination from '../../../../components/BasePagination.vue'
import {
  createQuoteBaseMappingRule,
  deleteQuoteBaseMappingRule,
  fetchQuoteBaseMappingRules,
  setQuoteBaseMappingRuleEnabled,
  updateQuoteBaseMappingRule,
} from '../../../../api/quoteBasePriceMappings'

const QUOTE_FIELD_OPTIONS = [
  { value: 'copper_price', label: '铜基价', variableCode: 'Cu' },
  { value: 'zinc_price', label: '锌基价', variableCode: 'Zn' },
  { value: 'aluminum_price', label: '铝基价', variableCode: 'Al' },
]

const defaultForm = () => ({
  businessUnitType: '',
  quoteFieldCode: 'copper_price',
  quoteFieldName: '铜基价',
  variableCode: 'Cu',
  matchKeywords: [],
  matchMode: 'ANY_KEYWORD',
  priority: 10,
  enabled: 1,
  remark: '',
})

const filters = reactive({
  businessUnitType: '',
  quoteFieldCode: '',
  enabled: '',
  variableCode: '',
  keyword: '',
})
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const form = reactive(defaultForm())

const dialogTitle = computed(() => (editingId.value ? '编辑规则' : '新增规则'))

const quoteFieldLabel = (code) =>
  QUOTE_FIELD_OPTIONS.find((item) => item.value === code)?.label || code || '-'

const quoteFieldOption = (code) =>
  QUOTE_FIELD_OPTIONS.find((item) => item.value === code) || QUOTE_FIELD_OPTIONS[0]

const parseKeywords = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : []
  } catch (error) {
    return String(raw || '')
      .split(/[,\n，、]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

const normalizePage = (data) => ({
  records: data?.records || data?.list || [],
  total: Number(data?.total || 0),
})

const buildParams = () => ({
  businessUnitType: filters.businessUnitType.trim(),
  quoteFieldCode: filters.quoteFieldCode,
  enabled: filters.enabled,
  // V3-07 后端目前是统一 keyword 检索，变量编码优先走同一个参数。
  keyword: filters.variableCode.trim() || filters.keyword.trim(),
  page: page.value,
  pageSize: pageSize.value,
})

async function loadRows() {
  loading.value = true
  try {
    const data = await fetchQuoteBaseMappingRules(buildParams())
    const pageData = normalizePage(data)
    rows.value = pageData.records
    total.value = pageData.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error?.message || '查询映射规则失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  if (page.value === 1) {
    loadRows()
  } else {
    page.value = 1
  }
}

function resetFilters() {
  filters.businessUnitType = ''
  filters.quoteFieldCode = ''
  filters.enabled = ''
  filters.variableCode = ''
  filters.keyword = ''
  applyFilters()
}

function assignForm(values) {
  Object.assign(form, defaultForm(), values)
}

function syncQuoteField() {
  const option = quoteFieldOption(form.quoteFieldCode)
  form.quoteFieldName = option.label
  form.variableCode = option.variableCode
}

function openCreate() {
  editingId.value = null
  assignForm(defaultForm())
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  const option = quoteFieldOption(row.quoteFieldCode)
  assignForm({
    businessUnitType: row.businessUnitType || '',
    quoteFieldCode: row.quoteFieldCode || option.value,
    quoteFieldName: row.quoteFieldName || option.label,
    variableCode: row.variableCode || option.variableCode,
    matchKeywords: parseKeywords(row.matchKeywordsJson),
    matchMode: row.matchMode || 'ANY_KEYWORD',
    priority: Number(row.priority ?? option.priority ?? 10),
    enabled: row.enabled === 0 ? 0 : 1,
    remark: row.remark || '',
  })
  dialogVisible.value = true
}

function buildPayload() {
  const option = quoteFieldOption(form.quoteFieldCode)
  // 页面用数组维护关键词，后端统一序列化成 JSON，避免用户手写 JSON 出错。
  return {
    businessUnitType: form.businessUnitType.trim(),
    quoteFieldCode: form.quoteFieldCode,
    quoteFieldName: form.quoteFieldName || option.label,
    variableCode: form.variableCode.trim(),
    matchKeywords: form.matchKeywords.map((item) => String(item).trim()).filter(Boolean),
    matchMode: form.matchMode || 'ANY_KEYWORD',
    priority: Number(form.priority ?? 0),
    enabled: form.enabled,
    remark: form.remark.trim(),
  }
}

async function submitForm() {
  const payload = buildPayload()
  if (!payload.quoteFieldCode || !payload.variableCode || payload.matchKeywords.length === 0) {
    ElMessage.warning('报价单字段、变量编码、匹配关键词必填')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateQuoteBaseMappingRule(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createQuoteBaseMappingRule(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '保存规则失败')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row) {
  const nextEnabled = row.enabled === 1 ? 0 : 1
  try {
    await setQuoteBaseMappingRuleEnabled(row.id, nextEnabled)
    ElMessage.success(nextEnabled === 1 ? '已启用' : '已停用')
    loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '状态更新失败')
  }
}

async function removeRow(row) {
  try {
    await ElMessageBox.confirm('确定删除该映射规则吗？', '提示', { type: 'warning' })
  } catch (error) {
    return
  }
  try {
    await deleteQuoteBaseMappingRule(row.id)
    ElMessage.success('已删除')
    loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '删除规则失败')
  }
}

watch(page, loadRows)
watch(pageSize, () => {
  if (page.value === 1) {
    loadRows()
  } else {
    page.value = 1
  }
})

onMounted(loadRows)
</script>

<style scoped>
.quote-base-page {
  padding: 20px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-head h1 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
  line-height: 32px;
  font-weight: 700;
}

.page-head p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.head-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filter-panel {
  margin-bottom: 14px;
  padding: 16px 16px 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  column-gap: 16px;
}

.filter-actions {
  justify-self: end;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
  align-items: center;
}

.muted {
  color: #9ca3af;
}

@media (max-width: 980px) {
  .page-head {
    flex-direction: column;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-self: stretch;
  }
}
</style>
