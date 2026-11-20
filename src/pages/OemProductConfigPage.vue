<template>
  <section class="oem-config">
    <header class="page-heading">
      <h1>OEM产品配置表</h1>
      <div class="page-actions">
        <el-button v-if="guide" @click="returnToQuote">返回报价单</el-button>
        <el-button :loading="exporting === 'template'" :disabled="exporting === 'data'" @click="download('template')">下载模板</el-button>
        <el-button :loading="exporting === 'data'" :disabled="exporting === 'template'" @click="download('data')">导出数据</el-button>
        <el-button type="primary" @click="openEditor()">新增产品</el-button>
      </div>
    </header>
    <el-input v-model="keyword" class="product-search" clearable aria-label="搜索OEM产品" placeholder="搜索料号、型号、规格或名称" />
    <el-table v-loading="loading" :data="pageRows" row-key="id" border>
      <el-table-column v-for="[field, label] in fields" :key="field" :label="label" :prop="field" min-width="160" show-overflow-tooltip />
      <el-table-column label="OEM 费率" min-width="125">
        <template #default="{ row }">{{ row.oemRate == null ? '取三项费用率表' : `${formatPercent(row.oemRate)}%` }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link :disabled="saving" @click="openEditor(row)">编辑</el-button>
          <el-button type="danger" link :disabled="saving" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无OEM产品" /></template>
    </el-table>
    <el-pagination v-if="filteredRows.length > 20" v-model:current-page="page" :total="filteredRows.length" :page-size="20" layout="prev, pager, next" />

    <el-dialog v-model="editorOpen" :title="editingId ? '编辑OEM产品' : '新增OEM产品'" width="min(520px, 94vw)"
      :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-width="88px" :disabled="saving" @submit.prevent="save">
        <el-form-item v-for="[field, label] in fields" :key="field" :label="label" :required="field === 'productCode'">
          <el-input v-model="form[field]" :aria-label="label" :maxlength="field === 'productCode' ? 80 : 255"
            :disabled="guidedEditor && field === 'productCode'" />
        </el-form-item>
        <el-form-item label="OEM 费率">
          <el-input v-model="form.oemPercent" aria-label="OEM 费率" placeholder="留空取三项费用率表的 OEM 费率">
            <template #append>%</template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="editorOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listOemProducts, createOemProduct, updateOemProduct, deleteOemProduct } from '../api/oemProductConfig'
import { useUserStore } from '../store/modules/user'
import { useRoute, useRouter } from 'vue-router'
import { saveWorkbook } from '../utils/workbookTransfer'

const fields = [['productCode', '料号'], ['productModel', '型号'], ['productSpec', '规格'], ['productName', '名称']]
const example = { productCode: '1145900000989', productModel: 'YCQB02-013051', productSpec: 'YCQB02-013051', productName: '线束' }
const user = useUserStore()
const route = useRoute()
const router = useRouter()
const guide = computed(() => {
  const { oaNo, itemId, unit, productCode, productModel, productSpec, productName } = route.query
  if (unit !== user.businessUnitType || typeof oaNo !== 'string' || !/^\d+$/.test(itemId || '') || typeof productCode !== 'string') return null
  return { oaNo, itemId, productCode: productCode.trim(), productModel, productSpec, productName }
})
const rows = ref([])
const keyword = ref('')
const page = ref(1)
const loading = ref(false)
const saving = ref(false)
const exporting = ref('')
const editorOpen = ref(false)
const editingId = ref(null)
const guidedEditor = ref(false)
const form = reactive({})
let listRequest = 0

const filteredRows = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return rows.value.filter(row => fields.some(([field]) => String(row[field] ?? '').toLowerCase().includes(query)))
})
const pageRows = computed(() => filteredRows.value.slice((page.value - 1) * 20, page.value * 20))

async function refresh() {
  const requestId = ++listRequest
  loading.value = true
  try {
    const result = await listOemProducts()
    if (requestId === listRequest) {
      rows.value = result
      page.value = Math.min(page.value, Math.max(1, Math.ceil(filteredRows.value.length / 20)))
      return true
    }
  } catch { /* The shared HTTP client presents the error. */ }
  finally { if (requestId === listRequest) loading.value = false }
}

