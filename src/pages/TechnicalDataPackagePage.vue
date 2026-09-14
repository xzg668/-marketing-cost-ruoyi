<template>
  <div class="package-workspace">
    <button class="back-link" type="button" @click="back">← 返回技术员录入工作台</button>

    <div class="page-heading">
      <div>
        <h2>{{ referenceMode ? '包装组件参照' : '包装组件录入' }}</h2>
        <p v-if="referenceMode">查找同组织已审核、仍有效的产品包装方案，确认后复制为当前产品自己的草稿。</p>
        <p v-else>按原型补齐包装组件料号、名称、规格、用量、单位和价格依据。</p>
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
            <h3>选择包装方案</h3>
            <span>只显示当前业务单元、当前组织且已生效并含有包装明细的技术版本</span>
          </div>
          <div class="search">
            <el-input
              v-model="keyword"
              clearable
              placeholder="产品料号 / 产品名称 / 型号"
              @keyup.enter="searchReferences"
            />
            <el-button type="primary" :loading="searching" @click="searchReferences">查询</el-button>
          </div>
        </div>

        <el-table :data="references" row-key="sourceVersionId" border>
          <el-table-column type="expand" width="48">
            <template #default="{ row }">
              <div class="source-details">
                <div class="detail-title">包装明细（{{ row.itemCount }}项）</div>
                <el-table :data="row.items" size="small" border>
                  <el-table-column prop="componentMaterialNo" label="包装组件料号" min-width="150" />
                  <el-table-column prop="componentName" label="名称" min-width="150" />
                  <el-table-column prop="componentSpec" label="规格" min-width="170" />
                  <el-table-column prop="quantity" label="用量" width="110" />
                  <el-table-column prop="unit" label="单位" width="90" />
                  <el-table-column prop="priceBasisLabel" label="价格依据" width="130" />
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="materialNo" label="来源产品料号" min-width="160" />
          <el-table-column prop="productName" label="来源产品" min-width="170" />
          <el-table-column prop="productModel" label="来源型号" min-width="170" />
          <el-table-column label="有效期" width="150">
            <template #default="{ row }">
              {{ row.validFromMonth }}起{{ row.validToMonth ? ` 至 ${row.validToMonth}` : '' }}
            </template>
          </el-table-column>
          <el-table-column prop="itemCount" label="包装明细" width="105">
            <template #default="{ row }">{{ row.itemCount }}项</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :disabled="!editable" :loading="usingId === row.sourceVersionId" @click="useReference(row)">
                使用方案
              </el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="没有可用包装方案" /></template>
        </el-table>

        <div class="notice">
          <b>参照规则：</b>使用方案后，包装明细和来源快照会复制到当前草稿；后续来源变化不会动态改写本产品。
        </div>
      </section>

      <section v-else class="panel">
        <div class="panel-title">
          <div>
            <h3>包装组件明细</h3>
            <span><em>*</em> 为必填；空白行保存时自动过滤，本期价格依据不上传附件</span>
          </div>
          <el-button :disabled="!editable" @click="addRow">＋ 新增包装组件</el-button>
        </div>

        <div class="table-scroll">
          <table class="entry-table">
            <thead>
              <tr>
                <th>序号</th>
                <th><em>*</em> 包装组件料号</th>
                <th><em>*</em> 名称</th>
                <th>规格</th>
                <th><em>*</em> 用量</th>
                <th><em>*</em> 单位</th>
                <th><em>*</em> 价格依据</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.clientKey">
                <td class="center">{{ index + 1 }}</td>
                <td><el-input v-model="row.componentMaterialNo" :disabled="!editable" maxlength="64" /></td>
                <td><el-input v-model="row.componentName" :disabled="!editable" maxlength="255" /></td>
                <td><el-input v-model="row.componentSpec" :disabled="!editable" maxlength="255" /></td>
                <td><el-input-number v-model="row.quantity" :disabled="!editable" :min="0" :controls="false" /></td>
                <td>
                  <el-select v-model="row.unit" :disabled="!editable">
                    <el-option v-for="unit in PACKAGE_UNIT_OPTIONS" :key="unit" :label="unit" :value="unit" />
                  </el-select>
                </td>
                <td>
                  <el-select v-model="row.priceBasisType" :disabled="!editable">
                    <el-option
                      v-for="option in PACKAGE_PRICE_BASIS_OPTIONS"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </td>
                <td><el-input v-model="row.remark" :disabled="!editable" maxlength="1000" /></td>
                <td>
                  <el-button link type="danger" :disabled="!editable" :loading="deletingId === row.id" @click="removeRow(row, index)">删除</el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="entry-summary">
          <span>当前明细：<b>{{ nonBlankCount }}项</b></span>
          <span>录入方式：<b>{{ workspace.entryMode === 'REFERENCE' ? '参照后编辑' : '手工录入' }}</b></span>
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
  applyTechnicalDataPackageReference,
  deleteTechnicalDataPackageItem,
  fetchTechnicalDataPackage,
  fetchTechnicalDataPackageReferences,
  saveTechnicalDataPackage,
} from '../api/technicalDataTasks'
import { isDomainError, showErrorOnce } from '../utils/errorHandler'
import {
  PACKAGE_PRICE_BASIS_OPTIONS,
  PACKAGE_UNIT_OPTIONS,
  validatePackageRows,
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

const referenceMode = computed(() => String(route.name).endsWith('package-reference'))
const editable = computed(() =>
  (workspace.value?.draftVersionStatus == null || workspace.value?.draftVersionStatus === 'DRAFT')
  && !['APPROVED', 'SUBMITTED', 'NOT_REQUIRED'].includes(workspace.value?.moduleStatus))
const productId = computed(() => route.params.productId)
const nonBlankCount = computed(() => rows.value.filter((row) => [
  row.componentMaterialNo, row.componentName, row.componentSpec, row.quantity,
  row.unit, row.priceBasisType, row.remark,
].some((value) => String(value ?? '').trim())).length)

function blankRow(source = {}) {
  rowSeed += 1
  return {
    id: source.id || null,
    clientKey: source.id ? `id-${source.id}` : `new-${rowSeed}`,
    componentMaterialNo: source.componentMaterialNo || '',
    componentName: source.componentName || '',
    componentSpec: source.componentSpec || '',
    quantity: source.quantity == null ? null : Number(source.quantity),
    unit: source.unit || '只',
    priceBasisType: source.priceBasisType || 'HISTORICAL_PRICE',
    remark: source.remark || '',
  }
}

async function load() {
  loading.value = true
  try {
    workspace.value = await fetchTechnicalDataPackage(productId.value)
    rows.value = (workspace.value.items || []).map(blankRow)
    if (!rows.value.length) rows.value = [blankRow()]
    if (referenceMode.value) await searchReferences()
  } catch (error) {
    showErrorOnce(error, '包装组件工作区加载失败')
  } finally {
    loading.value = false
  }
}

async function searchReferences() {
  searching.value = true
  try {
    const result = await fetchTechnicalDataPackageReferences(productId.value, keyword.value.trim())
    references.value = result?.candidates || []
  } catch (error) {
    showErrorOnce(error, '包装参照查询失败')
  } finally {
    searching.value = false
  }
}

async function useReference(candidate) {
  usingId.value = candidate.sourceVersionId
  try {
    workspace.value = await applyTechnicalDataPackageReference(
      productId.value, candidate.sourceVersionId, workspace.value.expectedVersion)
    ElMessage.success(`已参照 ${candidate.materialNo} / ${candidate.productModel}，共${candidate.itemCount}项`)
    back()
  } catch (error) {
    await handleWriteError(error, '使用包装方案失败')
  } finally {
    usingId.value = null
  }
}

function addRow() {
  rows.value.push(blankRow())
}

async function removeRow(row, index) {
  if (!row.id) {
    rows.value.splice(index, 1)
    if (!rows.value.length) addRow()
    return
  }
  try {
    await ElMessageBox.confirm('确定删除这条包装明细吗？', '删除确认', { type: 'warning' })
  } catch {
    return
  }
  deletingId.value = row.id
  try {
    workspace.value = await deleteTechnicalDataPackageItem(
      productId.value, row.id, workspace.value.expectedVersion)
    rows.value = (workspace.value.items || []).map(blankRow)
    if (!rows.value.length) addRow()
    ElMessage.success('包装明细已删除')
  } catch (error) {
    await handleWriteError(error, '删除包装明细失败')
  } finally {
    deletingId.value = null
  }
}

async function save(returnAfterSave) {
  const message = validatePackageRows(rows.value)
  if (message) return ElMessage.warning(message)
  saving.value = true
  try {
    const items = rows.value.map((row) => ({
      componentMaterialNo: row.componentMaterialNo,
      componentName: row.componentName,
      componentSpec: row.componentSpec,
      quantity: row.quantity,
      unit: row.unit,
      priceBasisType: row.priceBasisType,
      remark: row.remark,
    }))
    workspace.value = await saveTechnicalDataPackage(
      productId.value, items, workspace.value.expectedVersion)
    rows.value = (workspace.value.items || []).map(blankRow)
    ElMessage.success(`已保存 ${workspace.value.itemCount}项包装明细`)
    if (returnAfterSave) back()
  } catch (error) {
    await handleWriteError(error, '保存包装明细失败')
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
.package-workspace { min-width: 980px; color: #303846; }
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
.search { display: flex; gap: 8px; width: 430px; }
.source-details { padding: 12px 48px 18px; background: #f8fafc; }
.detail-title { margin-bottom: 8px; font-weight: 700; }
.notice { margin: 14px; padding: 12px 15px; border-left: 4px solid #3a94e8; background: #edf6ff; color: #48627c; }
.readonly-notice { margin-bottom: 14px; padding: 12px 15px; border-left: 4px solid #47a56a; background: #eef9f2; color: #386549; }
.table-scroll { overflow-x: auto; }
.entry-table { width: 100%; min-width: 1480px; border-collapse: collapse; }
.entry-table th, .entry-table td { padding: 9px 10px; border-right: 1px solid #e2e7ee; border-bottom: 1px solid #e2e7ee; text-align: left; }
.entry-table th { background: #f6f8fb; color: #3f4c60; }
.entry-table th:nth-child(1) { width: 58px; }
.entry-table th:nth-child(2) { width: 175px; }
.entry-table th:nth-child(3) { width: 170px; }
.entry-table th:nth-child(4) { width: 190px; }
.entry-table th:nth-child(5) { width: 135px; }
.entry-table th:nth-child(6) { width: 105px; }
.entry-table th:nth-child(7) { width: 150px; }
.entry-table th:nth-child(8) { width: 180px; }
.entry-table th:nth-child(9) { width: 80px; }
.entry-table :deep(.el-input-number), .entry-table :deep(.el-select) { width: 100%; }
.center { text-align: center !important; }
.entry-summary { display: flex; gap: 36px; padding: 13px 16px; border-top: 1px solid #e2e7ee; background: #fbfcfe; }
.actions { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; color: #8792a1; }
</style>
