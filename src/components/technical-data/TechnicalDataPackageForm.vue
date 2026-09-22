<template>
  <section v-loading="loading" class="package-form">
    <template v-if="workspace">
      <el-radio-group v-if="canEdit" v-model="mode" :disabled="busy" class="package-modes">
        <el-radio-button value="MANUAL">自行录入</el-radio-button>
        <el-radio-button value="REFERENCE">参考整套包装</el-radio-button>
      </el-radio-group>
      <p v-else class="hint">{{ mode === 'REFERENCE' ? '参考整套包装' : '自行录入' }} · 只读</p>

      <template v-if="mode === 'REFERENCE' && canEdit">
        <div class="search-bar">
          <el-input v-model="keyword" placeholder="成品料号 / 型号 / 规格 / 包装组件码" clearable @keyup.enter="searchReferences" />
          <el-button :loading="searching" :disabled="busy" @click="searchReferences">查询包装</el-button>
        </div>
        <el-table v-if="searched" :data="components" row-key="key" border class="package-components">
          <el-table-column prop="materialNo" label="包装组件码" min-width="160" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="model" label="型号／图号" min-width="150" />
          <el-table-column prop="childCount" label="子件数" width="85" />
          <el-table-column label="操作" width="85"><template #default="{ row }"><el-button link type="primary" @click="selectComponent(row)">选择</el-button></template></el-table-column>
          <template #empty><el-empty description="没有找到适用包装，请更换查询条件" /></template>
        </el-table>
        <div v-if="selectedComponent && selectedComponent.sources.length > 1" class="source-select">
          <label>来源成品</label>
          <el-select :model-value="form.source?.parentNodeId" placeholder="请选择来源成品及用量" @change="selectSourceById">
            <el-option v-for="source in selectedComponent.sources" :key="source.evidence.parentNodeId"
              :value="source.evidence.parentNodeId" :label="`${source.evidence.topProductCode} · 母件用量 ${source.evidence.parentQuantity ?? '未提供'}`" />
          </el-select>
        </div>
      </template>

      <div v-if="form.source" class="source-note">
        <b>{{ form.source.parentMaterialNo }} {{ form.source.parentName }}</b>
        <span>来源成品：{{ form.source.topProductCode }} {{ form.source.topProductModel || '' }}</span>
        <span>来源母件用量：<strong>{{ form.source.parentQuantity ?? '未提供' }}</strong> · BOM {{ form.source.bomVersion || '未提供版本号' }}</span>
      </div>
      <div class="parent-quantity">
        <label for="package-parent-quantity">本次母件用量 <em>*</em></label>
        <input id="package-parent-quantity" v-model="form.parentQuantity" aria-label="本次母件用量" type="number" step="any" min="0" :disabled="!canEdit || busy" placeholder="请填写" />
        <span>包装组件／件产品</span>
      </div>
      <p class="hint">下方子件组成一套包装。每产品子件用量＝母件用量 × 每组件子件用量。</p>
      <div v-if="canEdit && mode === 'MANUAL'" class="row-actions">
        <el-button :disabled="busy" @click="childDialog = true">选择已有包装子件</el-button>
        <el-button :disabled="busy" @click="form.items.push(packageRow())">新增无料号子件</el-button>
      </div>
      <div class="table-scroll">
        <table class="package-items">
          <thead><tr><th>子件料号</th><th>名称 <em>*</em></th><th>型号／图号</th><th>规格</th><th>用量／组件 <em>*</em></th><th>单位 <em>*</em></th><th>每产品用量</th><th v-if="canEdit">操作</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in form.items" :key="row.sourceNodeId ? `source-${row.sourceParentNodeId}-${row.sourceNodeId}` : `manual-${index}`">
              <td>{{ row.sourceNodeId ? row.componentMaterialNo : row.componentModel || '随型号自动填写' }}</td>
              <td><input v-if="canEdit && !row.sourceNodeId" v-model="row.componentName" :aria-label="`第${index + 1}行名称`" :disabled="busy" maxlength="255" /><span v-else>{{ row.componentName || '未提供' }}</span></td>
              <td><input v-if="canEdit && !row.sourceNodeId" v-model="row.componentModel" :aria-label="`第${index + 1}行型号`" :disabled="busy" maxlength="64" placeholder="型号即料号" /><span v-else>{{ row.componentModel || '未提供' }}</span></td>
              <td><input v-if="canEdit && !row.sourceNodeId" v-model="row.componentSpec" :aria-label="`第${index + 1}行规格`" :disabled="busy" maxlength="255" /><span v-else>{{ row.componentSpec || '未提供' }}</span></td>
              <td><input v-model="row.quantity" :aria-label="`第${index + 1}行子件用量`" type="number" step="any" min="0" :disabled="!canEdit || busy" /></td>
              <td><input v-if="canEdit && !row.sourceNodeId" v-model="row.unit" :aria-label="`第${index + 1}行单位`" :disabled="busy" maxlength="32" placeholder="如只、张" /><span v-else>{{ row.unit || '未提供' }}</span></td>
              <td>{{ totalQuantity(row) }}</td>
              <td v-if="canEdit"><el-button link type="danger" :disabled="busy" @click="form.items.splice(index, 1)">删除</el-button></td>
            </tr>
            <tr v-if="!form.items.length"><td :colspan="canEdit ? 8 : 7" class="empty">{{ canEdit ? '请选择包装来源或新增子件' : '暂无已保存包装明细' }}</td></tr>
          </tbody>
        </table>
      </div>
      <el-alert v-if="workspace.issues.length" type="warning" :closable="false" :title="workspace.issues.join('；')" />
    </template>
    <el-dialog v-model="childDialog" title="选择已有包装子件" width="980px" append-to-body>
      <div class="search-bar"><el-input v-model="childKeyword" placeholder="子件料号 / 型号 / 规格" @keyup.enter="searchChildren" /><el-button :loading="searchingChildren" @click="searchChildren">查询子件</el-button></div>
      <el-table :data="childOptions" border class="child-options">
        <el-table-column prop="child.materialNo" label="子件料号" min-width="140" />
        <el-table-column prop="child.name" label="名称" min-width="110" />
        <el-table-column prop="child.model" label="型号／图号" min-width="130" />
        <el-table-column prop="child.specification" label="规格" min-width="120" />
        <el-table-column prop="source.topProductCode" label="来源成品" min-width="140" />
        <el-table-column prop="source.parentMaterialNo" label="包装母件" min-width="140" />
        <el-table-column label="操作" width="70"><template #default="{ row }"><el-button link type="primary" @click="selectChild(row)">选择</el-button></template></el-table-column>
      </el-table>
      <template #footer><el-button @click="childDialog = false">取消</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataPackage, fetchTechnicalDataPackageReferences, fetchTechnicalDataPackageChildren, saveTechnicalDataPackage } from '../../api/technicalDataTasks'
