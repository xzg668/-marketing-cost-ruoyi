<template>
  <el-dialog v-model="visible" title="月度调价 · 导入联动价和区间价文件夹" width="92%" :close-on-click-modal="!busy" :show-close="!busy" :close-on-press-escape="!busy">
    <p>目标月份：<strong>{{ month }}</strong>。请先维护当月财务基价；系统按主表识别价格，保留原公式和区间规则。</p>
    <div class="folder-actions">
      <el-button type="primary" :disabled="busy || !month" @click="folderInput.click()">{{ report && report.status !== 'COMPLETE' ? '重新选择文件夹，补传或修正' : '选择文件夹并导入' }}</el-button>
      <input ref="folderInput" class="file-input" type="file" webkitdirectory directory multiple aria-label="选择价格文件夹" @change="onFolder" />
      <input ref="replacementInput" class="file-input" type="file" aria-label="选择修正后的价格文件" @change="onReplacement" />
      <el-button :disabled="busy" @click="load">刷新记录</el-button>
      <el-button v-if="report && report.status !== 'COMPLETE'" :disabled="busy" @click="run(processFiles)">重试待处理文件</el-button>
      <el-button v-if="report" :disabled="busy" @click="exportReceipt">下载核对清单</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-alert v-if="busy" :title="progress || '正在处理，请稍候'" type="info" :closable="false" />
    <template v-if="report">
      <div class="folder-summary">
        <span>错误 <strong>{{ report.summary.errorRows }}</strong> 处</span>
        <el-button v-for="file in errorFiles" :key="file.id" link type="danger" class="error-file"
          @click="tab = 'files'; onlyErrors = true">{{ file.path }}</el-button>
      </div>
      <el-alert v-if="report.status === 'COMPLETE'" type="success" :closable="false" show-icon
        :title="`本月资料处理完成，上月补齐 ${report.completion?.carried?.length || 0} 条规则，已按 ${month} 基价生成价格。`" />
      <el-alert v-else type="warning" :closable="false"
        :title="errorFiles.length ? '以下文件需要处理。其他文件已暂存，问题处理完后统一生效。' : '文件已暂存，完成剩余文件处理和上月规则补齐后生效。'" />
      <el-tabs v-model="tab">
        <el-tab-pane label="文件处理结果" name="files">
          <el-checkbox v-if="errorFiles.length" v-model="onlyErrors">只看错误文件</el-checkbox>
          <el-table :data="visibleFiles" max-height="410" row-key="id">
            <el-table-column prop="path" label="文件" min-width="300" />
            <el-table-column label="识别类型" width="110"><template #default="{ row }">{{ kindLabel(row.kind) }}</template></el-table-column>
            <el-table-column label="记录" width="80"><template #default="{ row }">{{ row.rowCount < 0 ? '未知' : row.rowCount }}</template></el-table-column>
            <el-table-column label="处理说明" min-width="300"><template #default="{ row }">
              <p v-for="(issue, index) in row.errors" :key="index" class="row-error">{{ folderIssueText(issue, month) }}</p>
              <span v-if="!row.errors.length">{{ row.message }}{{ row.noPriceRows ? `；无价跳过${row.noPriceRows}条` : '' }}</span>
              <p v-if="row.notices.length">{{ row.notices.length }}条识别提示，详见核对清单。</p>
            </template></el-table-column>
            <el-table-column label="操作" width="180"><template #default="{ row }">
              <el-button v-if="row.sha256" link type="primary" :disabled="busy" @click="downloadOriginal(row)">原件</el-button>
              <el-button v-if="report.status !== 'COMPLETE'" link type="primary" :disabled="busy" @click="replaceFile(row)">补传 / 修正</el-button>
            </template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="规则核对" name="rules">
          <div class="folder-actions"><el-checkbox v-model="onlyAlternatives" @change="page = 1">只看同料同供应商多规则</el-checkbox><el-input v-model="search" placeholder="搜索料号或供应商" clearable style="width:280px" @input="page = 1" /></div>
          <el-table :data="pagedGroups" max-height="390" row-key="identityKey">
            <el-table-column prop="identity.orgCode" label="组织" width="70" />
            <el-table-column prop="identity.materialCode" label="料号" min-width="150" />
            <el-table-column label="供应商" min-width="190"><template #default="{ row }">{{ row.identity.supplierCode }} {{ row.identity.supplierName }}</template></el-table-column>
            <el-table-column prop="identity.specification" label="规格" min-width="180" />
            <el-table-column prop="identity.unit" label="单位" width="80" />
            <el-table-column label="结果" width="100"><template #default="{ row }"><el-tag :type="row.status === 'IMPORTED' ? 'success' : 'info'">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="来源" width="120"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="selectedGroup = row">查看全部来源</el-button></template></el-table-column>
          </el-table>
          <el-pagination v-model:current-page="page" :page-size="50" :total="filteredGroups.length" layout="total, prev, pager, next" />
        </el-tab-pane>
      </el-tabs>
      <div class="folder-actions" v-if="canCompleteFolder(report)"><el-button type="primary" :disabled="busy" @click="run(finish)">补齐上月规则并完成本月资料</el-button></div>
    </template>
    <el-empty v-else-if="!busy" description="选择文件夹后，逐个识别联动价和区间价" />
    <el-dialog :model-value="!!selectedGroup" title="同一料号和供应商的来源核对" width="85%" append-to-body @close="selectedGroup = null">
      <template v-if="selectedGroup">
        <p>{{ selectedGroup.identity.orgCode }} · {{ selectedGroup.identity.materialCode }} · {{ selectedGroup.identity.supplierCode }} {{ selectedGroup.identity.supplierName }}</p>
        <el-alert v-if="selectedGroup.variantCount > 1" type="info" :closable="false" title="以下不同规则全部保留，按适用月份基价分别计算，取最高有效价。" />
        <el-table :data="selectedGroup.candidates" max-height="450">
          <el-table-column prop="fileName" label="文件" min-width="250" />
          <el-table-column label="位置" width="160"><template #default="{ row }">{{ row.sheet }} · 第{{ row.row }}行</template></el-table-column>
          <el-table-column label="实际公式或区间规则" min-width="360"><template #default="{ row }"><div class="rule-formula">{{ row.formula }}</div></template></el-table-column>

        </el-table>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useUserStore } from '../store/modules/user'
