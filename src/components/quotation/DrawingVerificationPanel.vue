<template>
  <section class="drawing-panel" :class="{ 'drawing-panel--inline': inline }" aria-label="电子图库">
    <div class="drawing-toolbar">
      <strong v-if="!inline">电子图库</strong>
      <template v-if="current">
        <el-tag :type="current.taskState === 'WAIT_REVIEW' || current.taskState === 'FAILED' ? 'warning' : current.taskState === 'RECEIVED' ? 'success' : 'info'" effect="plain">{{ drawingTaskLabel(current) }}</el-tag>
        <a v-if="editUrl && canOperate && !error" :href="editUrl" target="_blank" rel="noopener noreferrer" class="edit-link">去修正</a>
        <el-button v-if="current.taskState === 'RECEIVED' && current.currentResultId" link type="primary" @click="showResult(current.currentResultId)">查看明细</el-button>
        <el-button v-if="current.taskState === 'FAILED' && canOperate" link type="primary" :loading="busy" @click="restart">重新获取</el-button>
      </template>
      <span v-else class="drawing-empty">{{ loading ? '读取中…' : '—' }}</span>
      <el-button v-if="error" link type="warning" @click="refresh">读取失败，重试</el-button>
    </div>
    <p v-if="!inline && current?.taskState === 'WAIT_REVIEW'" class="drawing-hint">明细有差异，请点击“去修正”。修正结果接收后自动继续处理。</p>
    <p v-if="current?.taskState === 'WAIT_REVIEW' && !editUrl" class="drawing-hint">编辑地址未返回，请联系管理员。</p>
    <p v-if="!inline && current?.taskState === 'FAILED'" class="drawing-hint">{{ current.errorMessage }}</p>

    <el-dialog v-model="detailVisible" title="电子图库明细" width="min(1200px, 96vw)" top="5vh" append-to-body destroy-on-close>
      <div v-loading="detailLoading" class="drawing-detail-content">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
        <template v-if="detail">
          <p class="detail-adoption">{{ adoptionLabel }}</p>
          <p v-if="detail.summary.confirmedAt" class="drawing-empty">确认时间（北京时间）{{ drawingDateTime(detail.summary.confirmedAt) }}</p>
          <section v-if="selectedGroup" class="drawing-group">
            <h4>图号 {{ selectedDrawingNo }}</h4>
            <el-table :data="selectedGroup.params?.items || []" border size="small">
              <el-table-column v-for="[field, label] in drawingColumns" :key="field" :label="label" :min-width="field === 'note' ? 140 : 95">
                <template #default="{ row }">{{ drawingText(row[field]) }}</template>
              </el-table-column>
            </el-table>
          </section>
          <el-empty v-else description="当前产品尚无可采用的图纸明细" :image-size="60" />
          <el-collapse class="drawing-history">
            <el-collapse-item title="图纸来源" name="source">
              <p class="drawing-empty">接收时间（北京时间）{{ drawingDateTime(detail.receivedAt) }} · 原始差异 {{ detail.summary.differenceCount }} 处</p>
              <article v-for="(record, index) in detail.plmData" :key="index" class="plm-record">
                <strong>来源 {{ index + 1 }}</strong>
                <dl><template v-for="field in plmFields.filter(field => record[field] != null)" :key="field">
                  <dt>{{ plmLabel(field) }}</dt>
                  <dd><a v-if="field === 'fileUrl' && safeDrawingUrl(record[field])" :href="safeDrawingUrl(record[field])" target="_blank" rel="noopener noreferrer">查看原图（PDF）</a><span v-else>{{ ['createTime', 'expireTime'].includes(field) ? drawingDateTime(record[field]) : drawingText(record[field]) }}</span></dd>
                </template></dl>
                <details class="source-original"><summary>原始来源记录</summary><pre>{{ drawingText(record) }}</pre></details>
              </article>
              <el-empty v-if="!detail.plmData.length" description="本次未提供图纸来源" :image-size="60" />
              <details v-if="additionalGroups.length" class="source-original">
                <summary>接口附带的其他图号数据（{{ additionalGroups.length }} 组）</summary>
                <p>此处仅保留原始返回内容，不作为当前产品的明细展示。</p>
                <section v-for="([drawingNo, group]) in additionalGroups" :key="drawingNo">
                  <h4>{{ drawingNo }}</h4><pre>{{ drawingText(group) }}</pre>
                </section>
              </details>
              <p class="drawing-empty">解析任务号 {{ detail.summary.taskId }}</p>
            </el-collapse-item>
            <el-collapse-item v-if="state?.history?.length" title="历史图库版本" name="history">
              <div v-for="task in state.history" :key="task.localTaskId" class="history-task">
                <p>{{ task.drawingNo }} · {{ drawingTaskLabel(task) }} · {{ drawingDateTime(task.createdAt) }}</p>
                <el-button v-for="result in task.results" :key="result.resultId" link type="primary" @click="showResult(result.resultId)">
                  {{ drawingResultLabel(result) }} · 版本 {{ result.revision }} · {{ drawingDateTime(result.receivedAt) }}
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>
        </template>
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { fetchDrawingVerificationWorkspace, fetchDrawingVerificationResult, operateDrawingVerification } from '../../api/quoteRequests'
import { useDrawingVerification } from '../../composables/useDrawingVerification'
import { drawingColumns, drawingTaskLabel, drawingEditUrl, drawingResultLabel, drawingText, safeDrawingUrl, drawingDateTime, drawingDetailGroups } from '../../utils/drawingVerification'

