<template>
  <div class="linked-result">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">联动价格表</div>
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
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="filters.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="MAT-1001" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="derivedRows" stripe v-loading="loading">
        <el-table-column prop="orgCode" label="组织" width="90" />
        <el-table-column prop="sourceName" label="来源" width="120" />
        <el-table-column prop="supplierName" label="供应商名称" min-width="140" />
        <el-table-column prop="supplierCode" label="供应商代码" width="120" />
        <el-table-column prop="purchaseClass" label="采购分类" width="120" />
        <el-table-column prop="materialName" label="物料名称" min-width="140" />
        <el-table-column prop="materialCode" label="物料代码" width="140" />
        <el-table-column label="联动公式" min-width="260">
          <template #default="{ row }">
            <div class="expr-primary">{{ row.formulaExpr }}</div>
            <div class="expr-secondary">
              {{ toChineseExpr(row.formulaExpr, variableMap) }}
            </div>
            <div v-if="row.formulaIssue" class="expr-issue">
              缺少: {{ row.formulaIssue }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="specModel" label="规格型号" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="blankWeight" label="下料量" width="110" />
        <el-table-column prop="netWeight" label="净重" width="110" />
        <el-table-column prop="processFee" label="加工费" width="110" />
        <el-table-column prop="agentFee" label="代理费" width="110" />
        <el-table-column prop="manualPrice" label="单价" width="120" />
        <el-table-column label="计算单价" width="120">
          <template #default="{ row }">
            <span v-if="row.calcPrice !== null">
              {{ formatNumber(row.calcPrice) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="是否含税" width="100">
          <template #default="{ row }">
            {{ row.taxIncluded ? '含税' : '未税' }}
          </template>
        </el-table-column>
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
        <el-table-column prop="effectiveTo" label="失效日期" width="120" />
        <el-table-column prop="orderType" label="订单类型" width="120" />
        <el-table-column prop="quota" label="配额" width="100" />
        <el-table-column prop="pricingMonth" label="月份" width="110" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditRow(row)">
              编辑
            </el-button>
            <el-button type="primary" link @click="openFormulaEditor(row)">
              公式
            </el-button>
            <el-button type="danger" link @click="removeRow(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="formModel.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="组织">
          <el-input v-model="formModel.orgCode" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="formModel.sourceName" />
        </el-form-item>
        <el-form-item label="供应商名称">
          <el-input v-model="formModel.supplierName" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="formModel.supplierCode" />
        </el-form-item>
        <el-form-item label="采购分类">
          <el-input v-model="formModel.purchaseClass" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="规格型号">
          <el-input v-model="formModel.specModel" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" />
        </el-form-item>
        <el-form-item label="联动公式">
          <el-input
            v-model="formModel.formulaExpr"
            type="textarea"
            :rows="3"
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
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
        <el-form-item label="下料量">
          <el-input v-model="formModel.blankWeight" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input v-model="formModel.netWeight" />
        </el-form-item>
        <el-form-item label="加工费">
          <el-input v-model="formModel.processFee" />
        </el-form-item>
        <el-form-item label="代理费">
          <el-input v-model="formModel.agentFee" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="formModel.manualPrice" />
        </el-form-item>
        <el-form-item label="是否含税">
          <el-select v-model="formModel.taxIncluded" placeholder="选择">
            <el-option label="含税" :value="true" />
            <el-option label="未税" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="formModel.effectiveFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker
            v-model="formModel.effectiveTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-input v-model="formModel.orderType" />
        </el-form-item>
        <el-form-item label="配额">
          <el-input v-model="formModel.quota" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="formulaDialogVisible" title="编辑联动公式" width="640px">
      <div class="formula-meta" v-if="formulaRow">
        <span>物料代码: {{ formulaRow.materialCode }}</span>
        <span>规格型号: {{ formulaRow.specModel || '-' }}</span>
      </div>
      <el-form :model="formulaModel" label-width="90px">
        <el-form-item label="中文公式">
          <el-input
            v-model="formulaModel.formulaExprCn"
            type="textarea"
            :rows="3"
            placeholder="例如 (铜基价*0.59+锌基价*0.41)*下料量+加工费"
          />
        </el-form-item>
        <el-form-item label="表达式(编码)">
          <el-input
            v-model="formulaModel.formulaExpr"
            type="textarea"
            :rows="3"
            readonly
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
          />
        </el-form-item>
        <div v-if="formulaConvertWarning" class="formula-warning">
          {{ formulaConvertWarning }}
        </div>
        <el-form-item label="中文预览">
          <el-input
            :model-value="formulaEditorPreview"
            type="textarea"
            :rows="2"
            readonly
          />
        </el-form-item>
        <el-form-item label="变量">
          <div class="formula-vars">
            <el-tag
              v-for="item in formulaVarOptions"
              :key="item.code"
              class="formula-var-tag"
              @click="appendVariable(item.code)"
            >
              {{ item.label }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formulaDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFormula">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchLinkedItems,
  createLinkedItem,
  updateLinkedItem,
  deleteLinkedItem,
  importLinkedItems,
} from '../api/priceLinkedItems'
import { formulaVariables, toChineseExpr, toCodeExpr } from '../utils/formula'
import { fetchPriceVariables } from '../api/priceVariables'

const loading = ref(false)
const tableRows = ref([])
const dialogVisible = ref(false)
const importing = ref(false)
const editingId = ref(null)
const formulaDialogVisible = ref(false)
const formulaEditingId = ref(null)
const formulaRow = ref(null)

const formModel = ref({
  pricingMonth: '',
  orgCode: '',
  sourceName: '',
  supplierName: '',
  supplierCode: '',
  purchaseClass: '',
  materialName: '',
  materialCode: '',
  specModel: '',
  unit: '',
  formulaExpr: '',
  blankWeight: '',
  netWeight: '',
  processFee: '',
  agentFee: '',
  manualPrice: '',
  taxIncluded: true,
  effectiveFrom: '',
  effectiveTo: '',
  orderType: '',
  quota: '',
})

const formulaModel = ref({
  formulaExpr: '',
  formulaExprCn: '',
})

const variableMap = ref({ ...formulaVariables })
const variableList = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑联动价' : '新增联动价',
)

const formulaPreview = computed(() =>
  toChineseExpr(formModel.value.formulaExpr, variableMap.value),
)
const formulaEditorPreview = computed(() =>
  toChineseExpr(formulaModel.value.formulaExpr, variableMap.value),
)

const normalizeFormulaExpr = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return { formulaExpr: '', formulaExprCn: '' }
  }
  const formulaExpr = toCodeExpr(trimmed, variableMap.value)
  return {
    formulaExpr,
    formulaExprCn: toChineseExpr(formulaExpr, variableMap.value),
  }
}

