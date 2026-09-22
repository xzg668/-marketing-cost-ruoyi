<template>
  <section class="resolution-page" v-loading="loading">
    <header class="page-head">
      <div>
        <el-button class="back-button" link :icon="ArrowLeft" @click="returnToQuote()">返回报价单</el-button>
        <h1>为电子图库物料选择 U9 料号</h1>
        <p>{{ oaNo }} · 图号 {{ state.electronicDrawingNo || '-' }}</p>
      </div>
      <el-button :loading="loading" @click="loadState">刷新</el-button>
    </header>

    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
    <el-alert v-else-if="state.sourceVersionId" class="ready-summary" type="success" :closable="false" show-icon>
      <template #title>电子图库 BOM 已读取，只处理系统无法唯一匹配的物料</template>
      共 {{ state.totalCount || 0 }} 个物料，{{ state.autoMatchedCount || 0 }} 个已自动匹配，
      {{ state.manuallySelectedCount || 0 }} 个已保存；还剩 {{ pendingItems.length }} 个需要选择。
    </el-alert>

    <div v-if="pendingItems.length" class="resolution-workspace">
      <aside class="pending-panel">
        <div class="panel-title">
          <div>
            <strong>待选择物料</strong>
            <span>{{ selectedCount }}/{{ pendingItems.length }} 已选</span>
          </div>
          <el-progress
            type="circle"
            :width="52"
            :stroke-width="5"
            :show-text="false"
            :percentage="pendingItems.length ? selectedCount / pendingItems.length * 100 : 100"
          />
        </div>

        <button
          v-for="(item, index) in pendingItems"
          :key="item.sourceNodeId"
          type="button"
          class="pending-item"
          :class="{ active: sameNode(item, activeItem), selected: selectionDraft[item.sourceNodeId] }"
          @click="selectItem(item)"
        >
          <span class="item-index">{{ index + 1 }}</span>
          <span class="item-main">
            <strong>{{ item.sourceName || '未命名物料' }}</strong>
            <small>{{ item.drawingCode || '无图号' }} · 数量 {{ formatQuantity(item.quantity) }}</small>
            <em v-if="selectionDraft[item.sourceNodeId]">
              已选 {{ selectionDraft[item.sourceNodeId].materialCode }}
            </em>
            <em v-else>待选择</em>
          </span>
          <span class="item-state">{{ selectionDraft[item.sourceNodeId] ? '✓' : '›' }}</span>
        </button>
      </aside>

      <main v-if="activeItem" class="selection-panel">
        <div class="source-card">
          <div class="source-card__heading">
            <div>
              <span>电子图库物料</span>
              <h2>{{ activeItem.sourceName || '未命名物料' }}</h2>
            </div>
            <el-tag effect="plain">BOM 第 {{ activeItem.sourceRowNo || '-' }} 行</el-tag>
          </div>
          <dl>
            <div><dt>图号</dt><dd>{{ activeItem.drawingCode || '-' }}</dd></div>
            <div><dt>材料/规格</dt><dd>{{ activeItem.sourceMaterial || '-' }}</dd></div>
            <div><dt>用量</dt><dd>{{ formatQuantity(activeItem.quantity) }}</dd></div>
          </dl>
        </div>

        <div v-if="currentSelection" class="selected-card">
          <span>当前已选</span>
          <div>
            <strong>{{ currentSelection.materialName || '-' }}</strong>
            <b>{{ currentSelection.materialCode }}</b>
          </div>
          <small>{{ optionDetail(currentSelection) }}</small>
        </div>

        <div class="search-card">
          <div class="search-heading">
            <div><strong>搜索 U9 料品档案</strong><p>选择搜索方式，输入条件后主动查询。</p></div>
            <span>物料组织 {{ state.materialOrganizationCode || '-' }}</span>
          </div>
          <div class="search-controls">
            <el-radio-group v-model="searchType" @change="handleSearchTypeChange">
              <el-radio-button
                v-for="item in ELECTRONIC_DRAWING_SEARCH_TYPES"
                :key="item.value"
                :label="item.value"
              >{{ item.label }}</el-radio-button>
            </el-radio-group>
            <el-input
              v-model="keyword"
              clearable
              :placeholder="searchPlaceholder"
              @keyup.enter="searchOptions"
            >
              <template #append>
                <el-button :loading="searching" @click="searchOptions">搜索</el-button>
              </template>
            </el-input>
          </div>

          <div class="results-heading">
            <strong>搜索结果</strong>
            <span v-if="searchPerformed">找到 {{ options.length }} 个正常启用料品</span>
          </div>
          <el-empty
            v-if="!searchPerformed"
            :image-size="72"
            description="尚未搜索，请输入条件后查询 U9 料品档案"
          />
          <el-empty
            v-else-if="!options.length && !searching"
            :image-size="72"
            description="没有找到符合条件的正常启用料品，请更换条件再试"
          />
          <div v-else class="search-results">
            <button
              v-for="option in options"
              :key="option.materialCode"
              type="button"
              class="result-item"
              :class="{ selected: currentSelection?.materialCode === option.materialCode }"
              @click="chooseOption(option)"
            >
              <span class="result-main">
                <strong>{{ option.materialName || '-' }}</strong>
                <b>{{ option.materialCode }}</b>
                <small>{{ optionDetail(option) }}</small>
              </span>
              <span class="result-action">
                {{ currentSelection?.materialCode === option.materialCode ? '已选择' : '选择' }}
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <el-result
      v-else-if="!loading && !loadError && state.complete"
      icon="success"
      title="U9 料号已全部确认"
      :sub-title="completionMessage"
    >
      <template #extra>
        <el-button v-if="!state.bomComposed" :loading="saving" @click="saveSelections(true)">重新检查 BOM</el-button>
        <el-button type="primary" @click="returnToQuote()">返回报价单</el-button>
      </template>
    </el-result>

    <footer v-if="pendingItems.length" class="save-bar">
      <div>
        <strong>已选择 {{ selectedCount }} 个</strong>
        <span v-if="selectedCount < pendingItems.length">可以先保存已选项，稍后继续处理剩余物料。</span>
        <span v-else>保存后检查下级 BOM；补录资料完成审批和报价确认后才能核算。</span>
      </div>
      <el-button
        type="primary"
        size="large"
        :loading="saving"
        :disabled="!selectedCount"
        @click="saveSelections()"
      >
        {{ saveButtonText }}
      </el-button>
    </footer>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  fetchElectronicDrawingMaterialResolution,
  saveElectronicDrawingMaterialResolutions,
  searchElectronicDrawingMaterialOptions,
} from '../api/quoteRequests'
import {
  ELECTRONIC_DRAWING_SEARCH_TYPES,
  buildElectronicDrawingResolutionRequest,
  isElectronicDrawingVersionConflict,
  nextUnselectedElectronicDrawingItem,
  pendingElectronicDrawingItems,
  sourceSearchKeyword,
} from '../utils/electronicDrawingMaterialResolution'

