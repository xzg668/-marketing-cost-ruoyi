<template>
  <el-card shadow="never" class="price-workspace">
    <template #header>
      <div class="card-header">
        <div>
          <strong>补齐底层物料价格</strong>
          <div class="muted">系统只列真正缺价的底层物料；优先复制正式有效记录，找不到再直接填写。</div>
        </div>
        <el-tag :type="workspace?.savedCount === workspace?.totalCount ? 'success' : 'warning'" effect="plain">
          已保存 {{ workspace?.savedCount || 0 }}/{{ workspace?.totalCount || 0 }}
        </el-tag>
      </div>
    </template>

    <el-table v-loading="loading" :data="workspace?.items || []" size="small">
      <el-table-column label="底层物料" min-width="230">
        <template #default="{ row }">
          <div class="material-name">{{ row.materialName || row.materialCode }}</div>
          <div class="muted">{{ [row.materialCode, row.materialModel || row.materialSpec, row.materialRole].filter(Boolean).join(' · ') }}</div>
          <el-tag v-if="row.priceTypeLabel" size="small" effect="plain">{{ row.priceTypeLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="BOM位置与用量" min-width="250">
        <template #default="{ row }">
          <div>{{ row.bomPath || '-' }}</div>
          <div class="muted">{{ row.bomQuantity }} {{ row.bomUnit || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="缺价原因" min-width="250" />
      <el-table-column label="状态" width="190">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row)" effect="plain">{{ row.statusLabel }}</el-tag>
          <div v-if="row.draftId" class="muted saved-summary">
            {{ row.sourceModeLabel }}<br>{{ row.referenceLabel }}<br>{{ formatTime(row.savedAt) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openRow(row)">
            {{ row.draftId ? '查看/修改' : '补价格' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-alert
      v-if="workspace?.totalCount && workspace.savedCount === workspace.totalCount"
      :type="pendingValidationCount ? 'warning' : 'success'"
      show-icon :closable="false" class="next-hint"
      :title="pendingValidationCount
        ? `所有缺价项都已建立草稿，还有 ${pendingValidationCount} 项需要校验通过。`
        : allValidatedHint"
    />

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="78%" destroy-on-close>
      <template v-if="activeRow">
        <div class="target-strip">
          <span>本次要补：</span>
          <strong>{{ activeRow.materialName || activeRow.materialCode }}</strong>
          <span>{{ activeRow.materialCode }} · {{ activeRow.materialModel || activeRow.materialSpec || '-' }}</span>
        </div>

        <template v-if="!draft">
          <div class="choice-title">先搜索正式有效价格，复制后只改本料号不同的内容</div>
          <div class="search-bar">
            <el-input v-model="search.keyword" placeholder="输入料号、规格或型号" clearable @keyup.enter="searchReferences" />
            <el-select v-model="search.priceType" placeholder="全部价格类型" clearable>
              <el-option v-for="type in priceTypes" :key="type.value" :label="type.label" :value="type.value" />
            </el-select>
            <el-button type="primary" :loading="searching" @click="searchReferences">搜索正式价格</el-button>
          </div>
          <el-table :data="references" size="small" max-height="330">
            <el-table-column label="参考物料" min-width="210">
              <template #default="{ row }">
                <div>{{ row.materialName || row.materialCode }}</div>
                <div class="muted">{{ row.materialCode }} · {{ row.specModel || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="priceTypeLabel" label="价格类型" width="120" />
            <el-table-column prop="priceSummary" label="价格内容" min-width="210" />
            <el-table-column label="范围/版本" min-width="170">
              <template #default="{ row }">{{ row.orgCode || '通用组织' }} · {{ row.versionText }}</template>
            </el-table-column>
            <el-table-column prop="supplierName" label="供应商" min-width="150" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" :loading="creating" @click="copyReference(row)">复制</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="searched && !references.length" description="当前组织没有找到正式有效记录" :image-size="58" />
          <div class="direct-box">
            <span>找不到合适记录？选择现有价格类型后直接填写：</span>
            <el-select v-model="directType" placeholder="选择价格类型">
              <el-option v-for="type in priceTypes" :key="type.value" :label="type.label" :value="type.value" />
            </el-select>
            <el-button :disabled="!directType" :loading="creating" @click="createDirect">直接填写</el-button>
          </div>
        </template>

        <template v-else>
          <div class="draft-summary">
            <div><span>形成方式</span><strong>{{ draft.sourceModeLabel }}</strong></div>
            <div><span>价格类型</span><strong>{{ draft.priceTypeLabel }}</strong></div>
            <div><span>参考记录</span><strong>{{ draft.referenceLabel }}</strong></div>
            <el-button v-if="draft.sourceMode === 'COPY'" link type="primary" @click="beginChangeReference">更换参考记录</el-button>
          </div>

          <el-alert
            v-if="draft.validationStatus && draft.validationStatus !== 'NOT_CHECKED'"
            :type="draft.validationStatus === 'PASSED' ? 'success' : 'error'"
            :title="draft.validationMessage || (draft.validationStatus === 'PASSED' ? '校验通过' : '校验未通过')"
            show-icon :closable="false" class="validation-alert"
          />

          <el-alert
            v-if="draft.taxConversion"
            type="info" :closable="false" show-icon class="validation-alert"
            :title="`按当前税率换算：含税价 ${draft.taxConversion.taxIncludedPrice}，未税价 ${draft.taxConversion.taxExcludedPrice}`"
          />

          <el-alert
            v-if="isLinkedDraft && !changingReference"
            type="info" :closable="false" show-icon class="validation-alert"
            title="公式可以从相似正式记录复制并修改；系统行情变量自动取值，只要求填写公式实际引用的本料号技术参数。"
          />

          <el-alert
            v-if="isRangeDraft && !changingReference"
            type="info" :closable="false" show-icon class="validation-alert"
            title="整组维护区间价：每段下限包含、上限不包含，最后一段上限可留空表示无穷；当前报价数量必须且只能命中一段。"
          />

          <template v-if="changingReference">
            <el-alert title="更换后会保留原参考快照和变更记录，不会修改原正式价格。" type="info" :closable="false" />
            <div class="search-bar">
              <el-input v-model="search.keyword" placeholder="输入料号、规格或型号" @keyup.enter="searchReferences" />
              <el-select v-model="search.priceType" disabled><el-option :label="draft.priceTypeLabel" :value="draft.priceType" /></el-select>
              <el-button type="primary" :loading="searching" @click="searchReferences">搜索</el-button>
              <el-button @click="changingReference = false">取消</el-button>
            </div>
            <el-table :data="references" size="small" max-height="260">
              <el-table-column label="参考物料" min-width="220">
                <template #default="{ row }">{{ row.materialCode }} · {{ row.materialName }} · {{ row.specModel || '-' }}</template>
              </el-table-column>
              <el-table-column prop="priceSummary" label="价格内容" min-width="200" />
              <el-table-column prop="versionText" label="版本" width="150" />
              <el-table-column label="操作" width="100">
                <template #default="{ row }"><el-button link type="primary" @click="replaceReference(row)">改用此记录</el-button></template>
              </el-table-column>
            </el-table>
          </template>

          <el-form v-else label-width="100px" class="draft-form">
            <div class="common-grid">
              <el-form-item label="供应商编码"><el-input v-model="form.supplierCode" placeholder="与名称至少填一项" /></el-form-item>
              <el-form-item label="供应商名称"><el-input v-model="form.supplierName" placeholder="与编码至少填一项" /></el-form-item>
              <el-form-item label="单位" required><el-input v-model="form.unit" /></el-form-item>
              <el-form-item label="是否含税" required><el-select v-model="form.taxIncluded" clearable><el-option label="含税" :value="1" /><el-option label="不含税" :value="0" /></el-select></el-form-item>
              <el-form-item v-if="!isLinkedDraft" label="税率" required><el-input v-model="form.taxRate" placeholder="如 0.13" /></el-form-item>
              <el-form-item label="生效日期" required><el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
              <el-form-item label="失效日期"><el-date-picker v-model="form.effectiveTo" type="date" value-format="YYYY-MM-DD" /></el-form-item>
              <el-form-item v-if="isRangeDraft" label="区间依据" required>
                <el-select v-model="rangeBasis">
                  <el-option label="报价数量" value="QTY" />
                  <el-option label="报价行情" value="FACTOR" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="isRangeDraft && rangeBasis === 'FACTOR'" label="报价行情" required>
                <el-select v-model="rangeFactorCode">
                  <el-option v-for="factor in rangeFactors" :key="factor.value" :label="factor.label" :value="factor.value" />
                </el-select>
              </el-form-item>
            </div>
            <el-divider content-position="left">{{ draft.sourceMode === 'COPY' ? '本次补价与参考价格对比' : '技术本次填写' }}</el-divider>
            <template v-if="isRangeDraft">
              <div class="range-toolbar">
                <span class="muted">已维护 {{ rangeRows.length }} 段；新增、删除或修改后统一保存校验。</span>
                <el-button type="primary" plain @click="addRangeRow">新增区间</el-button>
              </div>
              <el-table :data="rangeRows" size="small" row-key="rowKey">
                <el-table-column type="index" label="段" width="55" />
                <el-table-column label="下限（含）" min-width="150">
                  <template #default="{ row }">
                    <el-input v-model="row.low.targetValue" placeholder="必填" />
                    <div v-if="row.low.validationStatus === 'FAILED'" class="field-error">{{ row.low.validationMessage }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="上限（不含）" min-width="160">
                  <template #default="{ row }">
                    <el-input v-model="row.high.targetValue" placeholder="最后一段可留空" />
                    <div v-if="row.high.validationStatus === 'FAILED'" class="field-error">{{ row.high.validationMessage }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="不含税价" min-width="150">
                  <template #default="{ row }">
                    <el-input v-model="row.excl.targetValue" />
                    <div v-if="row.excl.validationStatus === 'FAILED'" class="field-error">{{ row.excl.validationMessage }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="含税价" min-width="150">
                  <template #default="{ row }">
                    <el-input v-model="row.incl.targetValue" />
                    <div v-if="row.incl.validationStatus === 'FAILED'" class="field-error">{{ row.incl.validationMessage }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="90">
                  <template #default="{ row }"><el-button link type="danger" :disabled="rangeRows.length === 1" @click="deleteRangeRow(row.rowKey)">删除</el-button></template>
                </el-table-column>
              </el-table>
            </template>
            <el-table v-else :data="displayFields" size="small">
              <el-table-column label="内容" min-width="160">
                <template #default="{ row }">{{ row.fieldName }}<span v-if="row.required" class="required-star"> *</span></template>
              </el-table-column>
              <el-table-column v-if="draft.sourceMode === 'COPY'" prop="referenceValue" label="参考正式记录" min-width="190" />
              <el-table-column label="本料号填写" min-width="250">
                <template #default="{ row }">
                  <el-input
                    v-model="row.targetValue"
                    :type="isFormulaField(row) ? 'textarea' : 'text'"
                    :autosize="isFormulaField(row) ? { minRows: 2, maxRows: 5 } : undefined"
                    :placeholder="isFormulaField(row) ? '复制后可按本料号实际情况修改公式' : (row.techInputRequired ? '请填写本料号自己的参数' : '可按实际情况修改')"
                  >
                    <template v-if="row.unit" #append>{{ row.unit }}</template>
                  </el-input>
                  <div v-if="row.techInputRequired && !isFormulaField(row)" class="tech-required">必须填写本料号自己的值，不沿用参考物料</div>
                  <div v-if="isFormulaField(row)" class="formula-hint">只允许使用系统已登记变量和四则运算；系统不会展示试算金额。</div>
                  <div v-if="row.validationStatus === 'FAILED'" class="field-error">{{ row.validationMessage }}</div>
                </template>
              </el-table-column>
            </el-table>
          </el-form>

          <el-timeline v-if="draft.referenceChanges?.length && !changingReference" class="reference-history">
            <el-timeline-item v-for="item in draft.referenceChanges" :key="`${item.changedAt}-${item.afterReference}`" :timestamp="formatTime(item.changedAt)">
              {{ item.changedBy }}：{{ item.beforeReference }} → {{ item.afterReference }}
            </el-timeline-item>
          </el-timeline>
        </template>
      </template>

      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button v-if="draft && !changingReference && !isValidatableDraft" type="primary" :loading="saving" @click="saveDraft">保存草稿</el-button>
        <el-button v-if="draft && !changingReference && isValidatableDraft" type="primary" :loading="saving" @click="saveAndValidate">保存并校验</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  changeTechnicalPriceDraftReference,
  copyTechnicalPriceDraft,
  createTechnicalPriceDraft,
  fetchTechnicalPriceDraft,
  fetchTechnicalPriceGaps,
  saveTechnicalPriceDraft,
  searchFormalPriceReferences,
  validateTechnicalPriceDraft,
} from '../api/technicalCollaborationTasks'
import { showErrorOnce } from '../utils/errorHandler'

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  nextAction: { type: String, default: '' },
})
const emit = defineEmits(['updated'])
const priceTypes = [
  { value: 'FIXED_PURCHASE', label: '固定采购价' },
  { value: 'LINKED', label: '联动价' },
  { value: 'RANGE', label: '区间价' },
  { value: 'SETTLE_FIXED', label: '结算固定价' },
]
const loading = ref(false)
const searching = ref(false)
const creating = ref(false)
const saving = ref(false)
const workspace = ref(null)
const dialogVisible = ref(false)
const activeRow = ref(null)
const draft = ref(null)
const references = ref([])
const searched = ref(false)
const directType = ref('')
const changingReference = ref(false)
const search = reactive({ keyword: '', priceType: '' })
const form = reactive({ supplierCode: '', supplierName: '', unit: '', taxIncluded: null, taxRate: '', effectiveFrom: '', effectiveTo: '', fields: [] })
const dialogTitle = computed(() => draft.value ? `价格草稿 · ${activeRow.value?.materialCode || ''}` : `补价格 · ${activeRow.value?.materialCode || ''}`)
const isFixedDraft = computed(() => ['FIXED_PURCHASE', 'SETTLE_FIXED'].includes(draft.value?.priceType))
const isLinkedDraft = computed(() => draft.value?.priceType === 'LINKED')
const isRangeDraft = computed(() => draft.value?.priceType === 'RANGE')
const isValidatableDraft = computed(() => isFixedDraft.value || isLinkedDraft.value || isRangeDraft.value)
const pendingValidationCount = computed(() => (workspace.value?.items || [])
  .filter(item => item.validationStatus !== 'PASSED').length)
const allValidatedHint = computed(() => props.nextAction === 'SUBMIT_FINANCE_REVIEW'
  ? '所有缺价项均已校验通过。下一步请点击页面底部“完成并提交财务审核”。'
  : '所有缺价项均已校验通过。下一步请点击页面底部“检查完整性”。')
const displayFields = computed(() => form.fields.filter(field =>
  !['BINDING', 'RANGE_ROW'].includes(field.sectionCode)
    && field.fieldCode !== 'FORMULA_EXPR_CN'
    && !['RANGE_BASIS', 'FACTOR_CODE'].includes(field.fieldCode)))
const rangeFactors = [
  { value: 'CU', label: '铜价' }, { value: 'ZN', label: '锌价' },
  { value: 'AL', label: '铝价' }, { value: 'GOLD', label: '黄金价' },
  { value: 'SILVER', label: '白银价' }, { value: 'SUS304', label: 'SUS304价' },
  { value: 'SUS316L', label: 'SUS316L价' },
]
const rangeBasisField = computed(() => form.fields.find(field => field.sectionCode === 'COMMON' && field.fieldCode === 'RANGE_BASIS'))
const rangeFactorField = computed(() => form.fields.find(field => field.sectionCode === 'COMMON' && field.fieldCode === 'FACTOR_CODE'))
const rangeBasis = computed({
  get: () => rangeBasisField.value?.targetValue || 'QTY',
  set: value => { if (rangeBasisField.value) rangeBasisField.value.targetValue = value },
})
const rangeFactorCode = computed({
  get: () => rangeFactorField.value?.targetValue || '',
  set: value => { if (rangeFactorField.value) rangeFactorField.value.targetValue = value },
})
const rangeRows = computed(() => {
  const groups = new Map()
  for (const field of form.fields.filter(item => item.sectionCode === 'RANGE_ROW')) {
    if (!groups.has(field.rowKey)) groups.set(field.rowKey, { rowKey: field.rowKey })
    const row = groups.get(field.rowKey)
    if (field.fieldCode === 'RANGE_LOW') row.low = field
    if (field.fieldCode === 'RANGE_HIGH') row.high = field
    if (field.fieldCode === 'PRICE_EXCL_TAX') row.excl = field
    if (field.fieldCode === 'PRICE_INCL_TAX') row.incl = field
  }
  return [...groups.values()].filter(row => row.low && row.high && row.excl && row.incl)
})

async function load() {
  loading.value = true
  try { workspace.value = await fetchTechnicalPriceGaps(props.taskId) }
  catch (error) { showErrorOnce(error, '缺价明细加载失败') }
  finally { loading.value = false }
}

async function openRow(row) {
  activeRow.value = row
  draft.value = null
  references.value = []
  searched.value = false
  changingReference.value = false
  directType.value = ''
  search.keyword = row.materialCode || row.materialModel || row.materialSpec || ''
  search.priceType = row.priceType || ''
  dialogVisible.value = true
  if (row.draftId) await loadDraft(row.draftId)
  else await searchReferences()
}

async function searchReferences() {
  if (!activeRow.value) return
  searching.value = true
  try {
    const result = await searchFormalPriceReferences(activeRow.value.gapId, search)
    references.value = result.items || []
    searched.value = true
  } catch (error) { showErrorOnce(error, '正式价格搜索失败') }
  finally { searching.value = false }
}

async function copyReference(row) {
  creating.value = true
  try {
    const result = await copyTechnicalPriceDraft(activeRow.value.gapId, {
      referenceSourceType: row.sourceType, referenceSourceId: row.sourceId,
    })
    applyDraft(result)
    ElMessage.success('已复制为本料号独立草稿')
    await refreshWorkspace()
  } catch (error) { showErrorOnce(error, '复制价格失败') }
  finally { creating.value = false }
}

async function createDirect() {
  creating.value = true
  try {
    const result = await createTechnicalPriceDraft(activeRow.value.gapId, directType.value)
    applyDraft(result)
    ElMessage.success('已建立空草稿，请填写本料号价格')
    await refreshWorkspace()
  } catch (error) { showErrorOnce(error, '创建价格草稿失败') }
  finally { creating.value = false }
}

async function loadDraft(id) {
  try { applyDraft(await fetchTechnicalPriceDraft(id)) }
  catch (error) { showErrorOnce(error, '价格草稿加载失败') }
}

function applyDraft(value) {
  draft.value = value
  form.supplierCode = value.supplierCode || ''
  form.supplierName = value.supplierName || ''
  form.unit = value.unit || ''
  form.taxIncluded = value.taxIncluded
  form.taxRate = value.taxRate || ''
  form.effectiveFrom = value.effectiveFrom || ''
  form.effectiveTo = value.effectiveTo || ''
  form.fields = (value.fields || []).map(field => ({ ...field }))
  if (value.priceType === 'RANGE' && !rangeBasisField.value?.targetValue) rangeBasisField.value.targetValue = 'QTY'
  search.priceType = value.priceType
}

function addRangeRow() {
  const rowKey = `ROW-NEW-${Date.now()}-${rangeRows.value.length + 1}`
  const base = { sectionCode: 'RANGE_ROW', rowKey, valueType: 'DECIMAL', referenceValue: null, targetValue: '', techInputRequired: true, changed: true, validationStatus: 'NOT_CHECKED' }
  form.fields.push(
    { ...base, fieldCode: 'RANGE_LOW', fieldName: '区间下限', required: true },
    { ...base, fieldCode: 'RANGE_HIGH', fieldName: '区间上限', required: false },
    { ...base, fieldCode: 'PRICE_EXCL_TAX', fieldName: '不含税价', required: false, unit: form.unit },
    { ...base, fieldCode: 'PRICE_INCL_TAX', fieldName: '含税价', required: false, unit: form.unit },
  )
}

function deleteRangeRow(rowKey) {
  if (rangeRows.value.length <= 1) return
  form.fields = form.fields.filter(field => !(field.sectionCode === 'RANGE_ROW' && field.rowKey === rowKey))
}

async function persistDraft() {
  const result = await saveTechnicalPriceDraft(draft.value.draftId, {
      expectedVersion: draft.value.draftVersion,
      supplierCode: form.supplierCode, supplierName: form.supplierName, unit: form.unit,
      taxIncluded: form.taxIncluded, taxRate: form.taxRate || null,
      effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
      fields: form.fields.map(field => ({
        sectionCode: field.sectionCode, rowKey: field.rowKey,
        fieldCode: field.fieldCode, value: field.targetValue,
      })),
  })
  applyDraft(result)
  return result
}

async function saveDraft() {
  saving.value = true
  try {
    await persistDraft()
    ElMessage.success('草稿已保存，重新打开会继续编辑这一份')
    await refreshWorkspace()
  } catch (error) { showErrorOnce(error, '草稿保存失败') }
  finally { saving.value = false }
}

async function saveAndValidate() {
  saving.value = true
  try {
    const saved = await persistDraft()
    const result = await validateTechnicalPriceDraft(saved.draftId, saved.draftVersion)
    applyDraft(result)
    if (result.validationStatus === 'PASSED') ElMessage.success('校验通过，草稿已就绪')
    else ElMessage.error(result.validationMessage || '校验未通过，请按提示修改')
    await refreshWorkspace()
  } catch (error) { showErrorOnce(error, '保存并校验失败') }
  finally { saving.value = false }
}

async function beginChangeReference() {
  changingReference.value = true
  references.value = []
  searched.value = false
  search.priceType = draft.value.priceType
  await searchReferences()
}

async function replaceReference(row) {
  try {
    const result = await changeTechnicalPriceDraftReference(draft.value.draftId, {
      expectedVersion: draft.value.draftVersion,
      referenceSourceType: row.sourceType, referenceSourceId: row.sourceId,
    })
    applyDraft(result)
    changingReference.value = false
    ElMessage.success('参考记录已更换，原参考快照已保留')
    await refreshWorkspace()
  } catch (error) { showErrorOnce(error, '更换参考记录失败') }
}

async function refreshWorkspace() {
  await load()
  const row = workspace.value?.items?.find(item => item.gapId === activeRow.value?.gapId)
  if (row) activeRow.value = row
  emit('updated')
}

function formatTime(value) { return value ? String(value).replace('T', ' ').slice(0, 19) : '' }
function isFormulaField(row) { return row?.sectionCode === 'FORMULA' && row?.fieldCode === 'FORMULA_EXPR' }
function statusTagType(row) {
  if (!row.draftId || row.validationStatus === 'FAILED') return 'warning'
  return row.validationStatus === 'PASSED' ? 'success' : 'info'
}

watch(() => props.taskId, load)
onMounted(load)
</script>

<style scoped>
.price-workspace { margin-bottom: 14px; }
.card-header, .draft-summary, .target-strip, .direct-box { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.card-header .muted { margin-top: 5px; }
.muted { color: #909399; font-size: 13px; }
.material-name { font-weight: 600; margin-bottom: 4px; }
.saved-summary { margin-top: 6px; line-height: 1.5; }
.next-hint { margin-top: 14px; }
.target-strip { justify-content: flex-start; padding: 14px 16px; background: #f5f7fa; margin-bottom: 18px; }
.choice-title { font-weight: 600; margin-bottom: 12px; }
.search-bar { display: grid; grid-template-columns: minmax(280px, 1fr) 180px auto auto; gap: 10px; margin: 12px 0; }
.direct-box { justify-content: flex-start; border-top: 1px solid #ebeef5; margin-top: 16px; padding-top: 16px; }
.direct-box .el-select { width: 180px; }
.draft-summary { justify-content: flex-start; padding: 12px 16px; border: 1px solid #d9ecff; background: #f5faff; margin-bottom: 16px; }
.draft-summary div { display: flex; flex-direction: column; min-width: 170px; gap: 4px; }
.draft-summary span { color: #909399; font-size: 12px; }
.common-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 16px; }
.draft-form { margin-top: 8px; }
.tech-required { color: #e6a23c; font-size: 12px; margin-top: 4px; }
.field-error, .required-star { color: #f56c6c; }
.field-error { font-size: 12px; margin-top: 4px; }
.formula-hint { color: #909399; font-size: 12px; margin-top: 4px; }
.validation-alert { margin-bottom: 14px; }
.reference-history { margin-top: 20px; }
.range-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
@media (max-width: 1100px) { .common-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
