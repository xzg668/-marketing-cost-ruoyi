<template>
  <el-dialog :model-value="modelValue" title="导入联动原稿" width="1100px" destroy-on-close
    :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy"
    @update:model-value="$emit('update:modelValue', $event)">
    <div class="import-context">
      <span>{{ pricingMonth }} · {{ businessUnitLabel(businessUnitType) }}</span>
      <el-upload ref="upload" :auto-upload="false" :limit="1" accept=".xlsx,.xls" :disabled="busy"
        :on-change="changed" :on-remove="removed" :on-exceed="replaceFile">
        <el-button :disabled="busy">选择原稿</el-button>
      </el-upload>
      <el-button v-if="error && file" :disabled="busy" @click="previewFile">重新预检</el-button>
    </div>
    <div v-loading="previewing" class="preview-body">
      <el-alert v-if="error" type="error" :title="error" :closable="false" />
      <template v-if="preview">
        <el-alert v-if="preview.rows.some(row => row.matchStatus === 'WAIT_FINANCE_BASE')" type="info" :closable="false" title="可以先保存原稿；发布适用基价时会同步生成财务有效价。" />
        <p class="summary">主价 {{ preview.businessRowCount }} 条 · 新增 {{ summary.newCount }} · 修订 {{ summary.revisedCount }} · 未变 {{ summary.unchangedCount }} · 异常 {{ summary.errorCount }}</p>
        <p v-for="(context, org) in preview.financial" :key="org" class="finance-basis">
          组织 {{ org }} · 财务Cu {{ priceText(financeCopperPerTon(context)) }} 元/吨 · 来源月份 {{ context.months.sourceMonth }}
        </p>
        <el-tabs v-model="tab">
          <el-tab-pane label="复算结果" name="prices">
            <el-table :data="preview.rows" height="390" :row-key="row => `${row.ruleIdentity}:${row.sourceSheetName}:${row.sourceRowNumber}`">
              <el-table-column type="expand">
                <template #default="{ row }">
                  <div class="row-detail">
                    <p>{{ row.sourceSheetName }}!{{ row.sourceCell }} · {{ row.taxIncluded ? '原格含税' : '原格未税' }}</p>
                    <p class="formula"><span>原稿公式</span><code>{{ row.sourceFormula }}</code></p>
                    <p class="formula"><span>计算公式</span><code>{{ row.systemFormula }}</code></p>
                    <el-table :data="row.originalFactors" size="small" max-height="230">
                      <el-table-column label="因素"><template #default="{ row: factor }">{{ factor.key.replace(/^AVG\|/, '') }}</template></el-table-column>
                      <el-table-column label="来源格"><template #default="{ row: factor }">{{ factor.sheet }}!{{ factor.cell }}</template></el-table-column>
                      <el-table-column label="原稿值"><template #default="{ row: factor }">{{ priceText(factor.originalPrice) }}</template></el-table-column>
                      <el-table-column label="本次计算值"><template #default="{ row: factor }">{{ priceText(factor.price) }}</template></el-table-column>
                      <el-table-column label="单位"><template #default="{ row: factor }">{{ unitLabel(factor.unit) }}</template></el-table-column>
                    </el-table>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="materialCode" label="料号" min-width="145" />
              <el-table-column prop="supplierName" label="供应商" min-width="170" show-overflow-tooltip />
              <el-table-column prop="unit" label="单位" width="65" />
              <el-table-column label="原稿未税单价" min-width="145" align="right"><template #default="{ row }">{{ priceText(row.excelTaxExcludedPrice) }}</template></el-table-column>
              <el-table-column label="复算未税单价" min-width="145" align="right"><template #default="{ row }">{{ row.matchStatus === 'WAIT_FINANCE_BASE' ? '待基价' : row.importable ? priceText(row.systemTaxExcludedPrice) : '待处理' }}</template></el-table-column>
              <el-table-column label="本次操作" width="95"><template #default="{ row }">{{ originalActionLabel(row.action) }}</template></el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="`异常（${preview.errors.length}）`" name="errors">
            <el-table :data="preview.errors" height="390" empty-text="无异常">
              <el-table-column prop="sourceSheetName" label="工作表" width="170" />
              <el-table-column prop="rowNumber" label="行号" width="75" />
              <el-table-column prop="materialCode" label="料号" width="150" />
              <el-table-column prop="message" label="原因" min-width="300" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
      <p v-else-if="!error && !previewing" class="empty-hint">选择供管部原稿，系统会按财务基价复算。</p>
    </div>
    <LinkedImportedFiles v-if="modelValue" :pricing-month="pricingMonth" :business-unit-type="businessUnitType" />
    <template #footer>
      <el-button :disabled="busy" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!preview?.canConfirm || previewing" :loading="publishing" @click="publish">{{ publishing ? '正在保存并生成有效价' : '确认导入' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, genFileId } from 'element-plus'