const formulaVarOptions = computed(() =>
  Object.entries(variableMap.value).map(([code, label]) => ({
    code,
    name: label,
    label: `${label}(${code})`,
  })),
)

const formulaConvertWarning = computed(() => {
  const encoded = formulaModel.value.formulaExpr || ''
  return /[\u4e00-\u9fa5]/.test(encoded)
    ? '编码表达式含未识别中文变量，请补充变量映射'
    : ''
})

const filters = ref({
  pricingMonth: '',
  materialCode: '',
})

const buildParams = () => ({
  pricingMonth: filters.value.pricingMonth,
  materialCode: filters.value.materialCode?.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchLinkedItems(buildParams())
    tableRows.value = Array.isArray(data) ? data : []
    if (!filters.value.pricingMonth && tableRows.value.length > 0) {
      filters.value.pricingMonth = tableRows.value[0].pricingMonth || ''
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取联动价失败')
  } finally {
    loading.value = false
  }
}

const fetchVariables = async () => {
  try {
    const data = await fetchPriceVariables({ status: 'active' })
    variableList.value = Array.isArray(data) ? data : []
    const map = {}
    variableList.value.forEach((item) => {
      if (!item?.variableCode || !item?.variableName) {
        return
      }
      map[item.variableCode] = item.variableName
    })
    if (Object.keys(map).length > 0) {
      variableMap.value = map
    }
    return variableMap.value
  } catch (error) {
    ElMessage.warning(error?.message || '获取变量列表失败')
    return variableMap.value
  }
}

const resetFilters = () => {
  filters.value = {
    pricingMonth: '',
    materialCode: '',
  }
  fetchList()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    pricingMonth: filters.value.pricingMonth,
    orgCode: '',
    sourceName: '',
    supplierName: '',
    supplierCode: '',
    purchaseClass: '',
    materialName: '',
    materialCode: '',
    specModel: '',
    unit: '',
    formulaExpr: '',
    blankWeight: '',
    netWeight: '',
    processFee: '',
    agentFee: '',
    manualPrice: '',
    taxIncluded: true,
    effectiveFrom: '',
    effectiveTo: '',
    orderType: '',
    quota: '',
  }
  dialogVisible.value = true
}

