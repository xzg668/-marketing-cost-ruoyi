<template>
  <!--
    价格变量配置页 —— 财务可读极简版。
    原则：一屏一件事。页面只回答两个问题：
      1) 当前有哪些变量？每个变量的值从哪里来？（列表）
      2) 新增/改一个变量时，先选"值从哪里来"，再填这一种需要的几项字段（对话框）
    所有开发者术语（factor_type / resolver_kind / lp_* 表名）在页面上不出现，
    通过 KIND_TO_FACTOR_TYPE 自动推导传给后端。
  -->
  <div class="variable-admin-page">
    <el-card shadow="never">
      <div class="toolbar">
        <div>
          <div class="page-title">价格变量配置</div>
          <div class="page-subtitle">公式里能用的变量都在这里，每一行写明"值从哪里来"。</div>
        </div>
        <el-button type="primary" @click="openCreate">新增变量</el-button>
      </div>

      <div class="toolbar-filters">
        <el-input
          v-model="filters.keyword"
          placeholder="搜变量编码或中文名"
          clearable
          style="width: 260px"
        />
        <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 140px">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
      </div>

      <el-table :data="visibleRows" stripe v-loading="loading" border style="margin-top: 12px">
        <el-table-column prop="variableCode" label="变量编码" width="160">
          <template #default="{ row }">
            <code class="code-chip">{{ row.variableCode }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="variableName" label="变量名" width="160" />
        <el-table-column label="取值方式" width="170">
          <template #default="{ row }">
            <el-tag :type="resolverKindColor(row.resolverKind)" size="small">
              {{ kindShortLabel(row.resolverKind) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="值从哪里来" min-width="360">
          <template #default="{ row }">
            <div class="source-cell">{{ renderSource(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'active'"
              type="danger"
              link
              @click="removeRow(row)"
            >停用</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="720px"
      :close-on-click-modal="false"
      top="8vh"
    >
      <el-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-width="110px"
        label-position="right"
      >
        <el-form-item label="值从哪里来" prop="resolverKind">
          <div class="kind-picker">
            <div
              v-for="item in KIND_OPTIONS"
              :key="item.value"
              class="kind-card"
              :class="{ active: formModel.resolverKind === item.value }"
              @click="pickKind(item.value)"
            >
              <div class="kind-card-icon">{{ item.icon }}</div>
              <div class="kind-card-body">
                <div class="kind-card-title">{{ item.title }}</div>
                <div class="kind-card-desc">{{ item.description }}</div>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="变量编码" prop="variableCode">
          <el-input
            v-model="formModel.variableCode"
            :disabled="!!editingId"
            placeholder="字母/数字/下划线，例：Cu、blank_weight"
          />
          <div class="form-tip">
            <template v-if="editingId">编辑后不可改（公式里已经用 [编码] 引用）</template>
            <template v-else>这是公式里写的英文代号，保存后不可修改</template>
          </div>
        </el-form-item>

        <el-form-item label="变量名" prop="variableName">
          <el-input v-model="formModel.variableName" placeholder="给财务看的中文名，例：电解铜" />
        </el-form-item>

        <el-form-item label="公式别名">
          <el-input v-model="aliasesText" placeholder="多个用英文逗号分隔；例：电解铜,Cu" />
          <div class="form-tip">公式里写了别名会自动替换成变量编码。不填也可以。</div>
        </el-form-item>

        <!-- 按"值从哪里来"显示对应几项 -->
        <template v-if="formModel.resolverKind === 'FINANCE'">
          <el-form-item label="因素代码">
            <el-input v-model="financeParams.factorCode" placeholder="影响因素表里的代码，例：Cu、Zn" />
            <div class="form-tip">和下面的"因素名称"二选一，优先用代码</div>
          </el-form-item>
          <el-form-item label="因素名称">
            <el-input v-model="financeParams.shortName" placeholder="没有代码时用中文名，例：美国柜装黄铜" />
          </el-form-item>
          <el-form-item label="价格口径" required>
            <el-input v-model="financeParams.priceSource" placeholder="例：平均价、LME" />
          </el-form-item>
          <el-form-item label="业务线">
            <el-radio-group v-model="financeParams.buScoped">
              <el-radio :value="true">商用/家用分别取价</el-radio>
              <el-radio :value="false">所有业务线共用一条</el-radio>
            </el-radio-group>
          </el-form-item>
        </template>

        <template v-else-if="formModel.resolverKind === 'ENTITY'">
          <el-form-item label="取哪个字段" required>
            <el-select
              v-model="entityParams.field"
              style="width: 100%"
              placeholder="选一个字段"
              filterable
              allow-create
            >
              <el-option
                v-for="f in ENTITY_FIELD_HINTS"
                :key="f.value"
                :value="f.value"
                :label="f.label"
              />
            </el-select>
            <div class="form-tip">下拉没有的可以直接输入英文驼峰字段名</div>
          </el-form-item>
          <el-form-item label="单位换算">
            <el-input-number
              v-model="entityParams.unitScale"
              :precision="6"
              :step="0.001"
              :min="0"
              controls-position="right"
            />
            <div class="form-tip">料号与公式单位不同时用，例：克→千克填 0.001；相同填 1</div>
          </el-form-item>
        </template>

        <template v-else-if="formModel.resolverKind === 'DERIVED'">
          <el-form-item label="派生规则" required>
            <el-select v-model="derivedParams.strategy" style="width: 100%">
              <el-option
                v-for="s in DERIVED_STRATEGY_OPTIONS"
                :key="s.value"
                :label="s.label"
                :value="s.value"
              />
            </el-select>
            <div class="form-tip">{{ derivedStrategyDesc(derivedParams.strategy) }}</div>
          </el-form-item>
          <el-form-item
            v-if="derivedParams.strategy === 'FORMULA_REF'"
            label="引用公式"
            required
          >
            <el-input v-model="derivedParams.formulaRef" placeholder="例：[Cu]*0.59+[Zn]*0.41" />
          </el-form-item>
          <el-form-item
            v-if="derivedParams.strategy === 'FINANCE_FACTOR'"
            label="因素代码"
            required
          >
            <el-input v-model="derivedParams.factorCode" placeholder="例：美国柜装黄铜" />
          </el-form-item>
        </template>

        <template v-else-if="formModel.resolverKind === 'FORMULA'">
          <el-form-item label="公式" required>
            <el-input
              v-model="formulaParams.expr"
              type="textarea"
              :rows="3"
              placeholder="例：[Cu]/(1+[vat_rate])"
            />
            <div class="form-tip">用 [变量编码] 引用其他变量，支持 + - * / 和括号</div>
          </el-form-item>
        </template>

        <template v-else-if="formModel.resolverKind === 'CONST'">
          <el-form-item label="固定值" required>
            <el-input v-model="constParams.value" placeholder="例：0.13" />
            <div class="form-tip">一个数字即可</div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchPriceVariables,
  fetchPriceVariableById,
  createPriceVariable,
  updatePriceVariable,
  deletePriceVariable,
} from '../api/priceVariables'

/**
 * "值从哪里来"—— 页面上唯一暴露给财务的分类维度。
 * value 对应后端 resolver_kind；提交时由 KIND_TO_FACTOR_TYPE 自动推 factor_type。
 */
const KIND_OPTIONS = [
  {
    value: 'FINANCE',
    icon: '📊',
    title: '影响因素表',
    shortLabel: '📊 影响因素表',
    description: '每月公司发布的基准价，例如电解铜、电解锌',
  },
  {
    value: 'ENTITY',
    icon: '📎',
    title: '当前料号属性',
    shortLabel: '📎 料号属性',
    description: '从本次核算的料号上取字段，例如下料重量',
  },
  {
    value: 'DERIVED',
    icon: '🧮',
    title: '预设规则派生',
    shortLabel: '🧮 预设规则',
    description: '按主材、废料或指定因素等规则自动取值',
  },
  {
    value: 'FORMULA',
    icon: '🔢',
    title: '公式计算',
    shortLabel: '🔢 公式',
    description: '给一段公式，引用其他变量',
  },
  {
    value: 'CONST',
    icon: '🔒',
    title: '固定常量',
    shortLabel: '🔒 常量',
    description: '一个固定数值，例如税率 0.13',
  },
]

/** kind → factor_type（UI 分组）反向映射，保存时自动塞给后端 */
const KIND_TO_FACTOR_TYPE = {
  FINANCE: 'FINANCE_FACTOR',
  ENTITY: 'PART_CONTEXT',
  DERIVED: 'PART_CONTEXT',
  FORMULA: 'FORMULA_REF',
  CONST: 'CONST',
}

/** DERIVED 四种派生规则 —— label 是给财务看的中文 */
const DERIVED_STRATEGY_OPTIONS = [
  { value: 'MAIN_MATERIAL_FINANCE', label: '主材财务基准价（按料号主材自动选因素）' },
  { value: 'SCRAP_REF', label: '废料参考价（按料号的废料映射）' },
  { value: 'FORMULA_REF', label: '引用一个公式' },
  { value: 'FINANCE_FACTOR', label: '直接指定一个因素代码' },
]

/** ENTITY 字段候选 —— 常见几个；允许下拉挑或手动输入 */
const ENTITY_FIELD_HINTS = [
  { value: 'blankWeight', label: '下料重量（克）' },
  { value: 'netWeight', label: '产品净重（克）' },
  { value: 'processFee', label: '加工费（含税）' },
  { value: 'agentFee', label: '代理费' },
]

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const filters = reactive({
  keyword: '',
  status: '',
})

const allRows = ref([])

/** 前端过滤 —— 后端只支持 status 下推，关键词一起在前端模糊匹配 编码 + 名称 */
const visibleRows = computed(() => {
  const kw = filters.keyword.trim().toLowerCase()
  if (!kw) return allRows.value
  return allRows.value.filter((row) => {
    const code = (row.variableCode || '').toLowerCase()
    const name = (row.variableName || '').toLowerCase()
    return code.includes(kw) || name.includes(kw)
  })
})

const dialogTitle = computed(() => (editingId.value ? '编辑价格变量' : '新增价格变量'))

const emptyFormModel = () => ({
  variableCode: '',
  variableName: '',
  resolverKind: 'FINANCE',
  status: 'active',
})

const formModel = reactive(emptyFormModel())
const aliasesText = ref('')

/** 分 kind 的子参数 —— 保存时按当前 kind 取一个打包成 resolverParams */
const financeParams = reactive({
  factorCode: '',
  shortName: '',
  priceSource: '平均价',
  buScoped: true,
})
const entityParams = reactive({ entity: 'linkedItem', field: '', unitScale: 1 })
const derivedParams = reactive({ strategy: 'MAIN_MATERIAL_FINANCE', formulaRef: '', factorCode: '' })
const formulaParams = reactive({ expr: '' })
const constParams = reactive({ value: '' })

const formRules = {
  variableCode: [
    { required: true, message: '变量编码必填', trigger: 'blur' },
    {
      pattern: /^[A-Za-z][A-Za-z0-9_]*$/,
      message: '字母开头，只能含字母/数字/下划线',
      trigger: 'blur',
    },
  ],
  variableName: [{ required: true, message: '变量名必填', trigger: 'blur' }],
  resolverKind: [{ required: true, message: '请选择取值方式', trigger: 'change' }],
}

const reload = async () => {
  loading.value = true
  try {
    const data = await fetchPriceVariables({ status: filters.status || undefined })
    allRows.value = Array.isArray(data) ? data : []
  } catch (err) {
    allRows.value = []
    ElMessage.error(err?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

/** —— 列表渲染辅助 —— */

const parseAliases = (json) => {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const kindShortLabel = (v) =>
  KIND_OPTIONS.find((x) => x.value === v)?.shortLabel || v || '—'

const resolverKindColor = (v) => {
  if (v === 'FINANCE') return 'danger'
  if (v === 'ENTITY') return 'warning'
  if (v === 'DERIVED') return 'primary'
  if (v === 'FORMULA') return 'success'
  if (v === 'CONST') return 'info'
  return 'info'
}

const derivedStrategyDesc = (s) => {
  switch (s) {
    case 'MAIN_MATERIAL_FINANCE':
      return '系统按料号的主材 → 对应的财务因素 → 取最新月均价'
    case 'SCRAP_REF':
      return '系统按料号的废料映射 → 查废料参考价表'
    case 'FORMULA_REF':
      return '下面填一段公式，系统递归求值'
    case 'FINANCE_FACTOR':
      return '下面填一个因素代码，直接按该因素取最新月均价'
    default:
      return ''
  }
}

/**
 * 把 resolver_kind + resolver_params 渲染成一句财务能读的话。
 * 不出现任何表名/字段名等技术词。
 */
const renderSource = (row) => {
  const kind = row.resolverKind
  let params = {}
  try {
    params = row.resolverParams ? JSON.parse(row.resolverParams) : {}
  } catch {
    return '（参数格式异常，请联系管理员）'
  }
  switch (kind) {
    case 'FINANCE': {
      const id = params.factorCode
        ? `因素代码「${params.factorCode}」`
        : params.shortName
        ? `因素名称「${params.shortName}」`
        : '（未填因素）'
      const source = params.priceSource ? ` · ${params.priceSource}` : ''
      const bu = params.buScoped ? ' · 按业务线区分' : ' · 所有业务线共用'
      return `影响因素表 · ${id}${source}${bu}`
    }
    case 'ENTITY': {
      const field = fieldDisplay(params.field)
      const scale =
        params.unitScale && Number(params.unitScale) !== 1 ? ` · ×${params.unitScale}` : ''
      return `当前料号 · ${field}${scale}`
    }
    case 'DERIVED': {
      const s = params.strategy
      if (s === 'MAIN_MATERIAL_FINANCE') return '派生 · 按料号主材取对应财务基准价'
      if (s === 'SCRAP_REF') return '派生 · 按料号废料映射取废料参考价'
      if (s === 'FORMULA_REF')
        return `派生 · 引用公式 ${params.formulaRef || '（未填）'}`
      if (s === 'FINANCE_FACTOR')
        return `派生 · 指定因素 ${params.factorCode || '（未填）'}`
      return `派生 · ${s || '（未设置规则）'}`
    }
    case 'FORMULA':
      return `公式 · ${params.expr || '（未填）'}`
    case 'CONST':
      return `固定常量 = ${params.value ?? '（未填）'}`
    default:
      return row.resolverParams || '—'
  }
}

/** 把英文字段名转成中文（下拉 hint 命中优先，否则原样） */
const fieldDisplay = (rawField) => {
  if (!rawField) return '（未填）'
  const hit = ENTITY_FIELD_HINTS.find((f) => f.value === rawField)
  return hit ? hit.label : rawField
}

/** —— 对话框 —— */

const pickKind = (kind) => {
  formModel.resolverKind = kind
}

const resetFormToEmpty = () => {
  Object.assign(formModel, emptyFormModel())
  aliasesText.value = ''
  Object.assign(financeParams, { factorCode: '', shortName: '', priceSource: '平均价', buScoped: true })
  Object.assign(entityParams, { entity: 'linkedItem', field: '', unitScale: 1 })
  Object.assign(derivedParams, { strategy: 'MAIN_MATERIAL_FINANCE', formulaRef: '', factorCode: '' })
  Object.assign(formulaParams, { expr: '' })
  Object.assign(constParams, { value: '' })
}

const openCreate = () => {
  editingId.value = null
  resetFormToEmpty()
  dialogVisible.value = true
}

const openEdit = async (row) => {
  editingId.value = row.id
  resetFormToEmpty()
  try {
    const fresh = await fetchPriceVariableById(row.id)
    loadIntoForm(fresh || row)
  } catch {
    loadIntoForm(row)
  }
  dialogVisible.value = true
}

/** 把 entity 数据填进表单 + 按 resolver_kind 填到对应子参数对象 */
const loadIntoForm = (row) => {
  formModel.variableCode = row.variableCode || ''
  formModel.variableName = row.variableName || ''
  formModel.resolverKind = row.resolverKind || 'FINANCE'
  formModel.status = row.status || 'active'

  const aliases = parseAliases(row.aliasesJson)
  aliasesText.value = aliases.join(',')

  let params = {}
  try {
    params = row.resolverParams ? JSON.parse(row.resolverParams) : {}
  } catch {
    params = {}
  }
  switch (formModel.resolverKind) {
    case 'FINANCE':
      financeParams.factorCode = params.factorCode || ''
      financeParams.shortName = params.shortName || ''
      financeParams.priceSource = params.priceSource || ''
      financeParams.buScoped = !!params.buScoped
      break
    case 'ENTITY':
      entityParams.entity = params.entity || 'linkedItem'
      entityParams.field = params.field || ''
      entityParams.unitScale = params.unitScale ?? 1
      break
    case 'DERIVED':
      derivedParams.strategy = params.strategy || 'MAIN_MATERIAL_FINANCE'
      derivedParams.formulaRef = params.formulaRef || ''
      derivedParams.factorCode = params.factorCode || ''
      break
    case 'FORMULA':
      formulaParams.expr = params.expr || ''
      break
    case 'CONST':
      constParams.value = params.value != null ? String(params.value) : ''
      break
    default:
      break
  }
}

/** 把表单组装回 PriceVariableRequest —— 只取当前 kind 的子参数；factor_type 由 kind 自动推导 */
const buildRequestBody = () => {
  let resolverParams
  switch (formModel.resolverKind) {
    case 'FINANCE':
      resolverParams = {
        factorCode: financeParams.factorCode.trim() || undefined,
        shortName: financeParams.shortName.trim() || undefined,
        priceSource: financeParams.priceSource.trim(),
        buScoped: !!financeParams.buScoped,
      }
      break
    case 'ENTITY':
      resolverParams = {
        entity: entityParams.entity,
        field: (entityParams.field || '').trim(),
        unitScale: Number(entityParams.unitScale ?? 1),
      }
      break
    case 'DERIVED':
      resolverParams = { strategy: derivedParams.strategy }
      if (derivedParams.strategy === 'FORMULA_REF') {
        resolverParams.formulaRef = derivedParams.formulaRef.trim()
      } else if (derivedParams.strategy === 'FINANCE_FACTOR') {
        resolverParams.factorCode = derivedParams.factorCode.trim()
      }
      break
    case 'FORMULA':
      resolverParams = { expr: formulaParams.expr.trim() }
      break
    case 'CONST':
      resolverParams = { value: constParams.value.trim() }
      break
    default:
      resolverParams = {}
  }

  Object.keys(resolverParams).forEach((k) => {
    if (resolverParams[k] === undefined) delete resolverParams[k]
  })

  const aliases = aliasesText.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    variableCode: formModel.variableCode.trim(),
    variableName: formModel.variableName.trim(),
    aliasesJson: aliases.length ? JSON.stringify(aliases) : null,
    factorType: KIND_TO_FACTOR_TYPE[formModel.resolverKind] || 'CONST',
    resolverKind: formModel.resolverKind,
    resolverParams,
    taxMode: null,
    businessUnitType: null,
    status: formModel.status,
    scope: null,
  }
}

const submit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  const body = buildRequestBody()
  saving.value = true
  try {
    if (editingId.value) {
      await updatePriceVariable(editingId.value, body)
      ElMessage.success('更新成功')
    } else {
      await createPriceVariable(body)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    await reload()
  } catch (err) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm(
      `停用变量「${row.variableName || row.variableCode}」？已有公式继续用原值，新的核算不再解析。`,
      '确认停用',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await deletePriceVariable(row.id)
    ElMessage.success('已停用')
    await reload()
  } catch (err) {
    ElMessage.error(err?.message || '操作失败')
  }
}

onMounted(reload)

watch(() => filters.status, reload)
</script>

<style scoped>
.variable-admin-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
}

.page-subtitle {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.toolbar-filters {
  display: flex;
  gap: 8px;
}

.code-chip {
  font-family: 'JetBrains Mono', 'Menlo', monospace;
  background: #f4f4f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.source-cell {
  font-size: 13px;
  line-height: 1.5;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 2px;
}

/* —— "值从哪里来" 卡片选择器 —— */
.kind-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  width: 100%;
}

.kind-card {
  display: flex;
  gap: 8px;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}

.kind-card:hover {
  border-color: #a0cfff;
  background: #f5f9ff;
}

.kind-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.kind-card-icon {
  font-size: 18px;
  line-height: 1.3;
}

.kind-card-body {
  flex: 1;
  min-width: 0;
}

.kind-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.kind-card-desc {
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}
</style>
