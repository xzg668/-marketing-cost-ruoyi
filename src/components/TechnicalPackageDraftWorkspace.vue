<template>
  <section class="package-workspace" v-loading="loading || acting">
    <el-card shadow="never" class="workspace-card">
      <template #header>
        <div class="card-heading">
          <div>
            <strong>补裸品包装</strong>
            <p>U9 本体保持原样；这里只补包装，不会重复编辑本体 BOM。</p>
          </div>
          <el-tag :type="workspace?.u9Body?.ready ? 'success' : 'danger'" effect="plain">
            {{ workspace?.u9Body?.ready ? `U9本体已读取 · ${workspace.u9Body.lineCount}行` : 'U9本体不可用' }}
          </el-tag>
        </div>
      </template>

      <el-alert
        :title="workspace?.guidance || '先选择包装参考，再修改差异'"
        type="info"
        :closable="false"
        show-icon
      />

      <template v-if="!workspace?.draft">
        <div class="source-toolbar">
          <el-radio-group v-model="sourceMode" @change="searchSources">
            <el-radio-button value="QUOTED_PRODUCT">参考已审核报价产品</el-radio-button>
            <el-radio-button value="PACKAGE_PARENT">按包装目件查找</el-radio-button>
          </el-radio-group>
          <el-input v-model="keyword" clearable placeholder="输入料号或名称" @keyup.enter="searchSources">
            <template #append><el-button @click="searchSources">搜索</el-button></template>
          </el-input>
        </div>

        <el-table :data="candidates" highlight-current-row @current-change="selectCandidate">
          <el-table-column width="48">
            <template #default="{ row }"><el-radio v-model="selectedId" :value="row.sourceId" /></template>
          </el-table-column>
          <el-table-column label="可参考内容" min-width="230">
            <template #default="{ row }">
              <strong>{{ row.primaryCode }}</strong>
              <div class="muted">{{ row.primaryName || row.description }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="sourceTopProductCode" label="来源产品" min-width="150" />
          <el-table-column prop="periodMonth" label="来源月份" width="110" />
          <el-table-column prop="lineCount" label="包装关系" width="100" />
          <template #empty><el-empty description="没有合适参考时，请换关键词或包装目件查找" :image-size="64" /></template>
        </el-table>
        <div class="primary-bar">
          <span>复制后形成当前裸品的独立草稿，不会修改参考记录。</span>
          <el-button type="primary" :disabled="!selectedId" @click="copySelected">复制并开始修改</el-button>
        </div>
      </template>

      <template v-else>
        <div class="draft-head">
          <div>
            <strong>{{ workspace.draft.sourceLabel }}</strong>
            <span class="muted"> · {{ workspace.draft.lineCount }}条父子关系</span>
            <el-tag v-if="workspace.combinedBom?.ready" type="success" effect="plain" class="combined-tag">
              完整候选BOM {{ workspace.combinedBom.totalLineCount }}行（本体{{ workspace.combinedBom.bodyLineCount }}＋包装{{ workspace.combinedBom.packageLineCount }}）
            </el-tag>
          </div>
          <el-button v-if="canEdit" link type="primary" @click="changeSource">更换参考</el-button>
        </div>

        <el-tree
          :data="workspace.draft.tree"
          node-key="nodeKey"
          default-expand-all
          :expand-on-click-node="false"
          class="package-tree"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <strong>{{ data.materialCode }}</strong>
              <span>{{ data.materialName }}</span>
              <el-tag v-if="data.virtualPackage" size="small" effect="plain">包装目件</el-tag>
              <span class="muted">× {{ data.quantity }} {{ data.unit }}</span>
            </span>
          </template>
        </el-tree>

        <el-table :data="lines" class="edit-table" row-key="clientKey">
          <el-table-column type="index" label="#" width="48" />
          <el-table-column label="包装父件" min-width="190">
            <template #default="{ row }">
              <el-input v-model="row.packageParentCode" :disabled="!canEdit" placeholder="父件料号" />
              <el-input v-model="row.packageParentName" :disabled="!canEdit" placeholder="父件名称" />
            </template>
          </el-table-column>
          <el-table-column label="父件累计用量" width="150">
            <template #default="{ row }"><el-input-number v-model="row.packageQtyPerTop" :disabled="!canEdit" :min="0.00000001" :precision="8" controls-position="right" /></template>
          </el-table-column>
          <el-table-column label="下级包装材料" min-width="210">
            <template #default="{ row }">
              <el-input v-model="row.packageMaterialCode" :disabled="!canEdit" placeholder="子件料号" />
              <el-input v-model="row.packageMaterialName" :disabled="!canEdit" placeholder="子件名称" />
            </template>
          </el-table-column>
          <el-table-column label="相对父件用量" width="150">
            <template #default="{ row }"><el-input-number v-model="row.childQtyPerParent" :disabled="!canEdit" :min="0.00000001" :precision="8" controls-position="right" /></template>
          </el-table-column>
          <el-table-column label="单位" width="110">
            <template #default="{ row }"><el-input v-model="row.packageMaterialUnit" :disabled="!canEdit" /></template>
          </el-table-column>
          <el-table-column v-if="canEdit" label="操作" width="78">
            <template #default="{ $index }"><el-button link type="danger" @click="removeLine($index)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <div class="primary-bar">
          <el-button v-if="canEdit" @click="addLine">新增父子关系</el-button>
          <span v-else class="muted">包装已完成价格检查；如需修改，请按流程退回技术节点。</span>
          <div v-if="canEdit">
            <el-button @click="save(false)">保存草稿</el-button>
            <el-button type="primary" @click="save(true)">保存并检查价格</el-button>
          </div>
        </div>
      </template>
    </el-card>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  checkTechnicalPackagePrice,
  copyTechnicalPackageDraft,
  fetchTechnicalPackageWorkspace,
  saveTechnicalPackageDraft,
  searchTechnicalPackageSources,
} from '../api/technicalCollaborationTasks'
import { showErrorOnce } from '../utils/errorHandler'