import { emptyPackage, packagePayload, packageRow, packageSourceRow } from '../../utils/technicalDataPackage'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const workspace = ref(null), loading = ref(false), saving = ref(false), searching = ref(false)
const mode = ref('MANUAL'), buffers = reactive({ MANUAL: emptyPackage(), REFERENCE: emptyPackage() })
const originals = reactive({ MANUAL: '', REFERENCE: '' })
const keyword = ref(''), components = ref([]), searched = ref(false), selectedComponent = ref(null)
const childDialog = ref(false), childKeyword = ref(''), childOptions = ref([]), searchingChildren = ref(false)
const form = computed(() => buffers[mode.value])
const canEdit = computed(() => props.editable && workspace.value?.editable)
const busy = computed(() => loading.value || saving.value || searching.value || searchingChildren.value)
watch(busy, value => emit('busy', value))
watch(() => JSON.stringify(form.value), value => emit('dirty', value !== originals[mode.value]))

function restore(data, initial = false) {
  workspace.value = data
  if (initial) {
    buffers.MANUAL = emptyPackage(); buffers.REFERENCE = emptyPackage()
    mode.value = data.packaging?.entryMode === 'REFERENCE' ? 'REFERENCE' : 'MANUAL'
    for (const name of ['MANUAL', 'REFERENCE']) originals[name] = JSON.stringify(buffers[name])
  }
  const savedMode = data.packaging?.entryMode === 'REFERENCE' ? 'REFERENCE' : 'MANUAL'
  buffers[savedMode] = { parentQuantity: data.packaging?.parentQuantity == null ? '' : String(data.packaging.parentQuantity),
    source: data.packaging?.source ?? null, items: data.items.map(packageRow) }
  originals[savedMode] = JSON.stringify(buffers[savedMode])
  emit('dirty', JSON.stringify(form.value) !== originals[mode.value])
}
watch(() => props.productId, async () => {
  loading.value = true
  try { restore(await fetchTechnicalDataPackage(props.productId), true) }
  catch (error) { showErrorOnce(error, '包装资料加载失败') }
  finally { loading.value = false }
}, { immediate: true })

