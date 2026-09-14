<template>
  <div class="salary-workspace">
    <button class="back-link" type="button" @click="back">← 返回技术员录入工作台</button>

    <div class="page-heading">
      <div>
        <h2>{{ referenceMode ? '工资信息参照' : '工资信息录入' }}</h2>
        <p v-if="referenceMode">参照当前有效 CMS 工资方案或同组织已审核技术版本，确认后复制为当前草稿。</p>
        <p v-else>补齐工序、人工类型、工时、工资率和人数/系数；每件金额由服务端换算并计算。</p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-skeleton v-if="loading && !workspace" :rows="8" animated />
    <template v-else-if="workspace">
      <div class="context">
        <div><span>产品料号</span><b>{{ workspace.materialNo || '-' }}</b></div>
        <div><span>产品名称</span><b>{{ workspace.productName || '-' }}</b></div>
        <div><span>产品型号</span><b>{{ workspace.productModel || '-' }}</b></div>
        <div><span>核算月份</span><b>{{ workspace.accountingMonth }}</b></div>
      </div>
      <div v-if="!editable" class="readonly-notice">该版本已提交审核并冻结，当前页面只读。</div>

      <section v-if="referenceMode" class="panel">
        <div class="panel-title">
          <div>
            <h3>选择工资方案</h3>
            <span>来源只读；使用后复制工资明细与来源快照，不修改 CMS、HR 或历史版本</span>
          </div>
          <div class="search">
            <el-input
              v-model="keyword"
              clearable
              placeholder="产品料号 / 名称 / 型号 / 人工类型"
              @keyup.enter="searchReferences"
            />
            <el-button type="primary" :loading="searching" @click="searchReferences">查询</el-button>
          </div>
        </div>

        <el-table :data="references" :row-key="referenceKey" border>
          <el-table-column type="expand" width="48">
            <template #default="{ row }">
              <div class="source-details">
                <div class="detail-title">工资明细（{{ row.itemCount }}项）</div>
                <el-table :data="row.items" size="small" border>
                  <el-table-column prop="processCode" label="工序编码" min-width="125" />
                  <el-table-column prop="processName" label="工序名称" min-width="145" />
                  <el-table-column prop="laborTypeLabel" label="人工类型" width="105" />
                  <el-table-column prop="workingHours" label="标准工时" width="105" />
                  <el-table-column prop="timeUnit" label="工时单位" width="105" />
                  <el-table-column prop="wageRate" label="工资率" width="105" />
                  <el-table-column prop="rateUnit" label="计价单位" width="105" />
                  <el-table-column prop="personCoefficient" label="人数/系数" width="105" />
                  <el-table-column prop="amount" label="每件金额" width="115" />
                  <el-table-column prop="calculationExpression" label="计算过程" min-width="330" />
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="125">
            <template #default="{ row }">{{ sourceTypeLabel(row.sourceType) }}</template>
          </el-table-column>
          <el-table-column prop="materialNo" label="来源产品料号" min-width="160" />
          <el-table-column prop="productName" label="来源产品" min-width="160" />
          <el-table-column prop="productModel" label="来源型号" min-width="160" />
          <el-table-column prop="sourceVersion" label="来源版本" width="130" />
          <el-table-column prop="totalAmount" label="合计金额" width="120" />
          <el-table-column prop="itemCount" label="工资明细" width="100">
            <template #default="{ row }">{{ row.itemCount }}项</template>
          </el-table-column>
          <el-table-column label="操作" width="105" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                :disabled="!editable"
                :loading="usingId === referenceKey(row)"
                @click="useReference(row)"
              >
                使用方案
              </el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="没有可用工资方案" /></template>
        </el-table>

        <div class="notice">
          <b>参照规则：</b>只复制当前展示明细和来源快照；来源后续变化不会自动覆盖本产品。
        </div>
      </section>

      <section v-else class="panel">
        <div class="panel-title">
          <div>
            <h3>工资明细</h3>
            <span><em>*</em> 为必填；标准化工时、小时工资率和每件金额均由服务端计算，本期不提供附件</span>
          </div>
          <el-button :disabled="!editable" @click="addRow">＋ 新增工序</el-button>
        </div>

        <div class="table-scroll">
          <table class="entry-table">
            <thead>
              <tr>
                <th>序号</th>
                <th><em>*</em> 工序编码</th>
                <th><em>*</em> 工序名称</th>
                <th><em>*</em> 人工类型</th>
                <th><em>*</em> 标准工时</th>
                <th><em>*</em> 工时单位</th>
                <th><em>*</em> 工资率</th>
                <th><em>*</em> 计价单位</th>
                <th><em>*</em> 人数/系数</th>
                <th>标准小时</th>
                <th>标准小时工资率</th>
                <th>每件金额 / 计算过程</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.clientKey">
                <td class="center">{{ index + 1 }}</td>
                <td><el-input v-model="row.processCode" :disabled="!editable" maxlength="64" @input="markDirty(row)" /></td>
                <td><el-input v-model="row.processName" :disabled="!editable" maxlength="255" @input="markDirty(row)" /></td>
                <td>
                  <el-select v-model="row.laborType" :disabled="!editable" @change="markDirty(row)">
                    <el-option
                      v-for="option in SALARY_LABOR_TYPE_OPTIONS"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </td>
                <td><el-input-number v-model="row.workingHours" :disabled="!editable" :min="0" :controls="false" @change="markDirty(row)" /></td>
                <td>
                  <el-select v-model="row.timeUnit" :disabled="!editable" @change="markDirty(row)">
                    <el-option v-for="unit in SALARY_TIME_UNIT_OPTIONS" :key="unit" :label="unit" :value="unit" />
                  </el-select>
                </td>
                <td><el-input-number v-model="row.wageRate" :disabled="!editable" :min="0" :controls="false" @change="markDirty(row)" /></td>
                <td>
                  <el-select v-model="row.rateUnit" :disabled="!editable" @change="markDirty(row)">
                    <el-option v-for="unit in SALARY_RATE_UNIT_OPTIONS" :key="unit" :label="unit" :value="unit" />
                  </el-select>
                </td>
                <td><el-input-number v-model="row.personCoefficient" :disabled="!editable" :min="0" :controls="false" @change="markDirty(row)" /></td>
                <td class="server-value">{{ displayServerValue(row, 'standardHours', '小时') }}</td>
                <td class="server-value">{{ displayServerValue(row, 'hourlyRate', '元/小时') }}</td>
                <td class="amount">{{ displayCalculation(row) }}</td>
                <td><el-input v-model="row.remark" :disabled="!editable" maxlength="1000" @input="markDirty(row)" /></td>
                <td><el-button link type="danger" :disabled="!editable" :loading="deletingId === row.id" @click="removeRow(row, index)">删除</el-button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="calculation-note">
          金额口径：标准小时 × 标准小时工资率 × 人数/系数；分钟和元/分钟由服务端统一换算，客户端不提交金额。
        </div>
        <div class="entry-summary">
          <span>当前明细：<b>{{ nonBlankCount }}项</b></span>
          <span>录入方式：<b>{{ workspace.entryMode === 'REFERENCE' ? '参照后编辑' : '手工录入' }}</b></span>
          <span>服务端合计：<b>{{ workspace.totalAmount || 0 }} 元/件</b></span>
          <span>附件：<b>本期不提供</b></span>
        </div>
        <div class="actions">
          <span>保存草稿不会提交审核，可继续修改</span>
          <div>
            <el-button :disabled="!editable" :loading="saving" @click="save(false)">保存草稿</el-button>
            <el-button type="primary" :disabled="!editable" :loading="saving" @click="save(true)">保存并返回</el-button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  applyTechnicalDataSalaryReference,
  deleteTechnicalDataSalaryItem,
  fetchTechnicalDataSalary,
  fetchTechnicalDataSalaryReferences,
  saveTechnicalDataSalary,
} from '../api/technicalDataTasks'
import { isDomainError, showErrorOnce } from '../utils/errorHandler'
import {
  SALARY_LABOR_TYPE_OPTIONS,
  SALARY_RATE_UNIT_OPTIONS,
  SALARY_TIME_UNIT_OPTIONS,
  validateSalaryRows,
} from '../utils/technicalDataWorkbench'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const searching = ref(false)
const saving = ref(false)
const usingId = ref(null)
const deletingId = ref(null)
const workspace = ref(null)
const keyword = ref('')
const references = ref([])
const rows = ref([])
let rowSeed = 0