function openEditor(row, fromQuote = false) {
  editingId.value = row?.id ?? null
  guidedEditor.value = fromQuote
  for (const [field] of fields) form[field] = String(row?.[field] ?? '')
  form.revision = row?.revision ?? null
  form.oemPercent = row?.oemRate == null ? '' : formatPercent(row.oemRate)
  editorOpen.value = true
}

function formatPercent(rate) {
  return String(Number((Number(rate) * 100).toFixed(4)))
}

function returnToQuote() {
  if (!guide.value) return
  router.push({ name: 'ingest-quote-request-detail', params: { oaNo: guide.value.oaNo }, query: { itemId: guide.value.itemId } })
}

async function download(kind) {
  if (exporting.value) return
  const scope = user.businessUnitType
  const template = kind === 'template'
  exporting.value = kind
  try {
    const [xlsx, entries] = await Promise.all([import('xlsx'), template ? [example] : listOemProducts()])
    if (scope !== user.businessUnitType) return
    const header = [...fields.map(([, label]) => label), 'OEM费率']
    const values = entries.map(row => fields.map(([field]) => String(row[field] ?? '')))
    const sheet = xlsx.utils.aoa_to_sheet([header, ...values])
    entries.forEach((row, index) => {
      if (row.oemRate != null) sheet[xlsx.utils.encode_cell({ r: index + 1, c: 4 })] = { t: 'n', v: Number(row.oemRate), z: '0.####%' }
    })
    sheet['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 16 }]
    const book = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(book, sheet, 'OEM产品配置表')
    saveWorkbook(xlsx, book, template ? 'OEM产品配置表模板.xlsx' : 'OEM产品配置表.xlsx')
  } catch (error) {
    if (!error?.userNotified) ElMessage.error('下载失败，请重试')
  } finally {
    exporting.value = ''
  }
}

async function save() {
  if (saving.value) return
  const payload = Object.fromEntries(fields.map(([field]) => [field, form[field].trim()]))
  if (!payload.productCode) {
    ElMessage.warning('请输入料号')
    return
  }
  const percent = form.oemPercent.trim().replace(/[%％]$/, '')
  if (form.oemPercent.trim() && (!/^\d{1,3}(?:\.\d{1,4})?$/.test(percent) || Number(percent) > 100)) {
    ElMessage.warning('请输入 0 至 100 的百分比，最多四位小数')
    return
  }
  payload.oemRate = percent ? (Number(percent) / 100).toFixed(6) : null
  const scope = user.businessUnitType
  saving.value = true
  try {
    if (editingId.value == null) await createOemProduct(payload)
    else await updateOemProduct(editingId.value, { ...payload, revision: form.revision })
    if (scope === user.businessUnitType) {
      editorOpen.value = false
      ElMessage.success('OEM产品已保存')
      await refresh()
    }
  } catch { /* Retain the input so it can be corrected. */ }
  finally { saving.value = false }
}

async function remove(row) {
  const scope = user.businessUnitType
  try {
    await ElMessageBox.confirm(`移除料号 ${row.productCode} 的OEM配置？`, '移除OEM产品', {
      type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消',
    })
  } catch { return }
  if (scope !== user.businessUnitType || saving.value) return
  saving.value = true
  try {
    await deleteOemProduct(row.id, row.revision)
    if (scope === user.businessUnitType) await refresh()
  } catch { /* The shared HTTP client presents the error. */ }
  finally { saving.value = false }
}

watch(keyword, () => { page.value = 1 })
watch([() => user.businessUnitType, () => route.fullPath], async () => {
  const selected = guide.value
  editorOpen.value = false
  rows.value = []
  page.value = 1
  keyword.value = selected?.productCode ?? ''
  if (await refresh() && selected?.productCode && selected === guide.value) {
    openEditor(rows.value.find(row => row.productCode === selected.productCode) || selected, true)
  }
}, { immediate: true })
</script>

<style scoped>
.oem-config { padding: 24px; }
.page-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.page-heading h1 { margin: 0; font-size: 22px; }
.product-search { max-width: 320px; margin-bottom: 14px; }
.el-pagination { margin-top: 14px; }
</style>
