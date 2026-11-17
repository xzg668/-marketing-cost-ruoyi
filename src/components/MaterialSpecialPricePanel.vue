<template>
  <el-card shadow="never">
    <div class="policy-heading">
      <div><h3>特殊物料取价</h3><p>启用后仅使用指定类型的价格；缺少符合更新方式的数据时，提醒财务导入并等待核算。</p></div>
      <el-button v-if="canEdit" type="primary" @click="edit()">新增配置</el-button>
    </div>
    <el-form inline @submit.prevent="load">
      <el-form-item label="物料"><el-input v-model="search" placeholder="料号、名称、规格或型号" clearable style="width: 260px" /></el-form-item>
      <el-form-item><el-button native-type="submit" type="primary">查询</el-button></el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table v-loading="loading" :data="rows" row-key="id" stripe>
      <el-table-column prop="materialCode" label="料号" min-width="145" />
      <el-table-column prop="materialName" label="名称" min-width="140" />
      <el-table-column prop="materialSpec" label="规格" min-width="170" />
      <el-table-column prop="materialModel" label="型号" min-width="140" />
      <el-table-column label="组织" width="95"><template #default="{ row }">{{ row.priceOrgCode === 'ALL' ? '全部组织' : row.priceOrgCode }}</template></el-table-column>
      <el-table-column label="限定价格类型" min-width="125"><template #default="{ row }">{{ labels[row.priceType] || row.priceType }}</template></el-table-column>
      <el-table-column label="更新方式" min-width="170"><template #default="{ row }">{{ row.refreshMode === 'CURRENT_MONTH' ? '每月重新导入' : '当月优先，允许沿用最新' }}</template></el-table-column>
      <el-table-column label="状态" width="85"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column>
      <el-table-column prop="reminderText" label="提醒说明" min-width="200" />
      <el-table-column v-if="canEdit" label="操作" width="80" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="edit(row)">编辑</el-button></template></el-table-column>
      <template #empty><el-empty :description="error ? '查询失败，请重试' : '暂无特殊配置，物料按普通规则取价'" /></template>
    </el-table>
    <p class="policy-note">配置持续有效；价格按所选更新方式检查。修改配置后，相关产品下次核算重新检查取价，历史成本保留。</p>
  </el-card>
  <el-dialog v-model="opened" :title="form.id ? '编辑特殊物料取价' : '新增特殊物料取价'" width="660px" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
    <el-alert v-if="editError" :title="editError" type="error" :closable="false" show-icon />
    <el-form label-width="120px" :disabled="saving">
      <el-form-item label="料号" required><el-input v-model="form.materialCode"><template #append><el-button :loading="lookingUp" @click="lookup">查询料品档案</el-button></template></el-input></el-form-item>
      <el-form-item v-if="matches.length > 1" label="档案记录"><el-select v-model="selectedMaster" @change="useMaster" style="width: 100%"><el-option v-for="(item, i) in matches" :key="i" :value="i" :label="[item.materialName, item.materialSpec, item.materialModel].filter(Boolean).join(' / ')" /></el-select></el-form-item>
      <el-form-item label="名称"><el-input v-model="form.materialName" maxlength="128" /></el-form-item>
      <el-form-item label="规格"><el-input v-model="form.materialSpec" maxlength="128" /></el-form-item>
      <el-form-item label="型号"><el-input v-model="form.materialModel" maxlength="128" /></el-form-item>
      <el-form-item label="取价组织" required><el-select v-model="form.priceOrgCode"><el-option value="ALL" label="全部组织" /><el-option value="210" label="210" /><el-option value="220" label="220" /></el-select></el-form-item>
      <el-form-item label="限定价格类型" required><el-select v-model="form.priceType"><el-option v-for="(label, value) in labels" :key="value" :value="value" :label="label" /></el-select></el-form-item>
      <el-form-item label="更新方式" required><el-select v-model="form.refreshMode" style="width: 100%"><el-option value="CURRENT_MONTH" label="每月重新导入：仅接受当月数据" /><el-option value="LATEST_VALID" label="允许沿用：当月优先，没有则取最近有效历史数据" /></el-select></el-form-item>
      <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      <el-form-item label="提醒说明"><el-input v-model="form.reminderText" type="textarea" maxlength="500" show-word-limit /></el-form-item>
    </el-form>
    <template #footer><el-button :disabled="saving" @click="opened = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { fetchSpecialPriceRules, findSpecialPriceMaterial, saveSpecialPriceRule } from '../api/materialPriceTypes'