const route = useRoute()
const router = useRouter()
const oaNo = computed(() => String(route.params.oaNo || ''))
const itemId = computed(() => String(route.params.itemId || ''))
const taskId = computed(() => String(route.params.taskId || ''))
const loading = ref(false)
const loadError = ref('')
const searching = ref(false)
const saving = ref(false)
const state = ref({ items: [] })
const accountingMonth = computed(() => state.value.accountingMonth || String(route.query.accountingMonth || ''))
const activeNodeId = ref('')
const selectionDraft = reactive({})
const searchType = ref('DRAWING_NO')
const keyword = ref('')
const options = ref([])
const searchPerformed = ref(false)

const pendingItems = computed(() => pendingElectronicDrawingItems(state.value))
const activeItem = computed(() => pendingItems.value.find(
  (item) => String(item.sourceNodeId) === String(activeNodeId.value),
) || pendingItems.value[0] || null)
const currentSelection = computed(() => selectionDraft[activeItem.value?.sourceNodeId] || null)
const selectedCount = computed(() => pendingItems.value.filter(
  (item) => selectionDraft[item.sourceNodeId]?.materialCode,
).length)
const saveButtonText = computed(() => selectedCount.value === pendingItems.value.length
  ? `保存 ${selectedCount.value} 项并检查 BOM`
  : `保存已选 ${selectedCount.value} 项`)
const searchPlaceholder = computed(() => ({
  DRAWING_NO: '输入电子图库图号',
  MATERIAL_CODE: '输入 U9 料号',
  MATERIAL_NAME: '输入物料名称',
})[searchType.value])
const completionMessage = computed(() => state.value.bomPublished
  ? 'BOM 已就绪，可返回报价单继续检查和核算。'
  : state.value.bomComposed ? 'BOM 已组好，仍须完成补录审批及报价确认。'
    : '料号已确认，下级 BOM 尚未就绪，请在补录工作台查看需要继续补齐的资料。')