import * as api from '../api/monthlyPriceFolders'
import { createUuid } from '../utils/uuid'
import { canCompleteFolder, folderPath, folderReceiptCsv, folderIssueText } from './monthlyPriceFolderUtils'

const props = defineProps({ modelValue: Boolean, month: String })
const emit = defineEmits(['update:modelValue', 'prepared'])
const user = useUserStore()
const visible = computed({ get: () => props.modelValue, set: value => { if (!busy.value) emit('update:modelValue', value) } })
const report = ref(null), busy = ref(false), progress = ref(''), error = ref('')
const folderInput = ref(null), replacementInput = ref(null), replacement = ref(null)
const selectedGroup = ref(null), tab = ref('files'), onlyAlternatives = ref(true), search = ref(''), page = ref(1)
const onlyErrors = ref(true)
const errorFiles = computed(() => (report.value?.files || []).filter(file => file.errors.length))
const visibleFiles = computed(() => onlyErrors.value && errorFiles.value.length ? errorFiles.value : report.value?.files || [])
let epoch = 0
const filteredGroups = computed(() => (report.value?.groups || []).filter(group =>
  (!onlyAlternatives.value || group.variantCount > 1) &&
  `${group.identity.materialCode} ${group.identity.supplierCode} ${group.identity.supplierName}`.includes(search.value.trim())))
const pagedGroups = computed(() => filteredGroups.value.slice((page.value - 1) * 50, page.value * 50))
const kindLabel = kind => ({ LINKED: '联动价', RANGE: '区间价', REFERENCE: '参考资料', ERROR: '待修正', PENDING: '待上传' })[kind] || kind
const statusLabel = status => ({ READY: '待处理', PREPARED: '待整体生效', IMPORTED: '已采用' })[status] || status
const message = failure => failure?.message || '处理失败，请刷新核对结果后重试'