const props = defineProps({ taskId: { type: [String, Number], required: true } })
const emit = defineEmits(['updated'])
const loading = ref(false)
const acting = ref(false)
const workspace = ref(null)
const sourceMode = ref('QUOTED_PRODUCT')
const keyword = ref('')
const candidates = ref([])
const selectedId = ref(null)
const lines = ref([])
let clientSequence = 0

const canEdit = computed(() => ['PACKAGE_IN_PROGRESS', 'TECH_VALIDATION_FAILED', 'RETURNED_TO_TECH'].includes(workspace.value?.taskStatus))

async function load() {
  loading.value = true
  try {
    workspace.value = await fetchTechnicalPackageWorkspace(props.taskId)
    lines.value = (workspace.value?.draft?.lines || []).map(toEditable)
    if (!workspace.value?.draft) await searchSources()
  } catch (error) {
    showErrorOnce(error, '包装工作区加载失败')
  } finally { loading.value = false }
}

async function searchSources() {
  acting.value = true
  selectedId.value = null
  try {
    const result = await searchTechnicalPackageSources(props.taskId, sourceMode.value, keyword.value)
    candidates.value = result?.candidates || []
  } catch (error) {
    showErrorOnce(error, '包装参考搜索失败')
  } finally { acting.value = false }
}

function selectCandidate(row) { selectedId.value = row?.sourceId || null }

async function copySelected() {
  if (!selectedId.value) return
  await run(async () => {
    workspace.value = await copyTechnicalPackageDraft(props.taskId, {
      expectedTaskVersion: workspace.value.taskVersion,
      sourceMode: sourceMode.value,
      sourceId: selectedId.value,
    })
    lines.value = (workspace.value?.draft?.lines || []).map(toEditable)
    emit('updated')
    ElMessage.success('包装参考已复制，只需修改不同项')
  })
}

async function changeSource() {
  try {
    await ElMessageBox.confirm('更换参考会覆盖当前包装草稿，确认继续？', '更换参考', {
      confirmButtonText: '确认更换', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  workspace.value = { ...workspace.value, draft: null }
  lines.value = []
  await searchSources()
}

function addLine() {
  lines.value.push(toEditable({
    packageParentCode: '', packageParentName: '', packageParentUnit: '件', packageQtyPerTop: 1,
    packageMaterialCode: '', packageMaterialName: '', packageMaterialUnit: '件', childQtyPerParent: 1,
  }))
}

function removeLine(index) { lines.value.splice(index, 1) }

async function save(checkPrice) {
  await run(async () => {
    workspace.value = await saveTechnicalPackageDraft(props.taskId, {
      expectedTaskVersion: workspace.value.taskVersion,
      lines: lines.value.map(({ clientKey, ...line }) => line),
    })
    lines.value = (workspace.value?.draft?.lines || []).map(toEditable)
    if (checkPrice) {
      const result = await checkTechnicalPackagePrice(props.taskId, workspace.value.taskVersion)
      workspace.value = result.workspace
      lines.value = (workspace.value?.draft?.lines || []).map(toEditable)
      result.priceGapCount
        ? ElMessage.warning(result.message)
        : ElMessage.success(result.message)
    } else {
      ElMessage.success('包装草稿已保存')
    }
    emit('updated')
  })
}

function toEditable(row) {
  clientSequence += 1
  return { ...row, clientKey: row.draftLineId || `new-${clientSequence}` }
}

async function run(action) {
  acting.value = true
  try { await action() } catch (error) {
    showErrorOnce(error, '包装操作失败')
  } finally { acting.value = false }
}

watch(() => props.taskId, load)
onMounted(load)
</script>

<style scoped>
.package-workspace { margin-bottom: 14px; }
.workspace-card { border-color: #d9e8fb; }
.card-heading, .draft-head, .primary-bar, .source-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-heading p { margin: 5px 0 0; color: #909399; font-size: 13px; }
.source-toolbar { margin: 18px 0 12px; }
.source-toolbar .el-input { max-width: 430px; }
.draft-head { margin: 18px 0 12px; }
.combined-tag { margin-left: 10px; }
.package-tree { margin-bottom: 16px; padding: 12px; border: 1px solid #ebeef5; background: #fafcff; }
.tree-node { display: flex; align-items: center; gap: 10px; }
.edit-table :deep(.el-input + .el-input) { margin-top: 6px; }
.edit-table :deep(.el-input-number) { width: 100%; }
.primary-bar { margin-top: 14px; }
.muted { color: #909399; font-size: 13px; }
</style>
