<template>
  <div class="part-cost-rules">
    <el-alert v-if="!canMaintain" title="仅业务总监和管理员可以维护成品零件成本配置" type="warning" :closable="false" />
    <template v-else>
      <div class="heading"><div><h1>成品零件成本配置</h1><p>同一成品内，先按零件料号匹配，未匹配到再按型号匹配。</p></div>
        <div class="actions">
          <el-button :loading="downloading" @click="downloadTemplate">下载模板</el-button>
          <el-button :loading="importing" :disabled="saving" @click="fileInput.click()">导入配置</el-button>
          <el-button type="primary" :disabled="importing" @click="edit()">新增配置</el-button>
          <input ref="fileInput" type="file" accept=".xlsx" class="file-input" aria-label="选择配置Excel" @change="importFile" />
        </div></div>
      <el-alert title="先下载模板填写，再导入配置。费用率按百分比填写，例如10%；导入只新增，已有配置请在列表编辑。" type="info" :closable="false" class="import-hint" />
      <el-alert v-if="importErrors.length" title="本次未导入任何配置，请修改以下问题后重新导入" type="error" :closable="false" class="import-hint">
        <ul class="import-errors"><li v-for="(error, index) in importErrors" :key="index">{{ error.row > 0 ? `第${error.row}行：` : '' }}{{ error.message }}</li></ul>
      </el-alert>
      <el-form inline @submit.prevent="search">
        <el-form-item v-for="[key, label] in queryFields" :key="key" :label="label">
          <el-input v-model="filters[key]" :aria-label="`查询${label}`" clearable @keyup.enter="search" />
        </el-form-item>
        <el-form-item><el-button type="primary" :loading="loading" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <el-table :data="pagedRows" v-loading="loading" border row-key="id">
        <el-table-column v-for="[key, label] in partCostFields" :key="key" :prop="key" :label="label" min-width="150" show-overflow-tooltip />
        <el-table-column prop="shape" label="零件形态属性" width="130" />
        <el-table-column label="零件制造费用率" width="150"><template #default="{ row }">{{ manufacturePercent(row.manufactureRate) }}%</template></el-table-column>
        <el-table-column label="操作" fixed="right" width="140"><template #default="{ row }">
          <el-button link type="primary" @click="edit(row)">编辑</el-button><el-button link type="danger" :disabled="saving" @click="remove(row)">删除</el-button>
        </template></el-table-column>
        <template #empty><el-empty description="暂无成品零件成本配置" /></template>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="20" :total="rows.length" layout="total, prev, pager, next" />
      <el-dialog v-model="dialog" :title="editingId ? '编辑成品零件成本配置' : '新增成品零件成本配置'" width="760px" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
        <el-form label-position="top" :disabled="saving" @submit.prevent="save">
          <div class="form-grid">
            <el-form-item v-for="[key, label] in partCostFields" :key="key" :label="label" :required="key === 'productCode'">
              <el-input v-model="form[key]" :aria-label="label" :maxlength="['productCode', 'partCode'].includes(key) ? 80 : 255" />
            </el-form-item>
            <el-form-item label="零件形态属性" required><el-select v-model="form.shape" aria-label="零件形态属性"><el-option label="采购件" value="采购件" /><el-option label="制造件" value="制造件" /></el-select></el-form-item>
            <el-form-item label="零件制造费用率" required><el-input v-model="form.manufacturePercent" aria-label="零件制造费用率" placeholder="例如 10 表示 10%"><template #append>%</template></el-input></el-form-item>
          </div>
          <p class="hint">零件料号、零件型号至少填写一项。净损失率和三项费用率沿用报价成品。</p>
        </el-form>
        <template #footer><el-button :disabled="saving" @click="dialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { listProductPartCostRules, createProductPartCostRule, updateProductPartCostRule, deleteProductPartCostRule, downloadProductPartCostTemplate, importProductPartCostRules } from '../api/productPartCostRule'
import { canMaintainPartCosts, manufacturePercent, partCostFields, productPartCostPayload } from '../utils/productPartCostRule'

const user = useUserStore()
const canMaintain = computed(() => canMaintainPartCosts(user.roles))
const queryFields = partCostFields.filter(([key]) => key !== 'productSpec')
const filters = reactive(Object.fromEntries(queryFields.map(([key]) => [key, ''])))
const rows = ref([]), loading = ref(false), page = ref(1), dialog = ref(false), saving = ref(false), editingId = ref(null)
const form = reactive({})
const fileInput = ref(null), downloading = ref(false), importing = ref(false), importErrors = ref([])
const pagedRows = computed(() => rows.value.slice((page.value - 1) * 20, page.value * 20))

async function downloadTemplate() {
  downloading.value = true
  try { await downloadProductPartCostTemplate() }
  catch (error) { ElMessage.error(error.message || '模板下载失败') }
  finally { downloading.value = false }
}
async function importFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || importing.value) return
  importErrors.value = []
  if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 10 * 1024 * 1024) {
    ElMessage.warning('请上传不超过10MB的.xlsx模板文件'); return
  }
  importing.value = true
  try {
    const result = await importProductPartCostRules(file)
    importErrors.value = result.errors || []
    if (!importErrors.value.length) { ElMessage.success(`成功导入${result.imported}条配置`); await search() }
  } catch { /* HTTP client displays the actual failure. */ }
  finally { importing.value = false }
}

async function search() {
  if (!canMaintain.value) return
  loading.value = true
  try { rows.value = await listProductPartCostRules(filters); page.value = 1 }
  catch { /* HTTP client displays the actual failure; retain the previous result. */ }
  finally { loading.value = false }
}
function reset() { queryFields.forEach(([key]) => { filters[key] = '' }); search() }
function edit(row) {
  editingId.value = row?.id ?? null
  partCostFields.forEach(([key]) => { form[key] = row?.[key] || '' })
  form.shape = row?.shape || '采购件'
  form.manufacturePercent = manufacturePercent(row?.manufactureRate)
  form.revision = row?.revision ?? null
  dialog.value = true
}
async function save() {
  if (saving.value) return
  let payload
  try { payload = productPartCostPayload(form) } catch (error) { ElMessage.warning(error.message); return }
  saving.value = true
  try {
    if (editingId.value) await updateProductPartCostRule(editingId.value, payload)
    else await createProductPartCostRule(payload)
    dialog.value = false; ElMessage.success('配置已保存'); await search()
  } catch { /* Keep the user's input for correction or retry. */ }
  finally { saving.value = false }
}
async function remove(row) {
  try { await ElMessageBox.confirm(`删除成品 ${row.productCode} 的零件 ${row.partCode || row.partModel} 配置？`, '删除配置', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) }
  catch { return }
  saving.value = true
  try { await deleteProductPartCostRule(row.id, row.revision); ElMessage.success('配置已删除'); await search() }
  catch { /* HTTP client displays the actual failure. */ }
  finally { saving.value = false }
}
onMounted(search)
</script>

<style scoped>
.part-cost-rules { padding: 24px; }
.heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
h1 { margin: 0 0 8px; font-size: 22px; }
.heading p, .hint { color: #606266; font-size: 14px; }
.actions { display: flex; flex-shrink: 0; }
.file-input { display: none; }
.import-hint { margin-bottom: 16px; }
.import-errors { max-height: 240px; overflow: auto; margin: 8px 0; padding-left: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
.el-select { width: 100%; }
.el-pagination { margin-top: 20px; justify-content: flex-end; }
</style>
