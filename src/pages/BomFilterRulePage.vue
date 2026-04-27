<template>
  <!-- BOM 过滤规则维护页（T6 整页替换）
       旧版是 A/B/C/D 本地 stub，无后端联动；
       新版对接 /api/v1/bom/drill-rules CRUD + 启停 + 软删 -->
  <div class="base-page">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div>
          <div class="page-title">BOM 过滤规则</div>
          <div class="page-subtitle">
            规则命中后在 Flatten 阶段决定节点动作（停止下钻 / 排除）。
            修改后需重新跑 Flatten 才会生效。
          </div>
        </div>
        <div class="header-actions">
          <el-button type="primary" @click="openCreate">新增规则</el-button>
          <el-button :loading="loading" @click="reload">刷新</el-button>
          <!-- 高级模式入口：IT 用，或财务配向导不够用时直接进 -->
          <el-button link type="info" @click="openCreateAdvanced">高级模式 →</el-button>
        </div>
      </div>

      <el-form :inline="true" class="filter-form">
        <el-form-item label="启用状态">
          <el-select
            v-model="filters.enabled"
            placeholder="全部"
            clearable
            style="width: 140px"
            @change="reload"
          >
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配类型">
          <el-select
            v-model="filters.matchType"
            placeholder="全部"
            clearable
            style="width: 260px"
            @change="reload"
          >
            <el-option
              v-for="opt in MATCH_TYPE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table
        :data="rows"
        v-loading="loading"
        stripe
        empty-text="暂无规则"
      >
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="匹配类型" width="220">
          <template #default="{ row }">
            <el-tag size="small" :type="matchTypeTagType(row.matchType)">
              {{ row.matchType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="matchValue"
          label="匹配值"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column label="下钻动作" width="170">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.drillAction === 'EXCLUDE' ? 'danger' : 'warning'"
            >{{ row.drillAction }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标记子树成本" width="120" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.markSubtreeCostRequired === 1" color="#67c23a">
              <icon-check />
            </el-icon>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" align="right" />
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
              {{ row.enabled === 1 ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生效期" width="200">
          <template #default="{ row }">
            <span class="dim">
              {{ row.effectiveFrom || '—' }} ~ {{ row.effectiveTo || '—' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="businessUnitType"
          label="业务单元"
          width="110"
        >
          <template #default="{ row }">
            <span>{{ row.businessUnitType || '全局' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="remark"
          label="备注"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="onToggle(row)">
              {{ row.enabled === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- T10：向导弹窗（财务默认入口） -->
    <BomRuleWizardDialog
      v-model="wizardVisible"
      :editing-rule="wizardEditingRule"
      @saved="onWizardSaved"
      @switch-advanced="onSwitchToAdvanced"
    />

    <!-- 高级模式弹窗（原 JSON 编辑对话框，保留给 IT 及非标规则） -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑规则（高级模式）' : '新增规则（高级模式）'"
      width="560px"
      :close-on-click-modal="false"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="140px"
      >
        <el-form-item label="匹配类型" prop="matchType">
          <el-select v-model="form.matchType" style="width: 100%">
            <el-option
              v-for="opt in MATCH_TYPE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配值" prop="matchValue" v-if="form.matchType !== 'COMPOSITE'">
          <el-input
            v-model="form.matchValue"
            placeholder="按匹配类型含义填：名称关键字 / 料号前缀 / 主分类名..."
          />
        </el-form-item>

        <!-- T8 复合条件编辑器（只在 matchType=COMPOSITE 时显示） -->
        <template v-if="form.matchType === 'COMPOSITE'">
          <el-divider content-position="left">
            <el-text size="small" type="info">复合条件（所有三组取 AND 语义）</el-text>
          </el-divider>

          <!-- 本节点条件 -->
          <el-form-item label="本节点条件">
            <div class="clause-block">
              <div
                v-for="(clause, idx) in composite.nodeConditions"
                :key="'node-' + idx"
                class="clause-row"
              >
                <el-select v-model="clause.field" placeholder="字段" style="width: 220px">
                  <el-option
                    v-for="opt in CONDITION_FIELD_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select v-model="clause.op" placeholder="操作符" style="width: 120px">
                  <el-option
                    v-for="opt in CONDITION_OP_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <!-- IN 用多选，字段为 material_category_1/2 时从字典拉；其他走文本 tag 自由输入 -->
                <el-select
                  v-if="clause.op === 'IN' && (clause.field === 'material_category_1' || clause.field === 'material_category_2')"
                  v-model="clause.values"
                  multiple
                  filterable
                  allow-create
                  placeholder="从字典选或自由填"
                  style="flex: 1"
                >
                  <el-option
                    v-for="opt in categoryDictOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select
                  v-else-if="clause.op === 'IN'"
                  v-model="clause.values"
                  multiple
                  filterable
                  allow-create
                  placeholder="输入多个值（回车添加）"
                  style="flex: 1"
                />
                <!-- T11：IN_DICT op —— value 是字典 key（如 bom_leaf_rollup_codes），
                  自由文本输入 + 占位提示 -->
                <el-input
                  v-else-if="clause.op === 'IN_DICT'"
                  v-model="clause.value"
                  placeholder="字典 key（例：bom_leaf_rollup_codes）"
                  style="flex: 1"
                />
                <el-input
                  v-else
                  v-model="clause.value"
                  placeholder="值"
                  style="flex: 1"
                />
                <el-button link type="danger" @click="removeClause('nodeConditions', idx)">删除</el-button>
              </div>
              <el-button link type="primary" @click="addClause('nodeConditions')">+ 加一条本节点条件</el-button>
            </div>
          </el-form-item>

          <!-- 父节点条件 -->
          <el-form-item label="父节点条件">
            <div class="clause-block">
              <div
                v-for="(clause, idx) in composite.parentConditions"
                :key="'parent-' + idx"
                class="clause-row"
              >
                <el-select v-model="clause.field" placeholder="字段" style="width: 220px">
                  <el-option
                    v-for="opt in CONDITION_FIELD_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select v-model="clause.op" placeholder="操作符" style="width: 120px">
                  <el-option
                    v-for="opt in CONDITION_OP_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select
                  v-if="clause.op === 'IN' && (clause.field === 'material_category_1' || clause.field === 'material_category_2')"
                  v-model="clause.values"
                  multiple
                  filterable
                  allow-create
                  placeholder="从字典选或自由填"
                  style="flex: 1"
                >
                  <el-option
                    v-for="opt in categoryDictOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select
                  v-else-if="clause.op === 'IN'"
                  v-model="clause.values"
                  multiple
                  filterable
                  allow-create
                  placeholder="输入多个值（回车添加）"
                  style="flex: 1"
                />
                <!-- T11：IN_DICT op —— value 是字典 key（如 bom_leaf_rollup_codes），
                  自由文本输入 + 占位提示 -->
                <el-input
                  v-else-if="clause.op === 'IN_DICT'"
                  v-model="clause.value"
                  placeholder="字典 key（例：bom_leaf_rollup_codes）"
                  style="flex: 1"
                />
                <el-input
                  v-else
                  v-model="clause.value"
                  placeholder="值"
                  style="flex: 1"
                />
                <el-button link type="danger" @click="removeClause('parentConditions', idx)">删除</el-button>
              </div>
              <el-button link type="primary" @click="addClause('parentConditions')">+ 加一条父节点条件</el-button>
            </div>
          </el-form-item>

          <!-- 子节点条件 -->
          <el-form-item label="子节点条件">
            <div class="clause-block">
              <div class="clause-hint">至少一个直接子节点满足即命中（OR within children）</div>
              <div
                v-for="(clause, idx) in composite.childConditions"
                :key="'child-' + idx"
                class="clause-row"
              >
                <el-select v-model="clause.field" placeholder="字段" style="width: 220px">
                  <el-option
                    v-for="opt in CONDITION_FIELD_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select v-model="clause.op" placeholder="操作符" style="width: 120px">
                  <el-option
                    v-for="opt in CONDITION_OP_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select
                  v-if="clause.op === 'IN' && (clause.field === 'material_category_1' || clause.field === 'material_category_2')"
                  v-model="clause.values"
                  multiple
                  filterable
                  allow-create
                  placeholder="从字典选或自由填"
                  style="flex: 1"
                >
                  <el-option
                    v-for="opt in categoryDictOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select
                  v-else-if="clause.op === 'IN'"
                  v-model="clause.values"
                  multiple
                  filterable
                  allow-create
                  placeholder="输入多个值（回车添加）"
                  style="flex: 1"
                />
                <!-- T11：IN_DICT op —— value 是字典 key（如 bom_leaf_rollup_codes），
                  自由文本输入 + 占位提示 -->
                <el-input
                  v-else-if="clause.op === 'IN_DICT'"
                  v-model="clause.value"
                  placeholder="字典 key（例：bom_leaf_rollup_codes）"
                  style="flex: 1"
                />
                <el-input
                  v-else
                  v-model="clause.value"
                  placeholder="值"
                  style="flex: 1"
                />
                <el-button link type="danger" @click="removeClause('childConditions', idx)">删除</el-button>
              </div>
              <el-button link type="primary" @click="addClause('childConditions')">+ 加一条子节点条件</el-button>
            </div>
          </el-form-item>
        </template>

        <el-form-item label="下钻动作" prop="drillAction">
          <el-radio-group v-model="form.drillAction">
            <el-radio
              v-for="opt in DRILL_ACTION_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
          <!-- T11：选 LEAF_ROLLUP_TO_PARENT 时给业务一段提示文案 -->
          <el-alert
            v-if="form.drillAction === 'LEAF_ROLLUP_TO_PARENT'"
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 8px"
            title="LEAF_ROLLUP_TO_PARENT 使用提示"
          >
            <div style="line-height: 1.6">
              本规则匹配<strong>叶子节点</strong>；命中后该叶子的<strong>直接父</strong>作结算行（subtree_cost_required=1），命中叶子写入 sub_ref。
              父的<strong>非命中</strong>兄弟叶子继续作独立结算行。
              <br />
              建议 nodeConditions 用 <code>material_category_1 + IN_DICT(bom_leaf_rollup_codes)</code>
              一个条件即可（算法侧自动按"编码 + 名称兜底"双路命中，业务只填字典 key）。
              <br />
              字典 key 由后台 V43 SQL 建好，业务在 /system/dict 的 <code>bom_leaf_rollup_codes</code> 类型下维护具体条目。
            </div>
          </el-alert>
        </el-form-item>
        <el-form-item label="标记子树需成本">
          <el-switch
            v-model="form.markSubtreeCostRequired"
            :active-value="1"
            :inactive-value="0"
          />
          <span class="form-hint">仅 STOP_AND_COST_ROW 动作有意义</span>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-input-number
            v-model="form.priority"
            :min="1"
            :max="9999"
          />
          <span class="form-hint">值越小越优先；命中多条时按最小取第一条</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch
            v-model="form.enabled"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item label="生效期">
          <el-date-picker
            v-model="effectiveRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="~"
            start-placeholder="起"
            end-placeholder="止"
            style="width: 100%"
          />
          <span class="form-hint">留空 = 永久生效</span>
        </el-form-item>
        <el-form-item label="业务单元">
          <el-select
            v-model="form.businessUnitType"
            placeholder="留空 = 全局"
            clearable
            style="width: 100%"
          >
            <el-option label="商用" value="COMMERCIAL" />
            <el-option label="家用" value="HOUSEHOLD" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="可选"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
// BomFilterRulePage —— 真实 CRUD，全部走后端，无本地 stub
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check as IconCheck } from '@element-plus/icons-vue'
import {
  listDrillRules,
  createDrillRule,
  updateDrillRule,
  deleteDrillRule,
  toggleDrillRule,
  fetchDictData,
  matchTemplate,
  MATCH_TYPE_OPTIONS,
  DRILL_ACTION_OPTIONS,
  CONDITION_FIELD_OPTIONS,
  CONDITION_OP_OPTIONS,
} from '../api/bom'
import BomRuleWizardDialog from '../components/BomRuleWizardDialog.vue'

const loading = ref(false)
const rows = ref([])
const filters = reactive({
  enabled: null,
  matchType: null,
})

const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const formRef = ref(null)

// T10：向导对话框状态
const wizardVisible = ref(false)
const wizardEditingRule = ref(null)

const emptyForm = () => ({
  matchType: 'NAME_LIKE',
  matchValue: '',
  drillAction: 'STOP_AND_COST_ROW',
  markSubtreeCostRequired: 0,
  replaceToCode: null,
  priority: 100,
  enabled: 1,
  effectiveFrom: null,
  effectiveTo: null,
  businessUnitType: null,
  remark: '',
})

const form = ref(emptyForm())

// 生效期用 daterange picker 统一编辑，提交时拆回两个字段
const effectiveRange = ref(null)

// T8：复合条件的结构化编辑状态（matchType=COMPOSITE 时生效）
const emptyComposite = () => ({
  nodeConditions: [],
  parentConditions: [],
  childConditions: [],
})
const composite = ref(emptyComposite())

// 字典：bom_material_category（T8 规则 IN 列表的候选值，从后端字典接口拉）
const categoryDictOptions = ref([])

/** 复合条件子句增删 */
function addClause(group) {
  composite.value[group].push({ field: '', op: 'EQ', value: '', values: [] })
}
function removeClause(group, idx) {
  composite.value[group].splice(idx, 1)
}

const formRules = {
  matchType: [{ required: true, message: '必选', trigger: 'change' }],
  matchValue: [
    {
      required: true,
      trigger: 'blur',
      validator: (_rule, value, callback) => {
        // COMPOSITE 不要求 matchValue（走 JSON）；其他类型要求必填
        if (form.value.matchType === 'COMPOSITE') {
          callback()
        } else if (!value || !String(value).trim()) {
          callback(new Error('必填'))
        } else {
          callback()
        }
      },
    },
  ],
  drillAction: [{ required: true, message: '必选', trigger: 'change' }],
  priority: [{ required: true, message: '必填', trigger: 'blur' }],
}

/** 字典加载：按需（首次打开对话框时拉一次，结果缓存） */
async function ensureDictLoaded() {
  if (categoryDictOptions.value.length > 0) return
  try {
    const data = await fetchDictData('bom_material_category')
    const list = Array.isArray(data) ? data : data?.data || []
    // yudao 字典接口返回 {value, label} 或 {dictValue, dictLabel}，两种都兼容
    categoryDictOptions.value = list.map((d) => ({
      value: d.value ?? d.dictValue ?? d.dict_value,
      label: d.label ?? d.dictLabel ?? d.dict_label,
    }))
  } catch (error) {
    // 字典拉失败不阻塞表单编辑，IN 仍然能自由输入
    console.warn('字典 bom_material_category 加载失败', error?.message)
  }
}

async function reload() {
  loading.value = true
  try {
    const params = {}
    if (filters.enabled !== null && filters.enabled !== undefined) {
      params.enabled = filters.enabled
    }
    if (filters.matchType) {
      params.matchType = filters.matchType
    }
    const data = await listDrillRules(params)
    rows.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '查询规则失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.value = emptyForm()
  composite.value = emptyComposite()
  effectiveRange.value = null
  formRef.value?.clearValidate?.()
}

/** T10：财务入口 —— 新增默认走向导 */
function openCreate() {
  wizardEditingRule.value = null
  wizardVisible.value = true
}

/** IT 入口 —— 新增直接开高级模式对话框 */
function openCreateAdvanced() {
  resetForm()
  ensureDictLoaded()
  dialogVisible.value = true
}

/** T10：编辑按模板反推结果路由 —— 能反推进向导，反推不出进高级 */
function openEdit(row) {
  const tplCode = matchTemplate(row)
  if (tplCode) {
    wizardEditingRule.value = row
    wizardVisible.value = true
    return
  }
  // 反推不出 —— 非标规则，落回高级模式
  openEditAdvanced(row)
}

/** 高级模式编辑（内部函数，仅在反推失败时调；页面没暴露入口） */
function openEditAdvanced(row) {
  editingId.value = row.id
  form.value = {
    matchType: row.matchType,
    matchValue: row.matchValue,
    drillAction: row.drillAction,
    markSubtreeCostRequired: row.markSubtreeCostRequired ?? 0,
    replaceToCode: row.replaceToCode,
    priority: row.priority ?? 100,
    enabled: row.enabled ?? 1,
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    businessUnitType: row.businessUnitType || null,
    remark: row.remark || '',
  }
  // T8：反序列化 matchConditionJson 到 composite 编辑状态
  composite.value = parseConditionJson(row.matchConditionJson)
  effectiveRange.value = row.effectiveFrom
    ? [row.effectiveFrom, row.effectiveTo]
    : null
  ensureDictLoaded()
  dialogVisible.value = true
}

/** 向导保存成功 —— 刷新列表 */
function onWizardSaved() {
  reload()
}

/** 向导底部"使用高级模式 →"被点击 —— 向导组件保证在 @closed 后才 emit，这里直接开即可 */
function onSwitchToAdvanced(rule) {
  if (rule) openEditAdvanced(rule)
  else openCreateAdvanced()
}

/** 安全反序列化 matchConditionJson；无效 JSON 返回空结构，避免编辑器炸 */
function parseConditionJson(json) {
  if (!json) return emptyComposite()
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json
    return {
      nodeConditions: Array.isArray(parsed?.nodeConditions) ? parsed.nodeConditions : [],
      parentConditions: Array.isArray(parsed?.parentConditions) ? parsed.parentConditions : [],
      childConditions: Array.isArray(parsed?.childConditions) ? parsed.childConditions : [],
    }
  } catch (e) {
    console.warn('规则 matchConditionJson 解析失败', e?.message)
    return emptyComposite()
  }
}

/** 把 composite 编辑状态序列化为 JSON 字符串；全空则返 null（老字段生效） */
function serializeComposite(c) {
  const allEmpty =
    (!c.nodeConditions || c.nodeConditions.length === 0) &&
    (!c.parentConditions || c.parentConditions.length === 0) &&
    (!c.childConditions || c.childConditions.length === 0)
  if (allEmpty) return null
  // 去掉空字段；IN 情况用 values，其他用 value
  const clean = (arr) =>
    (arr || [])
      .filter((c) => c?.field && c?.op)
      .map((c) => {
        const o = { field: c.field, op: c.op }
        if (c.op === 'IN') o.values = Array.isArray(c.values) ? c.values : []
        else o.value = c.value ?? ''
        return o
      })
  return JSON.stringify({
    nodeConditions: clean(c.nodeConditions),
    parentConditions: clean(c.parentConditions),
    childConditions: clean(c.childConditions),
  })
}

async function submitForm() {
  // 触发校验；未通过则抛异常被 catch 静默吞掉，用户看到字段红框
  try {
    await formRef.value.validate()
  } catch (_) {
    return
  }
  submitting.value = true
  try {
    const payload = { ...form.value }
    // 拆 daterange 回到两字段
    if (Array.isArray(effectiveRange.value) && effectiveRange.value.length === 2) {
      payload.effectiveFrom = effectiveRange.value[0]
      payload.effectiveTo = effectiveRange.value[1]
    } else {
      payload.effectiveFrom = null
      payload.effectiveTo = null
    }
    // T8：matchType=COMPOSITE 时序列化 composite → matchConditionJson
    if (form.value.matchType === 'COMPOSITE') {
      payload.matchConditionJson = serializeComposite(composite.value)
      if (!payload.matchConditionJson) {
        ElMessage.warning('复合条件至少填一组（本节点/父节点/子节点）')
        submitting.value = false
        return
      }
      // matchValue 在 COMPOSITE 下留占位字符串（数据库 NOT NULL）
      if (!payload.matchValue) payload.matchValue = 'composite-' + Date.now()
    } else {
      // 非 COMPOSITE 时清空 matchConditionJson，避免老规则误带上
      payload.matchConditionJson = ''
    }
    if (editingId.value) {
      await updateDrillRule(editingId.value, payload)
      ElMessage.success('规则已更新，下次 BOM 计算生效')
    } else {
      await createDrillRule(payload)
      ElMessage.success('规则已创建，下次 BOM 计算生效')
    }
    dialogVisible.value = false
    await reload()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function onToggle(row) {
  try {
    await toggleDrillRule(row.id)
    ElMessage.success(row.enabled === 1 ? '已停用' : '已启用')
    await reload()
  } catch (error) {
    ElMessage.error(error?.message || '切换失败')
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除规则 #${row.id}（${row.matchType} = ${row.matchValue}）?`,
      '软删确认',
      { type: 'warning' }
    )
  } catch (_) {
    return
  }
  try {
    await deleteDrillRule(row.id)
    ElMessage.success('已删除')
    await reload()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

/** 给不同 matchType 分配不同 tag 色便于快速识别；未命中时返 undefined 走 el-tag 默认样式
 *  （不能返 '' —— el-tag 的 type prop validator 会拒绝空串并警告） */
function matchTypeTagType(type) {
  switch (type) {
    case 'MATERIAL_CODE_PREFIX':
      return 'success'
    case 'MATERIAL_TYPE':
      return 'warning'
    case 'CATEGORY_EQ':
      return 'info'
    case 'SHAPE_ATTR_EQ':
      return 'danger'
    default:
      return undefined
  }
}

onMounted(reload)
</script>

<style scoped>
.base-page {
  padding: 16px;
}
.header-card {
  margin-bottom: 16px;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.page-subtitle {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  max-width: 520px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.filter-form {
  margin-top: 16px;
}
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 10px;
}
.dim {
  color: #c0c4cc;
}

/* T8 复合条件编辑器样式 */
.clause-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.clause-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.clause-hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
</style>
