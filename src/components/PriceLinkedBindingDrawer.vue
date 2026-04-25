<template>
  <!-- T6：行详情右侧抽屉 —— 展示单个联动行的当前绑定 + 历史 + 新增/编辑/删除 -->
  <el-drawer
    v-model="visibleModel"
    :title="drawerTitle"
    direction="rtl"
    size="640px"
    :destroy-on-close="true"
  >
    <div v-loading="loading" class="binding-drawer">
      <!-- 顶部：物料 + 规格 + 公式，用户定位上下文 -->
      <div v-if="row" class="binding-header">
        <div><span class="binding-label">记录 ID</span>{{ row.id }}</div>
        <div>
          <span class="binding-label">物料</span>{{ row.materialCode || '-' }}
        </div>
        <div>
          <span class="binding-label">规格</span>{{ row.specModel || '-' }}
        </div>
        <div v-if="row.formulaExpr" class="binding-formula">
          <span class="binding-label">公式</span>
          <code>{{ row.formulaExprCn || row.formulaExpr }}</code>
        </div>
      </div>

      <!-- 操作条：新增 + 刷新 -->
      <div class="binding-actions">
        <el-button type="primary" size="small" @click="openCreate">
          新增绑定
        </el-button>
        <el-button size="small" @click="loadBindings">刷新</el-button>
      </div>

      <!-- 当前生效绑定列表 -->
      <el-table
        :data="bindings"
        stripe
        border
        size="small"
        empty-text="暂无绑定（请点击&quot;新增绑定&quot;）"
      >
        <el-table-column prop="tokenName" label="Token" width="140" />
        <el-table-column label="影响因素" min-width="160">
          <template #default="{ row: b }">
            <span class="binding-factor">
              {{ b.factorName || b.factorCode }}
            </span>
            <span class="binding-factor-code">({{ b.factorCode }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="priceSource" label="价源" width="100">
          <template #default="{ row: b }">
            {{ b.priceSource || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110">
          <template #default="{ row: b }">
            <el-tag
              size="small"
              :type="sourceTagType(b.source)"
            >
              {{ sourceLabel(b.source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="effectiveDate"
          label="生效日期"
          width="110"
        />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row: b }">
            <el-button type="primary" link size="small" @click="openEdit(b)">
              编辑
            </el-button>
            <el-button
              type="primary"
              link
              size="small"
              @click="openHistory(b.tokenName)"
            >
              历史
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              @click="removeBinding(b)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 历史时间线面板 —— 折叠在列表下方 -->
      <div v-if="historyTokenName" class="binding-history">
        <div class="binding-history-title">
          历史版本：{{ historyTokenName }}
          <el-button
            link
            type="primary"
            size="small"
            @click="closeHistory"
          >
            关闭
          </el-button>
        </div>
        <el-table
          :data="historyList"
          v-loading="historyLoading"
          size="small"
          border
          empty-text="该 token 尚无历史版本"
        >
          <el-table-column
            prop="effectiveDate"
            label="生效"
            width="110"
          />
          <el-table-column
            prop="expiryDate"
            label="失效"
            width="110"
          >
            <template #default="{ row: h }">
              {{ h.expiryDate || '生效中' }}
            </template>
          </el-table-column>
          <el-table-column label="影响因素" min-width="140">
            <template #default="{ row: h }">
              {{ h.factorName || h.factorCode }}
              <span class="binding-factor-code">({{ h.factorCode }})</span>
            </template>
          </el-table-column>
          <el-table-column prop="priceSource" label="价源" width="100" />
          <el-table-column label="来源" width="110">
            <template #default="{ row: h }">
              <el-tag size="small" :type="sourceTagType(h.source)">
                {{ sourceLabel(h.source) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" />
        </el-table>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 —— 嵌在 drawer 内部（Element Plus 支持嵌套 dialog） -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editingId ? '编辑绑定' : '新增绑定'"
      width="520px"
      append-to-body
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="Token" required>
          <el-select
            v-model="editForm.tokenName"
            placeholder="选择 B 组 token"
            :disabled="!!editingId"
          >
            <el-option
              v-for="opt in tokenOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="影响因素" required>
          <el-select
            v-model="editForm.factorCode"
            placeholder="选择影响因素"
            filterable
          >
            <!-- catalog 接口返回字段是 code/name（见 /variables/catalog 响应），
                 不是 lp_price_variable 实体的 variableCode/variableName —— 别搞混 -->
            <el-option
              v-for="f in factorOptions"
              :key="f.code"
              :label="`${f.name}（${f.code}）`"
              :value="f.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="价源">
          <el-select
            v-model="editForm.priceSource"
            placeholder="（可选，不填表示全部价源）"
            clearable
          >
            <el-option
              v-for="opt in priceSourceOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="BU 作用域">
          <el-switch
            v-model="editForm.buScoped"
            :active-value="1"
            :inactive-value="0"
          />
          <span class="binding-hint">开启：只取当前 BU 的价格</span>
        </el-form-item>
        <el-form-item label="生效日期" required>
          <el-date-picker
            v-model="editForm.effectiveDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editForm.remark"
            type="textarea"
            :rows="2"
            maxlength="256"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="submitEdit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchBindings,
  fetchHistory,
  saveBinding,
  deleteBinding,
} from '../api/priceLinkedBindings'
import { fetchCatalog } from '../api/priceVariables'

const props = defineProps({
  /** v-model:visible —— 抽屉显隐 */
  visible: { type: Boolean, default: false },
  /** 当前操作的联动行（需要至少含 id / materialCode / specModel / formulaExpr） */
  row: { type: Object, default: null },
})

const emit = defineEmits(['update:visible', 'changed'])

// 可写的 visible —— v-model 双向绑定
const visibleModel = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

// ============================ 数据状态 ============================
const loading = ref(false)
const bindings = ref([])

// 新增 / 编辑 弹窗
const editDialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const editForm = ref(createEmptyForm())

// 影响因素下拉（FinanceFactor + PartContext-DERIVED）
const factorOptions = ref([])

// 历史时间线
const historyTokenName = ref('')
const historyList = ref([])
const historyLoading = ref(false)

// ============================ 常量 ============================
// B 组 token：四个字符串由后端白名单锁定（VALID_TOKEN_NAMES）
const tokenOptions = ['材料含税价格', '材料价格', '废料含税价格', '废料价格']

// 价源下拉 —— 与 lp_finance_base_price.price_source 的可能取值对齐
const priceSourceOptions = [
  '平均价',
  '出厂价',
  '招标价',
  '采购价',
  '现货价',
  '月均价',
]

const drawerTitle = computed(() => {
  if (!props.row) {
    return '变量绑定'
  }
  return `变量绑定 · ${props.row.materialCode || '未知物料'}`
})

// ============================ 初始化 ============================
function createEmptyForm() {
  return {
    linkedItemId: null,
    tokenName: '',
    factorCode: '',
    priceSource: '',
    buScoped: 1,
    effectiveDate: todayIso(),
    remark: '',
  }
}

function todayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ============================ 拉取绑定 ============================
const loadBindings = async () => {
  if (!props.row?.id) {
    bindings.value = []
    return
  }
  loading.value = true
  try {
    const data = await fetchBindings(props.row.id)
    bindings.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '获取绑定列表失败')
  } finally {
    loading.value = false
  }
}

// ============================ 拉取影响因素目录 ============================
const loadFactorCatalog = async () => {
  if (factorOptions.value.length > 0) {
    return
  }
  try {
    const data = await fetchCatalog()
    // catalog 返回三组：financeFactors / partContexts / formulaRefs
    // 绑定场景主要用 FinanceFactor（如 Cu/Zn/copper_scrap_price）+ DERIVED 预计算变量
    const merged = []
    if (Array.isArray(data?.financeFactors)) {
      merged.push(...data.financeFactors)
    }
    if (Array.isArray(data?.partContexts)) {
      // catalog 返回的 partContexts 字段是 code/name/binding，binding 是 JSON 字符串，
      // 内含 source: ENTITY / DERIVED。只保留 DERIVED（FORMULA_REF 指向废料公式等），
      // ENTITY 是重量等非价格字段，不能作为 binding 的影响因素候选。
      merged.push(
        ...data.partContexts.filter((v) => {
          try {
            const b = typeof v.binding === 'string' ? JSON.parse(v.binding) : v.binding
            return (b?.source || '').toUpperCase() === 'DERIVED'
          } catch {
            return false
          }
        }),
      )
    }
    factorOptions.value = merged
  } catch (error) {
    ElMessage.warning(error?.message || '获取影响因素目录失败')
  }
}

// ============================ 新增 / 编辑 ============================
const openCreate = () => {
  editingId.value = null
  editForm.value = createEmptyForm()
  editForm.value.linkedItemId = props.row?.id
  loadFactorCatalog()
  editDialogVisible.value = true
}

const openEdit = (b) => {
  editingId.value = b.id
  editForm.value = {
    linkedItemId: b.linkedItemId,
    tokenName: b.tokenName,
    factorCode: b.factorCode,
    priceSource: b.priceSource || '',
    buScoped: b.buScoped ?? 1,
    effectiveDate: b.effectiveDate || todayIso(),
    remark: b.remark || '',
  }
  loadFactorCatalog()
  editDialogVisible.value = true
}

const submitEdit = async () => {
  // 前端基本校验 —— 真正的规则后端会再跑一遍
  if (!editForm.value.tokenName) {
    ElMessage.warning('请选择 Token')
    return
  }
  if (!editForm.value.factorCode) {
    ElMessage.warning('请选择影响因素')
    return
  }
  if (!editForm.value.effectiveDate) {
    ElMessage.warning('请选择生效日期')
    return
  }
  saving.value = true
  try {
    // source 不传 —— 后端默认补 MANUAL（V34 默认值）
    const body = { ...editForm.value }
    // priceSource 空串 → 不传，后端按 NULL 处理
    if (!body.priceSource) {
      delete body.priceSource
    }
    await saveBinding(body)
    ElMessage.success('已保存')
    editDialogVisible.value = false
    await loadBindings()
    emit('changed')
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const removeBinding = async (b) => {
  try {
    await ElMessageBox.confirm(
      `确定删除 ${b.tokenName} → ${b.factorCode} 的绑定吗？（软删，可通过历史恢复）`,
      '提示',
      { type: 'warning' },
    )
  } catch (_) {
    return
  }
  try {
    await deleteBinding(b.id)
    ElMessage.success('已删除')
    await loadBindings()
    emit('changed')
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

// ============================ 历史 ============================
const openHistory = async (tokenName) => {
  historyTokenName.value = tokenName
  historyList.value = []
  historyLoading.value = true
  try {
    const data = await fetchHistory(props.row.id, tokenName)
    historyList.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '获取历史失败')
  } finally {
    historyLoading.value = false
  }
}

const closeHistory = () => {
  historyTokenName.value = ''
  historyList.value = []
}

// ============================ 来源徽章色 ============================
// EXCEL_INFERRED 红字（待确认）/ SUPPLY_CONFIRMED 绿（已确认）/ MANUAL 蓝（运维手改）
const sourceTagType = (source) => {
  switch (source) {
    case 'EXCEL_INFERRED':
      return 'danger'
    case 'SUPPLY_CONFIRMED':
      return 'success'
    case 'MANUAL':
      return 'primary'
    default:
      return 'info'
  }
}

const sourceLabel = (source) => {
  switch (source) {
    case 'EXCEL_INFERRED':
      return '待确认'
    case 'SUPPLY_CONFIRMED':
      return '已确认'
    case 'MANUAL':
      return '手工'
    default:
      return source || '-'
  }
}

// ============================ 打开抽屉时刷新 ============================
watch(
  () => props.visible,
  (v) => {
    if (v) {
      closeHistory()
      loadBindings()
    }
  },
)

// row id 变化时（用户从 A 行切换到 B 行）立即刷新
watch(
  () => props.row?.id,
  (id) => {
    if (id && props.visible) {
      closeHistory()
      loadBindings()
    }
  },
)
</script>

<style scoped>
.binding-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13px;
  color: #1f2a37;
}

.binding-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.binding-label {
  display: inline-block;
  min-width: 64px;
  color: #6b7280;
  margin-right: 8px;
}

.binding-formula code {
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  color: #111827;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}

.binding-actions {
  display: flex;
  gap: 8px;
}

.binding-factor {
  font-weight: 500;
  color: #111827;
}

.binding-factor-code {
  color: #6b7280;
  font-size: 12px;
  margin-left: 4px;
}

.binding-history {
  border-top: 1px dashed #e5e7eb;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.binding-history-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  color: #1f2a37;
}

.binding-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #6b7280;
}
</style>
