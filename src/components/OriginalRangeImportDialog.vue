<template>
  <el-dialog :model-value="modelValue" title="导入区间价" width="1100px" destroy-on-close
    :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy"
    @update:model-value="$emit('update:modelValue', $event)">
    <el-form :inline="true" label-width="80px">
      <el-form-item label="导入范围"><span>{{ businessUnitLabel(user.businessUnitType) }} · {{ month }}</span></el-form-item>
      <el-form-item v-if="supplementRuleId != null" label="导入方式">
        <el-select v-model="onlySelected" :disabled="busy" style="width: 170px">
          <el-option :value="true" label="仅补所下载料号" />
          <el-option :value="false" label="导入整份原稿" />
        </el-select>
      </el-form-item>
      <el-form-item label="原稿文件">
        <el-upload ref="upload" :auto-upload="false" :limit="1" accept=".xlsx,.xls"
          :disabled="busy || !sourceReady" :on-change="changed" :on-remove="removed" :on-exceed="replaceFile">
          <el-button :disabled="busy || !sourceReady">选择原稿</el-button>
        </el-upload>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :disabled="!file || !month || busy" :loading="previewing" @click="previewFile">
          重新复算
        </el-button>
      </el-form-item>
    </el-form>
    <p v-if="supplementSource">
      {{ supplementSource.identity.materialCode }} · {{ supplementSource.identity.supplierName }}
      （{{ supplementSource.identity.supplierCode || '原稿未填代码' }}） · {{ supplementSource.identity.specification }}
      · 「{{ supplementSource.matrixSheet }}」第 {{ supplementSource.matrixRow }} 行
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="preview">
      <el-alert v-if="preview.notices?.length" type="info" :closable="false" title="识别提示：以下行未丢失，按说明跳过或纠正。" />
      <el-collapse v-if="preview.notices?.length"><el-collapse-item :title="`查看 ${preview.notices.length} 条识别提示`">
        <p v-for="(notice,index) in preview.notices" :key="index">{{ notice.sheet }} 第{{ notice.row }}行 · {{ notice.materialCode }}：{{ notice.message }}</p>
      </el-collapse-item></el-collapse>
      <el-alert v-if="preview.rows.some(row => !row.result && !row.error)" type="info" :closable="false" title="可以先保存原稿；发布适用基价时会同步生成财务有效价。" />
      <p>{{ preview.businessRowCount }} 条主价 · 新增 {{ summary.newCount }} · 修订 {{ summary.revisedCount }} · 未变 {{ summary.unchangedCount }} · 异常 {{ summary.errorCount }}</p>
      <p v-for="(context, org) in preview.financial" :key="org">
        财务Cu {{ priceText(financeCopperPerTon(context)) }} 元/吨 · 来源月份 {{ context.months.sourceMonth }} · 组织 {{ org }}
      </p>
      <el-tabs v-model="tab">
        <el-tab-pane label="复算结果" name="prices">
          <el-table :data="preview.rows" height="390" :row-key="row => `${row.rule.identity.materialCode}:${row.rule.sheet}:${row.rule.row}`">
            <el-table-column type="expand">
              <template #default="{ row }">
                <p>主表 {{ row.rule.sheet }} 第 {{ row.rule.row }} 行；矩阵 {{ row.rule.matrixSheet }} 第 {{ row.rule.matrixRow }} 行。</p>
                <el-table :data="row.rule.bands" max-height="260" size="small">
                  <el-table-column label="原始档位" min-width="180"><template #default="{ row: band }">{{ band.header.rawValue }}</template></el-table-column>
                  <el-table-column label="来源格" width="110"><template #default="{ row: band }">{{ band.address.cell }}</template></el-table-column>
                  <el-table-column prop="price" label="原始税价口径单价" min-width="160" />
                  <el-table-column label="实际公式" min-width="180"><template #default="{ row: band }">{{ band.source?.formula || '原格数值' }}</template></el-table-column>
                  <el-table-column prop="problem" label="档位问题" min-width="240" />
                </el-table>
              </template>
            </el-table-column>
            <el-table-column label="料号" width="160"><template #default="{ row }">{{ row.rule.identity.materialCode }}</template></el-table-column>
            <el-table-column label="供应商" min-width="200"><template #default="{ row }">{{ row.rule.identity.supplierName }}</template></el-table-column>
            <el-table-column label="原稿主价" width="120"><template #default="{ row }">{{ row.rule.mainPriceSource?.rawValue }}</template></el-table-column>
            <el-table-column label="复算未税单价" min-width="150"><template #default="{ row }">{{ row.result ? priceText(row.result.priceExcludingTax) : row.error ? '待处理' : '待基价' }}</template></el-table-column>
            <el-table-column label="命中档位" min-width="170"><template #default="{ row }">{{ rangeText(row.result?.selectedBounds) }}</template></el-table-column>
            <el-table-column label="本次导入" width="90"><template #default="{ row }">{{ originalActionLabel(row.action) }}</template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`异常（${preview.errors.length}）`" name="errors">
          <el-table :data="preview.errors" max-height="390">
            <el-table-column prop="sheet" label="Sheet" width="150" />
            <el-table-column prop="row" label="行" width="65" />
            <el-table-column prop="materialCode" label="料号" width="170" />
            <el-table-column prop="message" label="原因" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`异常档位（${warnings.length}）`" name="warnings">
          <p>以下原始档位存在缺值或公式错误，选到这些档位时会报缺价。当前财务档位是否可用以预检结果为准。</p>
          <el-table :data="warnings" max-height="390">
            <el-table-column prop="material" label="料号" width="170" />
            <el-table-column prop="source" label="来源" width="190" />
            <el-table-column prop="range" label="档位" width="170" />
            <el-table-column prop="message" label="问题" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </template>
    <template #footer>
      <el-button :disabled="busy" @click="$emit('update:modelValue', false)">关闭</el-button>
      <el-button type="primary" :disabled="!preview?.canConfirm || busy" :loading="publishing" @click="publish">
        {{ publishing ? '正在保存并生成有效价' : '确认导入' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, genFileId } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { fetchRangeOriginal, previewRangeOriginal, publishRangeOriginal } from '../api/priceRangeItems'
import { originalPublicationMessage, businessUnitLabel, originalActionLabel, originalSummary, priceText, financeCopperPerTon, rangeText } from './originalPriceDisplay'

const props = defineProps({
  modelValue: Boolean,
  initialMonth: { type: String, required: true },
  supplementRuleId: { type: Number, default: null },
})
const emit = defineEmits(['update:modelValue', 'imported'])
const user = useUserStore()
const month = computed(() => props.initialMonth)
const upload = ref(null)
const file = ref(null)
const preview = ref(null)
const error = ref('')
const previewing = ref(false)
const publishing = ref(false)
const onlySelected = ref(true)
const activeRuleId = computed(() => onlySelected.value ? props.supplementRuleId : null)
const sourceDetail = ref(null)
const supplementSource = computed(() => sourceDetail.value?.saved?.sources?.[0])
const sourceReady = computed(() => activeRuleId.value == null || Boolean(supplementSource.value))
const busy = computed(() => previewing.value || publishing.value)
const tab = ref('prices')
let generation = 0
const scope = computed(() => JSON.stringify([props.modelValue, props.initialMonth, activeRuleId.value, user.userId, user.businessUnitType]))
const invalidate = () => { generation += 1; preview.value = null; error.value = '' }
onBeforeUnmount(() => { generation += 1 })
watch(() => props.modelValue, (open) => { if (open) onlySelected.value = true })
watch(scope, async (owner) => {
  invalidate()
  file.value = null
  upload.value?.clearFiles()
  previewing.value = false
  sourceDetail.value = null
  if (!props.modelValue || activeRuleId.value == null) return
  const current = generation
  try {
    const detail = await fetchRangeOriginal(activeRuleId.value)
    if (owner === scope.value && generation === current) sourceDetail.value = detail
  } catch (failure) {
    if (owner === scope.value && generation === current) error.value = failure.message || '原稿读取失败'
  }
})
const changed = (item) => { file.value = item.raw; invalidate(); previewFile() }
const removed = () => { file.value = null; invalidate() }
const replaceFile = (files) => {
  if (busy.value) return
  upload.value.clearFiles()
  const next = files[0]
  next.uid = genFileId()
  upload.value.handleStart(next)
}
const summary = computed(() => originalSummary(preview.value?.rows, preview.value?.errors))
const warnings = computed(() => (preview.value?.rows || []).flatMap(({ rule }) => rule.bands
  .filter((band) => band.problem).map((band) => ({ material: rule.identity.materialCode,
    source: `${band.address.sheet}!${band.address.cell}`, range: band.header.rawValue, message: band.problem }))))

const previewFile = async () => {
  if (busy.value) return
  invalidate()
  if (!file.value || !month.value) { error.value = '请先选择导入月份和原稿'; return }
  const current = generation
  previewing.value = true
  try {
    const result = await previewRangeOriginal(file.value, month.value, user.businessUnitType, activeRuleId.value)
    if (generation === current) { preview.value = result; tab.value = result.canConfirm ? 'prices' : 'errors' }
  } catch (failure) { if (generation === current) error.value = failure.message || '原稿预检失败' }
  finally { if (generation === current) previewing.value = false }
}
const publish = async () => {
  if (busy.value || !preview.value?.canConfirm) return
  publishing.value = true
  const current = generation
  try {
    const result = await publishRangeOriginal(file.value, month.value, user.businessUnitType, preview.value, activeRuleId.value)
    if (generation !== current) return
    ElMessage.success(originalPublicationMessage(result, '区间'))
    emit('imported', result)
    invalidate()
    emit('update:modelValue', false)
  } catch (failure) { if (generation === current) { error.value = failure.message || '原稿发布失败'; preview.value = null } }
  finally { publishing.value = false }
}
</script>
