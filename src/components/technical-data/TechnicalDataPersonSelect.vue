<template>
  <el-tree-select
    :model-value="modelValue"
    :data="tree"
    :cache-data="selectedCache"
    :default-expanded-keys="expandedKeys"
    :filter-node-method="keepRemoteResult"
    :remote-method="search"
    :disabled="disabled"
    :clearable="clearable"
    :loading="loading"
    :indent="0"
    :aria-label="ariaLabel"
    :fit-input-width="false"
    :show-arrow="false"
    filterable
    remote
    class="technical-person-select"
    popper-class="technical-person-directory"
    placeholder="搜索姓名、工号或部门"
    @update:model-value="selectPerson"
    @visible-change="onVisibleChange"
  >
    <template #prefix>
      <svg class="directory-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" stroke-linecap="round" /></svg>
    </template>
    <template #header>
      <div class="directory-heading">
        <div><strong>选择技术员</strong><span>按事业部 / 部门查找人员</span></div>
        <span class="directory-result-count">{{ loading ? '搜索中…' : `本次 ${people.length} 人` }}</span>
      </div>
    </template>
    <template #default="{ data }">
      <div v-if="data.kind !== 'person'" class="directory-branch" :class="`directory-branch--${data.kind}`" :title="data.label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" stroke-linejoin="round" /><path d="M3 11h18" /></svg>
        <span class="directory-branch-name">{{ data.label }}</span>
        <span class="directory-branch-count">{{ data.count }}</span>
      </div>
      <div v-else class="directory-person" :class="{ 'directory-person--selected': data.value === modelValue }" :title="data.title">
        <span class="directory-avatar" aria-hidden="true">{{ Array.from(data.person.name || '?')[0] }}</span>
        <span class="directory-person-info">
          <span class="directory-person-name">{{ data.person.name }}</span>
          <span class="directory-person-detail"><span class="directory-employee-no">{{ data.person.employeeNo }}</span><span v-if="data.person.position" class="directory-position">{{ data.person.position }}</span></span>
        </span>
        <svg v-if="data.value === modelValue" class="directory-selected-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="已选择"><path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </div>
    </template>
    <template #loading><div class="directory-empty"><span class="directory-loading-dot" />正在查找人员…</div></template>
    <template #empty>
      <div class="directory-empty">
        <strong>{{ error ? '人员目录加载失败' : '没有找到匹配的人员' }}</strong>
        <span>{{ error || '试试姓名、工号，或更具体的部门名称' }}</span>
        <el-button v-if="error" link type="primary" @click="search(keyword)">重新加载</el-button>
      </div>
    </template>
    <template #footer>
      <div class="directory-footer" role="status">
        <span v-if="people.length >= RESULT_LIMIT">当前展示前 {{ RESULT_LIMIT }} 人，请搜索缩小范围</span>
        <span v-else>展开部门选择人员 · 悬停查看完整归属</span>
        <span class="directory-key-hint">↑ ↓ 选择</span>
      </div>
    </template>
  </el-tree-select>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchTechnicalDataAssignees } from '../../api/technicalDataTasks'
import { buildTechnicalDataPeopleTree, technicalDataPersonLabel } from '../../utils/technicalDataPeople'

const props = defineProps({
  modelValue: Number,
  selectedPerson: Object,
  disabled: Boolean,
  clearable: { type: Boolean, default: true },
  ariaLabel: { type: String, default: '选择技术员' },
})
const emit = defineEmits(['update:modelValue', 'change-person'])
const RESULT_LIMIT = 100
const people = ref([]), loading = ref(false), error = ref(''), keyword = ref('')
const selected = ref(null)
let generation = 0

