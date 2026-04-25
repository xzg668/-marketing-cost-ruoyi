<template>
  <!-- BOM 层级树查看页（T6）
       按顶层产品码查嵌套树；支持切"版本日期"看历史版本；节点点击抽屉看完整字段 -->
  <div class="base-page">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div>
          <div class="page-title">BOM 层级树查看</div>
          <div class="page-subtitle">
            按顶层产品展开多层树，可按"版本日期"复现历史版本（留空 = 今天）。
            接管 / 部品联动 等业务属性通过节点色彩与标签高亮。
          </div>
        </div>
      </div>

      <el-form :inline="true" class="query-form">
        <el-form-item label="顶层料号" required>
          <el-input
            v-model="query.topProductCode"
            placeholder="例：1079900000536"
            style="width: 240px"
            clearable
            @keyup.enter="loadTree"
          />
        </el-form-item>
        <el-form-item label="BOM 目的">
          <el-select
            v-model="query.bomPurpose"
            placeholder="（空=默认）"
            clearable
            style="width: 140px"
          >
            <el-option label="主制造" value="主制造" />
            <el-option label="普机" value="普机" />
            <el-option label="精益" value="精益" />
          </el-select>
        </el-form-item>
        <el-tooltip
          content="按哪个时间点生效的 BOM 版本查看；留空 = 今天"
          placement="top"
        >
          <el-form-item label="版本日期">
            <el-date-picker
              v-model="query.asOfDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="（空=今天）"
              style="width: 180px"
              clearable
            />
          </el-form-item>
        </el-tooltip>
        <el-form-item label="源类型">
          <el-select v-model="query.sourceType" style="width: 120px">
            <el-option label="U9" value="U9" />
            <el-option label="手工录入" value="MANUAL" />
            <el-option label="电子图库" value="E_DRAWING" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!query.topProductCode"
            @click="loadTree"
          >
            查询
          </el-button>
          <el-button @click="expandAll">展开全部</el-button>
          <el-button @click="collapseAll">折叠全部</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="tree-card">
      <div v-if="!tree && !loading" class="empty-tip">
        请输入顶层料号并点"查询"
      </div>
      <div
        v-else-if="empty"
        class="empty-tip"
      >
        该版本日期下查不到 BOM —— 请确认该日期是否在某个有效 BOM 版本的生效期内
      </div>
      <el-tree
        v-else
        ref="treeRef"
        :data="treeData"
        :props="treeProps"
        node-key="path"
        :default-expand-all="false"
        :expand-on-click-node="false"
        @node-click="onNodeClick"
        v-loading="loading"
      >
        <template #default="{ node, data }">
          <span class="tree-node">
            <!-- 节点主体：料号 + 品名 + 用量 + 形态标签 -->
            <span class="node-code">{{ data.materialCode }}</span>
            <span class="node-name">{{ data.materialName || '' }}</span>
            <span v-if="data.qtyPerParent" class="node-qty">
              × {{ data.qtyPerParent }}
            </span>
            <el-tag
              v-if="data.shapeAttr === '部品联动'"
              size="small"
              type="warning"
              effect="plain"
            >部品联动</el-tag>
            <el-tag
              v-if="isTakeover(data)"
              size="small"
              type="warning"
            >接管</el-tag>
            <el-tag
              v-if="data.isLeaf === 1"
              size="small"
              type="success"
              effect="plain"
            >叶子</el-tag>
          </span>
        </template>
      </el-tree>
    </el-card>

    <BomNodeDetailDrawer v-model="drawerVisible" :node="selectedNode" />
  </div>
</template>

<script setup>
// BomTreeViewerPage —— 一次性全量加载一棵树（后端已做 purpose/asOfDate 过滤）
// 后续若大树性能问题严重，可改 lazy + 按需拉子节点；目前先走全量方便调试。
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BomNodeDetailDrawer from '../components/BomNodeDetailDrawer.vue'
import { getBomHierarchy } from '../api/bom'

const query = reactive({
  topProductCode: '',
  bomPurpose: '',
  asOfDate: '',
  sourceType: 'U9',
})

const loading = ref(false)
const tree = ref(null)
const treeRef = ref(null)

const drawerVisible = ref(false)
const selectedNode = ref(null)

const treeProps = {
  label: 'materialCode',
  children: 'children',
}

const treeData = computed(() => (tree.value ? [tree.value] : []))
const empty = computed(() => tree.value && !tree.value.materialCode)

async function loadTree() {
  if (!query.topProductCode) {
    ElMessage.warning('请输入顶层料号')
    return
  }
  loading.value = true
  try {
    const data = await getBomHierarchy(query.topProductCode.trim(), {
      bomPurpose: query.bomPurpose || null,
      asOfDate: query.asOfDate || null,
      sourceType: query.sourceType,
    })
    tree.value = data
  } catch (error) {
    tree.value = null
    ElMessage.error(error?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

function onNodeClick(node) {
  selectedNode.value = node
  drawerVisible.value = true
}

/** 品名含"接管"视为接管节点（与后端 seed rule NAME_LIKE=接管 同口径） */
function isTakeover(data) {
  return (data?.materialName || '').includes('接管')
}

/** 递归遍历整棵树收集所有 path，交给 el-tree 一次性展开/折叠 */
function visitPaths(node, out) {
  if (!node) return
  if (node.path) out.push(node.path)
  ;(node.children || []).forEach((c) => visitPaths(c, out))
}

function expandAll() {
  if (!tree.value || !treeRef.value) return
  const paths = []
  visitPaths(tree.value, paths)
  paths.forEach((p) => {
    const nd = treeRef.value.getNode(p)
    if (nd) nd.expanded = true
  })
}

function collapseAll() {
  if (!tree.value || !treeRef.value) return
  const paths = []
  visitPaths(tree.value, paths)
  paths.forEach((p) => {
    const nd = treeRef.value.getNode(p)
    if (nd) nd.expanded = false
  })
}
</script>

<style scoped>
.base-page {
  padding: 16px;
}
.header-card {
  margin-bottom: 16px;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.page-subtitle {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  max-width: 640px;
}
.query-form {
  margin-top: 16px;
}
.tree-card :deep(.el-card__body) {
  min-height: 400px;
  max-height: calc(100vh - 260px);
  overflow: auto;
}
.empty-tip {
  color: #909399;
  text-align: center;
  padding: 40px 0;
}
.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.node-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  color: #303133;
}
.node-name {
  font-size: 13px;
  color: #606266;
}
.node-qty {
  font-size: 12px;
  color: #909399;
}
</style>
