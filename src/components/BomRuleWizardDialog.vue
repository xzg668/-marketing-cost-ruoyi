<template>
  <!-- BOM 规则向导弹窗（T10）
       3 步：选模板 → 填参数 → 预览确认。
       财务入口默认唤起此组件；IT 或非标规则走高级模式对话框。 -->
  <el-dialog
    v-model="visible"
    :title="editingRule ? '编辑规则（向导）' : '新增规则（向导）'"
    width="640px"
    :close-on-click-modal="false"
    :destroy-on-close="false"
    @closed="onClosed"
  >
    <!-- 步骤条 -->
    <el-steps :active="step" finish-status="success" class="step-bar">
      <el-step title="选模板" />
      <el-step title="填参数" />
      <el-step title="预览确认" />
    </el-steps>

    <!-- 第 1 步：选模板 -->
    <div v-if="step === 0" class="step-body">
      <div class="step-hint">按业务场景挑一个模板，向导会自动带上合理的默认值。</div>
      <div class="template-grid">
        <div
          v-for="tpl in RULE_WIZARD_TEMPLATES"
          :key="tpl.code"
          class="template-card"
          :class="{ active: selectedTemplate === tpl.code }"
          @click="selectTemplate(tpl.code)"
        >
          <div class="template-title">{{ tpl.title }}</div>
          <div class="template-desc">{{ tpl.description }}</div>
        </div>
      </div>
    </div>

    <!-- 第 2 步：填参数 -->
    <div v-else-if="step === 1" class="step-body">
      <el-alert
        :title="currentTemplate?.title"
        type="info"
        :closable="false"
        show-icon
        class="step-banner"
      >
        <template #default>
          <span class="template-desc-inline">{{ currentTemplate?.description }}</span>
        </template>
      </el-alert>

      <el-form
        ref="paramFormRef"
        :model="userValues"
        :rules="paramRules"
        label-width="180px"
        class="param-form"
      >
        <el-form-item
          v-for="field in currentTemplate?.userFields || []"
          :key="field.key"
          :label="field.label"
          :prop="field.key"
        >
          <!-- 字典多选：紫铜盘管 / 紫铜直管 这种 -->
          <el-select
            v-if="field.type === 'dict-multi'"
            v-model="userValues[field.key]"
            multiple
            filterable
            allow-create
            :placeholder="field.placeholder || '从字典选或自由填'"
            style="width: 100%"
          >
            <el-option
              v-for="opt in dictOptions[field.dictType] || []"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <!-- 普通文本输入 -->
          <el-input
            v-else
            v-model="userValues[field.key]"
            :placeholder="field.placeholder"
          />
          <div v-if="field.hint" class="field-hint">{{ field.hint }}</div>
        </el-form-item>

        <!-- 通用可选项：备注（所有模板共用） -->
        <el-form-item label="备注">
          <el-input
            v-model="userValues.remark"
            type="textarea"
            :rows="2"
            placeholder="可选：写个解释帮自己和同事将来理解这条规则"
          />
        </el-form-item>
      </el-form>
    </div>

    <!-- 第 3 步：预览 -->
    <div v-else-if="step === 2" class="step-body">
      <el-alert
        title="规则预览"
        type="success"
        :closable="false"
        show-icon
        class="step-banner"
      >
        <template #default>
          <div class="preview-sentence">{{ previewSentence }}</div>
        </template>
      </el-alert>
      <div class="preview-footer-hint">
        确认无误后点"保存"；系统会在下次 BOM 计算时应用此规则。
      </div>
    </div>

    <!-- 底部按钮 + 高级模式切换 -->
    <template #footer>
      <div class="footer-row">
        <el-button link type="info" @click="switchToAdvanced">使用高级模式 →</el-button>
        <div class="footer-actions">
          <el-button v-if="step > 0" @click="prevStep">上一步</el-button>
          <el-button v-if="step < 2" type="primary" @click="nextStep">下一步</el-button>
          <el-button
            v-if="step === 2"
            type="primary"
            :loading="submitting"
            @click="onSubmit"
          >保存</el-button>
          <el-button @click="visible = false">取消</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
