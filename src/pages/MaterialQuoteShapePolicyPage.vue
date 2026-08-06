<template>
  <div class="shape-policy-page">
    <section class="policy-hero">
      <div class="hero-copy">
        <span class="hero-kicker">报价基础规则</span>
        <div class="hero-title-row">
          <h1>报价 BOM 物料形态规则</h1>
          <el-tag effect="plain" round>全局生效</el-tag>
        </div>
        <p>只为需要特殊处理的物料配置报价规则；未配置物料继续按原有 U9 形态处理。</p>
        <div class="hero-freeze-note">
          <span class="note-dot" />
          新规则默认从下月生效；不会改变本月已经冻结的报价 BOM。
        </div>
      </div>
      <div class="hero-actions">
        <el-button
          v-hasPermi="['system:operation-log:list']"
          :icon="Tickets"
          @click="openAuditDrawer"
        >
          操作日志
        </el-button>
        <el-button
          v-hasPermi="['bom-data:material-shape-policy:edit']"
          type="primary"
          :icon="Plus"
          @click="openCreate"
        >
          新增规则
        </el-button>
        <el-button :icon="RefreshRight" circle :loading="loading" title="刷新" @click="loadRows" />
      </div>
    </section>

    <section class="summary-grid" aria-label="规则概览">
      <article class="summary-card summary-total">
        <div class="summary-label"><span class="summary-dot" />规则总数</div>
        <strong>{{ ruleSummary.total }}</strong>
        <small>当前查询范围</small>
      </article>
      <article class="summary-card summary-enabled">
        <div class="summary-label"><span class="summary-dot" />正在生效</div>
        <strong>{{ ruleSummary.enabled }}</strong>
        <small>已启用规则</small>
      </article>
      <article class="summary-card summary-fixed">
        <div class="summary-label"><span class="summary-dot" />固定形态</div>
        <strong>{{ ruleSummary.fixed }}</strong>
        <small>直接指定报价形态</small>
      </article>
      <article class="summary-card summary-ratio">
        <div class="summary-label"><span class="summary-dot" />特殊物料规则</div>
        <strong>{{ ruleSummary.supplierRatio }}</strong>
        <small>仅对已配置物料生效</small>
      </article>
    </section>

    <section class="query-panel">
      <div class="panel-heading">
        <div>
          <h2>筛选规则</h2>
          <p>优先按组织、料号或名称定位；型号和规格可在高级筛选中补充。</p>
        </div>
        <div class="filter-heading-actions">
          <el-tag v-if="activeFilterCount" type="primary" effect="plain" round>
            已应用 {{ activeFilterCount }} 个条件
          </el-tag>
          <el-button link type="primary" @click="advancedFiltersVisible = !advancedFiltersVisible">
            {{ advancedFiltersVisible ? '收起高级筛选' : '高级筛选' }}
          </el-button>
        </div>
      </div>
      <el-form :model="filters" label-position="top" class="query-form" @submit.prevent="search">
        <div class="filter-grid">
          <el-form-item label="料品组织">
              <el-select v-model="filters.materialOrgCode" clearable placeholder="全部">
                <el-option
                  v-for="item in MATERIAL_ORG_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
          </el-form-item>
          <el-form-item label="料号">
            <el-input v-model="filters.materialCode" clearable placeholder="输入完整或部分料号" @keyup.enter="search" />
          </el-form-item>
          <el-form-item label="物料名称">
            <el-input v-model="filters.materialName" clearable placeholder="例如：烧结基座" @keyup.enter="search" />
          </el-form-item>
          <el-form-item label="规则模式">
              <el-select v-model="filters.policyMode" clearable placeholder="全部">
                <el-option
                  v-for="item in POLICY_MODE_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
          </el-form-item>
          <el-form-item label="生效月份">
              <el-date-picker
                v-model="filters.effectiveMonth"
                type="month"
                value-format="YYYY-MM"
                placeholder="全部"
                clearable
              />
          </el-form-item>
          <el-form-item label="启用状态">
              <el-select v-model="filters.enabled" clearable placeholder="全部">
                <el-option label="启用" :value="1" />
                <el-option label="停用" :value="0" />
              </el-select>
          </el-form-item>
        </div>
        <div v-show="advancedFiltersVisible" class="advanced-filter-grid">
          <el-form-item label="型号">
            <el-input v-model="filters.materialModel" clearable placeholder="输入物料型号" @keyup.enter="search" />
          </el-form-item>
          <el-form-item label="规格">
            <el-input v-model="filters.materialSpec" clearable placeholder="输入物料规格" @keyup.enter="search" />
          </el-form-item>
        </div>
        <div class="query-actions">
          <el-button type="primary" :icon="Search" :loading="loading" @click="search">查询规则</el-button>
          <el-button v-if="activeFilterCount" :icon="RefreshLeft" @click="resetFilters">清空条件</el-button>
        </div>
      </el-form>
    </section>

    <section class="table-panel">
      <div class="panel-heading table-heading">
        <div>
          <h2>规则清单</h2>
          <p>规则按启用状态和生效月份排列；停用不会删除历史操作记录。</p>
        </div>
        <div class="table-count"><strong>{{ rows.length }}</strong><span>条规则</span></div>
      </div>
      <el-table :data="pagedRows" v-loading="loading" class="policy-table" row-key="id">
        <el-table-column label="物料信息" min-width="310" fixed>
          <template #default="{ row }">
            <div class="material-cell">
              <div class="material-code-line">
                <strong>{{ row.materialCode }}</strong>
                <el-tag size="small" effect="plain" class="org-tag">
                  {{ optionLabel(MATERIAL_ORG_OPTIONS, row.materialOrgCode) }}
                </el-tag>
              </div>
              <span class="material-name">{{ row.materialName || '未填写名称' }}</span>
              <span class="material-meta">
                {{ [row.materialModel, row.materialSpec].filter(Boolean).join(' · ') || '未维护型号/规格' }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="判定方式" min-width="320">
          <template #default="{ row }">
            <div class="decision-cell">
              <el-tag
                :type="row.policyMode === POLICY_MODE_FIXED ? 'primary' : 'warning'"
                size="small"
                effect="light"
                round
              >{{ optionLabel(POLICY_MODE_OPTIONS, row.policyMode) }}</el-tag>
              <strong>{{ policyTargetSummary(row) }}</strong>
              <span>{{ row.policyMode === POLICY_MODE_FIXED ? '命中后直接使用指定形态' : '仅该物料按主供关系判断并执行子件排除' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="生效范围" width="180">
          <template #default="{ row }">
            <div class="effective-cell">
              <strong>{{ row.effectiveFromMonth || '-' }}</strong>
              <span>至 {{ row.effectiveToMonth || '长期有效' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small" effect="light" round>
              {{ row.enabled === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="业务说明" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="remark-text">{{ row.remark || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right" align="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button
                v-hasPermi="['bom-data:material-shape-policy:edit']"
                link
                type="primary"
                @click="openEdit(row)"
              >编辑</el-button>
              <el-button
                v-hasPermi="['bom-data:material-shape-policy:toggle']"
                link
                type="warning"
                @click="toggleRow(row)"
              >{{ row.enabled === 1 ? '停用' : '启用' }}</el-button>
              <el-button
                v-hasPermi="['bom-data:material-shape-policy:edit']"
                link
                type="danger"
                @click="removeRow(row)"
              >删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-state">
            <el-empty description="还没有符合条件的物料形态规则">
              <el-button
                v-hasPermi="['bom-data:material-shape-policy:edit']"
                type="primary"
                plain
                @click="openCreate"
              >新增第一条规则</el-button>
            </el-empty>
          </div>
        </template>
      </el-table>

      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="rows.length"
      />
    </section>

    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑物料形态规则' : '新增物料形态规则'"
      width="680px"
      class="policy-editor-dialog"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="editor-intro">
        每条规则只作用于当前选择的物料，未配置规则的普通物料不会受影响；名称、型号、规格由 U9 料品主档自动带出。
      </div>
      <el-form :model="form" label-position="top" class="editor-form">
        <div class="editor-fields">
          <div class="material-select-grid">
            <el-form-item label="料品组织" required>
              <el-select v-model="form.materialOrgCode" @change="onMaterialOrgChange">
                <el-option
                  v-for="item in MATERIAL_ORG_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="物料" required>
              <el-select
                v-model="form.materialCode"
                filterable
                remote
                reserve-keyword
                allow-create
                default-first-option
                :remote-method="searchPolicyMaterials"
                :loading="materialOptionLoading"
                placeholder="输入料号 / 名称 / 型号 / 规格"
                @change="selectPolicyMaterial"
              >
                <el-option
                  v-for="item in materialOptions"
                  :key="item.materialCode"
                  :label="formatMaterialOption(item)"
                  :value="item.materialCode"
                >
                  <div class="material-option">
                    <strong>{{ item.materialCode }}</strong>
                    <span>{{ item.materialName || '未维护名称' }}</span>
                    <small>{{ materialDetailText(item) || '未维护型号/规格' }}</small>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </div>
          <div v-if="form.materialCode" class="selected-material">
            <div><span>料号</span><strong>{{ form.materialCode }}</strong></div>
            <div><span>名称</span><strong>{{ form.materialName || 'U9 暂无名称' }}</strong></div>
            <div><span>型号 / 规格</span><strong>{{ [form.materialModel, form.materialSpec].filter(Boolean).join(' / ') || 'U9 暂无数据' }}</strong></div>
          </div>

          <el-form-item label="处理方式" required>
            <div class="mode-choice" role="radiogroup" aria-label="报价处理方式">
              <button
                type="button"
                class="mode-choice-button"
                :class="{ 'is-active': form.policyMode === POLICY_MODE_FIXED }"
                :aria-pressed="form.policyMode === POLICY_MODE_FIXED"
                @click="onModeChange(POLICY_MODE_FIXED)"
              >固定报价形态</button>
              <button
                type="button"
                class="mode-choice-button"
                :class="{ 'is-active': form.policyMode === POLICY_MODE_SUPPLIER_RATIO }"
                :aria-pressed="form.policyMode === POLICY_MODE_SUPPLIER_RATIO"
                @click="onModeChange(POLICY_MODE_SUPPLIER_RATIO)"
              >特殊物料：按主供应商</button>
            </div>
          </el-form-item>

          <template v-if="form.policyMode === POLICY_MODE_FIXED">
            <el-form-item label="报价形态" required>
              <el-radio-group v-model="form.fixedTargetShape" class="shape-choice">
                <el-radio-button
                  v-for="item in MATERIAL_SHAPE_OPTIONS"
                  :key="item.value"
                  :value="item.value"
                >{{ item.label }}</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <div class="behavior-tip">{{ shapeBehaviorHint(form.fixedTargetShape) }}</div>
          </template>

          <template v-else>
            <div class="supplier-rule-summary">
              <strong>仅对当前选中的特殊物料生效</strong>
              <span>系统取该物料当月供货比例最高的关系：内部主供按制造件并保留下级；外部主供按委外加工件，并排除下方配置的直接子件后再报价。</span>
            </div>
            <el-form-item label="外部主供时排除的直接子件">
              <el-select
                v-model="form.excludedDirectChildMaterialCodes"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="输入子件料号后回车，例如金粉料号 311034930"
              />
              <div class="form-help">只排除当前特殊物料下匹配的直接子件及其子树；内部主供时不排除。</div>
            </el-form-item>
          </template>

          <el-form-item label="生效月份" required>
            <el-date-picker
              v-model="form.effectiveFromMonth"
              type="month"
              value-format="YYYY-MM"
            />
            <div class="form-help">默认下月开始，不改变已经冻结的本月报价。</div>
          </el-form-item>

          <el-button
            link
            type="primary"
            class="more-setting-button"
            @click="advancedEditorSettingsVisible = !advancedEditorSettingsVisible"
          >
            {{ advancedEditorSettingsVisible ? '收起高级设置' : '高级设置' }}
          </el-button>
          <el-collapse-transition>
            <div v-show="advancedEditorSettingsVisible" class="advanced-editor-settings">
              <div class="period-row">
                <el-checkbox v-model="limitedPeriod" @change="onLimitedPeriodChange">设置结束月份</el-checkbox>
                <el-form-item v-if="limitedPeriod" label="结束月份">
                  <el-date-picker
                    v-model="form.effectiveToMonth"
                    type="month"
                    value-format="YYYY-MM"
                    clearable
                  />
                </el-form-item>
              </div>
              <el-form-item label="业务说明（选填）">
                <el-input
                  v-model="form.remark"
                  type="textarea"
                  :rows="2"
                  maxlength="1000"
                  show-word-limit
                  placeholder="补充说明这条规则的业务原因"
                />
              </el-form-item>
            </div>
          </el-collapse-transition>
        </div>
      </el-form>
      <template #footer>
        <div class="editor-footer">
          <span>保存后默认启用，可在规则列表中随时停用。</span>
          <div>
            <el-button @click="editorVisible = false">取消</el-button>
            <el-button
              v-hasPermi="['bom-data:material-shape-policy:edit']"
              type="primary"
              :loading="saving"
              @click="saveRule"
            >保存规则</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="auditVisible" title="物料形态规则操作日志" size="720px">
      <div class="audit-filter">
        <el-input v-model="audit.operName" clearable placeholder="操作人" style="width: 220px" />
        <el-button type="primary" @click="searchAudit">查询</el-button>
      </div>
      <el-table :data="audit.rows" v-loading="audit.loading" border size="small">
        <el-table-column prop="operTime" label="时间" width="170" />
        <el-table-column prop="operName" label="操作人" width="110" />
        <el-table-column prop="businessType" label="类型" width="80" />
        <el-table-column prop="targetId" label="规则ID" width="90" />
        <el-table-column prop="requestMethod" label="请求" min-width="170" show-overflow-tooltip />
        <el-table-column label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 0 ? 'success' : 'danger'" size="small">
              {{ row.status === 0 ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="audit-pagination"
        v-model:current-page="audit.pageNum"
        v-model:page-size="audit.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="audit.total"
        layout="total, sizes, prev, pager, next"
        @change="loadAuditRows"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshLeft, RefreshRight, Search, Tickets } from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import {
  createMaterialQuoteShapePolicy,
  deleteMaterialQuoteShapePolicy,
  fetchMaterialQuoteShapePolicies,
  fetchMaterialQuoteShapePolicyLogs,
  toggleMaterialQuoteShapePolicy,
  updateMaterialQuoteShapePolicy,
} from '../api/materialQuoteShapePolicies.js'
import { fetchU9MaterialOptions } from '../api/u9MaterialMaster.js'
import {
  MATERIAL_ORG_OPTIONS,
  MATERIAL_SHAPE_OPTIONS,
  POLICY_MODE_FIXED,
  POLICY_MODE_OPTIONS,
  POLICY_MODE_SUPPLIER_RATIO,
  buildPolicyQuery,
  buildPolicyRequest,
  createEmptyPolicyForm,
  normalizeAuditPage,
  normalizePolicyList,
  optionLabel,
  policyTargetSummary,
  policyToForm,
  switchPolicyMode,
  validatePolicyForm,
} from '../utils/materialQuoteShapePolicy.js'

const filters = reactive({
  materialOrgCode: '', materialCode: '', materialName: '', materialModel: '',
  materialSpec: '', policyMode: '', effectiveMonth: '', enabled: undefined,
})
const rows = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const advancedFiltersVisible = ref(false)

const activeFilterCount = computed(() => [
  filters.materialOrgCode,
  filters.materialCode,
  filters.materialName,
  filters.materialModel,
  filters.materialSpec,
  filters.policyMode,
  filters.effectiveMonth,
  filters.enabled,
].filter((value) => value !== '' && value !== undefined && value !== null).length)

const ruleSummary = computed(() => ({
  total: rows.value.length,
  enabled: rows.value.filter((row) => row.enabled === 1).length,
  fixed: rows.value.filter((row) => row.policyMode === POLICY_MODE_FIXED).length,
  supplierRatio: rows.value.filter((row) => row.policyMode === POLICY_MODE_SUPPLIER_RATIO).length,
}))

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})

const editorVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const form = reactive(createEmptyPolicyForm())
const materialOptionLoading = ref(false)
const materialOptions = ref([])
const advancedEditorSettingsVisible = ref(false)
const limitedPeriod = ref(false)

const auditVisible = ref(false)
const audit = reactive({
  loading: false, operName: '', pageNum: 1, pageSize: 10, total: 0, rows: [],
})

async function loadRows() {
  loading.value = true
  try {
    rows.value = normalizePolicyList(
      await fetchMaterialQuoteShapePolicies(buildPolicyQuery(filters))
    )
    const maxPage = Math.max(1, Math.ceil(rows.value.length / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  } catch (error) {
    rows.value = []
    ElMessage.error(error.message || '查询物料形态规则失败')
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  loadRows()
}

function resetFilters() {
  Object.assign(filters, {
    materialOrgCode: '', materialCode: '', materialName: '', materialModel: '',
    materialSpec: '', policyMode: '', effectiveMonth: '', enabled: undefined,
  })
  advancedFiltersVisible.value = false
  search()
}

function replaceForm(value) {
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, value)
}

function materialDetailText(material) {
  return [material?.materialModel, material?.materialSpec]
    .filter(Boolean)
    .join(' / ')
}

function formatMaterialOption(material) {
  if (!material) return ''
  return [material.materialCode, material.materialName, materialDetailText(material)]
    .filter(Boolean)
    .join(' · ')
}

function currentMaterialOption() {
  if (!form.materialCode) return null
  return {
    materialCode: form.materialCode,
    materialName: form.materialName,
    materialModel: form.materialModel,
    materialSpec: form.materialSpec,
  }
}

async function searchPolicyMaterials(keyword) {
  const query = String(keyword || '').trim()
  if (!query) {
    materialOptions.value = currentMaterialOption() ? [currentMaterialOption()] : []
    return
  }
  materialOptionLoading.value = true
  try {
    materialOptions.value = await fetchU9MaterialOptions(query, 20, form.materialOrgCode)
  } catch (_error) {
    materialOptions.value = currentMaterialOption() ? [currentMaterialOption()] : []
  } finally {
    materialOptionLoading.value = false
  }
}

function selectPolicyMaterial(materialCode) {
  const selected = materialOptions.value.find((item) => item.materialCode === materialCode)
  if (selected) {
    form.materialName = selected.materialName || ''
    form.materialModel = selected.materialModel || ''
    form.materialSpec = selected.materialSpec || ''
  } else {
    form.materialName = ''
    form.materialModel = ''
    form.materialSpec = ''
  }
}

function onMaterialOrgChange() {
  form.materialCode = ''
  form.materialName = ''
  form.materialModel = ''
  form.materialSpec = ''
  materialOptions.value = []
}

function shapeBehaviorHint(shape) {
  const hints = {
    MANUFACTURE: '制造件：保留当前物料，并继续展开下级参与计价。',
    PURCHASE: '采购件：保留当前物料，报价 BOM 不再展开它的下级。',
    OUTSOURCE: '委外加工件：按委外价格处理，不按自制成本展开。',
  }
  return hints[shape] || '请选择报价形态。'
}

function onLimitedPeriodChange(checked) {
  if (!checked) form.effectiveToMonth = ''
}

function openCreate() {
  editingId.value = null
  replaceForm(createEmptyPolicyForm())
  materialOptions.value = []
  advancedEditorSettingsVisible.value = false
  limitedPeriod.value = false
  editorVisible.value = true
}

function openEdit(row) {
  try {
    editingId.value = row.id
    replaceForm(policyToForm(row))
    materialOptions.value = currentMaterialOption() ? [currentMaterialOption()] : []
    limitedPeriod.value = Boolean(form.effectiveToMonth)
    advancedEditorSettingsVisible.value = limitedPeriod.value
      || Boolean(form.remark)
      || form.excludedDirectChildMaterialCodes.length > 0
    editorVisible.value = true
  } catch (error) {
    ElMessage.error(error.message || '规则配置无法解析，请联系管理员')
  }
}

function onModeChange(value) {
  Object.assign(form, switchPolicyMode(form, value))
}

async function saveRule() {
  const errors = validatePolicyForm(form)
  if (errors.length) {
    ElMessage.warning(errors[0])
    return
  }
  saving.value = true
  try {
    const body = buildPolicyRequest(form)
    if (editingId.value) {
      await updateMaterialQuoteShapePolicy(editingId.value, body)
      ElMessage.success('物料形态规则已更新')
    } else {
      await createMaterialQuoteShapePolicy(body)
      ElMessage.success('物料形态规则已新增')
    }
    editorVisible.value = false
    await loadRows()
  } catch (error) {
    ElMessage.error(error.message || '物料形态规则保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleRow(row) {
  const nextEnabled = row.enabled === 1 ? 0 : 1
  try {
    await ElMessageBox.confirm(
      `确认${nextEnabled === 1 ? '启用' : '停用'}料号 ${row.materialCode} 的这条规则？`,
      '规则启停',
      { type: 'warning' }
    )
    await toggleMaterialQuoteShapePolicy(row.id, nextEnabled)
    ElMessage.success(nextEnabled === 1 ? '规则已启用' : '规则已停用')
    await loadRows()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.message || '规则启停失败')
  }
}

async function removeRow(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除料号 ${row.materialCode} 的这条规则？操作会记录审计日志。`,
      '删除物料形态规则',
      { type: 'warning' }
    )
    const deleted = await deleteMaterialQuoteShapePolicy(row.id)
    if (deleted !== true) throw new Error('服务端未删除该规则')
    ElMessage.success('物料形态规则已删除')
    await loadRows()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.message || '物料形态规则删除失败')
  }
}

async function loadAuditRows() {
  audit.loading = true
  try {
    const page = normalizeAuditPage(await fetchMaterialQuoteShapePolicyLogs(audit))
    audit.rows = page.list
    audit.total = page.total
  } catch (error) {
    audit.rows = []
    audit.total = 0
    ElMessage.error(error.message || '查询物料形态规则操作日志失败')
  } finally {
    audit.loading = false
  }
}

function openAuditDrawer() {
  auditVisible.value = true
  loadAuditRows()
}

function searchAudit() {
  audit.pageNum = 1
  loadAuditRows()
}

onMounted(loadRows)
</script>

<style scoped>
.shape-policy-page {
  min-height: 100%;
  padding: 22px;
  color: #263142;
  background: #f3f6fa;
}

.policy-hero,
.query-panel,
.table-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 3px 12px rgb(34 57 84 / 4%);
}

.policy-hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
  overflow: hidden;
  padding: 25px 28px;
  background: linear-gradient(135deg, #fff 0%, #f8fbff 100%);
}

.policy-hero::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  content: '';
  background: #409eff;
}

.hero-copy {
  min-width: 0;
}

.hero-kicker {
  display: block;
  margin-bottom: 6px;
  color: #337ecc;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-title-row h1 {
  margin: 0;
  color: #1f2d3d;
  font-size: 25px;
  font-weight: 650;
  line-height: 1.35;
}

.hero-copy > p {
  margin: 9px 0 0;
  color: #65758b;
  font-size: 14px;
  line-height: 1.7;
}

.hero-freeze-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 13px;
  padding: 7px 12px;
  color: #8a6220;
  font-size: 13px;
  background: #fff8e8;
  border: 1px solid #f7e2b6;
  border-radius: 8px;
}

.note-dot,
.summary-dot {
  display: inline-block;
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  background: #e6a23c;
  border-radius: 50%;
}

.hero-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
}

.hero-actions :deep(.el-button + .el-button),
.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 16px 0;
}

.summary-card {
  position: relative;
  min-height: 98px;
  padding: 17px 19px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(34 57 84 / 3%);
}

.summary-card::after {
  position: absolute;
  top: -28px;
  right: -24px;
  width: 88px;
  height: 88px;
  content: '';
  background: #f3f8ff;
  border-radius: 50%;
}

.summary-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5e6c80;
  font-size: 13px;
}

.summary-card strong {
  display: block;
  margin-top: 7px;
  color: #1f2d3d;
  font-size: 27px;
  font-weight: 650;
  line-height: 1;
}

.summary-card small {
  display: block;
  margin-top: 7px;
  color: #98a3b2;
  font-size: 12px;
}

.summary-enabled .summary-dot {
  background: #67c23a;
}

.summary-fixed .summary-dot {
  background: #409eff;
}

.summary-ratio .summary-dot {
  background: #e6a23c;
}

.query-panel {
  padding: 20px 22px 18px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.panel-heading h2 {
  margin: 0;
  color: #2a3545;
  font-size: 17px;
  font-weight: 650;
}

.panel-heading p {
  margin: 6px 0 0;
  color: #8a96a6;
  font-size: 13px;
}

.filter-heading-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(138px, 1fr));
  gap: 12px;
}

.advanced-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 290px));
  gap: 12px;
  margin-top: 13px;
  padding-top: 15px;
  border-top: 1px dashed #e4eaf2;
}

.query-form :deep(.el-select),
.query-form :deep(.el-date-editor),
.query-form :deep(.el-input) {
  width: 100%;
}

.query-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.query-form :deep(.el-form-item__label) {
  height: auto;
  padding: 0 0 7px;
  color: #5f6c7d;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
}

.query-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 17px;
  padding-top: 16px;
  border-top: 1px solid #edf0f5;
}

.query-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.table-panel {
  margin-top: 16px;
  overflow: hidden;
}

.table-heading {
  align-items: center;
  margin: 0;
  padding: 19px 22px;
}

.table-count {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: #8491a3;
  font-size: 12px;
}

.table-count strong {
  color: #337ecc;
  font-size: 20px;
  font-weight: 650;
}

.policy-table {
  width: 100%;
  border-top: 1px solid #edf0f5;
}

.policy-table :deep(th.el-table__cell) {
  height: 47px;
  color: #5c6878;
  font-size: 13px;
  font-weight: 600;
  background: #f7f9fc;
}

.policy-table :deep(td.el-table__cell) {
  padding: 12px 0;
  border-bottom-color: #edf0f5;
}

.policy-table :deep(.el-table__row:hover > td.el-table__cell) {
  background: #f8fbff;
}

.material-cell,
.decision-cell,
.effective-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.material-cell {
  gap: 4px;
}

.material-code-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.material-code-line strong {
  color: #25364b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  font-weight: 650;
}

.org-tag {
  --el-tag-bg-color: #f4f7fb;
  --el-tag-border-color: #dce4ee;
  --el-tag-text-color: #65758b;
}

.material-name {
  color: #4e5c6e;
  font-size: 13px;
}

.material-meta,
.decision-cell span,
.effective-cell span {
  color: #98a3b2;
  font-size: 12px;
}

.decision-cell {
  gap: 6px;
}

.decision-cell strong {
  color: #39495d;
  font-size: 13px;
  font-weight: 600;
}

.effective-cell {
  gap: 5px;
}

.effective-cell strong {
  color: #3d4c5f;
  font-size: 13px;
}

.remark-text {
  color: #68768a;
  font-size: 13px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 13px;
  white-space: nowrap;
}

.empty-state {
  padding: 28px 0;
}

.table-panel :deep(.pagination-container),
.table-panel :deep(.base-pagination) {
  padding: 16px 20px;
}

:global(.policy-editor-dialog) {
  max-width: calc(100vw - 36px);
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 18px 55px rgb(25 44 69 / 20%);
}

:global(.policy-editor-dialog .el-dialog__header) {
  margin: 0;
  padding: 22px 26px 17px;
  border-bottom: 1px solid #edf0f5;
}

:global(.policy-editor-dialog .el-dialog__title) {
  color: #263548;
  font-size: 20px;
  font-weight: 650;
}

:global(.policy-editor-dialog .el-dialog__headerbtn) {
  top: 10px;
  right: 12px;
}

:global(.policy-editor-dialog .el-dialog__body) {
  max-height: calc(88vh - 150px);
  padding: 0 26px;
  overflow-y: auto;
}

:global(.policy-editor-dialog .el-dialog__footer) {
  padding: 15px 26px;
  background: #fafbfd;
  border-top: 1px solid #edf0f5;
}

.editor-intro {
  margin: 18px 0 0;
  padding: 10px 13px;
  color: #536a85;
  font-size: 13px;
  line-height: 1.55;
  background: #f3f8ff;
  border: 1px solid #dcecff;
  border-radius: 8px;
}

.editor-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.editor-form :deep(.el-form-item__label) {
  height: auto;
  padding: 0 0 7px;
  color: #556477;
  font-size: 13px;
  font-weight: 550;
  line-height: 1.4;
}

.editor-form :deep(.el-select),
.editor-form :deep(.el-date-editor),
.editor-form :deep(.el-input) {
  width: 100%;
}

.editor-fields {
  padding: 20px 0 10px;
}

.editor-section {
  padding: 20px 0 5px;
  border-bottom: 1px solid #edf0f5;
}

.editor-section-last {
  padding-bottom: 8px;
  border-bottom: 0;
}

.editor-section-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 17px;
}

.editor-section-heading > span {
  display: inline-flex;
  flex: 0 0 24px;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #337ecc;
  font-size: 12px;
  font-weight: 650;
  background: #eaf3ff;
  border-radius: 50%;
}

.editor-section-heading > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.editor-section-heading strong {
  color: #2d3b4d;
  font-size: 15px;
  font-weight: 650;
}

.editor-section-heading small {
  color: #909dad;
  font-size: 12px;
  line-height: 1.45;
}

.material-select-grid {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 14px;
}

.material-option {
  display: grid;
  grid-template-columns: 120px minmax(110px, 1fr) minmax(130px, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
}

.material-option strong {
  color: #2e4056;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.material-option span,
.material-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-option small {
  color: #929eac;
}

.selected-material {
  display: grid;
  grid-template-columns: 1fr 1.25fr 1.35fr;
  gap: 1px;
  margin-bottom: 14px;
  overflow: hidden;
  background: #e6ebf2;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
}

.selected-material > div {
  min-width: 0;
  padding: 10px 12px;
  background: #f8fafc;
}

.selected-material span,
.selected-material strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-material span {
  margin-bottom: 4px;
  color: #97a2b0;
  font-size: 11px;
}

.selected-material strong {
  color: #425166;
  font-size: 12px;
  font-weight: 600;
}

.mode-choice,
.shape-choice {
  display: grid;
  width: 100%;
}

.mode-choice {
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 1px solid #d8dee8;
  border-radius: 6px;
}

.shape-choice {
  grid-template-columns: repeat(4, 1fr);
}

.shape-choice :deep(.el-radio-button) {
  width: 100%;
}

.shape-choice :deep(.el-radio-button__inner) {
  width: 100%;
  box-shadow: none;
}

.mode-choice-button {
  height: 38px;
  padding: 0 16px;
  color: #5f6876;
  font: inherit;
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  background: #fff;
  border: 0;
  transition: color 0.15s ease, background 0.15s ease;
}

.mode-choice-button + .mode-choice-button {
  border-left: 1px solid #d8dee8;
}

.mode-choice-button:hover {
  color: #337ecc;
  background: #f5f9ff;
}

.mode-choice-button.is-active {
  color: #fff;
  background: #409eff;
}

.behavior-tip,
.supplier-rule-summary {
  margin: -4px 0 15px;
  padding: 9px 12px;
  color: #5d6f84;
  font-size: 12px;
  line-height: 1.55;
  background: #f7f9fc;
  border-left: 3px solid #8bbcf4;
  border-radius: 4px 7px 7px 4px;
}

.supplier-rule-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #72551d;
  background: #fff9ec;
  border-left-color: #e6a23c;
}

.supplier-rule-summary strong {
  color: #604817;
  font-weight: 650;
}

.form-help {
  margin-top: 6px;
  color: #98a3b2;
  font-size: 12px;
  line-height: 1.5;
}

.inline-help {
  margin: 0 0 0 8px;
}

.more-setting-button {
  margin: -5px 0 10px;
}

.advanced-editor-settings {
  margin-bottom: 14px;
  padding: 15px 16px;
  background: #f8fafc;
  border: 1px solid #e7ecf3;
  border-radius: 9px;
}

.advanced-editor-settings :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.period-row {
  display: grid;
  grid-template-columns: 155px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.period-row :deep(.el-form-item) {
  margin-bottom: 12px;
}

.two-column-grid,
.effective-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.period-setting {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: 62px;
  padding-top: 7px;
}

.period-setting span {
  margin-top: 2px;
  color: #98a3b2;
  font-size: 12px;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.editor-footer > span {
  color: #8b97a7;
  font-size: 12px;
}

.editor-footer > div {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.editor-footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

.audit-filter {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}

.audit-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 1400px) {
  .filter-grid {
    grid-template-columns: repeat(3, minmax(160px, 1fr));
  }
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .shape-policy-page {
    padding: 14px;
  }

  .policy-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 18px;
    padding: 21px;
  }

  .hero-actions {
    flex-wrap: wrap;
    width: 100%;
    padding-top: 0;
  }

  .filter-grid,
  .advanced-filter-grid {
    grid-template-columns: 1fr;
  }

  .advanced-filter-grid {
    max-width: none;
  }

  .panel-heading {
    flex-direction: column;
    gap: 12px;
  }

  .filter-heading-actions {
    width: 100%;
    justify-content: space-between;
  }

  .material-select-grid,
  .two-column-grid,
  .effective-grid,
  .period-row {
    grid-template-columns: 1fr;
  }

  .selected-material {
    grid-template-columns: 1fr;
  }

  .shape-choice {
    grid-template-columns: repeat(2, 1fr);
  }

  .editor-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .editor-footer > div {
    align-self: flex-end;
  }
}

@media (max-width: 560px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .hero-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-freeze-note {
    align-items: flex-start;
  }

  .query-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .query-actions :deep(.el-button) {
    width: 100%;
  }
}
</style>
