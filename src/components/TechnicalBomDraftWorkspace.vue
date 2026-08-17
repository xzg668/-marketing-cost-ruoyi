<template>
  <section class="bom-workspace" v-loading="loading || acting">
    <el-card shadow="never" class="steps-card">
      <el-steps :active="Math.max(0, (workspace?.currentStep || 1) - 1)" finish-status="success" align-center>
        <el-step v-for="step in workspace?.steps || fallbackSteps" :key="step.step" :title="step.title" />
      </el-steps>
    </el-card>

    <template v-if="workspace?.currentStep === 1">
      <el-card shadow="never" class="workspace-card">
        <template #header>
          <div class="card-heading">
            <div>
              <strong>1. 找参考BOM</strong>
              <p>按当前产品的规格、型号，在本任务有权限的 U9 报价组织中查找。</p>
            </div>
            <el-button @click="openNewDialog()">没有合适参考，全新建立</el-button>
          </div>
        </template>

        <el-form :inline="true" :model="filters" class="search-form" @submit.prevent>
          <el-form-item label="料号/品名"><el-input v-model="filters.keyword" clearable /></el-form-item>
          <el-form-item label="规格"><el-input v-model="filters.spec" clearable /></el-form-item>
          <el-form-item label="型号"><el-input v-model="filters.model" clearable /></el-form-item>
          <el-form-item><el-button type="primary" plain @click="search">搜索 U9 相似BOM</el-button></el-form-item>
        </el-form>

        <el-table :data="candidates" row-key="candidateKey" highlight-current-row @current-change="selectCandidate">
          <el-table-column width="46">
            <template #default="{ row }"><el-radio v-model="selectedKey" :value="candidateKey(row)" /></template>
          </el-table-column>
          <el-table-column label="参考料号" prop="productCode" min-width="155" />
          <el-table-column label="品名" prop="productName" min-width="150" />
          <el-table-column label="规格/型号" min-width="230">
            <template #default="{ row }">{{ [row.productSpec, row.productModel].filter(Boolean).join(' · ') || '-' }}</template>
          </el-table-column>
          <el-table-column label="当前有效BOM" min-width="180">
            <template #default="{ row }">{{ row.bomPurpose || '默认用途' }} · {{ row.bomVersion || '当前版' }} · {{ row.bomNodeCount }}节点</template>
          </el-table-column>
          <el-table-column label="匹配" min-width="120">
            <template #default="{ row }"><el-tag effect="plain">{{ row.matchReason }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="{ row }"><el-button link type="primary" @click.stop="previewCandidate(row)">查看BOM</el-button></template>
          </el-table-column>
          <template #empty><el-empty description="没有找到合适参考时，可全新建立BOM" :image-size="66" /></template>
        </el-table>

        <div class="primary-bar">
          <span>只会复制为当前产品独立草稿，不会修改参考 U9 BOM。</span>
          <el-button type="primary" :disabled="!selectedCandidate" @click="copySelected">复制选中BOM</el-button>
        </div>
      </el-card>
    </template>

    <template v-else-if="workspace?.draft && (workspace?.currentStep === 2 || editingDraft)">
      <el-card shadow="never" class="workspace-card">
        <template #header>
          <div class="card-heading">
            <div>
              <strong>2. 编辑并导出完整BOM</strong>
              <p>{{ draftSourceText }}；页面与后续导出使用同一份完整父子数据。</p>
            </div>
            <div class="header-actions">
              <el-button v-if="workspace?.currentStep === 3" @click="editingDraft = false">返回第3步</el-button>
              <el-switch v-model="changedOnly" active-text="只看变更" />
            </div>
          </div>
        </template>

        <el-alert v-if="workspace.draft.issues.length" type="warning" :closable="false" show-icon class="draft-issues">
          <template #title>完整BOM还有 {{ workspace.draft.issues.length }} 项需要补齐</template>
          <div v-for="issue in workspace.draft.issues" :key="`${issue.nodeId}-${issue.code}`">• {{ issue.message }}</div>
        </el-alert>

        <el-tree
          v-if="visibleTree.length"
          :data="visibleTree"
          node-key="nodeId"
          :default-expanded-keys="defaultExpandedKeys"
          :expand-on-click-node="false"
          class="bom-tree"
        >
          <template #default="{ data }">
            <div class="tree-row" :class="{ changed: data.changed }">
              <div class="material-cell">
                <strong>{{ data.materialName || '待填写名称' }}</strong>
                <span>{{ data.materialCode || '新品暂无料号' }} · {{ [data.materialSpec, data.materialModel].filter(Boolean).join(' / ') || '待填写规格型号' }}</span>
              </div>
              <el-tag effect="plain" :type="natureTag(data.materialNature)">{{ natureLabel(data.materialNature) }}</el-tag>
              <span class="qty-cell">{{ data.quantity }} {{ data.unit || '-' }}</span>
              <div class="node-actions">
                <el-button link type="primary" @click.stop="editNode(data)">编辑/替换</el-button>
                <el-button v-if="canHaveChildren(data)" link type="primary" @click.stop="addChild(data)">加下级</el-button>
                <el-dropdown
                  v-if="data.parentNodeId"
                  trigger="click"
                  @click.stop
                  @command="handleNodeCommand($event, data)"
                >
                  <el-button link>更多操作</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="sibling">加同级</el-dropdown-item>
                      <el-dropdown-item command="up">上移</el-dropdown-item>
                      <el-dropdown-item command="down">下移</el-dropdown-item>
                      <el-dropdown-item command="remove" divided>删除整枝</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-tree>
        <el-empty v-else description="当前没有已变更节点" :image-size="66" />

        <div class="primary-bar">
          <span>保存会同时检查正式料号、父子关系、用量和物料性质。</span>
          <el-button type="primary" @click="saveDraft">保存并检查完整BOM</el-button>
        </div>
      </el-card>
    </template>

    <template v-else-if="workspace?.draft && workspace?.currentStep === 3">
      <el-card shadow="never" class="workspace-card verification-card">
        <template #header>
          <div class="card-heading">
            <div>
              <strong>3. 在电子图库录入并回取校验</strong>
              <p>报价系统只在电子图库真实返回完整有效BOM后，才认定补录完成。</p>
            </div>
            <el-tag v-if="workspace.electronicBomFingerprint" type="success" effect="plain">已回取校验</el-tag>
            <el-tag v-else type="warning" effect="plain">待回取校验</el-tag>
          </div>
        </template>

        <el-alert
          v-if="workspace.verificationIssues?.length"
          type="error"
          :closable="false"
          show-icon
          class="draft-issues"
        >
          <template #title>上次回取有 {{ workspace.verificationIssues.length }} 个问题，请在电子图库修正后重试</template>
          <div v-for="issue in workspace.verificationIssues" :key="`${issue.gapId}-${issue.code}`">
            • {{ issue.message }}<span v-if="issue.nodeKey">（节点：{{ issue.nodeKey }}）</span>
          </div>
        </el-alert>

        <div class="simple-flow">
          <div><b>1</b><span><strong>下载模板</strong><small>模板包含当前完整BOM的全部节点、父子关系和用量。</small></span></div>
          <div><b>2</b><span><strong>到电子图库录入</strong><small>电子图库支持导入就直接导入；不支持时按模板录入。</small></span></div>
          <div><b>3</b><span><strong>回到这里校验</strong><small>系统自行查询电子图库，前端不能手工标记完成。</small></span></div>
        </div>

        <div class="primary-bar">
          <el-button @click="editingDraft = true">返回修改BOM</el-button>
          <div class="primary-actions">
            <el-button @click="downloadTemplate">下载电子图库BOM模板</el-button>
            <el-button type="primary" @click="verifyElectronicBom">我已录入，回取并校验</el-button>
          </div>
        </div>
      </el-card>
    </template>

    <el-dialog v-model="previewVisible" title="参考BOM完整树" width="78%">
      <el-tree :data="previewTree" node-key="nodeId" default-expand-all :expand-on-click-node="false">
        <template #default="{ data }">
          <span>{{ data.materialCode || '暂无料号' }}　{{ data.materialName || '-' }}　× {{ data.quantity }}</span>
        </template>
      </el-tree>
      <template #footer><el-button @click="previewVisible = false">关闭</el-button></template>
    </el-dialog>

    <el-dialog v-model="newVisible" :title="rootDialogMode === 'copy' ? '确认当前产品信息' : '全新建立BOM'" width="620px">
      <el-form label-width="110px">
        <el-alert v-if="rootDialogMode === 'copy'" title="只复制参考BOM的下级结构；当前新品的名称、规格、型号/图号和性质必须使用自己的信息。" type="info" :closable="false" show-icon />
        <el-form-item label="产品名称" :required="rootFieldsRequired"><el-input v-model="newRoot.rootMaterialName" /></el-form-item>
        <el-form-item label="规格" :required="rootFieldsRequired"><el-input v-model="newRoot.rootMaterialSpec" /></el-form-item>
        <el-form-item label="型号" :required="rootFieldsRequired"><el-input v-model="newRoot.rootMaterialModel" /></el-form-item>
        <el-form-item label="型号/图号" :required="rootFieldsRequired"><el-input v-model="newRoot.rootDrawingNo" /></el-form-item>
        <el-form-item label="物料性质" required>
          <el-select v-model="newRoot.rootMaterialNature" style="width: 100%">
            <el-option v-for="item in natureOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRootDraft">{{ rootDialogMode === 'copy' ? '确认并复制参考BOM' : '建立目标BOM草稿' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" :title="editMode === 'edit' ? '编辑/替换零件' : '新增零件'" width="650px">
      <el-form label-width="110px">
        <el-form-item label="零件料号"><el-input v-model="editing.materialCode" placeholder="新品可不填；正式料号会校验U9" /></el-form-item>
        <el-form-item label="零件名称" required><el-input v-model="editing.materialName" /></el-form-item>
        <el-form-item label="规格" :required="!editing.materialCode"><el-input v-model="editing.materialSpec" /></el-form-item>
        <el-form-item label="型号" :required="!editing.materialCode"><el-input v-model="editing.materialModel" /></el-form-item>
        <el-form-item label="型号/图号" :required="!editing.materialCode"><el-input v-model="editing.drawingNo" /></el-form-item>
        <el-form-item label="物料性质" required>
          <el-select v-model="editing.materialNature" style="width: 100%">
            <el-option v-for="item in natureOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="相对父项用量" required><el-input-number v-model="editing.quantity" :min="0.00000001" :precision="8" /></el-form-item>
        <el-form-item label="单位" required><el-input v-model="editing.unit" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEdit">确认</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  copyTechnicalBomDraft,
  createTechnicalBomDraft,
  fetchTechnicalBomCandidateTree,
  fetchTechnicalBomWorkspace,
  saveTechnicalBomDraft,
  searchTechnicalBomCandidates,
  downloadTechnicalElectronicBomTemplate,
  verifyTechnicalElectronicBom,
} from '../api/technicalCollaborationTasks'
import { downloadBlob } from '../utils/quoteImport'
import { showErrorOnce } from '../utils/errorHandler'

const props = defineProps({ taskId: { type: [String, Number], required: true } })
const emit = defineEmits(['updated'])
const loading = ref(false)
const acting = ref(false)
const workspace = ref(null)
const candidates = ref([])
const selectedKey = ref('')
const filters = reactive({ keyword: '', spec: '', model: '' })
const previewVisible = ref(false)
const previewTree = ref([])
const newVisible = ref(false)
const rootDialogMode = ref('new')
const editVisible = ref(false)
const editMode = ref('edit')
const editing = reactive(emptyNode())
const changedOnly = ref(false)
const editingDraft = ref(false)
const fallbackSteps = [
  { step: 1, title: '找参考BOM' },
  { step: 2, title: '编辑并导出完整BOM' },
  { step: 3, title: '电子图库录入并校验' },
]
const natureOptions = [
  { value: 'PURCHASE', label: '采购件' },
  { value: 'MANUFACTURE', label: '制造件' },
  { value: 'OUTSOURCE', label: '委外件' },
  { value: 'VIRTUAL_PACKAGE', label: '虚拟件（包装）' },
]
const newRoot = reactive({
  rootMaterialNature: '', rootMaterialName: '', rootMaterialSpec: '',
  rootMaterialModel: '', rootDrawingNo: '',
})

const selectedCandidate = computed(() => candidates.value.find(row => candidateKey(row) === selectedKey.value))
const rootFieldsRequired = computed(() => !workspace.value?.target?.productCode)
const draftSourceText = computed(() => workspace.value?.draft?.sourceMode === 'U9_COPY'
  ? `参考料号：${workspace.value.draft.referenceProductCode || '-'}` : '全新建立的目标BOM')
const visibleTree = computed(() => {
  const tree = workspace.value?.draft?.tree || []
  return changedOnly.value ? filterChangedTree(tree) : tree
})
const defaultExpandedKeys = computed(() => visibleTree.value.map(row => row.nodeId))

async function load() {
  loading.value = true
  try {
    workspace.value = await fetchTechnicalBomWorkspace(props.taskId)
    editingDraft.value = false
    const target = workspace.value?.target || {}
    filters.spec = filters.spec || target.productSpec || ''
    filters.model = filters.model || target.productModel || ''
    if (workspace.value?.currentStep === 1) await search()
  } catch (error) {
    showErrorOnce(error, 'BOM工作区加载失败')
  } finally {
    loading.value = false
  }
}

async function search() {
  acting.value = true
  try {
    const result = await searchTechnicalBomCandidates(props.taskId, filters)
    candidates.value = (result.candidates || []).map(row => ({ ...row, candidateKey: candidateKey(row) }))
    if (!candidates.value.some(row => candidateKey(row) === selectedKey.value)) selectedKey.value = ''
  } catch (error) {
    showErrorOnce(error, '相似BOM搜索失败')
  } finally {
    acting.value = false
  }
}

function selectCandidate(row) { if (row) selectedKey.value = candidateKey(row) }
function candidateKey(row) { return `${row.productCode}|${row.bomPurpose || ''}|${row.bomVersion || ''}` }

async function previewCandidate(row) {
  acting.value = true
  try {
    const result = await fetchTechnicalBomCandidateTree(props.taskId, row.productCode, row.bomPurpose)
    previewTree.value = result.tree || []
    previewVisible.value = true
  } catch (error) {
    showErrorOnce(error, '参考BOM加载失败')
  } finally { acting.value = false }
}

async function copySelected() {
  if (!selectedCandidate.value) return
  if (!workspace.value?.target?.productCode || !workspace.value?.target?.materialNature) {
    openNewDialog('copy')
    return
  }
  await executeCopy()
}

async function executeCopy() {
  await run(async () => {
    const row = selectedCandidate.value
    const draft = await copyTechnicalBomDraft(props.taskId, {
      expectedTaskVersion: workspace.value.taskVersion,
      referenceProductCode: row.productCode,
      bomPurpose: row.bomPurpose,
      ...(rootDialogMode.value === 'copy' ? newRoot : {}),
    })
    newVisible.value = false
    applyDraft(draft, false)
  }, '参考BOM已复制为当前产品独立草稿')
}

function openNewDialog(mode = 'new') {
  rootDialogMode.value = mode
  const target = workspace.value?.target || {}
  Object.assign(newRoot, {
    rootMaterialNature: target.materialNature || '', rootMaterialName: target.productName || '',
    rootMaterialSpec: target.productSpec || '', rootMaterialModel: target.productModel || '',
    rootDrawingNo: target.productDrawingNo || '',
  })
  newVisible.value = true
}

async function confirmRootDraft() {
  if (!newRoot.rootMaterialNature) {
    return ElMessage.warning('请选择当前产品自己的物料性质')
  }
  if (rootFieldsRequired.value && (!newRoot.rootMaterialName || !newRoot.rootMaterialSpec
      || !newRoot.rootMaterialModel || !newRoot.rootDrawingNo)) {
    return ElMessage.warning('新品暂无料号，请填写当前产品自己的名称、规格、型号/图号和物料性质')
  }
  if (rootDialogMode.value === 'copy') return executeCopy()
  await run(async () => {
    const draft = await createTechnicalBomDraft(props.taskId, {
      expectedTaskVersion: workspace.value.taskVersion, ...newRoot,
    })
    newVisible.value = false
    applyDraft(draft, false)
  }, '已建立目标BOM草稿，请继续补下级')
}

function applyDraft(draft, advanceWhenReady) {
  const advance = Boolean(advanceWhenReady && draft.exportReady)
  workspace.value = {
    ...workspace.value, taskVersion: draft.taskVersion,
    currentStep: advance ? 3 : 2,
    primaryAction: advance ? 'EXPORT_AND_VERIFY' : 'SAVE_DRAFT',
    primaryActionLabel: advance
      ? '下载模板，录入电子图库后回取校验' : '保存并检查完整BOM', draft,
  }
  editingDraft.value = false
  emit('updated', draft.taskVersion)
}

function emptyNode() {
  return { nodeId: '', parentNodeId: null, materialCode: '', materialName: '', materialSpec: '',
    materialModel: '', drawingNo: '', materialNature: 'PURCHASE', quantity: 1, unit: '件',
    sortSeq: 1, changed: true }
}

function openEditor(node, mode, parentNodeId) {
  editMode.value = mode
  Object.assign(editing, mode === 'edit' ? { ...node, children: undefined, changed: true } : {
    ...emptyNode(), nodeId: `NEW-${Date.now()}-${Math.random().toString(16).slice(2)}`, parentNodeId,
  })
  editVisible.value = true
}

function editNode(node) { openEditor(node, 'edit', node.parentNodeId) }
function addChild(node) {
  if (!canHaveChildren(node)) return ElMessage.warning('采购件不能继续挂下级')
  openEditor(null, 'new', node.nodeId)
}
function addSibling(node) { openEditor(null, 'new', node.parentNodeId) }

function handleNodeCommand(command, node) {
  if (command === 'sibling') return addSibling(node)
  if (command === 'up') return moveNode(node, -1)
  if (command === 'down') return moveNode(node, 1)
  if (command === 'remove') return removeBranch(node)
}

function confirmEdit() {
  const missingNoCodeFields = !editing.materialCode
    && (!editing.materialSpec || !editing.materialModel || !editing.drawingNo)
  if (!editing.materialName || missingNoCodeFields || !editing.materialNature
      || !editing.quantity || Number(editing.quantity) <= 0 || !editing.unit) {
    return ElMessage.warning(editing.materialCode
      ? '请把名称、性质、用量和单位填写完整'
      : '新品暂无料号，请把名称、规格、型号/图号、性质、用量和单位填写完整')
  }
  const flat = workspace.value.draft.flatNodes
  const index = flat.findIndex(row => row.nodeId === editing.nodeId)
  const value = { ...editing, materialCode: editing.materialCode || null, changed: true, children: [] }
  if (index >= 0) flat.splice(index, 1, value)
  else flat.push(value)
  rebuildDraftTree()
  editVisible.value = false
}

async function removeBranch(node) {
  try {
    await ElMessageBox.confirm(`确认删除“${node.materialName || node.materialCode}”及其全部下级？`, '删除整条分支', {
      confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  const removed = new Set([node.nodeId])
  let changed = true
  while (changed) {
    changed = false
    for (const row of workspace.value.draft.flatNodes) {
      if (removed.has(row.parentNodeId) && !removed.has(row.nodeId)) { removed.add(row.nodeId); changed = true }
    }
  }
  workspace.value.draft.flatNodes = workspace.value.draft.flatNodes.filter(row => !removed.has(row.nodeId))
  rebuildDraftTree()
}

function moveNode(node, direction) {
  const siblings = workspace.value.draft.flatNodes
    .filter(row => row.parentNodeId === node.parentNodeId)
    .sort((a, b) => (a.sortSeq || 0) - (b.sortSeq || 0))
  const index = siblings.findIndex(row => row.nodeId === node.nodeId)
  const target = siblings[index + direction]
  if (!target) return
  const currentSort = node.sortSeq || index + 1
  node.sortSeq = target.sortSeq || index + direction + 1
  target.sortSeq = currentSort
  node.changed = true
  target.changed = true
  rebuildDraftTree()
}

function rebuildDraftTree() {
  const flat = workspace.value.draft.flatNodes
  const byId = new Map(flat.map(row => [row.nodeId, { ...row, children: [] }]))
  const roots = []
  for (const row of byId.values()) {
    if (row.parentNodeId && byId.has(row.parentNodeId)) byId.get(row.parentNodeId).children.push(row)
    else roots.push(row)
  }
  const sort = rows => rows.sort((a, b) => (a.sortSeq || 0) - (b.sortSeq || 0)).forEach(row => sort(row.children))
  sort(roots)
  workspace.value.draft.tree = roots
}

async function saveDraft() {
  await run(async () => {
    const draft = await saveTechnicalBomDraft(props.taskId, {
      expectedTaskVersion: workspace.value.taskVersion,
      nodes: workspace.value.draft.flatNodes.map(({ children, level, quantityToTop, temporaryMaterial, ...row }) => row),
    })
    applyDraft(draft, true)
    draft.exportReady
      ? ElMessage.success('完整BOM已保存并通过草稿检查')
      : ElMessage.warning(`草稿已保存，还有${draft.issues.length}项需要补齐`)
  })
}

async function downloadTemplate() {
  await run(async () => {
    const result = await downloadTechnicalElectronicBomTemplate(props.taskId)
    downloadBlob(result.blob, result.fileName)
  }, '电子图库BOM模板已下载')
}

async function verifyElectronicBom() {
  await run(async () => {
    const result = await verifyTechnicalElectronicBom(
      props.taskId, workspace.value.taskVersion, '主制造',
    )
    if (!result.verified) {
      ElMessage.warning(result.message)
    } else if (result.priceScanStatus === 'ERROR') {
      ElMessage.warning(result.message)
    } else {
      ElMessage.success(result.message)
    }
    emit('updated', result.taskVersion)
    // 成功后立即读取服务端保存的电子图库指纹和价格检查结果，避免页面仍显示旧草稿状态。
    if (result.verified) await load()
  })
}

async function run(action, success) {
  acting.value = true
  try { await action(); if (success) ElMessage.success(success) }
  catch (error) { showErrorOnce(error, '操作失败') }
  finally { acting.value = false }
}

function canHaveChildren(node) { return node.materialNature !== 'PURCHASE' }
function natureLabel(value) { return natureOptions.find(item => item.value === value)?.label || value || '-' }
function natureTag(value) {
  if (value === 'PURCHASE') return 'info'
  if (value === 'MANUFACTURE') return 'warning'
  return undefined
}
function filterChangedTree(rows) {
  return rows.flatMap(row => {
    const children = filterChangedTree(row.children || [])
    return row.changed || children.length ? [{ ...row, children }] : []
  })
}

watch(() => props.taskId, load)
onMounted(load)
</script>

<style scoped>
.steps-card, .workspace-card { margin-bottom: 14px; }
.card-heading, .primary-bar, .tree-row, .header-actions, .primary-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-heading p { margin: 5px 0 0; color: #909399; font-size: 13px; }
.search-form { padding: 8px 0 2px; }
.primary-bar { margin-top: 16px; padding: 14px 16px; border-top: 1px solid #ebeef5; color: #909399; font-size: 13px; }
.draft-issues { margin-bottom: 14px; }
.bom-tree { border: 1px solid #ebeef5; border-radius: 4px; overflow: hidden; }
.bom-tree :deep(.el-tree-node__content) { height: auto; min-height: 66px; padding-right: 12px; border-bottom: 1px solid #ebeef5; }
.tree-row { flex: 1; min-width: 0; padding: 8px 0; }
.tree-row.changed { background: #fffaf0; }
.material-cell { display: flex; flex: 1; min-width: 210px; flex-direction: column; gap: 5px; }
.material-cell span { overflow: hidden; color: #909399; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.qty-cell { width: 100px; color: #606266; text-align: right; }
.node-actions { display: flex; min-width: 420px; justify-content: flex-end; }
.simple-flow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.simple-flow > div { display: flex; gap: 12px; padding: 16px; border: 1px solid #ebeef5; border-radius: 4px; }
.simple-flow b { display: flex; width: 26px; height: 26px; align-items: center; justify-content: center; border-radius: 50%; background: #409eff; color: #fff; }
.simple-flow span { display: flex; flex: 1; flex-direction: column; gap: 7px; }
.simple-flow small { color: #909399; line-height: 1.6; }
@media (max-width: 1200px) { .node-actions { min-width: 260px; flex-wrap: wrap; } }
</style>
