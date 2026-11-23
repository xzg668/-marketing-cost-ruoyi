<template>
  <el-dialog :model-value="true" :title="isNewBand ? '新增区间价' : '下载模板数据'" width="650px"
    :close-on-click-modal="false" :show-close="!busy" :close-on-press-escape="!busy"
    @update:model-value="open => { if (!open) emit('close') }">
    <el-form label-width="108px" @submit.prevent>
      <el-form-item label="账期"><span>{{ month }}</span></el-form-item>
      <el-form-item label="物料代码">
        <el-input v-model="materialCode" :disabled="busy" placeholder="输入已有料号" @input="clearSelection" @keyup.enter="search">
          <template #append><el-button :loading="searching" :disabled="busy || !materialCode.trim()" @click="search">查询</el-button></template>
        </el-input>
      </el-form-item>
      <el-form-item label="供应商">
        <el-select v-model="selection" :disabled="busy" placeholder="选择供应商及规格" class="full-width">
          <el-option v-for="option in options" :key="option.id" :value="option.id" :label="optionLabel(option)" />
          <el-option v-if="!isNewBand" label="新料号填写模板" :value="blankTemplate" />
        </el-select>
      </el-form-item>
      <el-form-item label="供应商代码">
        <span>{{ selected ? selected.supplierCode || '原稿未填' : '选择供应商后带出' }}</span>
      </el-form-item>
      <template v-if="selected">
        <el-form-item label="物料名称"><span>{{ selected.materialName || '原稿未填' }}</span></el-form-item>
        <el-form-item label="规格型号"><span>{{ selected.specModel || '原稿未填' }}</span></el-form-item>
      </template>
      <template v-if="isNewBand && rule">
        <el-form-item label="区间下限">
          <div class="bound">
            <el-input v-model="form.low" :disabled="busy" inputmode="decimal" :placeholder="unit">
              <template #append>{{ unit }}</template>
            </el-input>
            <el-checkbox v-model="form.includeLow" :disabled="busy">含下限</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="区间上限">
          <div class="bound">
            <el-input v-model="form.high" :disabled="busy" inputmode="decimal" :placeholder="unit">
              <template #append>{{ unit }}</template>
            </el-input>
            <el-checkbox v-model="form.includeHigh" :disabled="busy">含上限</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item :label="rule.taxIncluded ? '含税单价' : '不含税单价'">
          <el-input v-model="form.price" :disabled="busy" inputmode="decimal">
            <template #append>元/{{ rule.identity.unit }}</template>
          </el-input>
        </el-form-item>
      </template>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template #footer>
      <el-button :disabled="busy" @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="busy || !canSubmit" :loading="saving" @click="submit">
        {{ isNewBand ? '保存' : '下载' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { addRangeBand, downloadRangeTemplate, fetchRangeOriginal, fetchRangeRuleOptions } from '../api/priceRangeItems'
import { originalPublicationMessage } from './originalPriceDisplay'
import { workbookDefinitions } from '../utils/workbookCatalog'
import { createWorkbook, saveWorkbook } from '../utils/workbookTransfer'

const props = defineProps({
  mode: { type: String, required: true },
  month: { type: String, required: true },
  initialMaterialCode: { type: String, default: '' },
})
const emit = defineEmits(['close', 'added', 'downloaded'])
const blankTemplate = 'NEW_MATERIAL'
const isNewBand = computed(() => props.mode === 'add')
const materialCode = ref(props.initialMaterialCode)
const options = ref([])
const selection = ref(null)
const detail = ref(null)
const searching = ref(false)
const loadingDetail = ref(false)
const saving = ref(false)
const error = ref('')
const busy = computed(() => searching.value || loadingDetail.value || saving.value)
const selected = computed(() => options.value.find(option => option.id === selection.value))
const rule = computed(() => detail.value?.saved?.sources?.[0])
const unit = computed(() => ({ CNY_TON: '元/吨', CNY_KG: '元/公斤', CNY_G: '元/克' })[rule.value?.factorUnit])
const emptyForm = () => ({ low: '', high: '', includeLow: false, includeHigh: true, price: '' })
const form = ref(emptyForm())
const canSubmit = computed(() => isNewBand.value
  ? Boolean(rule.value && form.value.low.trim() && form.value.high.trim() && form.value.price.trim())
  : Boolean(selected.value || selection.value === blankTemplate))
let searchId = 0
let detailId = 0
let active = true
onBeforeUnmount(() => { active = false })

const optionLabel = (option) => [
  option.supplierName || '原稿未填供应商名称', option.supplierCode, option.specModel, option.orgCode,
].filter(Boolean).join(' · ')

const clearSelection = () => {
  searchId += 1
  optionReset()
}

const optionReset = () => {
  options.value = []
  selection.value = null
  error.value = ''
}

const search = async () => {
  if (busy.value || !materialCode.value.trim()) return
  optionReset()
  const current = ++searchId
  searching.value = true
  try {
    const matches = await fetchRangeRuleOptions(props.month, materialCode.value.trim())
    if (!active || current !== searchId) return
    options.value = matches
    if (matches.length === 1) selection.value = matches[0].id
    if (!matches.length) error.value = '这个料号本月没有已发布的区间价'
  } catch (failure) {
    if (active && current === searchId) error.value = failure.message || '查询区间价失败'
  } finally {
    if (active && current === searchId) searching.value = false
  }
}

watch(selection, async (id) => {
  const current = ++detailId
  detail.value = null
  form.value = emptyForm()
  if (!isNewBand.value || id == null) return
  loadingDetail.value = true
  try {
    const result = await fetchRangeOriginal(id)
    if (!active || current !== detailId) return
    detail.value = result
    const last = rule.value.bands.reduce((highest, band) =>
      band.price != null && (!highest || Number(band.bounds.high) > Number(highest.high))
        ? band.bounds : highest, null)
    if (last) {
      form.value.low = String(last.high)
      form.value.includeLow = !last.upperInclusive
    }
  } catch (failure) {
    if (active && current === detailId) error.value = failure.message || '读取已有区间失败'
  } finally {
    if (active && current === detailId) loadingDetail.value = false
  }
})

const submit = async () => {
  if (busy.value || !canSubmit.value) return
  error.value = ''
  saving.value = true
  try {
    if (isNewBand.value) {
      const result = await addRangeBand(selected.value.id, {
        ...form.value,
        low: form.value.low.trim(), high: form.value.high.trim(), price: form.value.price.trim(),
      })
      if (!active) return
      ElMessage.success(originalPublicationMessage(result, '区间'))
      emit('added')
    } else if (selection.value === blankTemplate) {
      const XLSX = await import('xlsx')
      if (!active) return
      saveWorkbook(XLSX, createWorkbook(XLSX, workbookDefinitions.range, [], true), '区间价填写模板.xlsx')
      emit('downloaded', null)
    } else {
      const option = selected.value
      const extension = /\.xls$/i.test(option.sourceFile) ? '.xls' : '.xlsx'
      const downloaded = await downloadRangeTemplate(option.id,
        `区间价_${option.materialCode}_${option.supplierCode || option.id}_${props.month}${extension}`, { isCurrent: () => active })
      if (downloaded && active) emit('downloaded', option)
    }
  } catch (failure) {
    if (active) error.value = failure.message || (isNewBand.value ? '新增区间价失败' : '下载模板失败')
  } finally {
    if (active) saving.value = false
  }
}

onMounted(() => { if (materialCode.value.trim()) search() })
</script>

<style scoped>
.full-width { width: 100%; }
.bound { display: flex; gap: 12px; width: 100%; }
.bound .el-checkbox { flex-shrink: 0; }
</style>