const openEditRow = (row) => {
  editingId.value = row.id
  formModel.value = {
    pricingMonth: row.pricingMonth,
    orgCode: row.orgCode,
    sourceName: row.sourceName,
    supplierName: row.supplierName,
    supplierCode: row.supplierCode,
    purchaseClass: row.purchaseClass,
    materialName: row.materialName,
    materialCode: row.materialCode,
    specModel: row.specModel,
    unit: row.unit,
    formulaExpr: row.formulaExpr || '',
    blankWeight: row.blankWeight ?? '',
    netWeight: row.netWeight ?? '',
    processFee: row.processFee ?? '',
    agentFee: row.agentFee ?? '',
    manualPrice: row.manualPrice ?? '',
    taxIncluded: row.taxIncluded === null ? true : !!row.taxIncluded,
    effectiveFrom: row.effectiveFrom || '',
    effectiveTo: row.effectiveTo || '',
    orderType: row.orderType,
    quota: row.quota ?? '',
  }
  dialogVisible.value = true
}

const openFormulaEditor = (row) => {
  formulaEditingId.value = row.id
  formulaRow.value = row
  const normalizedFormulaExpr = toCodeExpr(
    row.formulaExpr || '',
    variableMap.value,
  )
  const currentFormulaExprCn = row.formulaExprCn?.trim() || ''
  const resolvedFormulaExprCn =
    currentFormulaExprCn &&
    toCodeExpr(currentFormulaExprCn, variableMap.value) ===
      normalizedFormulaExpr
      ? currentFormulaExprCn
      : toChineseExpr(normalizedFormulaExpr, variableMap.value)
  formulaModel.value = {
    formulaExpr: normalizedFormulaExpr,
    formulaExprCn: resolvedFormulaExprCn,
  }
  formulaDialogVisible.value = true
}

const appendVariable = (code) => {
  const name = variableMap.value[code] || code
  const current = formulaModel.value.formulaExprCn || ''
  const suffix = current && !current.endsWith(' ') ? ' ' : ''
  formulaModel.value.formulaExprCn = `${current}${suffix}${name} `
}

const submitFormula = async () => {
  if (!formulaEditingId.value) {
    return
  }
  const payload = {
    formulaExpr: formulaModel.value.formulaExpr?.trim() || '',
    formulaExprCn: formulaModel.value.formulaExprCn?.trim() || '',
  }
  try {
    const updated = await updateLinkedItem(formulaEditingId.value, payload)
    tableRows.value = tableRows.value.map((item) =>
      item.id === formulaEditingId.value ? updated : item,
    )
    ElMessage.success('公式已更新')
    formulaDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error?.message || '公式保存失败')
  }
}

watch(
  [() => formulaModel.value.formulaExprCn, () => variableMap.value],
  ([value, map]) => {
    formulaModel.value.formulaExpr = toCodeExpr(value, map)
  },
  { immediate: true },
)

