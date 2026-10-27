<template>
  <div class="finance-base-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-heading">
          <div>
            <h2>财务基价</h2>
            <p>选择要维护的月份，导出上月基价，修改后导入所选月份；商用与板换分别维护。</p>
          </div>
          <div v-if="canImport" class="publication-actions">
            <el-button :loading="exporting" :disabled="!exportSourceMonth || publishing" @click="exportPrevious">导出上月{{ scope.priceOrgCode === '220' ? '板换' : '商用' }}基价</el-button>
            <el-button type="primary" :disabled="publishing" @click="importVisible = true">导入财务基价表</el-button>
          </div>
        </div>
      </template>
      <el-form inline>
        <el-form-item label="组织">
          <el-select v-model="scope.priceOrgCode" aria-label="财务基价组织" style="width: 130px" @change="changeOrganization">
            <el-option label="商用" value="210" />
            <el-option label="板换" value="220" />
          </el-select>
        </el-form-item>
        <el-form-item label="月份">
          <el-date-picker v-model="scope.priceMonth" type="month" value-format="YYYY-MM" :clearable="false" @change="scopeChanged" />
        </el-form-item>
        <el-form-item v-if="scope.priceOrgCode === '220'" label="条件">
          <el-select v-model="scope.condition" aria-label="板换基价条件" style="width: 130px" @change="scopeChanged">
            <el-option label="非招标" value="NON_TENDER" />
            <el-option label="招标" value="TENDER" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="snapshot?.schemeCodes.length > 1" label="方案">
          <el-select v-model="scope.schemeCode" aria-label="财务基价方案" style="width: 180px" @change="loadSnapshot">
            <el-option v-for="code in snapshot.schemeCodes" :key="code" :value="code" :label="schemeLabel(code)" />
          </el-select>
        </el-form-item>
        <el-form-item><el-button :loading="loading" @click="loadSnapshot">查询</el-button></el-form-item>
      </el-form>
      <p v-if="canImport && exportSourceMonth" class="monthly-hint">导出来源：{{ exportSourceMonth }} 最后一次发布的全部基价；导入月份：{{ scope.priceMonth }}。发布时同步生成适用原稿的财务有效价，上月记录保留。</p>
      <el-alert v-if="loadError" :title="loadError" type="info" :closable="false" show-icon />
      <template v-if="snapshot">
        <div class="publication-summary">
          <span>方案：{{ schemeLabel(snapshot.scope.schemeCode) }}</span>
          <span>修订：{{ snapshot.revision }}</span>
          <span>来源：{{ snapshot.fileName }}</span>
          <span>发布人：{{ snapshot.publishedBy }} · {{ snapshot.publishedAt?.replace('T', ' ') }}</span>
          <span v-if="snapshot.publicationNote">调整原因：{{ snapshot.publicationNote }}</span>
        </div>
        <div v-if="copper" class="copper-summary">
          <div><span>财务 Cu 基价</span><strong>{{ copperPerTon }} <small>元/吨</small></strong></div>
          <el-button v-if="canEditCopper" @click="openCopperAdjustment">调整 Cu 基价</el-button>
        </div>
        <el-table v-loading="loading" :data="factorRows" max-height="520">
          <el-table-column prop="shortName" label="因素" min-width="160" />
          <el-table-column label="有效基价" min-width="160"><template #default="{ row }">{{ displayFactorPrice(row.price) }}</template></el-table-column>
          <el-table-column label="单位" width="110"><template #default="{ row }">{{ priceUnitLabel(row.unit) }}</template></el-table-column>
          <el-table-column label="税价" width="80"><template #default="{ row }">{{ row.taxIncluded ? '含税' : '未税' }}</template></el-table-column>
          <el-table-column label="来源" min-width="240">
            <template #default="{ row }">
              <el-popover trigger="click" width="420">
                <template #reference><el-button link type="primary">{{ row.sources.map(s => `${s.sheetName}!${s.cellRef}`).join('、') }}</el-button></template>
                <div v-for="source in row.sources" :key="source.id" class="source-detail">
                  <b>{{ source.sheetName }}!{{ source.cellRef }}</b>
                  <div>原值：{{ source.originalValue }} {{ source.originalUnit }}</div>
                  <div v-if="source.formula">原公式：{{ source.formula }}</div>
                  <div v-if="source.conversionBasis === 'BOARD_FIXED_SUS_VALUE_DIVIDE_1000'">板换固定不锈钢价由元/吨换算为元/公斤。</div>
                  <div v-if="source.conversionBasis === 'CURRENT_WORKBOOK_PREVIOUS_MONTH_AVERAGE'">方案未填写，采用本表上月均价。</div>
                  <div v-if="source.conversionBasis === 'FINANCE_MANUAL_CU_ADJUSTMENT'">有效价来自财务 Cu 调整，原文件值保留。</div>
                </div>
              </el-popover>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <el-dialog v-model="importVisible" title="导入财务基价表" width="880px" :close-on-click-modal="false">
      <p>{{ scope.priceOrgCode === '220' ? '板换' : '商用' }} · 导入月份：{{ scope.priceMonth }}</p>
      <el-upload ref="financeUpload" :auto-upload="false" :limit="1" accept=".xls,.xlsx" :on-change="chooseFile" :on-exceed="replaceFile" :on-remove="removeFile" :disabled="publishing">
        <el-button>选择财务基价表</el-button>
        <template #tip><div class="el-upload__tip">支持修改后的上月导出文件，也支持原商用多方案基价表和板换基价表。请保留全部方案或招标/非招标列，预检后再确认发布。</div></template>
      </el-upload>
      <el-form label-width="110px" class="import-options">
        <el-form-item label="Sheet（可选）"><el-input v-model="importContext.sheetName" placeholder="多个匹配表时填写" @input="clearImportPreview" /></el-form-item>
        <el-form-item v-if="schemes.length" label="默认方案">
          <el-select v-model="importContext.defaultSchemeCode" @change="clearImportPreview">
            <el-option v-for="scheme in schemes" :key="scheme.code" :label="scheme.label" :value="scheme.code" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-button :disabled="!file" :loading="previewing" @click="previewImport">预检并查看差异</el-button>
      <div v-if="importPreview" class="preview-result">
        <p>有效价格 {{ importPreview.changes.filter(c => c.kind !== 'REMOVED').length }} 项；来源记录 {{ importPreview.workbook.values.length }} 条。</p>
        <el-alert v-if="importPreview.workbook.problems.length" title="存在异常，整批不能发布" type="error" :closable="false" />
        <div v-for="(problem, index) in importPreview.workbook.problems" :key="index" class="problem">{{ problem.sheetName }}!{{ problem.cellRef }}：{{ problem.message }}</div>
        <el-table :data="importPreview.changes" max-height="310">
          <el-table-column label="因素" min-width="150"><template #default="{ row }">{{ factorLabel(row.canonicalKey) }}</template></el-table-column>
          <el-table-column prop="schemeCode" label="方案" width="135" />
          <el-table-column label="条件" width="90"><template #default="{ row }">{{ conditionLabel(row.conditionCode) }}</template></el-table-column>
          <el-table-column label="原有效价" min-width="140"><template #default="{ row }">{{ displayFactorPrice(row.previousPrice) }}</template></el-table-column>
          <el-table-column label="本次有效价" min-width="140"><template #default="{ row }">{{ displayFactorPrice(row.price) }}</template></el-table-column>
          <el-table-column label="变化" width="80"><template #default="{ row }">{{ changeLabel(row.kind) }}</template></el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="importVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="!canConfirmImport" :loading="publishing" @click="confirmImport">{{ publishing ? '正在发布并生成有效价' : '确认发布' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="copperVisible" title="调整财务 Cu 基价" width="560px" :close-on-click-modal="false">
      <p>本次调整 {{ snapshot?.scope.schemeCode }} / {{ conditionLabel(scope.condition) }} 的 Cu。其他因素保持当前有效值。</p>
      <el-form label-width="110px">
        <el-form-item label="Cu（元/吨）"><el-input v-model="copperForm.pricePerTon" inputmode="decimal" @input="clearCopperPreview" /></el-form-item>
        <el-form-item label="调整原因"><el-input v-model="copperForm.changeReason" type="textarea" maxlength="512" show-word-limit @input="clearCopperPreview" /></el-form-item>
      </el-form>
      <el-button :loading="previewingCopper" @click="previewCopper">预检调整</el-button>
      <el-alert v-if="copperPreview" class="preview-result" type="success" :closable="false" title="预检通过，确认后保存新修订。原修订及原文件值保留。" />
      <template #footer>
        <el-button @click="copperVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!copperPreview || previewingCopper" :loading="publishingCopper" @click="confirmCopper">{{ publishingCopper ? '正在保存并生成有效价' : '确认调整' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { financePublicationMessage } from '../components/originalPriceDisplay'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { fetchFinanceFactorSnapshot, previewFinanceFactors, publishFinanceFactors, previewFinanceCopper, publishFinanceCopper, exportPreviousFinanceFactors } from '../api/financeFactorPublications'
import { displayFactorPrice, factorPricePerTon, priceUnitLabel, publicationCanConfirm, validateCopperAdjustment, financePreviousMonthExport } from './financeFactorPublicationUtils'

const user = useUserStore()
const allowed = (permission) => user.permissions?.includes('*:*:*') || user.permissions?.includes(permission)
const canImport = computed(() => allowed('price:finance-base:import'))
const canReadFactors = computed(() => allowed('price:finance-base:list'))
const canEditCopper = computed(() => allowed('cost:finance-cu-base:edit'))
const route = useRoute()
const now = new Date()
const initialOrg = ['210', '220'].includes(route.query.priceOrgCode) ? route.query.priceOrgCode : (route.query.businessUnitType === 'PLATE' ? '220' : '210')
const initialMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.priceMonth || '') ? route.query.priceMonth : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const scope = ref({ priceOrgCode: initialOrg, priceMonth: initialMonth, condition: initialOrg === '220' ? 'NON_TENDER' : 'GENERAL', schemeCode: '' })
const snapshot = ref(null)
const loadError = ref('')
const loading = ref(false)
const exporting = ref(false)
const exportSourceMonth = computed(() => { try { return financePreviousMonthExport(scope.value).sourceMonth } catch { return '' } })
let alive = true
const exportScope = () => JSON.stringify([scope.value.priceMonth, scope.value.priceOrgCode, user.userId, user.businessUnitType])
async function exportPrevious() {
  if (!canImport.value || exporting.value) return
  const selected = exportScope()
  const isCurrent = () => alive && canImport.value && selected === exportScope()
  exporting.value = true
  try { await exportPreviousFinanceFactors({ ...scope.value }, { isCurrent }) }
  catch (error) { if (isCurrent()) ElMessage.error(error.message || '上月财务基价导出失败') }
  finally { exporting.value = false }
}
const factorRows = computed(() => Object.values(snapshot.value?.factors || {}))
const copper = computed(() => snapshot.value?.factors?.['AVG|1#CU'])
const copperPerTon = computed(() => factorPricePerTon(copper.value))
const importVisible = ref(false)
const file = ref(null)
const financeUpload = ref(null)
const importContext = ref({ sheetName: '', defaultSchemeCode: '' })
const schemes = ref([])
const importPreview = ref(null)
const previewing = ref(false)
const publishing = ref(false)
const canConfirmImport = computed(() => publicationCanConfirm(importPreview.value, file.value, publishing.value || previewing.value))
const copperVisible = ref(false)
const copperForm = ref({ pricePerTon: '', changeReason: '' })
const copperPreview = ref(null)
const previewingCopper = ref(false)
const publishingCopper = ref(false)
const copperPriceId = ref(null)
let snapshotRequest = 0
let importRequest = 0
let copperRequest = 0
const factorLabel = (key) => importPreview.value?.workbook.values.find(value => value.canonicalKey === key)?.shortName || key
const conditionLabel = (condition) => ({ GENERAL: '通用', NON_TENDER: '非招标', TENDER: '招标' }[condition] || condition)
const schemeLabel = (code) => code === 'BOARD' ? '板换基价' : code?.startsWith('CU_') ? `Cu ${code.slice(3)} 元/吨方案` : code
const changeLabel = (kind) => ({ NEW: '新增', CHANGED: '修改', UNCHANGED: '未变', REMOVED: '移除' }[kind] || kind)

async function loadSnapshot() {
  const request = ++snapshotRequest
  loading.value = true
  snapshot.value = null
  loadError.value = ''
  try {
    const result = await fetchFinanceFactorSnapshot({ ...scope.value }, !canReadFactors.value)
    if (request === snapshotRequest) {
      snapshot.value = result
      scope.value.schemeCode = result.scope.schemeCode
    }
  } catch (error) {
    if (request === snapshotRequest) loadError.value = error.message || '财务基价读取失败'
  } finally {
    if (request === snapshotRequest) loading.value = false
  }
}
function clearImportPreview() { importRequest++; importPreview.value = null }
function clearCopperPreview() { copperRequest++; copperPreview.value = null }
function scopeChanged() {
  scope.value.schemeCode = ''
  clearImportPreview()
  clearCopperPreview()
  copperVisible.value = false
  importContext.value = { sheetName: '', defaultSchemeCode: '' }
  schemes.value = []
  loadSnapshot()
}
function changeOrganization() {
  scope.value.condition = scope.value.priceOrgCode === '220' ? 'NON_TENDER' : 'GENERAL'
  scopeChanged()
}
function chooseFile(upload) {
  file.value = upload.raw
  schemes.value = []
  importContext.value = { sheetName: '', defaultSchemeCode: '' }
  clearImportPreview()
}
function replaceFile(files) {
  if (!files.length || publishing.value) return
  financeUpload.value?.clearFiles()
  financeUpload.value?.handleStart(files[0])
}
function removeFile() { file.value = null; clearImportPreview() }
async function previewImport() {
  if (!file.value) return
  previewing.value = true
  clearImportPreview()
  const request = importRequest
  try {
    const result = await previewFinanceFactors(file.value, { ...scope.value, ...importContext.value })
    if (request !== importRequest) return
    importContext.value = { sheetName: result.context.sheetName, defaultSchemeCode: result.context.defaultSchemeCode }
    schemes.value = result.workbook.schemes
    importPreview.value = result
  } catch (error) { if (request === importRequest) ElMessage.error(error.message || '预检失败') }
  finally { previewing.value = false }
}
async function confirmImport() {
  if (!canConfirmImport.value) return
  publishing.value = true
  try {
    const result = await publishFinanceFactors(file.value, { ...scope.value, ...importContext.value }, importPreview.value.previewFingerprint)
    ElMessage.success(financePublicationMessage(result))
    importVisible.value = false
    clearImportPreview()
    await loadSnapshot()
  } catch (error) { clearImportPreview(); ElMessage.error(error.message || '发布失败') }
  finally { publishing.value = false }
}
function openCopperAdjustment() {
  copperPriceId.value = copper.value.monthlyPriceId
  copperForm.value = { pricePerTon: copperPerTon.value, changeReason: '' }
  clearCopperPreview()
  copperVisible.value = true
}
async function previewCopper() {
  const error = validateCopperAdjustment(copperForm.value)
  if (error) return ElMessage.warning(error)
  previewingCopper.value = true
  clearCopperPreview()
  const request = copperRequest
  try {
    const result = await previewFinanceCopper(copperPriceId.value, { ...copperForm.value })
    if (request === copperRequest) copperPreview.value = result
  } catch (error) { if (request === copperRequest) ElMessage.error(error.message || '调整预检失败') }
  finally { previewingCopper.value = false }
}
async function confirmCopper() {
  if (!copperPreview.value || publishingCopper.value) return
  publishingCopper.value = true
  try {
    const result = await publishFinanceCopper(copperPriceId.value, { ...copperForm.value, previewFingerprint: copperPreview.value.previewFingerprint })
    ElMessage.success(financePublicationMessage(result))
    copperVisible.value = false
    await loadSnapshot()
  } catch (error) { copperPreview.value = null; ElMessage.error(error.message || '调整失败') }
  finally { publishingCopper.value = false }
}
onMounted(loadSnapshot)
onBeforeUnmount(() => { alive = false })
</script>

<style scoped>
.finance-base-page { padding: 20px; }
.publication-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.monthly-hint { color: #606266; font-size: 13px; line-height: 1.6; }
.page-heading, .copper-summary { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.page-heading h2 { margin: 0 0 8px; font-size: 21px; }
.page-heading p { margin: 0; color: #667085; font-size: 14px; }
.publication-summary { display: flex; flex-wrap: wrap; gap: 20px; padding: 12px 0; color: #667085; font-size: 13px; }
.copper-summary { margin: 12px 0 22px; padding: 20px; border-radius: 8px; background: #f4f8ff; }
.copper-summary span { display: block; color: #667085; margin-bottom: 8px; }
.copper-summary strong { color: #175cd3; font-size: 27px; }
.copper-summary small { font-size: 14px; font-weight: normal; }
.import-options, .preview-result { margin-top: 18px; }
.problem { color: #b42318; padding: 6px 0; }
.source-detail { margin: 10px 0; line-height: 1.7; overflow-wrap: anywhere; }
</style>
