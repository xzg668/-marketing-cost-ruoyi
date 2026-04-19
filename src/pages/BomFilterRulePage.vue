<template>
  <div class="bom-filter-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">BOM明细过滤规则</div>
        <div class="filter-actions">
          <el-button type="primary" @click="applyRule">预览</el-button>
          <el-button @click="resetRule">重置</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px" class="rule-form">
        <el-form-item label="BOM编码">
          <el-select v-model="form.bomCode" placeholder="选择BOM">
            <el-option label="全部" value="" />
            <el-option v-for="code in bomOptions" :key="code" :label="code" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="过滤规则">
          <el-radio-group v-model="form.rule">
            <el-radio-button label="A">规则A</el-radio-button>
            <el-radio-button label="B">规则B</el-radio-button>
            <el-radio-button label="C">规则C</el-radio-button>
            <el-radio-button label="D">规则D</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="showShapeAttr" label="形态属性">
          <el-select v-model="form.shapeAttr" placeholder="全部">
            <el-option label="全部" value="" />
            <el-option label="制造件" value="制造件" />
            <el-option label="采购件" value="采购件" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="showLevel" label="层级范围">
          <el-input-number v-model="form.levelFrom" :min="1" />
          <span class="range-sep">至</span>
          <el-input-number v-model="form.levelTo" :min="1" />
        </el-form-item>
        <el-form-item label="父子展示">
          <el-switch v-model="form.includeParents" active-text="展示父件链" />
        </el-form-item>
      </el-form>
    </el-card>

    <div class="summary-grid">
      <el-card shadow="never" class="summary-card">
        <div class="summary-title">规则说明</div>
        <div class="summary-content">
          <div class="summary-row">
            <span class="summary-label">当前规则</span>
            <span class="summary-value">{{ currentRule.label }}</span>
            <el-tag size="small" type="info">{{ currentRule.title }}</el-tag>
          </div>
          <div class="summary-row">
            <span class="summary-label">规则描述</span>
            <span class="summary-value">{{ currentRule.desc }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">形态属性</span>
            <span class="summary-value">
              {{ showShapeAttr ? (applied.shapeAttr || '全部') : '不限制' }}
            </span>
          </div>
          <div class="summary-row">
            <span class="summary-label">层级范围</span>
            <span class="summary-value">
              {{ showLevel ? levelRangeText : '不限制' }}
            </span>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="summary-card stats-card">
        <div class="summary-title">规则影响</div>
        <div class="stats-content">
          <div class="stat-item">
            <div class="stat-label">BOM料件总数</div>
            <div class="stat-value">{{ stats.total }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">叶子节点数</div>
            <div class="stat-value">{{ stats.leaf }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">规则筛选数</div>
            <div class="stat-value">{{ stats.filtered }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">含父件后数量</div>
            <div class="stat-value">{{ stats.included }}</div>
          </div>
        </div>
      </el-card>
    </div>

    <el-card shadow="never">
      <div class="result-header">
        <div class="result-title">过滤结果预览</div>
        <div class="result-meta">
          <el-tag size="small" type="success">共 {{ total }} 条</el-tag>
        </div>
      </div>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="列表视图" name="list">
          <el-table :data="pagedRows" stripe v-loading="loading">
            <el-table-column prop="bomCode" label="BOM编码" width="120" />
            <el-table-column prop="itemCode" label="料号" width="160" />
            <el-table-column prop="itemName" label="名称" min-width="160" />
            <el-table-column prop="itemSpec" label="规格" min-width="160" />
            <el-table-column prop="itemModel" label="型号" min-width="160" />
            <el-table-column prop="bomLevel" label="层级" width="90" />
            <el-table-column prop="parentCode" label="父件" width="160" />
            <el-table-column prop="shapeAttr" label="形态属性" width="100" />
            <template #empty>
              <el-empty description="暂无可预览的数据" />
            </template>
          </el-table>
          <BasePagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
          />
        </el-tab-pane>
        <el-tab-pane label="结构视图" name="tree">
          <el-table
            :data="treeRows"
            row-key="rowKey"
            :tree-props="{ children: 'children' }"
            stripe
          >
            <el-table-column prop="itemCode" label="料号" width="160" />
            <el-table-column prop="itemName" label="名称" min-width="160" />
            <el-table-column prop="itemSpec" label="规格" min-width="160" />
            <el-table-column prop="itemModel" label="型号" min-width="160" />
            <el-table-column prop="bomLevel" label="层级" width="90" />
            <el-table-column prop="shapeAttr" label="形态属性" width="100" />
            <template #empty>
              <el-empty description="暂无可预览的数据" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BasePagination from '../components/BasePagination.vue'

const ruleOptions = [
  {
    value: 'A',
    label: '规则A',
    title: '仅叶子节点',
    desc: '只保留末级料件，避免父子重复计价。',
  },
  {
    value: 'B',
    label: '规则B',
    title: '叶子节点 + 形态属性',
    desc: '在叶子节点基础上，按形态属性筛选。',
  },
  {
    value: 'C',
    label: '规则C',
    title: '指定层级',
    desc: '仅保留指定层级范围内的料件。',
  },
  {
    value: 'D',
    label: '规则D',
    title: '叶子节点 + 形态属性 + 层级',
    desc: '组合筛选，精确控制筛选范围。',
  },
]

const form = ref({
  bomCode: '',
  rule: 'A',
  shapeAttr: '',
  levelFrom: null,
  levelTo: null,
  includeParents: true,
})

const applied = ref({ ...form.value })

const loading = ref(false)
const applyTimer = ref(null)
const previewRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const activeTab = ref('list')

const sampleRows = [
  {
    id: 1,
    bomCode: 'BOM0001',
    itemCode: '1008900031271',
    itemName: '热力膨胀阀',
    itemSpec: 'RFG-K19060A-3128',
    itemModel: 'RFGK19E-6.0A-3128',
    bomLevel: 1,
    parentCode: '',
    shapeAttr: '制造件',
  },
  {
    id: 2,
    bomCode: 'BOM0001',
    itemCode: '102053856',
    itemName: '热力膨胀阀',
    itemSpec: 'RFG-K19060A-3128',
    itemModel: 'RFGK19E-6.0A-3128',
    bomLevel: 2,
    parentCode: '1008900031271',
    shapeAttr: '制造件',
  },
  {
    id: 3,
    bomCode: 'BOM0001',
    itemCode: '1008000300173',
    itemName: '阀体',
    itemSpec: 'RFG-K04-003424',
    itemModel: 'RFG-K04-003424',
    bomLevel: 3,
    parentCode: '102053856',
    shapeAttr: '制造件',
  },
  {
    id: 4,
    bomCode: 'BOM0001',
    itemCode: '1008000300944',
    itemName: '阀体部件',
    itemSpec: 'RFG-K04-002784',
    itemModel: 'RFG-K04-002784',
    bomLevel: 4,
    parentCode: '1008000300173',
    shapeAttr: '制造件',
  },
  {
    id: 5,
    bomCode: 'BOM0001',
    itemCode: '1008000300950',
    itemName: '调节部件',
    itemSpec: 'RFGN-14003',
    itemModel: 'RFGN-14003',
    bomLevel: 4,
    parentCode: '1008000300173',
    shapeAttr: '采购件',
  },
  {
    id: 6,
    bomCode: 'BOM0001',
    itemCode: '1008000300939',
    itemName: '阀芯部件',
    itemSpec: 'RFGC-23158',
    itemModel: 'RFGC-23158',
    bomLevel: 4,
    parentCode: '1008000300173',
    shapeAttr: '采购件',
  },
  {
    id: 7,
    bomCode: 'BOM0001',
    itemCode: '9990000056820',
    itemName: '端子',
    itemSpec: 'MOLEX 0850-0031',
    itemModel: 'MOLEX 0850-0031',
    bomLevel: 3,
    parentCode: '102053856',
    shapeAttr: '采购件',
  },
  {
    id: 8,
    bomCode: 'BOM0001',
    itemCode: '9830000025884',
    itemName: '包装组件',
    itemSpec: 'BZ-RFGF001_标准大包装',
    itemModel: '',
    bomLevel: 2,
    parentCode: '1008900031271',
    shapeAttr: '制造件',
  },
  {
    id: 9,
    bomCode: 'BOM0001',
    itemCode: '250012748',
    itemName: '瓦楞纸箱',
    itemSpec: 'BZ-RFG-F05001-02_外*425*275*275',
    itemModel: '',
    bomLevel: 3,
    parentCode: '9830000025884',
    shapeAttr: '采购件',
  },
  {
    id: 10,
    bomCode: 'BOM0002',
    itemCode: '200001',
    itemName: '压缩机',
    itemSpec: 'CP-K100',
    itemModel: 'CP-K100',
    bomLevel: 1,
    parentCode: '',
    shapeAttr: '制造件',
  },
  {
    id: 11,
    bomCode: 'BOM0002',
    itemCode: '200002',
    itemName: '壳体组件',
    itemSpec: 'CP-H101',
    itemModel: 'CP-H101',
    bomLevel: 2,
    parentCode: '200001',
    shapeAttr: '制造件',
  },
  {
    id: 12,
    bomCode: 'BOM0002',
    itemCode: '200003',
    itemName: '紧固件',
    itemSpec: 'CP-BOLT',
    itemModel: 'CP-BOLT',
    bomLevel: 2,
    parentCode: '200001',
    shapeAttr: '采购件',
  },
]

const bomOptions = computed(() => {
  const codes = new Set(sampleRows.map((row) => row.bomCode))
  return Array.from(codes)
})

const currentRule = computed(
  () => ruleOptions.find((item) => item.value === applied.value.rule) || ruleOptions[0],
)

const showShapeAttr = computed(() => ['B', 'D'].includes(form.value.rule))
const showLevel = computed(() => ['C', 'D'].includes(form.value.rule))

const levelRangeText = computed(() => {
  const from = applied.value.levelFrom
  const to = applied.value.levelTo
  if (!from && !to) {
    return '不限制'
  }
  if (from && !to) {
    return `>= ${from}`
  }
  if (!from && to) {
    return `<= ${to}`
  }
  return `${from} - ${to}`
})

const buildRowMap = (rows) =>
  new Map(rows.map((row) => [row.itemCode, row]))

const getLeafRows = (rows) => {
  const parentCodes = new Set(rows.map((row) => row.parentCode).filter(Boolean))
  return rows.filter((row) => !parentCodes.has(row.itemCode))
}

const filterRowsByRule = (rows, rule) => {
  let result = rows
  const leafRows = getLeafRows(rows)
  const hasLevel =
    rule.levelFrom !== null ||
    rule.levelTo !== null
  const matchesLevel = (row) => {
    if (!hasLevel) return true
    const level = Number(row.bomLevel || 0)
    if (rule.levelFrom !== null && level < rule.levelFrom) return false
    if (rule.levelTo !== null && level > rule.levelTo) return false
    return true
  }
  const matchesShape = (row) => !rule.shapeAttr || row.shapeAttr === rule.shapeAttr

  switch (rule.rule) {
    case 'A':
      result = leafRows
      break
    case 'B':
      result = leafRows.filter(matchesShape)
      break
    case 'C':
      result = rows.filter(matchesLevel)
      break
    case 'D':
      result = leafRows.filter((row) => matchesShape(row) && matchesLevel(row))
      break
    default:
      result = leafRows
  }
  return result
}

const buildPreviewRows = () => {
  const filtered = applied.value.bomCode
    ? sampleRows.filter((row) => row.bomCode === applied.value.bomCode)
    : sampleRows
  const baseRows = filterRowsByRule(filtered, applied.value)
  const rowMap = buildRowMap(filtered)
  if (!applied.value.includeParents) {
    return {
      baseRows,
      preview: baseRows,
      leafCount: getLeafRows(filtered).length,
      totalCount: filtered.length,
    }
  }
  const includeMap = new Map()
  baseRows.forEach((row) => {
    includeMap.set(row.itemCode, row)
    let current = row
    const visited = new Set([row.itemCode])
    while (current.parentCode) {
      if (visited.has(current.parentCode)) {
        break
      }
      visited.add(current.parentCode)
      const parent = rowMap.get(current.parentCode)
      if (!parent) {
        break
      }
      includeMap.set(parent.itemCode, parent)
      current = parent
    }
  })
  return {
    baseRows,
    preview: Array.from(includeMap.values()),
    leafCount: getLeafRows(filtered).length,
    totalCount: filtered.length,
  }
}

const stats = computed(() => {
  const { baseRows, preview, leafCount, totalCount } = buildPreviewRows()
  return {
    total: totalCount,
    leaf: leafCount,
    filtered: baseRows.length,
    included: preview.length,
  }
})

const buildTreeRows = (rows) => {
  const nodeMap = new Map()
  rows.forEach((row) => {
    nodeMap.set(row.itemCode, {
      ...row,
      rowKey: `${row.bomCode}-${row.itemCode}`,
      children: [],
    })
  })
  const roots = []
  nodeMap.forEach((node) => {
    if (node.parentCode && nodeMap.has(node.parentCode)) {
      nodeMap.get(node.parentCode).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return previewRows.value.slice(start, end)
})

watch(pageSize, () => {
  currentPage.value = 1
})

const applyRule = () => {
  if (applyTimer.value) {
    clearTimeout(applyTimer.value)
  }
  loading.value = true
  applyTimer.value = setTimeout(() => {
    applyTimer.value = null
    applied.value = { ...form.value }
    const { preview } = buildPreviewRows()
    const sorted = [...preview].sort((a, b) => {
      if (a.bomLevel !== b.bomLevel) {
        return a.bomLevel - b.bomLevel
      }
      return String(a.itemCode).localeCompare(String(b.itemCode))
    })
    previewRows.value = sorted
    total.value = sorted.length
    loading.value = false
    currentPage.value = 1
  }, 200)
}

const resetRule = () => {
  form.value = {
    bomCode: '',
    rule: 'A',
    shapeAttr: '',
    levelFrom: null,
    levelTo: null,
    includeParents: true,
  }
  applyRule()
}

const treeRows = computed(() => buildTreeRows(previewRows.value))

applyRule()

onBeforeUnmount(() => {
  if (applyTimer.value) {
    clearTimeout(applyTimer.value)
    applyTimer.value = null
  }
})
</script>

<style scoped>
.bom-filter-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.rule-form :deep(.el-form-item) {
  margin-right: 18px;
}

.range-sep {
  margin: 0 6px;
  color: #6b7280;
}

.summary-card {
  padding: 4px 2px 8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 16px;
}

.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 10px;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #374151;
}

.summary-label {
  width: 80px;
  color: #6b7280;
}

.summary-value {
  flex: 1;
}

.stats-card {
  background: linear-gradient(135deg, #f9fafb 0%, #eef2ff 100%);
  border: 1px solid #e5e7eb;
}

.stats-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid #eef2f7;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-top: 4px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .stats-content {
    grid-template-columns: 1fr;
  }
}
</style>