const toNumber = (value) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const submitRow = async () => {
  if (!formModel.value.pricingMonth || !formModel.value.materialCode) {
    ElMessage.warning('月份和物料代码必填')
    return
  }
  const normalizedFormula = normalizeFormulaExpr(formModel.value.formulaExpr)
  const payload = {
    pricingMonth: formModel.value.pricingMonth,
    orgCode: formModel.value.orgCode,
    sourceName: formModel.value.sourceName,
    supplierName: formModel.value.supplierName,
    supplierCode: formModel.value.supplierCode,
    purchaseClass: formModel.value.purchaseClass,
    materialName: formModel.value.materialName,
    materialCode: formModel.value.materialCode,
    specModel: formModel.value.specModel,
    unit: formModel.value.unit,
    formulaExpr: normalizedFormula.formulaExpr,
    formulaExprCn: normalizedFormula.formulaExprCn,
    blankWeight: toNumber(formModel.value.blankWeight),
    netWeight: toNumber(formModel.value.netWeight),
    processFee: toNumber(formModel.value.processFee),
    agentFee: toNumber(formModel.value.agentFee),
    manualPrice: toNumber(formModel.value.manualPrice),
    taxIncluded: formModel.value.taxIncluded,
    effectiveFrom: formModel.value.effectiveFrom || null,
    effectiveTo: formModel.value.effectiveTo || null,
    orderType: formModel.value.orderType,
    quota: toNumber(formModel.value.quota),
  }
  try {
    if (editingId.value) {
      const updated = await updateLinkedItem(editingId.value, payload)
      const nextRow = {
        ...updated,
        formulaExpr: normalizedFormula.formulaExpr,
        formulaExprCn: normalizedFormula.formulaExprCn,
      }
      tableRows.value = tableRows.value.map((item) =>
        item.id === editingId.value ? nextRow : item,
      )
      ElMessage.success('已更新')
    } else {
      const created = await createLinkedItem(payload)
      const nextRow = {
        ...created,
        formulaExpr: normalizedFormula.formulaExpr,
        formulaExprCn: normalizedFormula.formulaExprCn,
      }
      tableRows.value = [nextRow, ...tableRows.value]
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  try {
    await deleteLinkedItem(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const normalizeMonth = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\d{4})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`
  }
  return text
}

const getCurrentMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const normalizeDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return text.replace(/\//g, '-')
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseBoolean = (value) => {
  if (value === true || value === false) {
    return value
  }
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) {
    return null
  }
  if (['1', 'true', 'yes', 'y', '是', '含税'].includes(text)) {
    return true
  }
  if (['0', 'false', 'no', 'n', '否', '未税'].includes(text)) {
    return false
  }
  return null
}

const baseFactorDefaults = {
  Cu: 86.638,
  Zn: 24.662,
  Al: 18,
  Sn: 18,
  Cn: 5,
}

const demoLineDefaults = {
  blank_weight: 0.667,
  net_weight: 0.367,
  process_fee: 1.2,
  agent_fee: 0.6,
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildFormulaVars = (row) => {
  const vars = { ...baseFactorDefaults }
  const missing = new Set()
  const applyIfNumber = (key, value) => {
    const parsed = parseNumber(value)
    if (parsed !== null) {
      vars[key] = parsed
    }
  }
  applyIfNumber('Cu', row.Cu ?? row.cu)
  applyIfNumber('Zn', row.Zn ?? row.zn)
  applyIfNumber('Al', row.Al ?? row.al)
  applyIfNumber('Sn', row.Sn ?? row.sn)
  applyIfNumber('Cn', row.Cn ?? row.cn)

  const blankWeight = parseNumber(row.blankWeight)
  const netWeight = parseNumber(row.netWeight)
  const processFee = parseNumber(row.processFee)
  const agentFee = parseNumber(row.agentFee)

  if (blankWeight === null) {
    missing.add('blank_weight')
  }
  if (netWeight === null) {
    missing.add('net_weight')
  }
  if (processFee === null) {
    missing.add('process_fee')
  }
  if (agentFee === null) {
    missing.add('agent_fee')
  }

  vars.blank_weight =
    blankWeight === null ? demoLineDefaults.blank_weight : blankWeight
  vars.net_weight =
    netWeight === null ? demoLineDefaults.net_weight : netWeight
  vars.process_fee =
    processFee === null ? demoLineDefaults.process_fee : processFee
  vars.agent_fee = agentFee === null ? demoLineDefaults.agent_fee : agentFee

  return { vars, missing }
}

const evaluateFormula = (expr, vars) => {
  const text = String(expr ?? '').trim()
  if (!text) {
    return null
  }
  try {
    const keys = Object.keys(vars)
    const values = keys.map((key) => vars[key])
    const fn = new Function(...keys, `return ${text}`)
    const result = fn(...values)
    if (typeof result !== 'number' || Number.isNaN(result)) {
      return null
    }
    return Number(result.toFixed(4))
  } catch (error) {
    return null
  }
}

const getMissingVars = (expr, vars, missingBase, map) => {
  const text = String(expr ?? '').trim()
  if (!text) {
    return []
  }
  const missing = new Set()
  Object.keys(map).forEach((key) => {
    const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`)
    if (!pattern.test(text)) {
      return
    }
    if (
      vars[key] === null ||
      vars[key] === undefined ||
      missingBase.has(key)
    ) {
      missing.add(key)
    }
  })
  return Array.from(missing)
}

const formatMissingVars = (missing) =>
  missing.map((key) => variableMap.value[key] || key).join('、')

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }
  return Number(value).toFixed(4)
}

const derivedRows = computed(() =>
  tableRows.value.map((row) => {
    if (!row.formulaExpr) {
      return {
        ...row,
        calcPrice: null,
        formulaIssue: '',
      }
    }
    const { vars, missing } = buildFormulaVars(row)
    const missingVars = getMissingVars(
      row.formulaExpr,
      vars,
      missing,
      variableMap.value,
    )
    const calcPrice = evaluateFormula(row.formulaExpr, vars)
    return {
      ...row,
      calcPrice,
      formulaIssue: missingVars.length ? formatMissingVars(missingVars) : '',
    }
  }),
)