async function loadState() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await fetchElectronicDrawingMaterialResolution(taskId.value, String(route.query.accountingMonth || ''))
    state.value = response || { items: [] }
    if (state.value.accountingMonth && route.query.accountingMonth !== state.value.accountingMonth) {
      await router.replace({ query: { ...route.query, accountingMonth: state.value.accountingMonth } })
    }
    if (state.value.bomPublished) {
      ElMessage.success('BOM 已就绪，可继续核算')
      returnToQuote('resolved')
      return
    }
    const stillActive = pendingItems.value.find(
      (item) => String(item.sourceNodeId) === String(activeNodeId.value),
    )
    selectItem(stillActive || pendingItems.value[0])
  } catch (error) {
    loadError.value = error?.message || '电子图库物料状态加载失败，请刷新重试'
    state.value = { items: [] }
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function selectItem(item) {
  if (!item) return
  activeNodeId.value = String(item.sourceNodeId)
  searchType.value = 'DRAWING_NO'
  keyword.value = sourceSearchKeyword(item, searchType.value)
  options.value = []
  searchPerformed.value = false
}

function handleSearchTypeChange(value) {
  keyword.value = sourceSearchKeyword(activeItem.value, value)
  options.value = []
  searchPerformed.value = false
}

async function searchOptions() {
  const query = keyword.value.trim()
  if (!query) return ElMessage.warning('请输入搜索条件')
  searching.value = true
  options.value = []
  searchPerformed.value = true
  try {
    const response = await searchElectronicDrawingMaterialOptions(taskId.value, {
      sourceVersionId: state.value.sourceVersionId,
      accountingMonth: accountingMonth.value,
      searchType: searchType.value,
      keyword: query,
      limit: 30,
    })
    options.value = response?.options || []
  } catch (error) {
    searchPerformed.value = false
    ElMessage.error(error?.message || 'U9 料品档案搜索失败，请重试')
  } finally {
    searching.value = false
  }
}

function chooseOption(option) {
  if (!activeItem.value || !option?.materialCode) return
  selectionDraft[activeItem.value.sourceNodeId] = option
  const next = nextUnselectedElectronicDrawingItem(
    pendingItems.value,
    selectionDraft,
    activeItem.value.sourceNodeId,
  )
  if (next && String(next.sourceNodeId) !== String(activeItem.value.sourceNodeId)) selectItem(next)
}

async function saveSelections(recheck = false) {
  const request = buildElectronicDrawingResolutionRequest(state.value, selectionDraft)
  if (!request.selections.length && !(recheck && state.value.complete)) {
    return ElMessage.warning('请至少选择一个 U9 料号')
  }
  saving.value = true
  try {
    const response = await saveElectronicDrawingMaterialResolutions(taskId.value, request, accountingMonth.value)
    request.selections.forEach((item) => delete selectionDraft[item.sourceNodeId])
    state.value = response || { items: [] }
    if (state.value.complete) {
      ElMessage.success(completionMessage.value)
      if (state.value.bomPublished) returnToQuote('resolved')
      return
    }
    ElMessage.success(`已保存 ${request.selections.length} 项，还剩 ${pendingItems.value.length} 项`)
    selectItem(pendingItems.value[0])
  } catch (error) {
    if (isElectronicDrawingVersionConflict(error)) {
      Object.keys(selectionDraft).forEach((key) => delete selectionDraft[key])
      await loadState()
      ElMessage.warning('任务状态已变化，页面已恢复最新待处理物料，请重新选择')
    } else {
      ElMessage.error(error?.message || '保存失败；当前选择已保留，可以直接重试')
    }
  } finally {
    saving.value = false
  }
}

function returnToQuote(electronicDrawing) {
  router.replace({
    path: `/ingest/quote-requests/${encodeURIComponent(oaNo.value)}`,
    query: {
      itemId: itemId.value,
      ...(electronicDrawing ? { electronicDrawing } : {}),
    },
  })
}

function sameNode(left, right) {
  return String(left?.sourceNodeId) === String(right?.sourceNodeId)
}

function formatQuantity(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 8 }) : '-'
}

function optionDetail(option) {
  return [option?.materialSpec, option?.materialModel, option?.drawingNo, option?.materialNature]
    .filter(Boolean)
    .join(' · ') || '暂无更多档案信息'
}

onMounted(loadState)
</script>

