<template>
  <el-drawer
    :model-value="modelValue"
    class="alternative-selection-drawer"
    direction="rtl"
    size="720px"
    :with-header="false"
    :modal="false"
    :lock-scroll="false"
    :append-to-body="true"
    :destroy-on-close="true"
    @update:model-value="updatePanelVisibility"
  >
    <header class="panel-head">
      <div>
        <strong>标准/替代选择</strong>
        <span>选择即预览，应用后生效</span>
      </div>
      <button type="button" class="panel-close" aria-label="关闭方案面板" @click="closePanel">×</button>
    </header>
    <div class="alternative-drawer" v-loading="loading">
      <div class="preview-tip">
        左侧实时展示整支 BOM 和特殊规则结果，预览不会写入数据库。
      </div>
      <el-alert
        v-if="confirmed"
        type="warning"
        show-icon
        :closable="false"
        class="drawer-alert"
        title="当前产品的本月计价 BOM 已确认，标准/替代选择只能查看。"
      />
      <el-alert
        v-if="reviewWarning"
        type="error"
        show-icon
        :closable="false"
        class="drawer-alert stale-alert"
        :title="reviewWarning"
      />
      <el-alert
        v-else-if="!canSelect"
        type="info"
        show-icon
        :closable="false"
        class="drawer-alert"
        title="你有替代关系查看权限，但没有选择替代件或恢复标准件的权限。"
      />

      <el-empty
        v-if="!loading && groups.length === 0"
        description="当前报价产品没有可选择的标准/替代组"
      />

      <section
        v-for="group in groups"
        :key="group.alternativeGroupKey"
        class="alternative-group"
      >
        <header class="group-head">
          <div>
            <span class="field-label">父件</span>
            <strong>{{ group.parentMaterialCode || '-' }} {{ group.parentMaterialName || '' }}</strong>
          </div>
          <div class="group-status">
            <el-tag effect="light" :type="groupStatusType(group)">
              {{ groupStatusText(group) }}
            </el-tag>
            <el-tag v-if="group.reviewRequired" type="danger" effect="dark">需要重新确认</el-tag>
          </div>
        </header>

        <div class="group-location">
          <div>
            <span class="field-label">当前位置</span>
            <span>{{ groupLocationText(group) }}</span>
          </div>
        </div>

        <el-radio-group
          v-model="draftSelections[group.alternativeGroupKey]"
          class="candidate-list"
          :disabled="groupDisabled(group) || savingGroupKey === group.alternativeGroupKey"
          @change="previewGroup(group)"
        >
          <el-radio
            v-for="candidate in candidatesOf(group)"
            :key="candidate.materialCode"
            :value="candidate.materialCode"
            class="candidate-radio"
          >
            <span class="candidate-main">
              <span class="candidate-code">{{ candidate.materialCode || '-' }}</span>
              <span class="candidate-name">{{ candidate.materialName || '-' }}</span>
              <span v-if="candidate.materialSpec" class="candidate-spec">{{ candidate.materialSpec }}</span>
            </span>
            <span class="candidate-tags">
              <el-tag
                v-for="tag in candidateTags(candidate, group)"
                :key="tag.text"
                size="small"
                effect="light"
                :type="tag.type"
              >
                {{ tag.text }}
              </el-tag>
            </span>
          </el-radio>
        </el-radio-group>

        <footer class="group-footer">
          <div class="group-meta">
            <span>BOM：{{ group.bomPurpose || '-' }} / {{ group.bomVersion || '-' }}</span>
            <span>选择版本：{{ group.selectionVersion ?? '-' }}</span>
          </div>
          <div class="group-actions">
            <el-button
              link
              type="primary"
              :loading="historyLoadingGroup === group.alternativeGroupKey"
              @click="emit('load-history', group)"
            >
              查看选择历史
            </el-button>
            <el-button
              :disabled="!selectionChanged(group)"
              @click="restoreGroup(group)"
            >
              恢复当前
            </el-button>
            <el-button
              type="primary"
              :loading="savingGroupKey === group.alternativeGroupKey || previewingGroupKey === group.alternativeGroupKey"
              :disabled="groupDisabled(group) || !selectionChanged(group)"
              @click="saveGroup(group)"
            >
              应用此方案
            </el-button>
          </div>
        </footer>

        <div
          v-if="historyRows(group).length > 0"
          class="selection-history"
        >
          <div
            v-for="history in historyRows(group)"
            :key="`${history.selectionNo || ''}-${history.selectionVersion}`"
            class="history-row"
          >
            <span>版本 {{ history.selectionVersion ?? '-' }}</span>
            <span>{{ history.selectedMaterialCode || '-' }}</span>
            <span>{{ history.selectedBy || '-' }}</span>
            <span>{{ formatHistoryTime(history.selectedAt) }}</span>
            <span>{{ history.selectionRemark || '-' }}</span>
          </div>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  alternativeReviewWarning,
  alternativeSelectionDisabled,
  sortAlternativeCandidates,
} from '../utils/quoteBomAlternativeUtils'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  savingGroupKey: {
    type: String,
    default: '',
  },
  summary: {
    type: Object,
    default: () => ({}),
  },
  confirmed: {
    type: Boolean,
    default: false,
  },
  canSelect: {
    type: Boolean,
    default: false,
  },
  histories: {
    type: Object,
    default: () => ({}),
  },
  historyLoadingGroup: {
    type: String,
    default: '',
  },
  previewingGroupKey: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'update:modelValue',
  'save',
  'preview',
  'restore-preview',
  'cancel-preview',
  'load-history',
])
const draftSelections = ref({})
const groups = computed(() => Array.isArray(props.summary?.groups) ? props.summary.groups : [])
const reviewWarning = computed(() => alternativeReviewWarning(props.summary))