const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  importing.value = true
  try {
    if (!variableList.value.length) {
      await fetchVariables()
    }
    let XLSX = null
    try {
      const mod = await import('xlsx')
      XLSX = mod
    } catch (error) {
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }
    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    const headerMap = {
      价格月份: 'pricingMonth',
      组织: 'orgCode',
      来源: 'sourceName',
      供应商名称: 'supplierName',
      供应商代码: 'supplierCode',
      采购分类: 'purchaseClass',
      物料名称: 'materialName',
      物料代码: 'materialCode',
      规格型号: 'specModel',
      单位: 'unit',
      联动公式: 'formulaExpr',
      下料重: 'blankWeight',
      下料重量: 'blankWeight',
      净重: 'netWeight',
      加工费: 'processFee',
      代理费: 'agentFee',
      单价: 'manualPrice',
      是否含税: 'taxIncluded',
      生效日期: 'effectiveFrom',
      失效日期: 'effectiveTo',
      订单类型: 'orderType',
      配额: 'quota',
    }
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => headerMap[String(cell).trim()]),
    )
    if (headerIndex === -1) {
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerIndex]
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = headerMap[String(cell).trim()]
      if (field) {
        fieldIndex[field] = index
      }
    })
    const fallbackMonth = filters.value.pricingMonth || getCurrentMonth()
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => {
        const pricingMonth =
          normalizeMonth(row[fieldIndex.pricingMonth]) || fallbackMonth
        const formulaExprCn = String(row[fieldIndex.formulaExpr] || '').trim()
        return {
          pricingMonth,
          orgCode: String(row[fieldIndex.orgCode] || '').trim(),
          sourceName: String(row[fieldIndex.sourceName] || '').trim(),
          supplierName: String(row[fieldIndex.supplierName] || '').trim(),
          supplierCode: String(row[fieldIndex.supplierCode] || '').trim(),
          purchaseClass: String(row[fieldIndex.purchaseClass] || '').trim(),
          materialName: String(row[fieldIndex.materialName] || '').trim(),
          materialCode: String(row[fieldIndex.materialCode] || '').trim(),
          specModel: String(row[fieldIndex.specModel] || '').trim(),
          unit: String(row[fieldIndex.unit] || '').trim(),
          formulaExprCn,
          formulaExpr: toCodeExpr(formulaExprCn, variableMap.value),
          blankWeight: parseNumber(row[fieldIndex.blankWeight]),
          netWeight: parseNumber(row[fieldIndex.netWeight]),
          processFee: parseNumber(row[fieldIndex.processFee]),
          agentFee: parseNumber(row[fieldIndex.agentFee]),
          manualPrice: parseNumber(row[fieldIndex.manualPrice]),
          taxIncluded: parseBoolean(row[fieldIndex.taxIncluded]),
          effectiveFrom: normalizeDate(row[fieldIndex.effectiveFrom]) || null,
          effectiveTo: normalizeDate(row[fieldIndex.effectiveTo]) || null,
          orderType: String(row[fieldIndex.orderType] || '').trim(),
          quota: parseNumber(row[fieldIndex.quota]),
        }
      })
      .filter((row) => row.materialCode)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const importMonth = dataRows[0].pricingMonth || fallbackMonth
    await importLinkedItems({
      pricingMonth: importMonth,
      rows: dataRows,
    })
    filters.value.pricingMonth = importMonth
    ElMessage.success(`已导入${dataRows.length}条联动价`)
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(fetchList)
onMounted(fetchVariables)
</script>

<style scoped>
.linked-result {
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

.expr-primary {
  font-family: 'SFMono-Regular', Menlo, monospace;
  color: #111827;
}

.expr-secondary {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

.expr-issue {
  margin-top: 2px;
  font-size: 12px;
  color: #dc2626;
}

.text-muted {
  color: #9ca3af;
}

.formula-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  color: #6b7280;
  font-size: 12px;
}

.formula-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.formula-var-tag {
  cursor: pointer;
}

.formula-warning {
  margin: -8px 0 12px 90px;
  font-size: 12px;
  color: #dc2626;
}

.upload-btn {
  margin-left: 8px;
}
</style>