const user = useUserStore()
const canEdit = computed(() => user.permissions.includes('*:*:*') || user.permissions.includes('base:material-price-type:edit'))
const labels = { INQUIRY: '询价', FIXED: '固定价', LINKED: '联动价', RANGE: '区间价', SETTLE_FIXED: '结算固定价', SETTLE_LINKED: '结算联动价' }
const search = ref(''), rows = ref([]), loading = ref(false), error = ref(''), opened = ref(false), saving = ref(false), editError = ref('')
const form = ref({}), matches = ref([]), selectedMaster = ref(null), lookingUp = ref(false)
let readGeneration = 0, editGeneration = 0, active = true
const unwrap = (value) => value?.data ?? value
const message = (failure) => failure?.message || '操作失败，请重试'
async function load() {
  const generation = ++readGeneration
  loading.value = true; error.value = ''
  try { const result = unwrap(await fetchSpecialPriceRules(search.value)); if (active && generation === readGeneration) rows.value = Array.isArray(result) ? result : [] }
  catch (failure) { if (active && generation === readGeneration) error.value = message(failure) }
  finally { if (active && generation === readGeneration) loading.value = false }
}
function edit(row) {
  ++editGeneration; editError.value = ''; matches.value = []; selectedMaster.value = null; lookingUp.value = false
  form.value = row ? { ...row, enabled: Boolean(row.enabled), expectedVersion: row.version } : { materialCode: '', materialName: '', materialSpec: '', materialModel: '', priceOrgCode: 'ALL', priceType: 'INQUIRY', refreshMode: 'CURRENT_MONTH', enabled: true, reminderText: '' }
  opened.value = true
}
function useMaster(index) {
  const item = matches.value[index]
  if (item) Object.assign(form.value, { materialName: item.materialName || '', materialSpec: item.materialSpec || '', materialModel: item.materialModel || '' })
}
async function lookup() {
  const generation = editGeneration, code = form.value.materialCode?.trim()
  if (!code) { editError.value = '请输入料号'; return }
  lookingUp.value = true; editError.value = ''
  try {
    const result = unwrap(await findSpecialPriceMaterial(code))
    if (!active || generation !== editGeneration || code !== form.value.materialCode?.trim() || !opened.value) return
    matches.value = Array.isArray(result) ? result : []
    if (matches.value.length === 1) { selectedMaster.value = 0; useMaster(0) }
    else editError.value = matches.value.length ? '该料号有多套档案信息，请选择对应记录' : '料品档案中没有匹配记录，请核对料号'
  } catch (failure) { if (active && generation === editGeneration) editError.value = message(failure) }
  finally { if (active && generation === editGeneration) lookingUp.value = false }
}
async function save() {
  if (saving.value || !canEdit.value) return
  if (!form.value.materialCode?.trim()) { editError.value = '请输入料号'; return }
  const generation = editGeneration
  saving.value = true; editError.value = ''
  try { await saveSpecialPriceRule(form.value.id, { ...form.value }); if (active && generation === editGeneration) { opened.value = false; ElMessage.success('配置已保存'); await load() } }
  catch (failure) { if (active && generation === editGeneration) editError.value = message(failure) }
  finally { saving.value = false }
}
watch(() => user.businessUnitType, () => { ++editGeneration; opened.value = false; rows.value = []; load() })
onMounted(load)
onBeforeUnmount(() => { active = false; ++readGeneration; ++editGeneration })
</script>

<style scoped>
.policy-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.policy-heading h3 { margin: 0 0 8px; }
.policy-heading p, .policy-note { color: #606266; font-size: 13px; line-height: 1.6; }
</style>
