<template>
  <el-drawer
    :model-value="visible"
    title="查看导入依据"
    size="860px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="basis-drawer">
      <el-alert
        v-if="loadError"
        type="error"
        :closable="false"
        :title="loadError"
      />

      <el-alert
        v-else-if="loaded && !basis.available"
        type="info"
        :closable="false"
        :title="basis.emptyMessage"
      />

      <template v-else-if="basis.available">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="物料">
            {{ basis.materialCode || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="供应商">
            {{ basis.supplierCode || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="来源文件">
            {{ basis.sourceFileName }}
          </el-descriptions-item>
          <el-descriptions-item label="导入批次">
            {{ basis.sourceBatchText }}
          </el-descriptions-item>
          <el-descriptions-item label="来源位置" :span="2">
            {{ basis.sourceLocation }}
          </el-descriptions-item>
          <el-descriptions-item label="版本生效">
            {{ basis.effectiveFrom || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="版本失效">
            {{ basis.effectiveTo || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <section class="basis-section">
          <div class="basis-title">公式转换</div>
          <div class="formula-box">
            <span>Excel 原始公式</span>
            <code>{{ basis.sourceFormula }}</code>
          </div>
          <div class="formula-box">
            <span>系统公式</span>
            <code>{{ basis.systemFormula }}</code>
          </div>
        </section>

        <section class="basis-section">
          <div class="basis-title">原始输入字段、单元格和值</div>
          <el-table :data="basis.inputCells" size="small" border>
            <el-table-column prop="header" label="字段" min-width="150" />
            <el-table-column prop="sheetName" label="Sheet" min-width="130" />
            <el-table-column prop="cellRef" label="单元格" width="90" />
            <el-table-column prop="displayValue" label="原值" min-width="130" />
            <el-table-column prop="calculationValue" label="计算采用值" min-width="120" />
            <el-table-column label="处理" min-width="120">
              <template #default="{ row: item }">
                <el-tag
                  v-if="item.blankDefaultedToZero"
                  type="warning"
                  size="small"
                >
                  空白按 0
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="unit" label="单位" width="100" />
          </el-table>
        </section>

        <section class="basis-section">
          <div class="basis-title">影响因素绑定</div>
          <el-table :data="basis.factorBindings" size="small" border>
            <el-table-column prop="originalName" label="Excel 原名称" min-width="150" />
            <el-table-column prop="rawReference" label="原引用" min-width="130" />
            <el-table-column prop="factorIdentityId" label="统一身份 ID" width="120" />
            <el-table-column prop="factorMonthlyPriceId" label="月价 ID" width="110" />
            <el-table-column prop="importedPrice" label="导入价格" width="110" />
            <el-table-column prop="systemVariable" label="系统变量" min-width="170" />
          </el-table>
        </section>

        <section class="basis-section">
          <div class="basis-title">税转换与价格差异</div>
          <el-descriptions :column="3" border class="tax-basis">
            <el-descriptions-item label="Excel 是否含税">
              {{ taxIncludedText(basis.taxBasis?.originalTaxIncluded) }}
            </el-descriptions-item>
            <el-descriptions-item label="系统是否含税">
              {{ taxIncludedText(basis.taxBasis?.normalizedTaxIncluded ?? basis.taxIncluded) }}
            </el-descriptions-item>
            <el-descriptions-item label="最终税处理">
              {{ taxExecutionText(basis) }}
            </el-descriptions-item>
          </el-descriptions>
          <el-table :data="differenceRows" size="small" border>
            <el-table-column prop="priceType" label="口径" width="100" />
            <el-table-column prop="excelPrice" label="Excel 结果" min-width="120" />
            <el-table-column prop="systemPrice" label="系统结果" min-width="120" />
            <el-table-column prop="absoluteDifference" label="差异" min-width="110" />
            <el-table-column prop="tolerance" label="允许误差" min-width="110" />
            <el-table-column label="校验" width="90">
              <template #default="{ row: item }">
                <el-tag
                  v-if="item.passed !== null"
                  :type="item.passed ? 'success' : 'danger'"
                  size="small"
                >
                  {{ item.passed ? '通过' : '超差' }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </template>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchLinkedImportBasis } from '../api/priceLinkedItems'
import {
  buildImportBasisDifferenceRows,
  normalizeImportBasis,
  taxExecutionText,
  taxIncludedText,
} from './priceLinkedImportBasisUtils'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  row: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible'])
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const basis = ref(normalizeImportBasis())
const requestToken = ref(0)

const differenceRows = computed(() =>
  buildImportBasisDifferenceRows(basis.value),
)

const loadBasis = async () => {
  const linkedItemId = props.row?.id
  const token = ++requestToken.value
  loaded.value = false
  loadError.value = ''
  basis.value = normalizeImportBasis()
  if (!linkedItemId) {
    loadError.value = '该联动价缺少记录 ID，无法查看导入依据'
    loaded.value = true
    return
  }
  loading.value = true
  try {
    const response = await fetchLinkedImportBasis(linkedItemId)
    if (token !== requestToken.value) return
    basis.value = normalizeImportBasis(response || {})
  } catch (error) {
    if (token !== requestToken.value) return
    loadError.value = error?.message || '获取导入依据失败'
    ElMessage.error(loadError.value)
  } finally {
    if (token === requestToken.value) {
      loading.value = false
      loaded.value = true
    }
  }
}

watch(
  () => [props.visible, props.row?.id],
  ([visible]) => {
    if (visible) {
      loadBasis()
    } else {
      requestToken.value += 1
      loading.value = false
    }
  },
)
</script>

<style scoped>
.basis-drawer {
  min-height: 240px;
}

.basis-section {
  margin-top: 20px;
}

.basis-title {
  margin-bottom: 10px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.formula-box {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.formula-box span {
  color: #6b7280;
}

.formula-box code {
  color: #111827;
  font-family: 'SFMono-Regular', Menlo, monospace;
  overflow-wrap: anywhere;
}

.tax-basis {
  margin-bottom: 10px;
}
</style>
