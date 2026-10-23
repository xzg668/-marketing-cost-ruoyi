<template>
  <el-dialog v-model="visible" title="导入结算价格原稿" destroy-on-close width="900px" :close-on-click-modal="false" :before-close="close">
    <el-alert title="结算联动价引用商用财务已发布的铜锌基价，原表基价仅供对照。按月追加原稿，未提供的料号继续沿用已有规则。" type="info" :closable="false" />
    <el-form label-width="100px" :disabled="busy" class="import-form">
      <el-form-item label="导入月份"><el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="preview = null" /></el-form-item>
      <el-form-item label="原稿文件"><input aria-label="结算原稿文件" type="file" accept=".xls,.xlsx" :disabled="busy" @change="selectFile" /></el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section v-if="preview" aria-label="导入预览">
      <p>来源 {{ preview.workbook.sourceRows.length }} 行，合并为 {{ preview.workbook.rules.length }} 条价格；结算固定价 {{ fixedCount }} 条，结算联动价 {{ preview.workbook.rules.length - fixedCount }} 条。</p>
      <el-alert title="新版四位小数公式采用原稿重量，空白锌重按0克计算并保留原始空白；铜重缺失时请修正原稿后重新导入。原稿重量变化时生成新版本，同一原稿重导保留已有版本。" type="info" :closable="false" />
      <el-table :data="preview.workbook.rules" height="280" size="small">
        <el-table-column prop="materialCode" label="料号" width="130" />
        <el-table-column label="类型" width="120"><template #default="{ row }">{{ typeLabel(row.priceType) }}</template></el-table-column>
        <el-table-column label="给定价"><template #default="{ row }">{{ displayDecimal(row.givenPrice) }}</template></el-table-column>
        <el-table-column label="重量处理" width="190"><template #default="{ row }">{{ importWeightStatus(row) }}</template></el-table-column>
        <el-table-column label="来源行"><template #default="{ row }">{{ row.sources.map(s => s.row).join('、') }}</template></el-table-column>
      </el-table>
    </section>
    <template #footer>
      <el-button :disabled="busy" @click="close">取消</el-button>
      <el-button :disabled="!file || busy" @click="inspect">预览原稿</el-button>
      <el-button type="primary" :disabled="!preview || busy" :loading="busy" @click="confirm">确认导入</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { previewSettlement, importSettlement } from '../../api/settlementPrices'
import { typeLabel, displayDecimal, importWeightStatus } from '../../pages/settlementPriceUtils'
const visible = defineModel({ type: Boolean })
const props = defineProps({ priceMonth: String })
const emit = defineEmits(['imported'])
const month = ref('2026-10'), file = ref(null), preview = ref(null), busy = ref(false), error = ref('')
const fixedCount = computed(() => preview.value?.workbook.rules.filter(r => r.priceType === 'SETTLE_FIXED').length || 0)
watch(visible, value => { if (value) { month.value = props.priceMonth; file.value = null; preview.value = null; error.value = '' } })
function selectFile(event) { file.value = event.target.files[0] || null; preview.value = null; error.value = '' }
function close() { if (!busy.value) visible.value = false }
async function inspect() {
  busy.value = true; error.value = ''; preview.value = null
  try { preview.value = await previewSettlement(file.value, month.value) }
  catch (e) { error.value = e.message }
  finally { busy.value = false }
}
async function confirm() {
  if (!preview.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    const result = await importSettlement(file.value, month.value, preview.value.fingerprint)
    const generated = result.effectivePrices
    const message = `导入完成：新增${result.inserted}条，修订${result.revised}条，未变化${result.unchanged}条；生成${generated.generated}条月度结算价格`
    if (generated.pending) ElMessage.warning(`${message}，另有${generated.pending}条缺少重量或适用基价，请补齐后报价`)
    else ElMessage.success(message)
    visible.value = false; emit('imported', month.value)
  } catch (e) { error.value = e.message; preview.value = null }
  finally { busy.value = false }
}
</script>
<style scoped>.import-form { margin-top: 20px; }</style>