// BomRuleWizardDialog —— T10 向导化入口
// 对外契约：
//   v-model          : 弹窗开关
//   :editing-rule    : 传入已有规则对象就是编辑；传 null 就是新建
//   @saved           : 保存成功后 emit，传后端返回的 rule；父组件用于刷新列表
//   @switch-advanced : 用户点"使用高级模式"时 emit，父组件负责关向导 + 开高级对话框
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createDrillRule,
  updateDrillRule,
  fetchDictData,
  RULE_WIZARD_TEMPLATES,
  buildPayloadFromTemplate,
  matchTemplate,
  extractTemplateUserValues,
} from '../api/bom'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editingRule: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved', 'switch-advanced'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const step = ref(0)
const selectedTemplate = ref(null)
const userValues = reactive({})
const dictOptions = reactive({}) // { [dictType]: [{value,label}] }
const submitting = ref(false)
const paramFormRef = ref(null)

// 关闭时要做的副作用：切换到高级模式需要等关闭动画走完后再通知父组件，避免两 dialog 瞬时叠显
// 用"延后的意图"代替 setTimeout，在 @closed 里消费
const pendingSwitchAdvanced = ref(false)
// editingRule 在关闭动画期间要保留一下，因为父组件一旦知道切换意图就会清空 editingRule
// 导致 emit 时拿不到规则对象
const pendingSwitchPayload = ref(null)

const currentTemplate = computed(() =>
  RULE_WIZARD_TEMPLATES.find((t) => t.code === selectedTemplate.value)
)

/** 每次打开弹窗重置（新建）或按编辑规则反推（编辑） */
watch(
  () => props.modelValue,
  (v) => {
    if (v) initState()
  }
)

function initState() {
  resetState()
  if (props.editingRule) {
    const code = matchTemplate(props.editingRule)
    if (code) {
      // 反推成功 —— 跳到第 2 步参数，带回原值
      selectedTemplate.value = code
      const values = extractTemplateUserValues(props.editingRule) || {}
      const tpl = RULE_WIZARD_TEMPLATES.find((t) => t.code === code)
      // 初始化 userValues：每个字段 key 都必须有初值，否则 el-form 校验 prop 时报错
      for (const f of tpl.userFields) {
        userValues[f.key] = values[f.key] ?? (f.type === 'dict-multi' ? [] : '')
      }
      userValues.remark = props.editingRule.remark || ''
      step.value = 1
      // 编辑 ROLLUP 模板要拉字典
      ensureDictForTemplate(tpl)
    }
    // 反推失败的情况父组件已经路由到高级模式，不会进到这里
  }
}

function resetState() {
  step.value = 0
  selectedTemplate.value = null
  submitting.value = false
  // 清空 userValues 的所有键
  for (const k of Object.keys(userValues)) delete userValues[k]
  userValues.remark = ''
}

async function ensureDictForTemplate(tpl) {
  if (!tpl) return
  for (const f of tpl.userFields) {
    if (f.type === 'dict-multi' && f.dictType && !dictOptions[f.dictType]) {
      try {
        const data = await fetchDictData(f.dictType)
        const list = Array.isArray(data) ? data : data?.data || []
        dictOptions[f.dictType] = list.map((d) => ({
          value: d.value ?? d.dictValue ?? d.dict_value,
          label: d.label ?? d.dictLabel ?? d.dict_label,
        }))
      } catch (error) {
        // 字典挂了不阻塞：el-select allow-create 允许自由输入
        dictOptions[f.dictType] = []
        console.warn(`字典 ${f.dictType} 加载失败`, error?.message)
      }
    }
  }
}

function selectTemplate(code) {
  selectedTemplate.value = code
  // 选中模板后预初始化 userValues，方便第 2 步 v-model 正常
  for (const k of Object.keys(userValues)) delete userValues[k]
  const tpl = RULE_WIZARD_TEMPLATES.find((t) => t.code === code)
  for (const f of tpl.userFields) {
    userValues[f.key] = f.type === 'dict-multi' ? [] : ''
  }
  userValues.remark = ''
  ensureDictForTemplate(tpl)
}

/** 第 2 步的必填校验规则动态从模板生成 */
const paramRules = computed(() => {
  const tpl = currentTemplate.value
  if (!tpl) return {}
  const rules = {}
  for (const f of tpl.userFields) {
    if (!f.required) continue
    if (f.type === 'dict-multi') {
      rules[f.key] = [
        {
          required: true,
          trigger: 'change',
          validator: (_r, value, cb) => {
            if (Array.isArray(value) && value.length > 0) cb()
            else cb(new Error('至少选一个'))
          },
        },
      ]
    } else {
      rules[f.key] = [
        {
          required: true,
          trigger: 'blur',
          validator: (_r, value, cb) => {
            if (value && String(value).trim()) cb()
            else cb(new Error('必填'))
          },
        },
      ]
    }
  }
  return rules
})

