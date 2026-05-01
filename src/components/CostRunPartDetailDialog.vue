<template>
  <!-- T13：试算明细弹窗。轻量预览部品 4 列 + 缺价红字；与整页 CostRunDetailPage 并存。 -->
  <el-dialog
    v-model="visible"
    :title="title"
    width="1100px"
    top="6vh"
    destroy-on-close
    @closed="onClosed"
  >
    <div v-loading="loading">
      <div class="meta-row">
        <span><b>OA：</b>{{ oaNo }}</span>
        <span class="select-line" v-if="productOptions.length > 1">
          <b>产品：</b>
          <el-select v-model="selectedProduct" size="small" style="width: 220px" @change="load">
            <el-option v-for="p in productOptions" :key="p" :label="p" :value="p" />
          </el-select>
        </span>
        <span v-else-if="selectedProduct"><b>产品：</b>{{ selectedProduct }}</span>
        <span v-if="hasData"><b>部品行数：</b>{{ partItems.length }}</span>
        <span v-if="hasData"><b>不含税总成本：</b>{{ formatTotal(detail.total) }}</span>
      </div>

      <el-tabs v-if="hasData" v-model="activeTab">
        <el-tab-pane :label="`部品取价 (${partItems.length})`" name="parts">
          <el-table
            :data="partItems"
            :row-class-name="rowClass"
            stripe
            border
            size="small"
            max-height="520"
          >
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="partName" label="部品名" min-width="140" show-overflow-tooltip />
            <el-table-column prop="partCode" label="部品料号" min-width="130" />
            <el-table-column prop="costElement" label="成本要素" min-width="160" show-overflow-tooltip />
            <el-table-column prop="partQty" label="用量" min-width="80" align="right" />
            <el-table-column label="部品单价" min-width="110" align="right">
              <template #default="{ row }">{{ formatNumber(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="部品价格" min-width="110" align="right">
              <template #default="{ row }">{{ formatNumber(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="价格来源" min-width="110">
              <template #default="{ row }">
                <el-tag v-if="row.priceSource === 'NO_ROUTE'" type="danger" size="small">NO_ROUTE</el-tag>
                <el-tag v-else-if="row.priceSource === 'ERROR'" type="danger" size="small">ERROR</el-tag>
                <span v-else>{{ row.priceSource || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注 / 缺价原因" min-width="280" show-overflow-tooltip />
          </el-table>
          <div class="legend">
            <span class="legend-item miss-bg"></span>红色行 = 缺路由 (NO_ROUTE) 或 路由有但价表无 (ERROR)
          </div>
        </el-tab-pane>

        <!-- T14：费用汇总 tab。展示 14+N 项费用要素，缺率行红字。 -->
        <el-tab-pane :label="`费用汇总 (${costItems.length})`" name="costs">
          <el-table
            :data="costItems"
            :row-class-name="costRowClass"
            stripe
            border
            size="small"
            max-height="520"
          >
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="costCode" label="费用编码" min-width="160" />
            <el-table-column prop="costName" label="费用项" min-width="140" show-overflow-tooltip />
            <el-table-column label="基数 baseAmount" min-width="130" align="right">
              <template #default="{ row }">{{ formatNumber(row.baseAmount) }}</template>
            </el-table-column>
            <el-table-column label="费率 rate" min-width="110" align="right">
              <template #default="{ row }">{{ formatRate(row.rate) }}</template>
            </el-table-column>
            <el-table-column label="金额 amount" min-width="130" align="right">
              <template #default="{ row }">
                <span :class="{ 'is-total': row.costCode === 'TOTAL' }">
                  {{ formatNumber(row.amount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注 / 缺率原因" min-width="320" show-overflow-tooltip />
          </el-table>
          <div class="legend">
            <span class="legend-item miss-bg"></span>红色行 = 缺率（remark 非空 + amount=NULL，配置缺失或事业部多/无人工）
          </div>
        </el-tab-pane>
      </el-tabs>

      <el-empty v-else-if="!loading" description="暂无明细数据" />
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchCostRunDetail } from '../api/costRunDetail'
import { fetchOaFormDetail } from '../api/oaForms'

// T13：弹窗 props 和 v-model:visible 用法保持轻量
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  oaNo: { type: String, default: '' },
  productCode: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const loading = ref(false)
const detail = ref({})
const activeTab = ref('parts')
// T13：OA 可多产品；productCode 没传时自动拉 OA 详情拿可选项
const productOptions = ref([])
const selectedProduct = ref('')

const partItems = computed(() => detail.value?.partItems || [])
const costItems = computed(() => detail.value?.costItems || [])
const hasData = computed(() => partItems.value.length > 0 || costItems.value.length > 0)

const title = computed(() => `试算明细 - ${props.oaNo || ''}`)

// T13：NO_ROUTE / ERROR 整行红色背景，便于一眼锁定缺价行
const rowClass = ({ row }) => {
  const src = row?.priceSource
  return src === 'NO_ROUTE' || src === 'ERROR' ? 'row-miss' : ''
}

// T14：费用要素行染色规则
//   - 缺率行（remark 非空且 amount=null）→ 红字，提示缺配置
//   - TOTAL 行 → 加粗金黄背景，强调总成本
const costRowClass = ({ row }) => {
  if (row?.costCode === 'TOTAL') return 'row-total'
  if (row?.remark && (row.amount === null || row.amount === undefined)) return 'row-miss'
  return ''
}

const formatNumber = (v) => {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(6) : v
}

// T14：rate 显示百分比，方便业务一眼看出"3.5%"而不是"0.035000"
const formatRate = (v) => {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  // rate 通常是 0-1 区间小数；调整后制造成本系数可能是 1.0+，直接也按百分比展示
  return (n * 100).toFixed(2) + '%'
}

const formatTotal = (v) => {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : v
}

const load = async () => {
  if (!props.oaNo || !selectedProduct.value) return
  loading.value = true
  try {
    detail.value = (await fetchCostRunDetail(props.oaNo, selectedProduct.value)) || {}
  } catch (e) {
    detail.value = {}
    ElMessage.error(e?.message || '获取试算明细失败')
  } finally {
    loading.value = false
  }
}

// T13：弹窗打开时先解析可选产品列表，再触发 detail 加载
const initOpen = async () => {
  detail.value = {}
  if (!props.oaNo) return
  // 优先用调用方显式传入的 productCode；否则从 OA 详情拿
  if (props.productCode) {
    productOptions.value = [props.productCode]
    selectedProduct.value = props.productCode
    await load()
    return
  }
  loading.value = true
  try {
    const oaForm = (await fetchOaFormDetail(props.oaNo)) || {}
    const items = Array.isArray(oaForm.items) ? oaForm.items : []
    const codes = Array.from(
      new Set(items.map((it) => it?.materialNo).filter((v) => !!v))
    )
    productOptions.value = codes
    selectedProduct.value = codes[0] || ''
    if (selectedProduct.value) {
      await load()
    } else {
      ElMessage.warning('该 OA 无产品料号，无法查询明细')
    }
  } catch (e) {
    ElMessage.error(e?.message || '获取 OA 产品列表失败')
  } finally {
    loading.value = false
  }
}

const onClosed = () => {
  detail.value = {}
  productOptions.value = []
  selectedProduct.value = ''
}

// T13：弹窗打开时重新拉，避免上次缓存覆盖
watch(visible, (v) => {
  if (v) initOpen()
})
</script>

<style scoped>
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 13px;
  color: #303133;
  padding: 0 4px 12px 4px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}
.legend {
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend-item {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid #dcdfe6;
}
.miss-bg {
  background: #fde2e2;
}
:deep(.row-miss) td {
  background: #fde2e2 !important;
  color: #c0392b;
}
:deep(.row-miss):hover td {
  background: #fbcdcd !important;
}
/* T14：TOTAL 行加粗金黄背景，强调总成本 */
:deep(.row-total) td {
  background: #fff7e6 !important;
  font-weight: 600;
  color: #ad6800;
}
:deep(.row-total):hover td {
  background: #ffedd1 !important;
}
.is-total {
  font-weight: 700;
  color: #ad6800;
  font-size: 14px;
}
</style>
