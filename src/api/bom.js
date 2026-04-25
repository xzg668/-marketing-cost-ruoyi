// BOM 三层架构前端 API 封装（T6）
// 对接后端 Controller:
//   BomImportController       POST /api/v1/bom/import, GET /api/v1/bom/batches
//   BomHierarchyController    POST /api/v1/bom/build-hierarchy, GET /api/v1/bom/hierarchy/{topProductCode}
//   BomFlattenController      POST /api/v1/bom/flatten
//   BomDrillRuleController    GET/POST/PUT/DELETE /api/v1/bom/drill-rules, POST /{id}/toggle
//
// 所有响应都经过 http.request() 的 CommonResult 解包，调用方直接拿到 data；
// 业务错误 / HTTP 错误由 errorHandler 统一弹 toast 并 throw Error。
import axios from 'axios'
import { request } from './http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ===== 阶段 A：Excel 导入 =====

/**
 * 财务一键导入：上传 Excel 后后端自动做"导入 + 按 purpose 批量构建层级"两步。
 *
 * 和 {@link importBomExcel} 的区别：importBomExcel 只做阶段 A（原始数据入库），
 * 这个合成版会连带做完阶段 B（展开层级树）；财务界面默认用这个，不需要再手工点构建。
 *
 * 超时同样开到 15 分钟（导入 2 分钟 + 构建若干分钟）。
 *
 * @param {File} file 浏览器 File 对象（来自 el-upload 的 raw）
 * @returns {Promise<{importResult, builds, totalRawRowsWritten, purposesBuilt, status, errorMessage}>}
 */
export const importAndBuildBom = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return axios
    .post(`${API_BASE_URL}/api/v1/bom/import-and-build`, formData, {
      headers,
      timeout: 15 * 60 * 1000,
    })
    .then((resp) => {
      const payload = resp.data
      if (payload && typeof payload.code === 'number') {
        if (payload.code !== 0) {
          throw new Error(payload.msg || 'BOM 一键导入失败')
        }
        return payload.data
      }
      return payload
    })
}

/**
 * 上传 U9 BOM Excel 到 lp_bom_u9_source（仅阶段 A，不做构建）。
 *
 * <p>后端用 EasyExcel 流式读 34 万行约需 2 分钟，默认 axios 60s 不够；
 * 这里单独 new 一个 axios 实例把超时开到 15 分钟，避开 http.js 的默认 timeout。
 *
 * <p>注：新的财务一键入口已改走 {@link importAndBuildBom}；本函数保留给 /admin 高级页面
 * （单独测试或重跑某一阶段）。
 *
 * @param {File} file 浏览器 File 对象（来自 el-upload 的 raw）
 * @returns {Promise<{importBatchId:string,sourceFileName:string,totalRows:number,successRows:number,errors:Array,importedAt:string}>}
 */
export const importBomExcel = (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  // 单独实例：15 分钟超时，不走 http.js 的 pending GET 去重逻辑（上传都是 POST）
  return axios
    .post(`${API_BASE_URL}/api/v1/bom/import`, formData, {
      headers,
      timeout: 15 * 60 * 1000,
    })
    .then((resp) => {
      // 和 http.js 保持一致的 CommonResult 解包
      const payload = resp.data
      if (payload && typeof payload.code === 'number') {
        if (payload.code !== 0) {
          throw new Error(payload.msg || 'BOM 导入失败')
        }
        return payload.data
      }
      return payload
    })
}

/**
 * 查导入批次历史（按时间倒序分页）。
 *
 * @param {string} layer U9_SOURCE / RAW_HIERARCHY / COSTING_ROW
 * @param {number} page 1-based
 * @param {number} size 每页条数
 */
export const listBomBatches = (layer, page = 1, size = 20) =>
  request('/api/v1/bom/batches', { params: { layer, page, size } })

// ===== 阶段 B：层级构建 =====

/**
 * 触发层级构建，把 u9_source 行按 parent_code 编织成 raw_hierarchy 树。
 *
 * @param {object} payload { importBatchId, bomPurpose?, mode: 'ALL'|'BY_PRODUCT', topProductCode? }
 */
export const buildBomHierarchy = (payload) =>
  request('/api/v1/bom/build-hierarchy', { method: 'POST', body: payload })

/**
 * 按顶层料号查嵌套树（T6 树查看器专用）。
 *
 * @param {string} topProductCode 顶层产品料号
 * @param {object} query { bomPurpose?, asOfDate?(YYYY-MM-DD), sourceType?='U9' }
 */