import LinkedImportedFiles from './LinkedImportedFiles.vue'
import { previewLinkedItemsExcel, importLinkedItemsExcel } from '../api/priceLinkedItems'
import { originalPublicationMessage, businessUnitLabel, originalActionLabel, originalSummary, financeCopperPerTon, priceText } from './originalPriceDisplay'
const props = defineProps({ modelValue: Boolean, pricingMonth: String, businessUnitType: String })
const emit = defineEmits(['update:modelValue', 'imported'])
const upload = ref(null), file = ref(null), preview = ref(null), error = ref('')
const previewing = ref(false), publishing = ref(false), tab = ref('prices')
const busy = computed(() => previewing.value || publishing.value)
const summary = computed(() => originalSummary(preview.value?.rows, preview.value?.errors))
const unitLabel = (unit) => ({ CNY_KG: '元/公斤', CNY_TON: '元/吨', CNY_G: '元/克' })[unit] || unit
let generation = 0
const invalidate = () => { generation += 1; preview.value = null; error.value = ''; previewing.value = false }
watch(() => [props.pricingMonth, props.businessUnitType], invalidate)
watch(() => props.modelValue, open => { if (!open) { invalidate(); file.value = null } })
const previewFile = async () => {
  invalidate()
  if (!file.value || !props.pricingMonth || !props.businessUnitType) { error.value = '请选择月份和业务范围'; return }
  const current = generation
  previewing.value = true
  try {
    const result = await previewLinkedItemsExcel(file.value, props.pricingMonth, { businessUnitType: props.businessUnitType })
    if (current !== generation) return
    preview.value = result
    tab.value = result.canConfirm ? 'prices' : 'errors'
  } catch (failure) { if (current === generation) error.value = failure.message || '预检失败' }
  finally { if (current === generation) previewing.value = false }
}
const changed = (item) => { file.value = item.raw; previewFile() }
const removed = () => { file.value = null; invalidate() }
const replaceFile = (files) => {
  if (busy.value) return
  upload.value.clearFiles()
  const next = files[0]; next.uid = genFileId(); upload.value.handleStart(next)
}
const publish = async () => {
  if (!preview.value?.canConfirm || busy.value) return
  publishing.value = true
  const current = generation
  try {
    const result = await importLinkedItemsExcel(file.value, props.pricingMonth, {
      businessUnitType: props.businessUnitType,
      previewFileSha256: preview.value.fileSha256, previewFingerprint: preview.value.previewFingerprint,
    })
    if (current !== generation) return
    ElMessage.success(originalPublicationMessage(result, '联动'))
    emit('imported', result)
    emit('update:modelValue', false)
  } catch (failure) { if (current === generation) { error.value = failure.message || '导入失败'; preview.value = null } }
  finally { publishing.value = false }
}
</script>

<style scoped>
.import-context { display: flex; align-items: flex-start; gap: 18px; }
.import-context > span { padding-top: 8px; white-space: nowrap; }
.preview-body { min-height: 100px; margin-top: 16px; }
.summary { font-weight: 600; }
.finance-basis, .empty-hint { color: #606266; }
.row-detail { padding: 8px 24px; }
.formula { display: flex; gap: 12px; align-items: baseline; }
.formula > span { flex-shrink: 0; }
.formula code { overflow-wrap: anywhere; }
</style>