const referenceMode = computed(() => String(route.name).endsWith('salary-reference'))
const editable = computed(() =>
  (workspace.value?.draftVersionStatus == null || workspace.value?.draftVersionStatus === 'DRAFT')
  && !['APPROVED', 'SUBMITTED', 'NOT_REQUIRED'].includes(workspace.value?.moduleStatus))
const productId = computed(() => route.params.productId)
const nonBlankCount = computed(() => rows.value.filter((row) => [
  row.processCode, row.processName, row.laborType, row.workingHours,
  row.timeUnit, row.wageRate, row.rateUnit, row.personCoefficient, row.remark,
].some((value) => String(value ?? '').trim())).length)

function blankRow(source = {}) {
  rowSeed += 1
  return {
    id: source.id || null,
    clientKey: source.id ? `id-${source.id}` : `new-${rowSeed}`,
    processCode: source.processCode || '',
    processName: source.processName || '',
    laborType: source.laborType || 'DIRECT',
    workingHours: source.workingHours == null ? null : Number(source.workingHours),
    timeUnit: source.timeUnit || '小时/件',
    wageRate: source.wageRate == null ? null : Number(source.wageRate),
    rateUnit: source.rateUnit || '元/小时',
    personCoefficient: source.personCoefficient == null ? 1 : Number(source.personCoefficient),
    standardHours: source.standardHours == null ? null : source.standardHours,
    hourlyRate: source.hourlyRate == null ? null : source.hourlyRate,
    amount: source.amount == null ? null : source.amount,
    calculationExpression: source.calculationExpression || '',
    remark: source.remark || '',
    calculationDirty: false,
  }
}