const tree = computed(() => buildTechnicalDataPeopleTree(people.value))
const selectedCache = computed(() => selected.value ? [{ value: selected.value.userId, label: technicalDataPersonLabel(selected.value) }] : [])
const expandedKeys = computed(() => tree.value.flatMap(division => [division.value, ...division.children.filter(node => node.kind === 'department').map(node => node.value)]))
// 搜索已由接口按姓名、工号和完整部门执行，不再用节点短标签二次过滤。
const keepRemoteResult = () => true

watch(() => [props.modelValue, props.selectedPerson], () => {
  if (props.modelValue == null) selected.value = null
  else if (props.selectedPerson?.userId === props.modelValue) selected.value = props.selectedPerson
  else if (selected.value?.userId !== props.modelValue) selected.value = people.value.find(person => person.userId === props.modelValue) || null
}, { immediate: true })

async function search(query = '') {
  const request = ++generation
  keyword.value = String(query || '').trim()
  loading.value = true
  error.value = ''
  try {
    const result = await fetchTechnicalDataAssignees(keyword.value, RESULT_LIMIT)
    if (request !== generation) return
    people.value = result
    const current = result.find(person => person.userId === props.modelValue)
    if (current) selected.value = current
  } catch (cause) {
    if (request !== generation) return
    people.value = []
    error.value = cause.message || '请稍后重试'
  } finally {
    if (request === generation) loading.value = false
  }
}

function selectPerson(value) {
  const person = people.value.find(item => item.userId === value) || (selected.value?.userId === value ? selected.value : null)
  // 部门节点只用于展开，提交的身份必须来自实际人员记录。
  if (value != null && value !== '' && !person) return
  selected.value = person
  emit('update:modelValue', person?.userId ?? null)
  emit('change-person', person)
}