watch(
  () => props.summary?.groups,
  () => resetDraftSelections(),
  { immediate: true, deep: true },
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) resetDraftSelections()
  },
)

function resetDraftSelections() {
  const next = {}
  groups.value.forEach((group) => {
    next[group.alternativeGroupKey] = group.selectedMaterialCode || ''
  })
  draftSelections.value = next
}

function candidatesOf(group) {
  return sortAlternativeCandidates(group?.candidates)
}

function candidateTags(candidate, group) {
  const childType = String(candidate?.childType || '').toUpperCase()
  const materialCode = String(candidate?.materialCode || '')
  const savedMaterialCode = String(group?.selectedMaterialCode || '')
  const draftMaterialCode = String(draftSelections.value[group.alternativeGroupKey] || '')
  const tags = [{
    text: childType === 'ALTERNATIVE' ? '替代方案' : '标准方案',
    type: childType === 'ALTERNATIVE' ? 'warning' : 'primary',
  }]
  if (materialCode === savedMaterialCode) {
    tags.push({ text: '当前使用', type: 'success' })
  }
  if (materialCode === draftMaterialCode && draftMaterialCode !== savedMaterialCode) {
    tags.push({ text: '预览方案', type: 'primary' })
  }
  return tags
}

function groupDisabled(group) {
  return alternativeSelectionDisabled({
    confirmed: props.confirmed,
    canSelect: props.canSelect,
    summary: props.summary,
    group,
  })
}

function selectionChanged(group) {
  return String(draftSelections.value[group.alternativeGroupKey] || '')
    !== String(group?.selectedMaterialCode || '')
}

function saveGroup(group) {
  emit('save', {
    group,
    selectedMaterialCode: draftSelections.value[group.alternativeGroupKey],
  })
}

function previewGroup(group) {
  groups.value.forEach((candidateGroup) => {
    if (candidateGroup.alternativeGroupKey !== group.alternativeGroupKey) {
      draftSelections.value[candidateGroup.alternativeGroupKey]
        = candidateGroup.selectedMaterialCode || ''
    }
  })
  if (!selectionChanged(group)) {
    emit('restore-preview', group)
    return
  }
  emit('preview', {
    group,
    selectedMaterialCode: draftSelections.value[group.alternativeGroupKey],
  })
}

function restoreGroup(group) {
  draftSelections.value[group.alternativeGroupKey] = group?.selectedMaterialCode || ''
  emit('restore-preview', group)
}

function closePanel() {
  updatePanelVisibility(false)
}