async function load() {
  loading.value = true
  try {
    workspace.value = await fetchTechnicalDataSalary(productId.value)
    rows.value = (workspace.value.items || []).map(blankRow)
    if (!rows.value.length) rows.value = [blankRow()]
    if (referenceMode.value) await searchReferences()
  } catch (error) {
    showErrorOnce(error, '工资工作区加载失败')
  } finally {
    loading.value = false
  }
}

async function searchReferences() {
  searching.value = true
  try {
    const result = await fetchTechnicalDataSalaryReferences(productId.value, keyword.value.trim())
    references.value = result?.candidates || []
  } catch (error) {
    showErrorOnce(error, '工资参照查询失败')
  } finally {
    searching.value = false
  }
}

async function useReference(candidate) {
  usingId.value = referenceKey(candidate)
  try {
    workspace.value = await applyTechnicalDataSalaryReference(
      productId.value, candidate.sourceType, candidate.sourceId, workspace.value.expectedVersion)
    ElMessage.success(`已参照${sourceTypeLabel(candidate.sourceType)}，共${candidate.itemCount}项`)
    back()
  } catch (error) {
    await handleWriteError(error, '使用工资方案失败')
  } finally {
    usingId.value = null
  }
}

function addRow() {
  rows.value.push(blankRow())
}

function markDirty(row) {
  row.calculationDirty = true
}

function displayServerValue(row, field, unit) {
  if (row.calculationDirty || row[field] == null) return '保存后计算'
  return `${row[field]} ${unit}`
}

function displayCalculation(row) {
  if (row.calculationDirty || row.amount == null) return '保存后由服务端计算'
  return row.calculationExpression || `${row.amount} 元/件`
}

async function removeRow(row, index) {
  if (!row.id) {
    rows.value.splice(index, 1)
    if (!rows.value.length) addRow()
    return
  }
  try {
    await ElMessageBox.confirm('确定删除这条工资明细吗？', '删除确认', { type: 'warning' })
  } catch {
    return
  }
  deletingId.value = row.id
  try {
    workspace.value = await deleteTechnicalDataSalaryItem(
      productId.value, row.id, workspace.value.expectedVersion)
    rows.value = (workspace.value.items || []).map(blankRow)
    if (!rows.value.length) addRow()
    ElMessage.success('工资明细已删除')
  } catch (error) {
    await handleWriteError(error, '删除工资明细失败')
  } finally {
    deletingId.value = null
  }
}

async function save(returnAfterSave) {
  const message = validateSalaryRows(rows.value)
  if (message) return ElMessage.warning(message)
  saving.value = true
  try {
    const items = rows.value.map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      laborType: row.laborType,
      workingHours: row.workingHours,
      timeUnit: row.timeUnit,
      wageRate: row.wageRate,
      rateUnit: row.rateUnit,
      personCoefficient: row.personCoefficient,
      remark: row.remark,
    }))
    workspace.value = await saveTechnicalDataSalary(
      productId.value, items, workspace.value.expectedVersion)
    rows.value = (workspace.value.items || []).map(blankRow)
    ElMessage.success(`已保存 ${workspace.value.itemCount}项工资，合计${workspace.value.totalAmount}元/件`)
    if (returnAfterSave) back()
  } catch (error) {
    await handleWriteError(error, '保存工资明细失败')
  } finally {
    saving.value = false
  }
}

