<template>
  <section class="entry-preview" :aria-label="`${moduleName(moduleType)}填写页预览`">
    <el-alert title="填写页只读预览，可切换填写方式查看字段；资料由负责技术员填写并提交。" type="info" :closable="false" />
    <p v-if="reason" class="gap-reason">{{ reason }}</p>
    <div v-loading="loading" class="preview-content">
      <template v-if="error">
        <el-alert :title="error" type="error" :closable="false" />
        <el-button @click="load">重试</el-button>
      </template>
      <TechnicalDataProfileForm v-else-if="moduleType === 'PROFILE'" :product="row.product" :editable="false" />
      <component v-else-if="preview && formComponent" :is="formComponent" :key="moduleType" :preview-data="preview" :editable="false" />
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { checkQuotePriceSources, fetchQuoteCostingWorkbench } from '../../api/quoteRequests'
import { priceEntryPreview } from '../../utils/technicalDataPrice'
import { findModule, moduleName } from '../../utils/technicalDataWorkbench'
import TechnicalDataProfileForm from './TechnicalDataProfileForm.vue'
import TechnicalDataPackageForm from './TechnicalDataPackageForm.vue'
import TechnicalDataAuxiliaryForm from './TechnicalDataAuxiliaryForm.vue'
import TechnicalDataSolderForm from './TechnicalDataSolderForm.vue'
import TechnicalDataSalaryForm from './TechnicalDataSalaryForm.vue'
import TechnicalDataNetLossForm from './TechnicalDataNetLossForm.vue'
import TechnicalDataPriceForm from './TechnicalDataPriceForm.vue'

const props = defineProps({ row: { type: Object, required: true }, moduleType: { type: String, required: true } })
const forms = { PACKAGE: TechnicalDataPackageForm, AUXILIARY: TechnicalDataAuxiliaryForm,
  SOLDER: TechnicalDataSolderForm, SALARY: TechnicalDataSalaryForm, NET_LOSS: TechnicalDataNetLossForm, PRICE: TechnicalDataPriceForm }
const formComponent = computed(() => forms[props.moduleType])
const reason = computed(() => findModule(props.row.product, props.moduleType)?.requirementReason)
const preview = ref(null), error = ref(''), loading = ref(false)
let generation = 0
async function load() {
  const current = ++generation, row = props.row
  error.value = ''; loading.value = false
  // Unassigned products have no technical product ID. Display the real form's empty
  // fields without creating a task or reading somebody else's unpublished draft.
  preview.value = { editable: false, moduleStatus: 'PENDING', items: [], issues: [], priceRequirements: [] }
  if (props.moduleType !== 'PRICE') return
  preview.value = null; loading.value = true
  try {
    const [check, workbench] = await Promise.all([
      checkQuotePriceSources(row.oaNo, row.product.oaFormItemId, { periodMonth: row.accountingMonth, refreshCandidates: true }),
      fetchQuoteCostingWorkbench(row.oaNo, row.product.oaFormItemId),
    ])
    if (current !== generation) return
    if (check?.readiness?.status === 'FAILED') throw new Error(check.readiness.message || '价格检查失败，请重试')
    preview.value = priceEntryPreview(check, workbench)
  } catch (cause) {
    if (current === generation) error.value = cause.message || '价格填写页加载失败，请重试'
  } finally { if (current === generation) loading.value = false }
}
watch(() => [props.row, props.moduleType], load, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
.gap-reason { color: #94622d; line-height: 1.7; }
.preview-content { min-height: 100px; margin-top: 20px; }
</style>