function updatePanelVisibility(visible) {
  if (!visible) {
    resetDraftSelections()
    emit('cancel-preview')
  }
  emit('update:modelValue', visible)
}

function groupLocationText(group) {
  const location = [
    group?.childSeq != null ? `第 ${group.childSeq} 个子项` : '',
    group?.processSeq ? `工序 ${group.processSeq}` : '',
  ].filter(Boolean)
  return location.join(' · ') || '当前父件下'
}

function groupStatusText(group) {
  if (group?.reviewRequired || String(group?.selectionStatus || '').toUpperCase() === 'STALE') {
    return '需要复核'
  }
  return String(group?.selectedChildType || '').toUpperCase() === 'ALTERNATIVE'
    ? '当前替代方案'
    : '当前标准方案'
}

function groupStatusType(group) {
  if (group?.reviewRequired || String(group?.selectionStatus || '').toUpperCase() === 'STALE') {
    return 'danger'
  }
  if (String(group?.selectedChildType || '').toUpperCase() === 'ALTERNATIVE') {
    return 'warning'
  }
  return 'success'
}

function historyRows(group) {
  const rows = props.histories?.[group.alternativeGroupKey]
  return Array.isArray(rows) ? rows : []
}

function formatHistoryTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 19) : '-'
}
</script>

<style scoped>
:global(.alternative-selection-drawer) {
  border-left: 1px solid #dce5f0;
  background: #fff;
  box-shadow: -18px 0 48px rgb(31 55 85 / 14%);
}

:global(.alternative-selection-drawer .el-drawer__body) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid #edf1f6;
  background: #fbfcfe;
}

.panel-head strong,
.panel-head span {
  display: block;
}

.panel-head strong {
  color: #233247;
  font-size: 16px;
}

.panel-head span {
  margin-top: 3px;
  color: #8793a4;
  font-size: 12px;
}

.panel-close {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #7d8999;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  line-height: 30px;
}

.panel-close:hover {
  background: #eef2f7;
}

.alternative-drawer {
  display: flex;
  overflow: auto;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 16px 18px 22px;
}

.preview-tip {
  padding: 10px 12px;
  border-radius: 7px;
  color: #607086;
  background: #f2f6fb;
  font-size: 12px;
  line-height: 1.6;
}

.stale-alert {
  font-weight: 650;
}

.alternative-group {
  overflow: hidden;
  border: 1px solid #dfe5ef;
  border-radius: 9px;
  background: #fff;
}

.group-head,
.group-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #fbfcfe;
}

.group-head strong {
  display: block;
  margin-top: 4px;
  color: #253044;
}

.field-label {
  display: block;
  color: #7a8495;
  font-size: 12px;
}

.group-status,
.candidate-tags,
.group-actions,
.group-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.group-location {
  padding: 11px 14px 4px;
  color: #4d5869;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 8px 14px 12px;
}

.candidate-radio {
  width: 100%;
  height: auto;
  min-height: 60px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #e4e9f1;
  border-radius: 8px;
  transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
  white-space: normal;
}

.candidate-radio.is-checked {
  border-color: #9cc5f4;
  background: #f5f9fe;
  box-shadow: 0 0 0 2px rgb(64 158 255 / 8%);
}

.candidate-radio :deep(.el-radio__label) {
  display: inline-flex;
  width: calc(100% - 24px);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.candidate-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-items: flex-start;
  gap: 2px;
}

.candidate-code {
  color: #253044;
  font-weight: 650;
}

.candidate-name {
  color: #4d5869;
}

.candidate-spec {
  overflow: hidden;
  color: #7a8495;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-footer {
  align-items: flex-end;
  border-top: 1px solid #e8edf4;
}

.group-meta {
  color: #7a8495;
  font-size: 12px;
}

.selection-history {
  padding: 8px 14px 12px;
  border-top: 1px solid #e8edf4;
  background: #fbfcfe;
}

.history-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 0;
  color: #5d6777;
  font-size: 12px;
}

@media (max-width: 900px) {
  :global(.alternative-selection-drawer) {
    width: min(720px, 92vw) !important;
  }
}
</style>