async function nextStep() {
  if (step.value === 0) {
    if (!selectedTemplate.value) {
      ElMessage.warning('请先选一个模板')
      return
    }
    step.value = 1
    return
  }
  if (step.value === 1) {
    // 过校验才能前进
    try {
      await paramFormRef.value?.validate()
      step.value = 2
    } catch (_) {
      // 字段红框会自动显示
    }
  }
}

function prevStep() {
  if (step.value > 0) step.value -= 1
}

/** 第 3 步的中文预览句子 —— 每个模板独立渲染，不共用 */
const previewSentence = computed(() => {
  const code = selectedTemplate.value
  if (code === 'SUBTREE_COMPOSITE') {
    const kw = userValues.matchValue || '（未填）'
    return `当节点品名包含「${kw}」时，此节点作为结算行，不再往下拆；其下所有子件的价由"子树合成算法"统一算回。`
  }
  if (code === 'ROLLUP_TO_PARENT') {
    const ce = userValues.parentCostElement || '（未填）'
    const cats = Array.isArray(userValues.childCategories)
      ? userValues.childCategories.join(' / ')
      : ''
    return `当节点的"成本要素"等于「${ce}」且至少有一个直接子件的"主分类"属于「${cats || '（未选）'}」时，此节点作为结算行，不再往下拆；系统会记录其直接子件清单，父件价 = Σ(子件联动价)。`
  }
  return ''
})

async function onSubmit() {
  if (!selectedTemplate.value) return
  submitting.value = true
  try {
    // 编辑时保留原 priority / enabled / effectiveFrom/To / businessUnitType，避免向导洗掉
    const extras = props.editingRule
      ? {
          priority: props.editingRule.priority,
          enabled: props.editingRule.enabled,
          effectiveFrom: props.editingRule.effectiveFrom,
          effectiveTo: props.editingRule.effectiveTo,
          businessUnitType: props.editingRule.businessUnitType,
          // matchValue 在 COMPOSITE 编辑时保留原值避免每次重写
          matchValue: props.editingRule.matchValue,
          remark: userValues.remark || '',
        }
      : { remark: userValues.remark || '' }
    const payload = buildPayloadFromTemplate(selectedTemplate.value, userValues, extras)

    let saved
    if (props.editingRule?.id) {
      saved = await updateDrillRule(props.editingRule.id, payload)
      ElMessage.success('规则已更新，下次 BOM 计算生效')
    } else {
      saved = await createDrillRule(payload)
      ElMessage.success('规则已创建，下次 BOM 计算生效')
    }
    emit('saved', saved)
    visible.value = false
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function switchToAdvanced() {
  // 记下"关闭完要切高级"的意图 + 快照 editingRule，然后关向导
  // @closed 会在 Element Plus 的 fade 动画结束后触发，那时再 emit，两个 dialog 不会叠显
  pendingSwitchAdvanced.value = true
  pendingSwitchPayload.value = props.editingRule
  visible.value = false
}

/** dialog 完全关闭（动画结束）后统一清理 + 处理"切高级"的延后意图 */
function onClosed() {
  if (pendingSwitchAdvanced.value) {
    const payload = pendingSwitchPayload.value
    pendingSwitchAdvanced.value = false
    pendingSwitchPayload.value = null
    // 先 emit 再 resetState：父组件拿到 payload 后再把子组件状态清空
    emit('switch-advanced', payload)
  }
  resetState()
}
</script>

<style scoped>
.step-bar {
  margin-bottom: 20px;
}
.step-body {
  min-height: 260px;
}
.step-hint {
  font-size: 13px;
  color: #606266;
  margin-bottom: 12px;
}
.step-banner {
  margin-bottom: 16px;
}
.template-desc-inline {
  font-size: 12px;
  color: #606266;
}
.template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.template-card {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}
.template-card:hover {
  border-color: #409eff;
  box-shadow: 0 1px 6px rgba(64, 158, 255, 0.2);
}
.template-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}
.template-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}
.template-desc {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
}
.param-form {
  margin-top: 8px;
}
.field-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}
.preview-sentence {
  font-size: 14px;
  color: #303133;
  line-height: 1.7;
  padding: 4px 0;
}
.preview-footer-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
.footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.footer-actions {
  display: flex;
  gap: 8px;
}
</style>