async function run(work) {
  if (busy.value) return
  const current = epoch
  busy.value = true; error.value = ''
  try { await work(current) } catch (failure) { if (current === epoch) error.value = message(failure) }
  finally { if (current === epoch) { busy.value = false; progress.value = '' } }
}
async function load() {
  if (!props.month || busy.value) return
  await run(async current => { const result = await api.latestPriceFolder(props.month); if (current === epoch) report.value = result })
}
async function onFolder(event) {
  const selected = [...event.target.files]; event.target.value = ''
  if (!selected.length) return
  await run(async current => {
    if (selected.length > 128 || selected.some(file => file.size > 25 * 1024 * 1024)) throw new Error('每批最多128个文件，单文件不得超过25MB')
    const paths = selected.map(folderPath)
    let next = report.value && report.value.status !== 'COMPLETE'
      ? await api.addPriceFolderFiles(report.value.id, report.value.revision, paths)
      : await api.startPriceFolder({ pricingMonth: props.month, requestKey: createUuid(), paths })
    if (current !== epoch) return
    report.value = next
    for (let i = 0; i < selected.length; i++) {
      if (current !== epoch) return
      progress.value = `正在读取 ${i + 1}/${selected.length}：${paths[i]}`
      const file = next.files.find(row => row.path === paths[i])
      try { await api.uploadPriceFolderFile(next.id, file.id, selected[i]) }
      catch (failure) {
        error.value = `${paths[i]}：${message(failure)}；其余文件继续处理`
        try { await api.priceFolderUploadFailed(next.id, file.id, message(failure)) } catch { /* 断网时保留待上传状态，恢复后可以补传。 */ }
      }
    }
    if (current !== epoch) return
    report.value = await api.readPriceFolder(next.id)
    await processFiles(current)
  })
}
async function processFiles(current = epoch) {
  if (!report.value || report.value.status === 'COMPLETE') return
  const id = report.value.id
  const files = report.value.files.filter(file => ['LINKED', 'RANGE'].includes(file.kind))
  for (let i = 0; i < files.length; i++) {
    if (current !== epoch) return
    progress.value = `正在处理 ${i + 1}/${files.length}：${files[i].path}`
    try {
      const next = await api.processPriceFolderFile(id, files[i].id, report.value.revision)
      if (current !== epoch) return
      report.value = next
    } catch (failure) {
      if (current !== epoch) return
      error.value = `${files[i].path}：${message(failure)}；其余文件继续处理`
      try { report.value = await api.readPriceFolder(id) } catch { /* 保留服务器记录，后续刷新重试。 */ }
    }
  }
  if (current !== epoch) return
  if (canCompleteFolder(report.value)) await finish(current)
  else if (report.value.summary.errorRows || report.value.summary.pendingFiles) tab.value = 'files'
  else if (report.value.summary.alternativeRuleCount) tab.value = 'rules'
}
async function finish(current = epoch) {
  progress.value = '正在补齐上月规则，并按当月基价复算'
  const next = await api.completePriceFolder(report.value.id, report.value.revision)
  if (current === epoch) { report.value = next; emit('prepared') }
}
function replaceFile(file) { replacement.value = file; replacementInput.value.click() }
async function onReplacement(event) {
  const file = event.target.files[0]; event.target.value = ''
  if (!file || !replacement.value) return
  const target = replacement.value
  await run(async current => {
    progress.value = `正在重新读取：${target.path}`
    await api.uploadPriceFolderFile(report.value.id, target.id, file)
    if (current !== epoch) return
    report.value = await api.readPriceFolder(report.value.id)
    await processFiles(current)
  })
}
async function downloadOriginal(file) { await run(() => api.downloadPriceFolderOriginal(report.value.id, file)) }
function exportReceipt() {
  const url = URL.createObjectURL(new Blob([folderReceiptCsv(report.value)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `${props.month}价格文件夹核对清单.csv`; link.click(); URL.revokeObjectURL(url)
}
watch(() => [props.modelValue, props.month, user.businessUnitType], async ([open]) => {
  epoch++; report.value = null; selectedGroup.value = null; busy.value = false; error.value = ''; progress.value = ''
  tab.value = 'files'; onlyErrors.value = true
  if (open) await load()
}, { immediate: true })
</script>

<style scoped>
.rule-formula{white-space:pre-wrap;overflow-wrap:anywhere}
.error-file{height:auto;white-space:normal;text-align:left;overflow-wrap:anywhere}
.file-input{display:none}.folder-actions,.folder-summary{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:15px 0}.folder-summary{background:#f4f7fc;padding:14px;border-radius:6px}.folder-summary span{margin-right:10px}.row-error{color:#c45656;margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere}.el-alert{margin:12px 0}.el-pagination{margin-top:15px}p{line-height:1.6}
</style>