export const getBomHierarchy = (topProductCode, query = {}) =>
  request(`/api/v1/bom/hierarchy/${encodeURIComponent(topProductCode)}`, {
    params: query,
  })

// ===== 阶段 C：拍平 =====

/**
 * 触发拍平 —— 把 raw_hierarchy + 过滤规则合成 lp_bom_costing_row。
 *
 * @param {object} payload { bomPurpose?, mode:'BY_OA'|'BY_PRODUCT'|'ALL', oaNo?, topProductCode?, asOfDate(YYYY-MM-DD)必填 }
 */
export const flattenBom = (payload) =>
  request('/api/v1/bom/flatten', { method: 'POST', body: payload })

// ===== 过滤规则 CRUD（bom_stop_drill_rule）=====

/**
 * 列表。可按 enabled / matchType 过滤；后端已按 priority asc 排序。
 */
export const listDrillRules = (params = {}) =>
  request('/api/v1/bom/drill-rules', { params })

/**
 * 新增。
 * @param {object} payload { matchType, matchValue, drillAction, markSubtreeCostRequired?,
 *                           replaceToCode?, priority, enabled, effectiveFrom?, effectiveTo?,
 *                           businessUnitType?, remark? }
 */
export const createDrillRule = (payload) =>
  request('/api/v1/bom/drill-rules', { method: 'POST', body: payload })

/**
 * 修改；id 不存在返 BAD_REQUEST。
 */
export const updateDrillRule = (id, payload) =>
  request(`/api/v1/bom/drill-rules/${id}`, { method: 'PUT', body: payload })

/**
 * 软删（@TableLogic 置 deleted=1）。
 */
export const deleteDrillRule = (id) =>
  request(`/api/v1/bom/drill-rules/${id}`, { method: 'DELETE' })

/**
 * 切换启用 / 停用 —— enabled 在 0 ↔ 1 间翻转。
 */
export const toggleDrillRule = (id) =>
  request(`/api/v1/bom/drill-rules/${id}/toggle`, { method: 'POST' })

// ===== 常量（供前端 Select / Radio 使用，与后端 StopDrillRuleMatcher 保持同步）=====

/** 规则 match_type 下拉选项（5 种老模式 + T8 COMPOSITE 占位）*/
export const MATCH_TYPE_OPTIONS = [
  { value: 'NAME_LIKE', label: 'NAME_LIKE（名称模糊匹配）' },
  { value: 'MATERIAL_CODE_PREFIX', label: 'MATERIAL_CODE_PREFIX（料号前缀）' },
  { value: 'MATERIAL_TYPE', label: 'MATERIAL_TYPE（主分类精确）' },
  { value: 'CATEGORY_EQ', label: 'CATEGORY_EQ（生产类别精确）' },
  { value: 'SHAPE_ATTR_EQ', label: 'SHAPE_ATTR_EQ（形态属性精确）' },
  { value: 'COMPOSITE', label: 'COMPOSITE（T8：复合条件，走下方 JSON）' },
]

// ===== T8 复合条件 UI 下拉数据 =====

/** 复合条件可选字段（对齐后端 CompositeRuleEvaluator.readFieldValue）*/
export const CONDITION_FIELD_OPTIONS = [
  { value: 'cost_element_code', label: '成本要素编码 (cost_element_code)' },
  { value: 'material_category_1', label: '主分类 1 (material_category_1)' },
  { value: 'material_category_2', label: '主分类 2 (material_category_2)' },
  { value: 'material_code', label: '料号 (material_code)' },
  { value: 'material_name', label: '品名 (material_name)' },
  { value: 'shape_attr', label: '形态属性 (shape_attr)' },
  { value: 'production_category', label: '生产分类 (production_category)' },
]

/** 操作符 */
export const CONDITION_OP_OPTIONS = [
  { value: 'EQ', label: 'EQ（等于，单值）' },
  { value: 'IN', label: 'IN（列表，多值）' },
  { value: 'LIKE', label: 'LIKE（包含子串，预留）' },
]

// ===== 字典查询（yudao 原生接口）=====

/**
 * 拉取某字典类型的全量条目，用于前端下拉候选值。
 * 复用 yudao 自带 `/api/v1/system/dict-data/type/{type}`。
 *
 * @param {string} dictType 字典类型，例如 'bom_material_category'
 * @returns {Promise<Array<{value:string,label:string}>>}
 */