<style scoped>
.resolution-page {
  min-height: calc(100vh - 116px);
  padding-bottom: 86px;
  color: #1f2937;
}
.page-head, .ready-summary, .resolution-workspace, .save-bar { max-width: 1440px; margin-right: auto; margin-left: auto; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
.page-head h1 { margin: 8px 0 5px; color: #172033; font-size: 25px; }
.page-head p { margin: 0; color: #78849a; font-size: 14px; }
.back-button { padding: 0; color: #5d6b82; }
.ready-summary { box-sizing: border-box; margin-bottom: 18px; border: 1px solid #b7e59c; background: #f2faec; }
.resolution-workspace { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 18px; align-items: start; }
.pending-panel, .selection-panel { box-sizing: border-box; border: 1px solid #e1e7ef; border-radius: 10px; background: #fff; box-shadow: 0 2px 8px rgb(31 41 55 / 4%); }
.pending-panel { overflow: hidden; }
.panel-title { display: flex; align-items: center; justify-content: space-between; padding: 18px; border-bottom: 1px solid #e8edf3; background: #f8fafc; }
.panel-title > div { display: flex; flex-direction: column; gap: 5px; }
.panel-title strong { font-size: 17px; }
.panel-title span { color: #7a8799; font-size: 12px; }
.pending-item { display: flex; width: 100%; align-items: center; gap: 12px; padding: 16px; border: 0; border-bottom: 1px solid #edf1f5; background: #fff; color: inherit; cursor: pointer; text-align: left; }
.pending-item:last-child { border-bottom: 0; }
.pending-item:hover { background: #f7faff; }
.pending-item.active { box-shadow: inset 3px 0 #409eff; background: #eef6ff; }
.pending-item.selected:not(.active) { background: #f5fbf1; }
.item-index { display: flex; width: 28px; height: 28px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; background: #edf2f7; color: #526174; font-weight: 700; }
.pending-item.active .item-index { background: #409eff; color: #fff; }
.pending-item.selected .item-index { background: #67c23a; color: #fff; }
.item-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
.item-main strong, .item-main small, .item-main em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-main small { color: #7a8799; }
.item-main em { color: #409eff; font-size: 12px; font-style: normal; }
.pending-item.selected .item-main em { color: #529b2e; }
.item-state { color: #9aa5b5; font-size: 22px; }
.pending-item.selected .item-state { color: #67c23a; }
.selection-panel { padding: 22px; }
.source-card { padding: 18px 20px; border: 1px solid #dce5ef; border-radius: 8px; background: #fafbfd; }
.source-card__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.source-card__heading span, .selected-card > span { color: #7b8799; font-size: 13px; font-weight: 600; }
.source-card h2 { margin: 7px 0 0; color: #202939; font-size: 21px; }
.source-card dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin: 18px 0 0; }
.source-card dl div { min-width: 0; }
.source-card dt { margin-bottom: 5px; color: #8a95a6; font-size: 12px; }
.source-card dd { overflow: hidden; margin: 0; color: #3f4b5d; text-overflow: ellipsis; white-space: nowrap; }
.selected-card { display: grid; grid-template-columns: 90px 1fr auto; gap: 16px; align-items: center; margin-top: 14px; padding: 14px 18px; border: 1px solid #b9ddff; border-radius: 8px; background: #eff7ff; }
.selected-card div { display: flex; flex-direction: column; gap: 4px; }
.selected-card b { color: #1677d2; }
.selected-card small { max-width: 420px; color: #68768a; text-align: right; }
.search-card { margin-top: 18px; }
.search-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.search-heading strong { font-size: 18px; }
.search-heading p { margin: 5px 0 0; color: #8490a2; font-size: 13px; }
.search-heading > span { color: #7b8799; font-size: 12px; }
.search-controls { display: grid; grid-template-columns: auto minmax(280px, 1fr); gap: 12px; margin-top: 16px; }
.results-heading { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 10px; padding-bottom: 10px; border-bottom: 1px solid #e7ecf2; }
.results-heading span { color: #8490a2; font-size: 12px; }
.search-results { display: flex; max-height: 440px; flex-direction: column; gap: 10px; overflow-y: auto; }
.result-item { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 18px; padding: 15px 17px; border: 1px solid #e1e7ef; border-radius: 8px; background: #fff; color: inherit; cursor: pointer; text-align: left; }
.result-item:hover, .result-item.selected { border-color: #409eff; background: #f2f8ff; }
.result-main { display: grid; min-width: 0; grid-template-columns: minmax(140px, 1fr) 150px minmax(180px, 2fr); gap: 15px; align-items: center; }
.result-main b { color: #1677d2; }
.result-main small { overflow: hidden; color: #718096; text-overflow: ellipsis; white-space: nowrap; }
.result-action { flex: 0 0 auto; color: #409eff; font-weight: 600; }
.save-bar { position: fixed; z-index: 8; right: 24px; bottom: 18px; left: 224px; display: flex; box-sizing: border-box; align-items: center; justify-content: space-between; gap: 24px; padding: 14px 20px; border: 1px solid #dce5ef; border-radius: 10px; background: rgb(255 255 255 / 96%); box-shadow: 0 6px 24px rgb(31 41 55 / 12%); }
.save-bar div { display: flex; flex-direction: column; gap: 4px; }
.save-bar span { color: #7b8799; font-size: 13px; }
@media (max-width: 1100px) {
  .resolution-workspace { grid-template-columns: 260px minmax(0, 1fr); }
  .search-controls { grid-template-columns: 1fr; }
  .result-main { grid-template-columns: 1fr; gap: 4px; }
  .save-bar { left: 24px; }
}
</style>