async function handleWriteError(error, fallback) {
  if (isDomainError(error, 'VERSION_CONFLICT') || Number(error?.resultCode) === 409) {
    ElMessage.error('数据已被其他会话修改，页面将刷新为最新数据')
    await load()
  } else {
    showErrorOnce(error, fallback)
  }
}

function referenceKey(row) {
  return `${row.sourceType}:${row.sourceId}`
}

function sourceTypeLabel(value) {
  return value === 'CMS_EFFECTIVE' ? 'CMS有效工资' : '历史技术版本'
}

function back() {
  if (route.meta?.technicalDataShortSession) {
    router.push({ name: 'technical-data-access-workbench', params: { taskId: route.params.taskId } })
  } else if (route.query.returnTo === 'product-workbench') {
    router.push('/collaboration/tasks')
  } else {
    router.push({ name: 'technical-data-workbench', params: { taskId: route.params.taskId } })
  }
}

onMounted(load)
</script>

<style scoped>
.salary-workspace { min-width: 1080px; color: #303846; }
.back-link { margin-bottom: 14px; padding: 0; border: 0; background: transparent; color: #318de5; cursor: pointer; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.page-heading h2 { margin: 0 0 6px; font-size: 24px; }
.page-heading p { margin: 0; color: #7d8999; }
.context { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 16px; border: 1px solid #e1e6ee; background: #fff; }
.context > div { padding: 13px 18px; border-right: 1px solid #edf0f4; }
.context > div:last-child { border-right: 0; }
.context span { display: block; color: #8a95a4; font-size: 12px; }
.context b { display: block; margin-top: 4px; }
.panel { border: 1px solid #dde3eb; background: #fff; }
.panel-title { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #f7f9fc; border-bottom: 1px solid #e2e7ee; }
.panel-title h3 { margin: 0 0 4px; }
.panel-title span { color: #8792a1; font-size: 13px; }
.panel-title em, th em { color: #e64a42; font-style: normal; }
.search { display: flex; gap: 8px; width: 470px; }
.source-details { padding: 12px 48px 18px; background: #f8fafc; }
.detail-title { margin-bottom: 8px; font-weight: 700; }
.notice, .calculation-note { margin: 14px; padding: 12px 15px; border-left: 4px solid #3a94e8; background: #edf6ff; color: #48627c; }
.readonly-notice { margin-bottom: 14px; padding: 12px 15px; border-left: 4px solid #47a56a; background: #eef9f2; color: #386549; }
.table-scroll { overflow-x: auto; }
.entry-table { width: 100%; min-width: 2220px; border-collapse: collapse; }
.entry-table th, .entry-table td { padding: 9px 10px; border-right: 1px solid #e2e7ee; border-bottom: 1px solid #e2e7ee; text-align: left; }
.entry-table th { background: #f6f8fb; color: #3f4c60; }
.entry-table th:nth-child(1) { width: 58px; }
.entry-table th:nth-child(2) { width: 135px; }
.entry-table th:nth-child(3) { width: 155px; }
.entry-table th:nth-child(4) { width: 120px; }
.entry-table th:nth-child(5) { width: 120px; }
.entry-table th:nth-child(6) { width: 115px; }
.entry-table th:nth-child(7) { width: 120px; }
.entry-table th:nth-child(8) { width: 110px; }
.entry-table th:nth-child(9) { width: 115px; }
.entry-table th:nth-child(10) { width: 125px; }
.entry-table th:nth-child(11) { width: 155px; }
.entry-table th:nth-child(12) { width: 370px; }
.entry-table th:nth-child(13) { width: 180px; }
.entry-table th:nth-child(14) { width: 75px; }
.entry-table :deep(.el-input-number), .entry-table :deep(.el-select) { width: 100%; }
.center { text-align: center !important; }
.server-value { color: #526b86; }
.amount { color: #1e7d49; font-weight: 700; }
.entry-summary { display: flex; gap: 32px; padding: 13px 16px; border-top: 1px solid #e2e7ee; background: #fbfcfe; }
.actions { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; color: #8792a1; }
</style>
