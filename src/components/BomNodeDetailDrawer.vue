<template>
  <!-- BOM 树节点详情抽屉 —— 点击 el-tree 某节点后右侧展示完整字段
       后端 DTO: BomHierarchyTreeDto（见 dto/BomHierarchyTreeDto.java） -->
  <el-drawer
    v-model="visible"
    direction="rtl"
    size="420px"
    :title="node ? `节点详情 · ${node.materialCode}` : '节点详情'"
    :with-header="true"
    :destroy-on-close="false"
  >
    <div v-if="!node" class="empty-tip">未选中节点</div>
    <div v-else class="node-detail">
      <!-- 业务标记 —— 方便一眼判断是否接管/部品联动/结算行 -->
      <div class="tag-row">
        <el-tag v-if="node.isLeaf === 1" type="success" size="small">叶子节点</el-tag>
        <el-tag v-else type="info" size="small">中间节点</el-tag>
        <el-tag v-if="node.shapeAttr === '部品联动'" type="warning" size="small">
          部品联动
        </el-tag>
        <el-tag v-if="isTakeover(node)" type="warning" size="small">接管</el-tag>
      </div>

      <el-descriptions
        :column="1"
        size="small"
        border
        class="detail-desc"
      >
        <el-descriptions-item label="料号">
          <code>{{ node.materialCode || '-' }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="品名">
          {{ node.materialName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="规格">
          {{ node.materialSpec || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="层级">
          {{ node.level ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="路径">
          <code class="path-code">{{ node.path || '-' }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="单件用量（相对父）">
          {{ formatNum(node.qtyPerParent) }}
        </el-descriptions-item>
        <el-descriptions-item label="累计用量（至顶层）">
          {{ formatNum(node.qtyPerTop) }}
        </el-descriptions-item>
        <el-descriptions-item label="形态属性">
          {{ node.shapeAttr || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="生产类别">
          {{ node.sourceCategory || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="BOM 目的">
          {{ node.bomPurpose || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="BOM 版本">
          {{ node.bomVersion || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="生效期">
          {{ node.effectiveFrom || '-' }} ~ {{ node.effectiveTo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="子节点数">
          {{ (node.children || []).length }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-drawer>
</template>

<script setup>
// BomNodeDetailDrawer —— 通过 v-model 控制开关；node 为 null 时展示空态
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  node: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

/** 接管识别 —— 品名含"接管"（与后端 seed rule NAME_LIKE=接管 同口径），仅做视觉提示 */
function isTakeover(node) {
  const name = node?.materialName || ''
  return name.includes('接管')
}

/** qty 展示：原样保留精度，NULL 返 "-" */
function formatNum(val) {
  if (val === null || val === undefined || val === '') return '-'
  return String(val)
}
</script>

<style scoped>
.empty-tip {
  padding: 20px;
  text-align: center;
  color: #909399;
}
.node-detail {
  padding: 0 4px;
}
.tag-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.detail-desc :deep(.el-descriptions__label) {
  width: 130px;
}
.path-code {
  word-break: break-all;
  font-size: 12px;
  color: #606266;
}
</style>