export const fetchDictData = (dictType) =>
  request(`/api/v1/system/dict-data/type/${encodeURIComponent(dictType)}`)

/** drill_action 下拉选项（T8 加 ROLLUP_TO_PARENT；REPLACE 暂不支持） */
export const DRILL_ACTION_OPTIONS = [
  { value: 'STOP_AND_COST_ROW', label: 'STOP_AND_COST_ROW（停止下钻并成为结算行）' },
  { value: 'EXCLUDE', label: 'EXCLUDE（整子树排除）' },
  { value: 'ROLLUP_TO_PARENT', label: 'ROLLUP_TO_PARENT（T8：父节点作结算行，子件进 sub_ref）' },
]

/** 构建层级 mode 选项 */
export const BUILD_MODE_OPTIONS = [
  { value: 'ALL', label: '全量（该批次所有顶层产品）' },
  { value: 'BY_PRODUCT', label: '按产品（指定 topProductCode）' },
]

/** 拍平 mode 选项 */
export const FLATTEN_MODE_OPTIONS = [
  { value: 'BY_OA', label: '按 OA 单（需填 oaNo）' },
  { value: 'BY_PRODUCT', label: '按产品（需填 topProductCode）' },
  { value: 'ALL', label: '全量（该 asOfDate 全部顶层）' },
]

// ===== T10：规则向导模板（财务入口专用）=====
//
// 设计取自 T10-rule-ui-wizard.md —— 业务真相：规则唯一职责是决定结算行落在
// 叶子还是父层；取价永远查叶子料号。目前只有两种"上提到父层"场景：
//   1. SUBTREE_COMPOSITE — 接管类，父层作结算行 + 子树价走子树合成算法
//   2. ROLLUP_TO_PARENT  — 铜管组件上卷，父层作结算行 + 子件清单写 sub_ref
// 其他场景（EXCLUDE / MATERIAL_CODE_PREFIX 等）留给 IT 走"高级模式"。

/**
 * 向导模板定义，控制 3 步向导每步展示什么字段、保存时拼什么 payload。
 * userFields 说明：
 *   - type 省略 = 文本输入（el-input）
 *   - type='dict-multi' = 从指定字典拉候选的 multi-select（el-select multiple + allow-create）
 */
export const RULE_WIZARD_TEMPLATES = [
  {
    code: 'SUBTREE_COMPOSITE',
    title: '接管类规则',
    description:
      '品名含指定关键字 → 此节点作结算行 不再往下拆；子树价由"子树合成算法"补回（典型场景：接管）',
    defaults: {
      matchType: 'NAME_LIKE',
      drillAction: 'STOP_AND_COST_ROW',
      markSubtreeCostRequired: 1,
      priority: 10,
    },
    userFields: [
      {
        key: 'matchValue',
        label: '品名关键字',
        placeholder: '例如：接管',
        required: true,
        hint: '节点品名包含这个关键字就命中（SQL LIKE %xxx%）',
      },
    ],
  },
  {
    code: 'ROLLUP_TO_PARENT',
    title: '父层上卷规则',
    description:
      '本节点命中指定成本要素且至少一个子件属于指定主分类 → 此节点作结算行；子件清单写入 sub_ref，父件价 = Σ(子件联动价)。典型场景：紫铜盘管/紫铜直管的组件',
    defaults: {
      matchType: 'COMPOSITE',
      drillAction: 'ROLLUP_TO_PARENT',
      markSubtreeCostRequired: 0,
      priority: 20,
    },
    userFields: [
      {
        key: 'parentCostElement',
        label: '本节点 成本要素编码',
        placeholder: '例如：No101',
        required: true,
        hint: '父节点的 cost_element_code 精确等于这个值时才会继续判子件',
      },
      {
        key: 'childCategories',
        label: '子件主分类（可多选）',
        type: 'dict-multi',
        dictType: 'bom_material_category',
        required: true,
        hint: '至少一个子件的 material_category_1 属于这些分类就命中（OR 语义）',
      },
    ],
  },
]