function onVisibleChange(open) {
  if (open) search('')
  else { generation++; loading.value = false }
}
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
.technical-person-select { width: 320px; max-width: 100%; }
.technical-person-select :deep(.el-select__wrapper) { min-height: 40px; padding: 8px 12px; border-radius: 8px; gap: 9px; background: #fff; }
.directory-search-icon { width: 17px; height: 17px; color: #8a99ad; }
</style>

<style>
/* 浮层挂载在 body 下，样式限定到专用类，避免影响其他下拉框和树。 */
.technical-person-directory.el-popper {
  width: min(460px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid #e0e7f0;
  border-radius: 12px;
  box-shadow: 0 12px 36px -8px rgb(30 50 80 / 20%), 0 2px 8px rgb(30 50 80 / 5%);
  font-family: inherit;
}
.technical-person-directory .el-select-dropdown { min-width: 0 !important; }
.technical-person-directory .el-select-dropdown__header { padding: 16px 18px 14px; border-bottom: 1px solid #edf1f6; }
.technical-person-directory .el-select-dropdown__footer { padding: 11px 16px; border-top: 1px solid #edf1f6; background: #fbfcfe; }
.technical-person-directory .el-select-dropdown__wrap { max-height: min(400px, 55vh); }
.technical-person-directory .el-select-dropdown__list { padding: 10px; }
.technical-person-directory .directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.technical-person-directory .directory-heading > div { display: flex; flex-direction: column; gap: 4px; }
.technical-person-directory .directory-heading strong { color: #25354b; font-size: 14px; font-weight: 600; line-height: 20px; }
.technical-person-directory .directory-heading > div > span { color: #8390a3; font-size: 12px; line-height: 18px; }
.technical-person-directory .directory-result-count { flex-shrink: 0; padding: 4px 9px; background: #f0f5fb; color: #647b99; border-radius: 6px; font-size: 11px; line-height: 18px; font-variant-numeric: tabular-nums; }
.technical-person-directory .el-tree { --el-tree-node-hover-bg-color: #f3f7fc; color: #45566e; }
.technical-person-directory .el-tree-node__content { height: auto; min-height: 38px; margin: 2px 0; padding-right: 10px; border-radius: 7px; }
.technical-person-directory .el-tree-node__content > .el-select-dropdown__item { min-width: 0; height: auto; padding: 0; line-height: normal; white-space: normal; overflow: visible; }
.technical-person-directory .el-tree-node__expand-icon { margin-left: 2px; padding: 7px; color: #93a2b5; }
.technical-person-directory .el-tree-node__expand-icon.is-leaf { display: none; }
.technical-person-directory .el-tree-node__children { margin-left: 13px; padding-left: 13px; border-left: 1px solid #e3eaf3; }
.technical-person-directory .el-tree-node__children > .el-tree-node { position: relative; }
.technical-person-directory .el-tree-node__children > .el-tree-node::before { content: ''; position: absolute; top: 21px; left: -13px; width: 11px; border-top: 1px solid #e3eaf3; pointer-events: none; }
.technical-person-directory .el-tree-node:focus-visible > .el-tree-node__content { outline: 2px solid #8bb6f0; outline-offset: -2px; }
.technical-person-directory .el-tree-node__content:has(.directory-person--selected) { background: #edf5ff; box-shadow: inset 2px 0 #4c8bdd; }
.technical-person-directory .directory-branch { display: flex; align-items: center; gap: 8px; min-height: 38px; min-width: 0; }
.technical-person-directory .directory-branch svg { width: 17px; height: 17px; flex-shrink: 0; color: #88a0bd; }
.technical-person-directory .directory-branch--division { color: #365a87; font-weight: 600; font-size: 13px; }
.technical-person-directory .directory-branch--division svg { color: #648bc0; }
.technical-person-directory .directory-branch--department { color: #65758b; font-size: 12px; }
.technical-person-directory .directory-branch-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.technical-person-directory .directory-branch-count { margin-left: auto; padding-left: 8px; color: #97a4b6; font-size: 11px; font-weight: 400; font-variant-numeric: tabular-nums; }
.technical-person-directory .directory-person { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 7px 6px 7px 10px; box-sizing: border-box; }
.technical-person-directory .directory-avatar { display: flex; align-items: center; justify-content: center; flex: 0 0 30px; height: 30px; border: 1px solid #e6ecf4; border-radius: 9px; background: #f1f5fa; color: #7187a3; font-size: 12px; font-weight: 500; }
.technical-person-directory .directory-person-info { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.technical-person-directory .directory-person-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; line-height: 18px; color: #34445c; }
.technical-person-directory .directory-person-detail { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 11px; font-weight: 400; line-height: 16px; color: #8793a5; }
.technical-person-directory .directory-employee-no { flex-shrink: 0; font-variant-numeric: tabular-nums; letter-spacing: .25px; }
.technical-person-directory .directory-position { border-left: 1px solid #dfe6ef; padding-left: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.technical-person-directory .directory-person--selected .directory-avatar { background: #e1edfd; border-color: #d7e7fb; color: #3974bd; }
.technical-person-directory .directory-person--selected .directory-person-name { color: #2c69b4; font-weight: 600; }
.technical-person-directory .directory-selected-icon { width: 18px; height: 18px; margin-left: auto; flex-shrink: 0; color: #4d87d0; }
.technical-person-directory .directory-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: #8a97a9; font-size: 11px; line-height: 18px; }
.technical-person-directory .directory-key-hint { flex-shrink: 0; color: #a0aabb; }
.technical-person-directory .directory-empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; min-height: 140px; padding: 20px; font-size: 12px; line-height: 20px; color: #8a97a9; white-space: normal; text-align: center; }
.technical-person-directory .directory-empty strong { color: #53657c; font-weight: 500; font-size: 13px; }
.technical-person-directory .directory-loading-dot { width: 20px; height: 20px; border: 2px solid #e4edf9; border-top-color: #6c98d5; border-radius: 50%; animation: directory-spin .8s linear infinite; }
@keyframes directory-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .technical-person-directory .directory-loading-dot { animation: none; } }
@media (max-width: 480px) { .technical-person-directory .directory-key-hint { display: none; } }
</style>