const props = defineProps({ oaNo: String, itemId: [Number, String], accountingMonth: String, readonly: Boolean, inline: Boolean })
const emit = defineEmits(['changed', 'state-change'])
const user = useUserStore()
const scope = computed(() => ({ oaNo: props.oaNo, itemId: props.itemId, month: props.accountingMonth }))
const { state, detail, loading, busy, detailLoading, error, detailError, refresh, operate, openResult } = useDrawingVerification(scope, {
  fetch: fetchDrawingVerificationWorkspace, detail: fetchDrawingVerificationResult, operate: operateDrawingVerification,
})
const detailVisible = ref(false)
const current = computed(() => state.value?.current)
const canOperate = computed(() => !props.readonly && user.permissions.some(p => ['*:*:*', 'ingest:quote:cost-run:execute'].includes(p)))
const editUrl = computed(() => drawingEditUrl(current.value))
const adoptionLabel = computed(() => ({ MANUAL_CONFIRMED: '人工已确认，采用此明细', DIRECT_ACCEPTED: '零差异，直接采用', WAIT_REVIEW: '待人工确认' })[detail.value?.adoption])
const plmFields = ['drawingNo', 'plmVersion', 'departmentName', 'createTime', 'fileUrl', 'expireTime']
const selectedDrawingNo = computed(() => state.value?.history?.find(task => task.localTaskId === detail.value?.localTaskId)?.drawingNo
  || (current.value?.localTaskId === detail.value?.localTaskId ? current.value?.drawingNo : ''))
const groups = computed(() => drawingDetailGroups(detail.value?.data, selectedDrawingNo.value))
const selectedGroup = computed(() => groups.value.current)
const additionalGroups = computed(() => groups.value.additional)
const plmLabel = field => ({ drawingNo: '图号', createTime: '创建时间（北京时间）', fileUrl: '原图', plmVersion: 'PLM 版本', departmentName: '部门', expireTime: '到期时间（北京时间）' })[field] || field
async function perform(action) {
  const next = await operate(action, current.value?.drawingNo)
  if (next) emit('changed')
}
async function restart() {
  try { await ElMessageBox.confirm('将创建新的取图任务，现有结果继续保留为历史。确认重新获取？', '重新获取图库', { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }) }
  catch { return }
  await perform('RESTART')
}
function showResult(resultId) { detailVisible.value = true; openResult(resultId) }
watch(state, value => { if (value) emit('state-change', value) })
function returnToPage() { if (document.visibilityState === 'visible') refresh() }
onMounted(() => { window.addEventListener('focus', returnToPage); document.addEventListener('visibilitychange', returnToPage) })
onBeforeUnmount(() => { window.removeEventListener('focus', returnToPage); document.removeEventListener('visibilitychange', returnToPage) })
</script>

<style scoped>
.drawing-panel { padding: 12px 16px; border: 1px solid #dfe5ee; border-radius: 6px; margin: 12px 0; }
.drawing-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.drawing-panel .el-alert { margin-bottom: 12px; }
.drawing-panel--inline { padding: 0; border: 0; margin: 0; }
.drawing-panel--inline .drawing-toolbar { margin: 0; gap: 6px 10px; }
.drawing-hint { margin: 4px 0 0; font-size: 13px; color: #a66c19; }
.drawing-empty { color: #909399; }
.edit-link { color: #1765c1; font-weight: 600; }
.history-task { padding: 6px 0; border-top: 1px solid #eaecf0; overflow-wrap: anywhere; }
.drawing-group { margin: 16px 0; }
.drawing-detail-content { max-height: 78vh; overflow-y: auto; padding-right: 8px; }
.detail-adoption { color: #468126; }
.source-original { margin: 12px 0; color: #667085; }
.source-original summary { cursor: pointer; }
.plm-record { border: 1px solid #dfe5ee; border-radius: 4px; padding: 12px; margin-bottom: 12px; }
dl { display: grid; grid-template-columns: minmax(100px, 160px) 1fr; gap: 8px 16px; }
dt { color: #667085; } dd { margin: 0; overflow-wrap: anywhere; } pre { margin: 0; white-space: pre-wrap; font: inherit; }
</style>