async function searchReferences() {
  if (!keyword.value.trim()) return ElMessage.warning('请输入查询条件')
  searching.value = true
  components.value = []; selectedComponent.value = null; buffers.REFERENCE = emptyPackage(); searched.value = true
  try { components.value = (await fetchTechnicalDataPackageReferences(props.productId, keyword.value.trim())).components }
  catch (error) { showErrorOnce(error, '包装查询失败') }
  finally { searching.value = false }
}
function selectComponent(component) {
  selectedComponent.value = component; buffers.REFERENCE = emptyPackage()
  if (component.sources.length === 1) selectSource(component.sources[0])
}
function selectSourceById(id) { selectSource(selectedComponent.value.sources.find(source => source.evidence.parentNodeId === id)) }
function selectSource(source) {
  buffers.REFERENCE = { parentQuantity: source.evidence.parentQuantity == null ? '' : String(source.evidence.parentQuantity),
    source: source.evidence, items: source.children.map(child => packageSourceRow(source.evidence, child)) }
}
async function searchChildren() {
  if (!childKeyword.value.trim()) return ElMessage.warning('请输入子件查询条件')
  searchingChildren.value = true; childOptions.value = []
  try { childOptions.value = await fetchTechnicalDataPackageChildren(props.productId, childKeyword.value.trim()) }
  catch (error) { showErrorOnce(error, '包装子件查询失败') }
  finally { searchingChildren.value = false }
}
function selectChild(option) {
  if (buffers.MANUAL.items.some(row => row.sourceNodeId === option.child.sourceNodeId)) return ElMessage.warning('该子件已选入')
  buffers.MANUAL.items.push(packageSourceRow(option.source, option.child)); childDialog.value = false
}
async function save(next) {
  saving.value = true
  try {
    const data = await saveTechnicalDataPackage(props.productId, packagePayload(mode.value, form.value, workspace.value.expectedVersion))
    restore(data)
    ElMessage.success(data.issues.length ? '草稿已保存，请补齐提示内容后提交' : '包装资料已保存')
    emit('saved', { next: next && !data.issues.length })
  } catch (error) { showErrorOnce(error, '包装保存失败，本次输入已保留') }
  finally { saving.value = false }
}
function totalQuantity(row) {
  if (!(Number(form.value.parentQuantity) > 0) || !(Number(row.quantity) > 0)) return '—'
  return Number((Number(form.value.parentQuantity) * Number(row.quantity)).toPrecision(12))
}

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && !busy.value) })
</script>

<style scoped>
.package-form{min-height:160px;color:#303b4b}.package-modes{margin-bottom:18px}.search-bar{display:flex;gap:12px;margin-bottom:14px;max-width:780px}.source-select,.parent-quantity{display:flex;align-items:center;gap:12px;margin:18px 0}.source-select .el-select{width:480px}.source-note{display:flex;flex-wrap:wrap;gap:12px 24px;padding:15px;background:#f3f6fa;margin-top:14px;border-radius:6px}.source-note b{width:100%}.parent-quantity input{width:170px}.hint{font-size:13px;color:#637085;line-height:1.7}.row-actions{display:flex;gap:10px;margin:15px 0}.table-scroll{overflow-x:auto;margin:16px 0}.package-items{width:100%;min-width:1050px;border-collapse:collapse;font-size:14px}.package-items th,.package-items td{text-align:left;border:1px solid #e1e6ee;padding:12px;vertical-align:middle}.package-items th{background:#f4f6f9;color:#586579}.package-items td:first-child{max-width:180px;overflow-wrap:anywhere}.package-items input{width:100%;min-width:75px;box-sizing:border-box}.package-items input[type=number]{width:115px}.package-form input{border:1px solid #cbd3df;border-radius:4px;padding:9px;font:inherit;color:inherit;box-sizing:border-box}.package-form input:disabled{background:#f5f7fa;color:#576173}.package-form em{color:#e05252;font-style:normal}.empty{text-align:center!important;color:#8792a5;padding:30px!important}
</style>
