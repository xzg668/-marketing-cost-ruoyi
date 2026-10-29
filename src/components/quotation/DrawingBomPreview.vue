<template>
  <section class="drawing-bom-preview" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-else>
      <p>本次图库 BOM 共 {{ state.totalCount || 0 }} 条明细，包含已保存的财务修正。数量取图库原文或财务修正，自制、采购等属性取料品档案。</p>
      <p v-if="state.bomComposed">实际参与计价的物料和用量请查看计价 BOM。被 U9 下级替换或被核算规则排除的图库行在这里保留，可点击节点查看处理原因。</p>
      <div class="drawing-toolbar">
        <el-button type="primary" plain @click="openResolution()">查看并确认物料匹配</el-button>
        <div>
          <el-button size="small" :disabled="!tree.length" @click="setExpanded(true)">展开全部</el-button>
          <el-button size="small" :disabled="!tree.length" @click="setExpanded(false)">收起全部</el-button>
        </div>
      </div>
      <div class="drawing-tree-panel">
        <el-tree ref="treeRef" class="drawing-tree" :data="tree" node-key="sourceSequence"
          :props="treeProps" :indent="0" default-expand-all highlight-current
          :expand-on-click-node="false" aria-label="图库 BOM" @node-click="openDetail">
          <template #default="{ data }">
            <div class="drawing-node" :class="{ 'product-root': data.isProductRoot, 'parent-node': data.children.length }">
              <span class="node-code" :title="data.isProductRoot || data.resolvedMaterialCode ? '料号' : '电子图库图号'">{{ data.isProductRoot ? productIdentity(data) : (data.resolvedMaterialCode || data.drawingCode || '未匹配料号') }}</span>
              <span class="node-name">{{ data.isProductRoot ? data.productName : data.sourceName }}</span>
              <span v-if="inlineDrawingNo(data)" class="node-drawing-no">图号：{{ inlineDrawingNo(data) }}</span>
              <span v-if="data.quantityUnit && data.resolvedMaterialSpec" class="node-drawing-no">{{ data.resolvedMaterialSpec }}</span>
              <span v-if="!data.isProductRoot && data.quantity != null" class="node-qty"
                :title="`${data.quantityUnit ? '财务修正用量' : '电子图库数量'}（相对父项）：${data.quantity}`">× {{ data.quantity }} {{ data.quantityUnit || '' }}</span>
              <el-tag v-if="data.quantityUnit" class="finance-correction-tag" type="warning" size="small">财务修正</el-tag>
              <el-tag v-if="data.processingState === 'EXCLUDED'" type="info" size="small" :title="data.processingMessage">未采用此图库行</el-tag>
              <el-tag v-if="!data.isProductRoot && data.resolvedMaterialNature" class="material-nature-tag"
                :type="materialNatureInfo(data.resolvedMaterialNature).type" size="small"
                :title="`料品档案属性：${data.resolvedMaterialNature}`">
                {{ materialNatureInfo(data.resolvedMaterialNature).label }}
              </el-tag>
              <el-tag v-if="data.requiresAction" class="pending-material-tag" type="warning" size="small">待确认料号</el-tag>
              <span v-if="data.children.length" class="node-child-count">{{ data.children.length }} 个子项</span>
              <el-button v-if="!data.isProductRoot && data.canModify"
                v-hasPermi="['ingest:quote:cost-run:execute']" link type="primary" size="small"
                @click.stop="openResolution(data.sourceNodeId)">
                {{ data.resolvedMaterialCode ? '修正 BOM' : '选择料号 / 拆分' }}
              </el-button>
            </div>
          </template>
        </el-tree>
      </div>
    </template>
    <el-drawer v-model="detailVisible" title="图库 BOM 节点详情" size="min(520px, 100%)" append-to-body>
      <el-descriptions v-if="selectedNode" :column="1" border>
        <template v-if="selectedNode.isProductRoot">
          <el-descriptions-item label="产品料号">{{ selectedNode.materialNo || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">{{ selectedNode.productName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="三花型号">{{ selectedNode.sunlModel || '—' }}</el-descriptions-item>
          <el-descriptions-item label="客户图号">{{ selectedNode.customerDrawing || '—' }}</el-descriptions-item>
          <el-descriptions-item label="电子图库图号">{{ state.electronicDrawingNo || '—' }}</el-descriptions-item>
        </template>
        <template v-else>
          <el-descriptions-item label="图库物料">{{ selectedNode.sourceName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="图号">{{ selectedNode.drawingCode || '—' }}</el-descriptions-item>
          <el-descriptions-item :label="selectedNode.quantityUnit ? '修正用量（相对父项）' : '图库数量（相对父项）'">{{ selectedNode.quantity ?? '—' }} {{ selectedNode.quantityUnit || '' }}</el-descriptions-item>
          <el-descriptions-item label="已匹配料号">{{ selectedNode.resolvedMaterialCode || '—' }}</el-descriptions-item>
          <el-descriptions-item label="已匹配物料">{{ selectedNode.resolvedMaterialName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="料品档案属性">{{ materialNatureInfo(selectedNode.resolvedMaterialNature).label }}</el-descriptions-item>
          <el-descriptions-item label="当前处理情况">{{ selectedNode.processingMessage || (selectedNode.requiresAction ? '待确认料号' : '—') }}</el-descriptions-item>
        </template>
      </el-descriptions>
      <el-button v-if="selectedNode?.canModify" v-hasPermi="['ingest:quote:cost-run:execute']"
        class="detail-action" type="primary" @click="openResolution(selectedNode.sourceNodeId)">
        修正料号、用量或拆分材料
      </el-button>
    </el-drawer>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchElectronicDrawingMaterialResolution } from '../../api/quoteRequests'
import { buildDrawingSourceTree } from '../../utils/electronicDrawingMaterialResolution'
const props = defineProps({ oaNo: String, itemId: [String, Number], product: Object, month: String, revision: String })
const router = useRouter()
const state = ref({}), loading = ref(false), error = ref('')
const treeRef = ref(null), selectedNode = ref(null), detailVisible = ref(false)
const treeProps = { children: 'children', label: row => row.isProductRoot ? productIdentity(row) : row.sourceName }
let generation = 0
const tree = computed(() => buildDrawingSourceTree(state.value.items, props.product))
watch(() => [props.itemId, props.month, props.revision], async () => {
  const current = ++generation
  loading.value = true; error.value = ''; state.value = {}; detailVisible.value = false; selectedNode.value = null
  try {
    const result = await fetchElectronicDrawingMaterialResolution(props.itemId, props.month)
    if (current === generation) state.value = result || {}
  } catch (failure) {
    if (current === generation) error.value = failure?.message || '读取图库 BOM 失败，请刷新重试'
  } finally { if (current === generation) loading.value = false }
}, { immediate: true })
function productIdentity(product) {
  return product.materialNo || product.sunlModel || product.customerDrawing || '报价产品'
}
function inlineDrawingNo(node) {
  if (node.isProductRoot) return state.value.electronicDrawingNo
  return node.resolvedMaterialCode && node.drawingCode !== '/' ? node.drawingCode : ''
}
function materialNatureInfo(nature) {
  if (nature === '制造件' || nature === '自制件') return { label: '自制件', type: 'primary' }
  if (nature === '采购件') return { label: nature, type: 'success' }
  if (nature === '委外加工件') return { label: nature, type: 'warning' }
  return { label: nature || '未获取', type: 'info' }
}
function setExpanded(expanded) {
  function visit(rows) {
    for (const row of rows) {
      const node = treeRef.value?.getNode(row.sourceSequence)
      if (node) node.expanded = expanded
      visit(row.children)
    }
  }
  visit(tree.value)
}
function openDetail(node) {
  selectedNode.value = node
  detailVisible.value = true
}
function openResolution(sourceNodeId) {
  router.push({ name: 'electronic-drawing-material-resolution',
    params: { oaNo: props.oaNo, itemId: props.itemId, taskId: props.itemId },
    query: { accountingMonth: props.month, returnTo: 'costing', ...(sourceNodeId ? { sourceNodeId } : {}) } })
}
</script>

<style scoped>
.drawing-bom-preview p { color: #667085; line-height: 1.6; }
.drawing-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.drawing-tree-panel { max-height: calc(100vh - 360px); min-height: 240px; overflow: auto; padding: 12px; border: 1px solid #e4e9f1; border-radius: 8px; background: #fff; }
.drawing-node { display: flex; align-items: center; gap: 8px; padding: 5px 6px; line-height: 1.4; border-radius: 6px; }
.drawing-tree :deep(.el-tree-node__content) { height: auto; min-height: 32px; width: max-content; min-width: 100%; align-items: flex-start; box-sizing: border-box; padding-right: 10px; border-radius: 6px; }
.drawing-tree :deep(.el-tree-node__expand-icon) { flex-shrink: 0; margin-top: 8px; color: #8290a3; }
.drawing-tree :deep(.el-tree-node__children) { overflow: visible; margin-left: 11px; padding-left: 17px; border-left: 1px solid #d8e1ec; }
.drawing-tree :deep(.el-tree-node__children > .el-tree-node) { position: relative; }
.drawing-tree :deep(.el-tree-node__children > .el-tree-node::before) { position: absolute; z-index: 1; top: 16px; left: -17px; width: 15px; border-top: 1px solid #d8e1ec; content: ''; }
.drawing-tree :deep(.el-tree-node__children > .el-tree-node:last-child::after) { position: absolute; z-index: 0; top: 17px; bottom: 0; left: -18px; width: 2px; background: #fff; content: ''; }
.product-root { margin-bottom: 5px; padding: 7px 10px; border: 1px solid #dbe8f7; border-left: 3px solid #4d8fd8; border-radius: 7px; background: #f5f9fe; }
.node-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #303133; }
.node-name { font-size: 13px; color: #606266; }
.node-drawing-no { color: #667085; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.parent-node .node-code, .parent-node .node-name { color: #26364a; font-weight: 600; }
.node-qty { font-size: 12px; color: #909399; }
.material-nature-tag { height: 22px; padding: 0 8px; border: 0; border-radius: 5px; font-weight: 500; }
.node-child-count { color: #8a97a8; font-size: 11px; }
.detail-action { margin-top: 16px; }
</style>