/**
 * 反推规则对应的向导模板 code；无法匹配返 null（调用方应走高级模式）。
 *
 * 匹配规则：
 *   - NAME_LIKE + STOP_AND_COST_ROW + markSubtree=1 → SUBTREE_COMPOSITE
 *   - COMPOSITE + ROLLUP_TO_PARENT 且 JSON 结构符合
 *     (nodeConditions 单条 EQ cost_element_code
 *      + childConditions 单条 IN material_category_1
 *      + parentConditions 空) → ROLLUP_TO_PARENT
 *   - 其他 → null
 *
 * 反推时任何结构不符（JSON 解析失败、多条件、字段不对）都返 null；
 * 这是正常分支不是错误，由调用方决定弹向导还是高级。
 */
export const matchTemplate = (rule) => {
  if (!rule) return null
  if (
    rule.matchType === 'NAME_LIKE' &&
    rule.drillAction === 'STOP_AND_COST_ROW' &&
    Number(rule.markSubtreeCostRequired) === 1
  ) {
    return 'SUBTREE_COMPOSITE'
  }
  if (
    rule.matchType === 'COMPOSITE' &&
    rule.drillAction === 'ROLLUP_TO_PARENT' &&
    rule.matchConditionJson
  ) {
    try {
      const parsed =
        typeof rule.matchConditionJson === 'string'
          ? JSON.parse(rule.matchConditionJson)
          : rule.matchConditionJson
      const node = Array.isArray(parsed?.nodeConditions) ? parsed.nodeConditions : []
      const parent = Array.isArray(parsed?.parentConditions) ? parsed.parentConditions : []
      const child = Array.isArray(parsed?.childConditions) ? parsed.childConditions : []
      const nodeOk =
        node.length === 1 &&
        node[0]?.field === 'cost_element_code' &&
        node[0]?.op === 'EQ'
      const childOk =
        child.length === 1 &&
        child[0]?.field === 'material_category_1' &&
        child[0]?.op === 'IN' &&
        Array.isArray(child[0]?.values)
      if (nodeOk && childOk && parent.length === 0) {
        return 'ROLLUP_TO_PARENT'
      }
    } catch (e) {
      // JSON 解析失败 → 非标规则，走高级模式
      return null
    }
  }
  return null
}

/**
 * 从已有规则反推出向导用户字段的值（用于编辑回填）。
 * 未匹配到模板返 null。
 */
export const extractTemplateUserValues = (rule) => {
  const code = matchTemplate(rule)
  if (!code) return null
  if (code === 'SUBTREE_COMPOSITE') {
    return { matchValue: rule.matchValue || '' }
  }
  if (code === 'ROLLUP_TO_PARENT') {
    try {
      const parsed =
        typeof rule.matchConditionJson === 'string'
          ? JSON.parse(rule.matchConditionJson)
          : rule.matchConditionJson
      return {
        parentCostElement: parsed?.nodeConditions?.[0]?.value || '',
        childCategories: parsed?.childConditions?.[0]?.values || [],
      }
    } catch (e) {
      return null
    }
  }
  return null
}

/**
 * 根据模板 code + 用户填写的 values 拼出后端 CRUD 所需的 payload。
 */
export const buildPayloadFromTemplate = (templateCode, userValues, extras = {}) => {
  const tpl = RULE_WIZARD_TEMPLATES.find((t) => t.code === templateCode)
  if (!tpl) throw new Error(`未知模板：${templateCode}`)

  const base = {
    ...tpl.defaults,
    enabled: 1,
    businessUnitType: null,
    matchValue: '',
    matchConditionJson: null,
    remark: '',
    effectiveFrom: null,
    effectiveTo: null,
    ...extras, // 允许外部覆盖（编辑时保留原 priority/enabled/businessUnitType/remark 等）
  }

  if (templateCode === 'SUBTREE_COMPOSITE') {
    base.matchValue = (userValues.matchValue || '').trim()
  } else if (templateCode === 'ROLLUP_TO_PARENT') {
    // matchValue 在 COMPOSITE 下无业务意义但表字段 NOT NULL —— 编辑保留原值，新建塞占位
    if (!base.matchValue) base.matchValue = 'wizard-' + Date.now()
    base.matchConditionJson = JSON.stringify({
      nodeConditions: [
        {
          field: 'cost_element_code',
          op: 'EQ',
          value: (userValues.parentCostElement || '').trim(),
        },
      ],
      parentConditions: [],
      childConditions: [
        {
          field: 'material_category_1',
          op: 'IN',
          values: Array.isArray(userValues.childCategories)
            ? userValues.childCategories
            : [],
        },
      ],
    })
  }
  return base
}
