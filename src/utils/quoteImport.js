import * as XLSX from 'xlsx'

export const QUOTE_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024
export const QUOTE_IMPORT_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']

export const QUOTE_IMPORT_TEMPLATE = {
  fileName: '报价单导入模板.xlsx',
  sheets: [
    {
      name: '报价单表头',
      headers: [
        '报价单号',
        '来源类型',
        '流程编号',
        '流程名称',
        '申请日期',
        '客户名称',
        '申请部门',
        '申请处室',
        '申请人',
        '紧急程度',
        '产品属性',
        '销售价格联动情况',
        '是否海外销售',
        '铜基价',
        '锌基价',
        '铝基价',
        '不锈钢基价',
        'SUS304 基价',
        'SUS316L 基价',
        '白银基价',
        '黄金基价',
        '备注',
      ],
      sample: [
        'OA-DEMO-001',
        'EXCEL',
        'FI-SC-006',
        '销售报价流程',
        '2026-05-11',
        '示例客户',
        '亚洲业务部',
        '销售一处',
        '张三',
        '普通',
        '批量品',
        '联动',
        '否',
        '90000',
        '21684',
        '23386',
        '17200',
        '',
        '',
        '',
        '',
        '财务导入样例',
      ],
    },
    {
      name: '产品明细',
      headers: [
        '报价单号',
        '行号',
        '业务类型',
        '产品名称',
        '客户图号',
        '客户编码',
        '料号',
        '三花型号',
        '规格',
        '产品属性',
        '是否首次报价',
        '是否有认证需求',
        '起运国',
        '技术员',
        '包装类型',
        '包装方式',
        '包装组件料号',
        '包装数量',
        '三花配套量',
        '预计年用量',
        '研发项目号',
        '产品状态',
        '报废率',
        '单件工资',
        '成本有效期',
      ],
      sample: [
        'OA-DEMO-001',
        '1',
        '批量品',
        '测试产品',
        '',
        '',
        'MAT-001',
        'SHF-A',
        '10mm',
        '批量品',
        '否',
        '否',
        '中国',
        '李四',
        '',
        '',
        '',
        '',
        '1000',
        '12000',
        '',
        '量产',
        '',
        '',
        '2026-12-31',
      ],
    },
    {
      name: '额外费用',
      headers: ['报价单号', '行号', '费用编码', '费用名称', '费用分类', '金额', '单位', '备注'],
      sample: ['OA-DEMO-001', '1', 'MOLD_TOTAL', '模具费用总金额', 'MOLD', '50000', '元', '新品可填'],
    },
  ],
}

const toArray = (value) => (Array.isArray(value) ? value : [])

export function getQuoteImportFile(fileLike) {
  return fileLike?.raw || fileLike || null
}

export function getQuoteImportFileName(fileLike) {
  return getQuoteImportFile(fileLike)?.name || fileLike?.name || ''
}

export function isQuoteImportExcelFile(fileLike) {
  const name = getQuoteImportFileName(fileLike).toLowerCase()
  return QUOTE_IMPORT_ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function validateQuoteImportFile(fileLike) {
  const file = getQuoteImportFile(fileLike)
  if (!file) {
    return { valid: false, message: '请选择报价单 Excel 文件' }
  }
  if (!isQuoteImportExcelFile(file)) {
    return { valid: false, message: '仅支持 .xlsx / .xls 格式' }
  }
  if (Number(file.size || 0) > QUOTE_IMPORT_MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 20MB' }
  }
  return { valid: true, message: '' }
}

export function normalizeQuoteExcelPreview(preview, fallbackFileName = '') {
  const safePreview = preview || {}
  const errors = toArray(safePreview.errors)
  const warnings = toArray(safePreview.warnings)
  const forms = toArray(safePreview.forms)
  const errorCount = Number(safePreview.errorCount ?? errors.length ?? 0)
  const warningCount = Number(safePreview.warningCount ?? warnings.length ?? 0)
  const valid = safePreview.valid === false ? false : errorCount === 0
  return {
    fileName: safePreview.fileName || fallbackFileName || '',
    formCount: Number(safePreview.formCount || forms.length || 0),
    itemCount: Number(safePreview.itemCount || 0),
    feeCount: Number(safePreview.feeCount || 0),
    errorCount,
    warningCount,
    valid,
    statusLabel: valid ? (warningCount > 0 ? '可提交，有提醒' : '校验通过') : '存在错误',
    statusType: valid ? (warningCount > 0 ? 'warning' : 'success') : 'danger',
    forms,
    errors,
    warnings,
  }
}

export function canCommitQuoteExcelPreview(preview) {
  return Boolean(preview) && normalizeQuoteExcelPreview(preview).valid
}

export function createQuoteImportTemplateWorkbook() {
  const workbook = XLSX.utils.book_new()
  QUOTE_IMPORT_TEMPLATE.sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, sheet.sample])
    worksheet['!cols'] = sheet.headers.map((header) => ({ wch: Math.max(12, String(header).length + 4) }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })
  return workbook
}

export function downloadQuoteImportTemplate() {
  XLSX.writeFile(createQuoteImportTemplateWorkbook(), QUOTE_IMPORT_TEMPLATE.fileName)
}
