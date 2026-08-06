import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  RANGE_IMPORT_TYPE_OPTIONS,
  buildRangeImportBatchNo,
  buildRangeImportPayload,
  buildRangeType1ImportRequest,
  buildRangePriceTypeApplyPayload,
  collectRangeFormulaCells,
  detectRangeFactorBySheetName,
  detectRangeWorkbookRoute,
  formatCurrentStatus,
  formatRangeType,
  isQuantityRangeSheetName,
  matchRangeType1Rows,
  normalizeRangeImportErrors,
  normalizeRangeBaseSpec,
  normalizeRangeBaseSupplierCode,
  normalizeRangeBaseSupplierName,
  parseRangeBaseSheet,
  parseRangeType1Sheet,
  submitRangeType1ImportRequest,
  summarizeRangeWorkbookSheets,
} from '../src/pages/priceRangeImportUtils.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceRangePage.vue')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('MFRP-03 区间价导入 sheet 识别', () => {
  it('识别区间铜价为 CU', () => {
    const factor = detectRangeFactorBySheetName('区间铜价')
    assert.equal(factor.code, 'CU')
    assert.equal(factor.label, '铜价区间')
  })

  it('识别区间锌价、区间铝价、镀金区间价、白银区间价', () => {
    assert.equal(detectRangeFactorBySheetName('区间锌价').code, 'ZN')
    assert.equal(detectRangeFactorBySheetName('区间铝价').code, 'AL')
    assert.equal(detectRangeFactorBySheetName('镀金区间价').code, 'GOLD')
    assert.equal(detectRangeFactorBySheetName('白银区间价').code, 'SILVER')
  })

  it('无法识别时返回 null，页面负责弹出选择', () => {
    assert.equal(detectRangeFactorBySheetName('Sheet1'), null)
  })

  it('数量区间 sheet 走旧 QTY 兼容路径', () => {
    assert.equal(isQuantityRangeSheetName('数量区间价'), true)
    assert.equal(isQuantityRangeSheetName('区间铜价'), false)
  })
})

describe('MFRP-03 区间价导入 payload', () => {
  it('FACTOR 导入提交 rangeBasis、factorCode、sourceSheet 和 importBatchNo', () => {
    const payload = buildRangeImportPayload(
      [
        {
          materialCode: '201850160',
          unit: '元/米',
          rangeLow: 87501,
          rangeHigh: 92500,
          priceExclTax: 0.392035,
        },
      ],
      {
        factor: { code: 'CU' },
        fileName: 'range.xlsx',
        sheetName: '区间铜价',
        importBatchNo: 'BATCH-001',
      }
    )

    assert.equal(payload.rangeBasis, 'FACTOR')
    assert.equal(payload.factorCode, 'CU')
    assert.equal(payload.factorName, '电解铜')
    assert.equal(payload.factorUnit, '元/吨')
    assert.equal(payload.priceUnit, '元/米')
    assert.equal(payload.sourceFile, 'range.xlsx')
    assert.equal(payload.sourceSheet, '区间铜价')
    assert.equal(payload.importBatchNo, 'BATCH-001')
    assert.equal(payload.rows[0].rangeBasis, 'FACTOR')
    assert.equal(payload.rows[0].factorCode, 'CU')
  })

  it('QTY 导入保持数量区间 payload', () => {
    const payload = buildRangeImportPayload(
      [{ materialCode: 'MAT-QTY', rangeLow: 1, rangeHigh: 10, priceInclTax: 5 }],
      { sheetName: '数量区间价', importBatchNo: 'BATCH-QTY' }
    )

    assert.equal(payload.rangeBasis, 'QTY')
    assert.equal(payload.factorCode, '')
    assert.equal(payload.rows[0].rangeBasis, 'QTY')
  })

  it('importBatchNo 生成稳定前缀', () => {
    assert.equal(
      buildRangeImportBatchNo(new Date('2026-07-02T09:05:06')),
      'RANGE20260702090506'
    )
  })
})

describe('MFRP-03 区间价列表展示', () => {
  it('FACTOR 行展示人话区间类型和当前状态', () => {
    assert.equal(formatRangeType({ rangeBasis: 'FACTOR', factorCode: 'CU' }), '铜价区间')
    assert.equal(formatCurrentStatus({ currentFlag: 1 }), '当前')
  })

  it('旧数据默认展示数量区间，currentFlag=0 展示历史', () => {
    assert.equal(formatRangeType({}), '数量区间')
    assert.equal(formatCurrentStatus({ currentFlag: 0 }), '历史')
  })

  it('页面包含简单选择弹窗，不直接展示技术字段列', () => {
    assert.match(pageContent, /title="选择区间类型"/)
    assert.match(pageContent, /RANGE_IMPORT_TYPE_OPTIONS/)
    assert.match(pageContent, /formatRangeType\(row\)/)
    assert.match(pageContent, /formatCurrentStatus\(row\)/)
    assert.equal(RANGE_IMPORT_TYPE_OPTIONS.some((option) => option.code === 'QTY'), true)
    assert.doesNotMatch(pageContent, /label="factor_rule_id"/i)
    assert.doesNotMatch(pageContent, /label="range_basis"/i)
    assert.doesNotMatch(pageContent, /label="current_flag"/i)
    assert.doesNotMatch(pageContent, /label="version_no"/i)
  })
})

describe('MFRP-04 价格类型冲突确认', () => {
  it('构造改为区间价 payload 时只提交物料和生效信息', () => {
    const payload = buildRangePriceTypeApplyPayload([
      {
        materialCode: '201850160',
        materialName: '铜管',
        businessUnitType: 'COMMERCIAL',
        period: '2026-07',
        effectiveFrom: '2026-07-01',
        currentPriceType: '固定价',
      },
    ])

    assert.deepEqual(payload, {
      rows: [
        {
          materialCode: '201850160',
          materialName: '铜管',
          businessUnitType: 'COMMERCIAL',
          period: '2026-07',
          effectiveFrom: '2026-07-01',
          source: 'range-price-import',
        },
      ],
    })
  })

  it('页面导入后提示价格类型冲突并可调用确认改价接口', () => {
    assert.match(pageContent, /价格类型冲突/)
    assert.match(pageContent, /改为区间价/)
    assert.match(pageContent, /暂不修改/)
    assert.match(pageContent, /applyRangePriceTypes/)
    assert.match(pageContent, /priceTypeConflicts/)
  })
})

const buildType1Rows = ({ headerRowIndex = 1, factorCode = 'CU' } = {}) => {
  const rows = Array.from({ length: headerRowIndex }, () => ['区间价格导入'])
  rows.push(['序号', '名称', '规格', '供方', `${factorCode}：57001-60000`, ''])
  rows.push(['', '', '', '', '不含税', '含税'])
  rows.push([1, '气门芯', 'JZF-000-004001', '公主岭远达', 1.23, 1.39])
  return rows
}

const buildBaseRows = ({ headerRowIndex = 0 } = {}) => {
  const rows = Array.from({ length: headerRowIndex }, () => ['基础资料'])
  rows.push(['组织', '供应商名称', '供应商代码', '物料名称', '物料代码', '规格型号'])
  rows.push(['股份', '公主岭市远达实业有限公司', 'S000841', '气门芯', '201503873', 'JZF-000-004001'])
  return rows
}

const buildStandardFactorRows = () => [
  ['物料名称', '物料代码', '规格型号', '是否含税', 'CU：57001-60000'],
  ['气门芯', '201503873', 'JZF-000-004001', false, 1.23],
]

const buildStandardQuantityRows = () => [
  ['物料名称', '物料代码', '规格型号', '区间下限', '区间上限', '不含税价'],
  ['气门芯', '201503873', 'JZF-000-004001', 1, 10, 1.23],
]

describe('RPI1-02 工作簿结构识别和新旧模板路由', () => {
  it('类型1文件名任意时仍按内容识别', () => {
    const result = detectRangeWorkbookRoute(
      [
        { name: '基础数据', rows: buildBaseRows() },
        { name: '业务价格', rows: buildType1Rows() },
      ],
      { fileName: '完全看不出业务含义的文件.xls' }
    )

    assert.equal(result.ok, true)
    assert.equal(result.route, 'TYPE1')
    assert.equal(result.baseSheet.name, '基础数据')
    assert.equal(result.rangeSheet.name, '业务价格')
    assert.equal(result.factor.code, 'CU')
  })

  it('Sheet顺序变化时仍识别同一个基础表和区间表', () => {
    const result = detectRangeWorkbookRoute([
      { name: '后放的价格表', rows: buildType1Rows() },
      { name: '前放的基础表', rows: buildBaseRows() },
    ])

    assert.equal(result.ok, true)
    assert.equal(result.route, 'TYPE1')
    assert.equal(result.baseSheet.name, '前放的基础表')
    assert.equal(result.rangeSheet.name, '后放的价格表')
  })

  it('Sheet名称修改时不影响识别', () => {
    const result = detectRangeWorkbookRoute([
      { name: '供应商档案2026', rows: buildBaseRows() },
      { name: '财务确认版', rows: buildType1Rows() },
    ])

    assert.equal(result.ok, true)
    assert.equal(result.route, 'TYPE1')
    assert.equal(result.factor.code, 'CU')
  })

  it('基础表头位于第2行、区间主表头位于第2行且子表头位于第3行时识别', () => {
    const result = detectRangeWorkbookRoute([
      { name: '基础', rows: buildBaseRows({ headerRowIndex: 1 }) },
      { name: '区间', rows: buildType1Rows({ headerRowIndex: 1 }) },
    ])

    assert.equal(result.ok, true)
    assert.equal(result.baseSheet.headerRowIndex, 1)
    assert.equal(result.rangeSheet.headerRowIndex, 1)
    assert.equal(result.rangeSheet.subHeaderRowIndex, 2)
  })

  it('原有标准行情区间模板仍走STANDARD路由', () => {
    const result = detectRangeWorkbookRoute([
      { name: '任意旧模板名', rows: buildStandardFactorRows() },
    ])

    assert.equal(result.ok, true)
    assert.equal(result.route, 'STANDARD')
    assert.equal(result.standardSheet.name, '任意旧模板名')
    assert.equal(result.factor.code, 'CU')
  })

  it('原有数量区间模板仍走STANDARD路由', () => {
    const result = detectRangeWorkbookRoute([
      { name: '数量价格', rows: buildStandardQuantityRows() },
    ])

    assert.equal(result.ok, true)
    assert.equal(result.route, 'STANDARD')
    assert.equal(result.factor, null)
  })

  it('多个基础资料候选时阻断并列出候选Sheet', () => {
    const result = detectRangeWorkbookRoute([
      { name: '基础A', rows: buildBaseRows() },
      { name: '基础B', rows: buildBaseRows() },
      { name: '区间', rows: buildType1Rows() },
    ])

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'MULTIPLE_BASE_SHEETS')
    assert.match(result.message, /基础A/)
    assert.match(result.message, /基础B/)
  })

  it('多个类型1区间价格候选时阻断并列出候选Sheet', () => {
    const result = detectRangeWorkbookRoute([
      { name: '基础', rows: buildBaseRows() },
      { name: '区间A', rows: buildType1Rows() },
      { name: '区间B', rows: buildType1Rows({ factorCode: 'ZN' }) },
    ])

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'MULTIPLE_RANGE_SHEETS')
    assert.match(result.message, /区间A/)
    assert.match(result.message, /区间B/)
  })

  it('无有效候选时返回业务可读错误', () => {
    const result = detectRangeWorkbookRoute([
      { name: '说明', rows: [['这是说明页'], ['没有可导入数据']] },
    ])

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'NO_VALID_RANGE_TEMPLATE')
    assert.match(result.message, /未找到/)
    assert.match(result.message, /区间价/)
  })

  it('空Sheet会被忽略', () => {
    const sheets = [
      { name: '空白页', rows: [[], ['', '']] },
      { name: '基础', rows: buildBaseRows() },
      { name: '区间', rows: buildType1Rows() },
    ]
    const summaries = summarizeRangeWorkbookSheets(sheets)
    const result = detectRangeWorkbookRoute(sheets)

    assert.equal(summaries.length, 2)
    assert.equal(summaries.some((item) => item.name === '空白页'), false)
    assert.equal(result.ok, true)
    assert.equal(result.route, 'TYPE1')
  })

  it('页面导入入口扫描整个工作簿并先执行结构路由', () => {
    assert.match(pageContent, /workbook\.SheetNames\.map/)
    assert.match(pageContent, /detectRangeWorkbookRoute/)
    assert.doesNotMatch(pageContent, /const sheetName = workbook\.SheetNames\[0\]/)
  })
})

const BASE_SHEET_HEADERS = [
  '组织',
  '来源',
  '供应商名称',
  '供应商代码',
  '采购分类',
  '物料名称',
  '物料代码',
  '规格型号',
  '单位',
  '是否含税',
  '生效日期',
  '失效日期',
  '订单类型',
]

const buildCompleteBaseRow = (overrides = {}) => {
  const values = {
    orgCode: 210,
    sourceName: '供管处',
    supplierName: '公主岭市远达实业有限公司',
    supplierCode: 'S000841',
    purchaseClass: '部品固定',
    materialName: '气门芯',
    materialCode: '201503873',
    specModel: 'JZF-000-004001(商用专用)',
    unit: '只',
    taxIncluded: false,
    effectiveFrom: '2025-11-01',
    effectiveTo: '2025-11-30',
    orderType: 'VMI采购',
    ...overrides,
  }
  return [
    values.orgCode,
    values.sourceName,
    values.supplierName,
    values.supplierCode,
    values.purchaseClass,
    values.materialName,
    values.materialCode,
    values.specModel,
    values.unit,
    values.taxIncluded,
    values.effectiveFrom,
    values.effectiveTo,
    values.orderType,
  ]
}

const parseBaseRows = (dataRows, headerRowIndex = 0) => {
  const rows = Array.from({ length: headerRowIndex }, () => ['基础资料说明'])
  rows.push(BASE_SHEET_HEADERS)
  rows.push(...dataRows)
  return parseRangeBaseSheet(rows)
}

describe('RPI1-03 基础资料Sheet解析与字段标准化', () => {
  it('完整基础资料行保留原值并生成标准字段', () => {
    const result = parseBaseRows([buildCompleteBaseRow()], 1)
    const row = result.rows[0]

    assert.equal(result.ok, true)
    assert.equal(result.headerRowIndex, 1)
    assert.equal(row.sourceRowNumber, 3)
    assert.equal(row.orgCode, '210')
    assert.equal(row.sourceName, '供管处')
    assert.equal(row.supplierName, '公主岭市远达实业有限公司')
    assert.equal(row.supplierCode, 'S000841')
    assert.equal(row.materialCode, '201503873')
    assert.equal(row.specModel, 'JZF-000-004001(商用专用)')
    assert.equal(row.normalizedSpec, 'JZF-000-004001(商用专用)')
    assert.equal(row.normalizedSupplierName, '公主岭远达')
    assert.equal(row.normalizedSupplierCode, 'S000841')
    assert.equal(row.supplierIdentityKey, 'CODE:S000841')
  })

  it('规格换行只影响匹配键，不修改原始规格', () => {
    const rawSpec = 'JZF-000-004001\n(商用专用)'
    const result = parseBaseRows([buildCompleteBaseRow({ specModel: rawSpec })])

    assert.equal(result.rows[0].specModel, rawSpec)
    assert.equal(result.rows[0].normalizedSpec, 'JZF-000-004001(商用专用)')
  })

  it('规格全角空格和中英文横线统一，括号内容保留', () => {
    assert.equal(
      normalizeRangeBaseSpec(' jzf－000—004001　（Y） '),
      'JZF-000-004001(Y)'
    )
  })

  it('供应商代码保留前导字符和原始值，比较键统一大小写', () => {
    const result = parseBaseRows([
      buildCompleteBaseRow({ supplierCode: ' 00ab01 ' }),
    ])
    const row = result.rows[0]

    assert.equal(row.supplierCodeRaw, ' 00ab01 ')
    assert.equal(row.supplierCode, '00ab01')
    assert.equal(row.normalizedSupplierCode, '00AB01')
    assert.equal(row.supplierIdentityKey, 'CODE:00AB01')
    assert.equal(normalizeRangeBaseSupplierCode(' 00ab01 '), '00AB01')
  })

  it('供应商代码为空但名称存在时按标准化名称生成身份', () => {
    const result = parseBaseRows([
      buildCompleteBaseRow({ supplierCode: '' }),
    ])
    const row = result.rows[0]

    assert.equal(result.ok, true)
    assert.equal(row.supplierCode, '')
    assert.equal(row.supplierIdentityKey, 'NAME:公主岭远达')
  })

  it('供应商名称为空时返回业务可读错误', () => {
    const result = parseBaseRows([
      buildCompleteBaseRow({ supplierName: '', supplierCode: 'S000841' }),
    ])

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'MISSING_SUPPLIER_NAME')
    assert.equal(result.errors[0].rowNumber, 2)
    assert.match(result.errors[0].message, /供应商名称/)
  })

  it('物料代码为空时返回业务可读错误', () => {
    const result = parseBaseRows([
      buildCompleteBaseRow({ materialCode: '' }),
    ])

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'MISSING_MATERIAL_CODE')
    assert.equal(result.errors[0].rowNumber, 2)
    assert.match(result.errors[0].message, /物料代码/)
  })

  it('日期支持Date对象和常见Excel日期文本并输出YYYY-MM-DD', () => {
    const result = parseBaseRows([
      buildCompleteBaseRow({
        effectiveFrom: new Date(2025, 10, 1),
        effectiveTo: '11/30/25',
      }),
    ])
    const row = result.rows[0]

    assert.equal(row.effectiveFrom, '2025-11-01')
    assert.equal(row.effectiveTo, '2025-11-30')
    assert.equal(row.effectiveToRaw, '11/30/25')
  })

  it('布尔含税字段支持FALSE、TRUE和中文值', () => {
    const result = parseBaseRows([
      buildCompleteBaseRow({ materialCode: 'MAT-1', taxIncluded: 'FALSE' }),
      buildCompleteBaseRow({ materialCode: 'MAT-2', taxIncluded: 'TRUE' }),
      buildCompleteBaseRow({ materialCode: 'MAT-3', taxIncluded: '是' }),
    ])

    assert.deepEqual(
      result.rows.map((row) => row.taxIncluded),
      [false, true, true]
    )
  })

  it('重复基础资料行阻断并指出首条和重复行', () => {
    const duplicate = buildCompleteBaseRow()
    const result = parseBaseRows([duplicate, [...duplicate]])

    assert.equal(result.ok, false)
    assert.equal(result.rows.length, 2)
    assert.equal(result.duplicates.length, 1)
    assert.equal(result.duplicates[0].firstRowNumber, 2)
    assert.equal(result.duplicates[0].duplicateRowNumber, 3)
    assert.equal(result.errors.at(-1).code, 'DUPLICATE_BASE_ROW')
    assert.match(result.errors.at(-1).message, /第2行/)
  })

  it('供应商标准化可识别真实样例中的行政区、企业后缀和业务描述词', () => {
    assert.equal(
      normalizeRangeBaseSupplierName('公主岭市远达实业有限公司'),
      '公主岭远达'
    )
    assert.equal(
      normalizeRangeBaseSupplierName('吉林省合信汽配有限公司'),
      '吉林合信'
    )
  })

  it('页面识别类型1后先校验基础资料，不提前提交区间明细', () => {
    assert.match(pageContent, /parseRangeBaseSheet/)
    assert.match(pageContent, /baseParseResult/)
    assert.match(pageContent, /基础资料解析失败/)
  })
})

const buildRangeType1Matrix = ({
  intervals = [
    { title: 'CU：57001-60000', subHeaders: ['不含税', '含税'] },
  ],
  businessRows = [
    {
      name: '气门芯',
      spec: 'JZF-000-004001\n(商用专用)',
      supplier: '公主岭远达',
      prices: [[0.9947, 1.124]],
      remark: '测试备注',
    },
  ],
  titleRows = [['类型1区间价格导入']],
} = {}) => {
  const header = ['名称', '规格', '供方']
  const subHeader = ['', '', '']
  intervals.forEach((interval) => {
    const subHeaders = interval.subHeaders || ['不含税', '含税']
    header.push(interval.title)
    subHeader.push(subHeaders[0] || '')
    for (let index = 1; index < subHeaders.length; index += 1) {
      header.push('')
      subHeader.push(subHeaders[index])
    }
  })
  header.push('备注')
  subHeader.push('')

  const rows = [...titleRows, header, subHeader]
  businessRows.forEach((businessRow) => {
    const row = [
      businessRow.name || '',
      businessRow.spec || '',
      businessRow.supplier || '',
    ]
    intervals.forEach((interval, intervalIndex) => {
      const subHeaders = interval.subHeaders || ['不含税', '含税']
      const values = businessRow.prices?.[intervalIndex] || []
      subHeaders.forEach((_subHeader, priceIndex) => {
        row.push(values[priceIndex] ?? '')
      })
    })
    row.push(businessRow.remark || '')
    rows.push(row)
  })
  return rows
}

const buildTenIntervals = () =>
  Array.from({ length: 10 }, (_value, index) => {
    const rangeLow = 57001 + index * 3000
    const rangeHigh = 60000 + index * 3000
    return {
      title: `${index === 0 ? 'CU：' : ''}${rangeLow}-${rangeHigh}`,
      subHeaders: ['不含税', '含税'],
    }
  })

describe('RPI1-04 Sheet1区间表头、公式缓存值和矩阵解析', () => {
  it('识别第2、3行双层表头并保留Excel业务行号', () => {
    const rows = buildRangeType1Matrix()
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, true)
    assert.equal(result.headerRowIndex, 1)
    assert.equal(result.subHeaderRowIndex, 2)
    assert.equal(result.rows[0].sourceRowNumber, 4)
    assert.equal(result.rows[0].specModelRaw, 'JZF-000-004001\n(商用专用)')
    assert.equal(result.rows[0].supplierShortName, '公主岭远达')
    assert.equal(result.rows[0].remark, '测试备注')
  })

  it('解析CU区间并识别影响因素代码和单位', () => {
    const result = parseRangeType1Sheet(buildRangeType1Matrix())

    assert.equal(result.factor.code, 'CU')
    assert.equal(result.factor.factorUnit, '元/吨')
    assert.equal(result.intervals[0].rangeLow, 57001)
    assert.equal(result.intervals[0].rangeHigh, 60000)
  })

  it('兼容中文和英文区间连接符', () => {
    const intervals = [
      { title: 'CU：57001-60000', subHeaders: ['不含税'] },
      { title: '60001至63000', subHeaders: ['不含税'] },
      { title: '63001—66000', subHeaders: ['不含税'] },
      { title: '66001～69000', subHeaders: ['不含税'] },
    ]
    const result = parseRangeType1Sheet(buildRangeType1Matrix({
      intervals,
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1], [2], [3], [4]],
      }],
    }))

    assert.equal(result.ok, true)
    assert.deepEqual(
      result.intervals.map((item) => [item.rangeLow, item.rangeHigh]),
      [[57001, 60000], [60001, 63000], [63001, 66000], [66001, 69000]]
    )
  })

  it('含税和不含税子列顺序变化时仍按表头归位', () => {
    const rows = buildRangeType1Matrix({
      intervals: [{ title: 'CU：57001-60000', subHeaders: ['含税', '不含税'] }],
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1.13, 1]],
      }],
    })
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, true)
    assert.equal(result.intervalRows[0].priceInclTax, 1.13)
    assert.equal(result.intervalRows[0].priceExclTax, 1)
  })

  it('只有不含税价时生成不含税区间行', () => {
    const rows = buildRangeType1Matrix({
      intervals: [{ title: 'CU：57001-60000', subHeaders: ['不含税'] }],
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1]],
      }],
    })
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, true)
    assert.equal(result.intervalRows[0].priceExclTax, 1)
    assert.equal(result.intervalRows[0].priceInclTax, null)
  })

  it('只有含税价时生成含税区间行', () => {
    const rows = buildRangeType1Matrix({
      intervals: [{ title: 'CU：57001-60000', subHeaders: ['含税'] }],
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1.13]],
      }],
    })
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, true)
    assert.equal(result.intervalRows[0].priceExclTax, null)
    assert.equal(result.intervalRows[0].priceInclTax, 1.13)
  })

  it('公式价格优先读取Excel保存的精确缓存值', () => {
    const rows = buildRangeType1Matrix()
    rows[3][3] = '0.9947'
    const formulaCells = {
      '3:3': {
        address: 'D4',
        formula: 'E4/1.13',
        cachePresent: true,
        cachedValue: 0.9946902654867257,
        cellType: 'n',
      },
    }
    const result = parseRangeType1Sheet(rows, { formulaCells })

    assert.equal(result.ok, true)
    assert.equal(result.intervalRows[0].priceExclTax, 0.9946902654867257)
  })

  it('公式没有缓存结果时阻断并指出单元格', () => {
    const rows = buildRangeType1Matrix()
    const formulaCells = {
      '3:3': {
        address: 'D4',
        formula: 'E4/1.13',
        cachePresent: false,
        cellType: 'n',
      },
    }
    const result = parseRangeType1Sheet(rows, { formulaCells })

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'MISSING_FORMULA_CACHE')
    assert.match(result.errors[0].message, /D4/)
  })

  it('Excel错误值阻断', () => {
    const rows = buildRangeType1Matrix()
    rows[3][3] = '#DIV/0!'
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'EXCEL_PRICE_ERROR')
  })

  it('非数字价格阻断', () => {
    const rows = buildRangeType1Matrix()
    rows[3][3] = '待确认'
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'NON_NUMERIC_PRICE')
  })

  it('区间重叠时阻断', () => {
    const intervals = [
      { title: 'CU：57001-60000', subHeaders: ['不含税'] },
      { title: '59000-63000', subHeaders: ['不含税'] },
    ]
    const result = parseRangeType1Sheet(buildRangeType1Matrix({
      intervals,
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1], [2]],
      }],
    }))

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'OVERLAPPING_RANGES')
  })

  it('相邻闭区间重复边界时阻断', () => {
    const intervals = [
      { title: 'CU：57001-60000', subHeaders: ['不含税'] },
      { title: '60000-63000', subHeaders: ['不含税'] },
    ]
    const result = parseRangeType1Sheet(buildRangeType1Matrix({
      intervals,
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1], [2]],
      }],
    }))

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'DUPLICATE_RANGE_BOUNDARY')
  })

  it('区间下限大于上限时阻断', () => {
    const rows = buildRangeType1Matrix({
      intervals: [{ title: 'CU：60000-57001', subHeaders: ['不含税'] }],
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [[1]],
      }],
    })
    const result = parseRangeType1Sheet(rows, {
      headerRowIndex: 1,
      subHeaderRowIndex: 2,
    })

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'RANGE_LOW_GT_HIGH')
  })

  it('同一区间含税价和不含税价都为空时阻断', () => {
    const result = parseRangeType1Sheet(buildRangeType1Matrix({
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-1',
        supplier: '公主岭远达',
        prices: [['', '']],
      }],
    }))

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].code, 'EMPTY_RANGE_PRICE')
  })

  it('完全空白的业务行会忽略', () => {
    const rows = buildRangeType1Matrix({
      businessRows: [
        { name: '', spec: '', supplier: '', prices: [['', '']] },
        {
          name: '气门芯',
          spec: 'JZF-1',
          supplier: '公主岭远达',
          prices: [[1, 1.13]],
        },
      ],
    })
    const result = parseRangeType1Sheet(rows)

    assert.equal(result.ok, true)
    assert.equal(result.rows.length, 1)
    assert.equal(result.intervalRows.length, 1)
    assert.equal(result.rows[0].sourceRowNumber, 5)
  })

  it('真实结构可识别8行且每行10个区间，共展开80条', () => {
    const intervals = buildTenIntervals()
    const businessRows = Array.from({ length: 8 }, (_value, rowIndex) => ({
      name: '气门芯',
      spec: `JZF-000-00400${rowIndex + 1}`,
      supplier: rowIndex < 4 ? '公主岭远达' : '吉林合信',
      prices: intervals.map((_interval, intervalIndex) => [
        1 + rowIndex / 10 + intervalIndex / 100,
        1.13 + rowIndex / 10 + intervalIndex / 100,
      ]),
    }))
    const result = parseRangeType1Sheet(buildRangeType1Matrix({
      intervals,
      businessRows,
    }))

    assert.equal(result.ok, true)
    assert.equal(result.rows.length, 8)
    assert.equal(result.intervals.length, 10)
    assert.equal(result.intervalRows.length, 80)
    assert.equal(result.rows.every((row) => row.intervals.length === 10), true)
  })

  it('从SheetJS工作表提取公式和缓存元数据', () => {
    const metadata = collectRangeFormulaCells({
      D4: { f: 'E4/1.13', t: 'n', v: 0.9946902654867257, w: '0.9947' },
      E4: { t: 'n', v: 1.124 },
      '!ref': 'A1:E4',
    })

    assert.deepEqual(metadata['3:3'], {
      address: 'D4',
      formula: 'E4/1.13',
      cachePresent: true,
      cachedValue: 0.9946902654867257,
      cellType: 'n',
      displayValue: '0.9947',
    })
    assert.equal(metadata['3:4'], undefined)
  })

  it('页面类型1路径同时校验基础资料和区间矩阵，且仍不提交数据库', () => {
    assert.match(pageContent, /collectRangeFormulaCells/)
    assert.match(pageContent, /parseRangeType1Sheet/)
    assert.match(pageContent, /区间矩阵解析失败/)
    assert.match(pageContent, /本次未导入数据/)
  })
})

const buildMatchBaseRow = (overrides = {}) => {
  const row = {
    sourceRowNumber: 2,
    orgCode: '210',
    sourceName: '供管处',
    supplierName: '公主岭市远达实业有限公司',
    supplierCode: 'S000841',
    purchaseClass: '部品固定',
    materialName: '气门芯',
    materialCode: '201503873',
    specModel: 'JZF-000-004001(商用专用)',
    unit: '只',
    taxIncluded: false,
    effectiveFrom: '2025-11-01',
    effectiveTo: '2025-11-30',
    orderType: 'VMI采购',
    ...overrides,
  }
  row.normalizedSpec = normalizeRangeBaseSpec(row.specModel)
  row.normalizedSupplierName = normalizeRangeBaseSupplierName(row.supplierName)
  row.normalizedSupplierCode = normalizeRangeBaseSupplierCode(row.supplierCode)
  row.supplierIdentityKey = row.normalizedSupplierCode
    ? `CODE:${row.normalizedSupplierCode}`
    : row.normalizedSupplierName
      ? `NAME:${row.normalizedSupplierName}`
      : ''
  return row
}

const buildMatchBusinessRow = (overrides = {}) => {
  const row = {
    sourceRowNumber: 4,
    materialName: '气门芯',
    specModel: 'JZF-000-004001\n(商用专用)',
    supplierShortName: '公主岭远达',
    remark: '价格随铜价调整',
    intervals: [
      { intervalIndex: 0, rangeLow: 57001, rangeHigh: 60000, priceExclTax: 1, priceInclTax: 1.13 },
      { intervalIndex: 1, rangeLow: 60001, rangeHigh: 63000, priceExclTax: 1.01, priceInclTax: 1.1413 },
    ],
    ...overrides,
  }
  row.specModelRaw = row.specModel
  row.supplierShortNameRaw = row.supplierShortName
  row.normalizedSpec = normalizeRangeBaseSpec(row.specModel)
  row.normalizedSupplierShortName = normalizeRangeBaseSupplierName(row.supplierShortName)
  return row
}

describe('RPI1-05 规格和供方简称唯一匹配与导入预览', () => {
  it('公主岭远达唯一匹配完整名称和S000841', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow()],
      [buildMatchBusinessRow()]
    )

    assert.equal(result.ok, true)
    assert.equal(result.previewRows[0].matchStatus, 'MATCHED')
    assert.equal(result.previewRows[0].materialCode, '201503873')
    assert.equal(result.previewRows[0].supplierName, '公主岭市远达实业有限公司')
    assert.equal(result.previewRows[0].supplierCode, 'S000841')
    assert.equal(result.previewRows[0].intervalCount, 2)
  })

  it('吉林合信唯一匹配完整名称和S001289', () => {
    const baseRow = buildMatchBaseRow({
      supplierName: '吉林省合信汽配有限公司',
      supplierCode: 'S001289',
      materialCode: '201503703',
      specModel: 'JZF-000-004001(H)',
    })
    const businessRow = buildMatchBusinessRow({
      sourceRowNumber: 10,
      specModel: 'JZF-000-004001(H)',
      supplierShortName: '吉林合信',
    })
    const result = matchRangeType1Rows([baseRow], [businessRow])

    assert.equal(result.ok, true)
    assert.equal(result.previewRows[0].materialCode, '201503703')
    assert.equal(result.previewRows[0].supplierName, '吉林省合信汽配有限公司')
    assert.equal(result.previewRows[0].supplierCode, 'S001289')
  })

  it('相同规格存在两个供应商时用简称正确区分', () => {
    const baseRows = [
      buildMatchBaseRow(),
      buildMatchBaseRow({
        sourceRowNumber: 3,
        supplierName: '吉林省合信汽配有限公司',
        supplierCode: 'S001289',
      }),
    ]
    const result = matchRangeType1Rows(baseRows, [
      buildMatchBusinessRow({ supplierShortName: '吉林合信' }),
    ])

    assert.equal(result.ok, true)
    assert.equal(result.previewRows[0].supplierCode, 'S001289')
  })

  it('规格不存在时返回明确失败原因', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow()],
      [buildMatchBusinessRow({ sourceRowNumber: 27, specModel: 'NOT-FOUND' })]
    )

    assert.equal(result.ok, false)
    assert.equal(result.previewRows[0].matchStatus, 'FAILED')
    assert.equal(result.previewRows[0].errorCode, 'NO_SPEC_MATCH')
    assert.match(result.previewRows[0].errorReason, /规格/)
  })

  it('规格存在但供方简称不存在时不能因规格唯一而直接匹配', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow()],
      [buildMatchBusinessRow({ supplierShortName: '不存在的供应商' })]
    )

    assert.equal(result.ok, false)
    assert.equal(result.previewRows[0].errorCode, 'NO_SUPPLIER_MATCH')
    assert.equal(result.previewRows[0].materialCode, '')
  })

  it('同规格同简称匹配到多条时阻断且不默认取第一条', () => {
    const baseRows = [
      buildMatchBaseRow({ materialCode: 'MAT-001' }),
      buildMatchBaseRow({ sourceRowNumber: 3, materialCode: 'MAT-002' }),
    ]
    const result = matchRangeType1Rows(baseRows, [buildMatchBusinessRow()])

    assert.equal(result.ok, false)
    assert.equal(result.previewRows[0].matchStatus, 'CONFLICT')
    assert.equal(result.previewRows[0].errorCode, 'MULTIPLE_SUPPLIER_MATCH')
    assert.equal(result.previewRows[0].materialCode, '')
    assert.deepEqual(result.previewRows[0].candidateMaterialCodes, ['MAT-001', 'MAT-002'])
  })

  it('供应商代码为空但完整名称存在时允许以名称身份唯一匹配', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow({ supplierCode: '' })],
      [buildMatchBusinessRow()]
    )

    assert.equal(result.ok, true)
    assert.equal(result.previewRows[0].supplierCode, '')
    assert.equal(result.matchedRows[0].supplierIdentityKey, 'NAME:公主岭远达')
  })

  it('同规格候选的供应商名称和代码都为空时返回身份缺失错误', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow({ supplierName: '', supplierCode: '' })],
      [buildMatchBusinessRow()]
    )

    assert.equal(result.ok, false)
    assert.equal(result.previewRows[0].errorCode, 'MISSING_SUPPLIER_IDENTITY')
    assert.match(result.previewRows[0].errorReason, /名称和代码都为空/)
  })

  it('任意一行业务数据匹配失败时整批阻断', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow()],
      [
        buildMatchBusinessRow(),
        buildMatchBusinessRow({
          sourceRowNumber: 5,
          specModel: 'NOT-FOUND',
          supplierShortName: '吉林合信',
        }),
      ]
    )

    assert.equal(result.ok, false)
    assert.equal(result.canSubmit, false)
    assert.equal(result.summary.totalCount, 2)
    assert.equal(result.summary.matchedCount, 1)
    assert.equal(result.summary.failedCount, 1)
    assert.equal(result.matchedRows.length, 1)
  })

  it('预览行号和错误字段准确', () => {
    const result = matchRangeType1Rows(
      [buildMatchBaseRow()],
      [buildMatchBusinessRow({
        sourceRowNumber: 27,
        supplierShortName: '错误供方',
      })]
    )

    assert.equal(result.previewRows[0].sourceRowNumber, 27)
    assert.equal(result.previewRows[0].errorField, 'supplierShortName')
    assert.equal(result.errors[0].rowNumber, 27)
    assert.equal(result.errors[0].field, 'supplierShortName')
  })

  it('基础资料多余行不生成预览业务行', () => {
    const result = matchRangeType1Rows(
      [
        buildMatchBaseRow(),
        buildMatchBaseRow({
          sourceRowNumber: 99,
          materialCode: 'EXTRA-001',
          specModel: 'EXTRA-SPEC',
          supplierName: '额外供应商有限公司',
          supplierCode: 'EXTRA-SUPPLIER',
        }),
      ],
      [buildMatchBusinessRow()]
    )

    assert.equal(result.ok, true)
    assert.equal(result.previewRows.length, 1)
    assert.equal(result.previewRows.some((row) => row.materialCode === 'EXTRA-001'), false)
  })

  it('页面展示业务可读预览，匹配异常时整批阻断', () => {
    assert.match(pageContent, /类型1区间价导入预览/)
    assert.match(pageContent, /Sheet1行号/)
    assert.match(pageContent, /供方简称/)
    assert.match(pageContent, /匹配料号/)
    assert.match(pageContent, /异常原因/)
    assert.match(pageContent, /matchRangeType1Rows/)
    assert.match(pageContent, /存在解析或匹配错误/)
  })
})

describe('RPI1-11 导入错误定位和完整展示', () => {
  it('区间矩阵错误带出Sheet、Excel行、规格和供方简称', () => {
    const rows = buildRangeType1Matrix({
      businessRows: [{
        name: '气门芯',
        spec: 'JZF-ERR-001',
        supplier: '公主岭远达',
        prices: [['待确认', 1.13]],
      }],
    })

    const result = parseRangeType1Sheet(rows, { sheetName: 'Sheet1' })

    assert.equal(result.ok, false)
    assert.equal(result.errors[0].sheetName, 'Sheet1')
    assert.equal(result.errors[0].rowNumber, 4)
    assert.equal(result.errors[0].specModel, 'JZF-ERR-001')
    assert.equal(result.errors[0].supplierShortName, '公主岭远达')
    assert.match(result.errors[0].message, /不是有效数字/)
  })

  it('跨Sheet匹配错误标准化后不丢失料号规格供应商和原因', () => {
    const normalized = normalizeRangeImportErrors([
      {
        code: 'NO_SUPPLIER_MATCH',
        rowNumber: 27,
        message: '供方简称没有匹配项',
        specModel: 'YCQB02-031003',
        supplierShortName: '浙江华亿',
        materialCode: '1145000300485',
      },
    ], { sheetName: 'Sheet1' })

    assert.deepEqual(normalized[0], {
      code: 'NO_SUPPLIER_MATCH',
      sheetName: 'Sheet1',
      rowNumber: 27,
      materialCode: '1145000300485',
      specModel: 'YCQB02-031003',
      supplierName: '浙江华亿',
      supplierCode: '',
      message: '供方简称没有匹配项',
    })
  })

  it('页面用明细弹窗展示全部错误，不再只显示前三条摘要', () => {
    assert.match(pageContent, /导入错误明细/)
    assert.match(pageContent, /Sheet名称/)
    assert.match(pageContent, /Excel行号/)
    assert.match(pageContent, /料号\/规格/)
    assert.match(pageContent, /供应商简称\/身份/)
    assert.match(pageContent, /rangeImportErrorRows/)
    assert.doesNotMatch(pageContent, /baseParseResult\.errors\s*\n?\s*\.slice\(0, 3\)/)
    assert.doesNotMatch(pageContent, /rangeParseResult\.errors\s*\n?\s*\.slice\(0, 3\)/)
  })
})

const buildRpi106Fixture = () => {
  const intervalRows = Array.from({ length: 10 }, (_value, intervalIndex) => ({
    intervalIndex,
    rangeLow: 57001 + intervalIndex * 3000,
    rangeHigh: 60000 + intervalIndex * 3000,
    priceExclTax: 0.99 + intervalIndex / 100,
    priceInclTax: 1.12 + intervalIndex / 100,
  }))
  const rowDefinitions = [
    ['201503873', 'JZF-000-004001(商用专用)', '公主岭远达', 'S000841', '公主岭市远达实业有限公司'],
    ['201503874', 'JZF-000-004002(商用专用)', '公主岭远达', 'S000841', '公主岭市远达实业有限公司'],
    ['201503702', 'JZF-000-004003(商用专用)', '公主岭远达', 'S000841', '公主岭市远达实业有限公司'],
    ['201503705', 'JZF-000-004004(商用专用)', '公主岭远达', 'S000841', '公主岭市远达实业有限公司'],
    ['201503873', 'JZF-000-004001(商用专用)', '吉林合信', 'S001289', '吉林省合信汽配有限公司'],
    ['201503874', 'JZF-000-004002(商用专用)', '吉林合信', 'S001289', '吉林省合信汽配有限公司'],
    ['201503703', 'JZF-000-004005(H)', '吉林合信', 'S001289', '吉林省合信汽配有限公司'],
    ['201503706', 'JZF-000-004006(H)', '吉林合信', 'S001289', '吉林省合信汽配有限公司'],
  ]
  const baseRows = rowDefinitions.map((
    [materialCode, specModel, _supplierShortName, supplierCode, supplierName],
    index
  ) => buildMatchBaseRow({
    sourceRowNumber: index + 2,
    materialCode,
    materialName: `基础资料名称${index + 1}`,
    specModel,
    supplierCode,
    supplierName,
    unitPrice: 999,
  }))
  const businessRows = rowDefinitions.map((
    [_materialCode, specModel, supplierShortName],
    index
  ) => buildMatchBusinessRow({
    sourceRowNumber: index + 4,
    materialName: `Sheet1产品${index + 1}`,
    specModel,
    supplierShortName,
    intervals: intervalRows.map((interval) => ({
      ...interval,
      priceExclTax: interval.priceExclTax + index / 10,
      priceInclTax: interval.priceInclTax + index / 10,
    })),
  }))
  return {
    baseRows,
    businessRows,
    matchResult: matchRangeType1Rows(baseRows, businessRows),
  }
}

const buildRpi106Request = () => {
  const fixture = buildRpi106Fixture()
  return {
    ...fixture,
    requestResult: buildRangeType1ImportRequest(fixture.matchResult, {
      factor: { code: 'CU' },
      fileName: '采购价表二次开发导入模板251115区间价格导入类型1.xls',
      sheetName: 'Sheet1',
      importBatchNo: 'RPI1-06-BATCH',
    }),
  }
}

describe('RPI1-06 区间矩阵展开、标准请求构造和前端导入接入', () => {
  it('8行业务数据展开为80条标准区间价明细', () => {
    const { requestResult } = buildRpi106Request()

    assert.equal(requestResult.ok, true)
    assert.equal(requestResult.canSubmit, true)
    assert.equal(requestResult.businessRowCount, 8)
    assert.equal(requestResult.rowCount, 80)
    assert.equal(requestResult.payload.rows.length, 80)
  })

  it('201503873包含两个供应商且每个供应商各10条', () => {
    const rows = buildRpi106Request().requestResult.payload.rows
      .filter((row) => row.materialCode === '201503873')

    assert.equal(rows.length, 20)
    assert.equal(rows.filter((row) => row.supplierCode === 'S000841').length, 10)
    assert.equal(rows.filter((row) => row.supplierCode === 'S001289').length, 10)
  })

  it('201503874包含两个供应商且每个供应商各10条', () => {
    const rows = buildRpi106Request().requestResult.payload.rows
      .filter((row) => row.materialCode === '201503874')

    assert.equal(rows.length, 20)
    assert.equal(rows.filter((row) => row.supplierCode === 'S000841').length, 10)
    assert.equal(rows.filter((row) => row.supplierCode === 'S001289').length, 10)
  })

  it('逐区间保留正确的上下限', () => {
    const rows = buildRpi106Request().requestResult.payload.rows.slice(0, 10)

    assert.deepEqual(
      rows.map((row) => [row.rangeLow, row.rangeHigh]),
      Array.from({ length: 10 }, (_value, index) => [
        57001 + index * 3000,
        60000 + index * 3000,
      ])
    )
  })

  it('含税和不含税价格只取Sheet1区间矩阵且不读取基础资料普通单价', () => {
    const firstRow = buildRpi106Request().requestResult.payload.rows[0]

    assert.equal(firstRow.priceExclTax, 0.99)
    assert.equal(firstRow.priceInclTax, 1.12)
    assert.equal('unitPrice' in firstRow, false)
    assert.equal(Object.values(firstRow).includes(999), false)
  })

  it('每条明细带入基础资料中的正式供应商名称和供应商代码', () => {
    const rows = buildRpi106Request().requestResult.payload.rows

    assert.equal(
      rows
        .filter((row) => row.supplierCode === 'S000841')
        .every((row) => row.supplierName === '公主岭市远达实业有限公司'),
      true
    )
    assert.equal(
      rows
        .filter((row) => row.supplierCode === 'S001289')
        .every((row) => row.supplierName === '吉林省合信汽配有限公司'),
      true
    )
  })

  it('请求使用实际来源文件、区间Sheet和CU影响因素信息', () => {
    const { payload } = buildRpi106Request().requestResult

    assert.equal(payload.rangeBasis, 'FACTOR')
    assert.equal(payload.factorCode, 'CU')
    assert.equal(payload.factorName, '电解铜')
    assert.equal(payload.factorUnit, '元/吨')
    assert.equal(payload.sourceFile, '采购价表二次开发导入模板251115区间价格导入类型1.xls')
    assert.equal(payload.sourceSheet, 'Sheet1')
    assert.equal(payload.importBatchNo, 'RPI1-06-BATCH')
  })

  it('逐行继承基础资料日期且只生成现有后端DTO字段', () => {
    const firstRow = buildRpi106Request().requestResult.payload.rows[0]

    assert.equal(firstRow.effectiveFrom, '2025-11-01')
    assert.equal(firstRow.effectiveTo, '2025-11-30')
    assert.deepEqual(Object.keys(firstRow).sort(), [
      'effectiveFrom',
      'effectiveTo',
      'factorCode',
      'materialCode',
      'materialName',
      'orderType',
      'orgCode',
      'priceExclTax',
      'priceInclTax',
      'purchaseClass',
      'rangeBasis',
      'rangeHigh',
      'rangeLow',
      'sourceName',
      'specModel',
      'supplierCode',
      'supplierName',
      'taxIncluded',
      'unit',
    ])
    assert.equal(firstRow.materialName, 'Sheet1产品1')
    assert.equal(firstRow.specModel, 'JZF-000-004001(商用专用)')
  })

  it('原有标准行情区间价请求结构保持不变', () => {
    const sourceRow = {
      materialCode: 'OLD-FACTOR',
      unit: '元/只',
      rangeLow: 1,
      rangeHigh: 2,
      priceExclTax: 3,
      customLegacyField: 'keep',
    }
    const payload = buildRangeImportPayload([sourceRow], {
      factor: { code: 'ZN' },
      fileName: 'old.xlsx',
      sheetName: '区间锌价',
      importBatchNo: 'OLD-FACTOR-BATCH',
    })

    assert.deepEqual(payload, {
      rangeBasis: 'FACTOR',
      factorCode: 'ZN',
      factorName: '电解锌',
      factorUnit: '元/吨',
      priceUnit: '元/只',
      sourceFile: 'old.xlsx',
      sourceSheet: '区间锌价',
      importBatchNo: 'OLD-FACTOR-BATCH',
      rows: [{
        ...sourceRow,
        rangeBasis: 'FACTOR',
        factorCode: 'ZN',
      }],
    })
  })

  it('原有数量区间价请求结构保持不变', () => {
    const sourceRow = {
      materialCode: 'OLD-QTY',
      unit: '元/件',
      rangeLow: 1,
      rangeHigh: 100,
      priceInclTax: 10,
      customLegacyField: 'keep',
    }
    const payload = buildRangeImportPayload([sourceRow], {
      fileName: 'old-qty.xlsx',
      sheetName: '数量区间价',
      importBatchNo: 'OLD-QTY-BATCH',
    })

    assert.deepEqual(payload, {
      rangeBasis: 'QTY',
      factorCode: '',
      factorName: '',
      factorUnit: '',
      priceUnit: '元/件',
      sourceFile: 'old-qty.xlsx',
      sourceSheet: '数量区间价',
      importBatchNo: 'OLD-QTY-BATCH',
      rows: [{
        ...sourceRow,
        rangeBasis: 'QTY',
        factorCode: '',
      }],
    })
  })

  it('匹配失败时不构造请求也绝不调用导入API', async () => {
    const failedMatchResult = matchRangeType1Rows(
      [buildMatchBaseRow()],
      [buildMatchBusinessRow({ specModel: 'NOT-FOUND' })]
    )
    const requestResult = buildRangeType1ImportRequest(failedMatchResult, {
      factor: { code: 'CU' },
      fileName: 'range.xls',
      sheetName: 'Sheet1',
    })
    let apiCallCount = 0
    const submitResult = await submitRangeType1ImportRequest(requestResult, async () => {
      apiCallCount += 1
      return { importedCount: 0 }
    })

    assert.equal(requestResult.ok, false)
    assert.equal(requestResult.canSubmit, false)
    assert.equal(requestResult.payload, null)
    assert.equal(submitResult.submitted, false)
    assert.equal(apiCallCount, 0)
    assert.match(pageContent, /submitRangeType1ImportRequest/)
    assert.match(pageContent, /确认导入/)
  })

  it('匹配成功后只调用一次现有导入API并提供8行匹配与80条明细预览', async () => {
    const { requestResult } = buildRpi106Request()
    let apiCallCount = 0
    let submittedPayload = null
    const submitResult = await submitRangeType1ImportRequest(requestResult, async (payload) => {
      apiCallCount += 1
      submittedPayload = payload
      return { importedCount: payload.rows.length }
    })

    assert.equal(submitResult.submitted, true)
    assert.equal(submitResult.response.importedCount, 80)
    assert.equal(apiCallCount, 1)
    assert.equal(submittedPayload.rows.length, 80)
    assert.match(pageContent, /匹配结果（/)
    assert.match(pageContent, /导入明细（/)
    assert.match(pageContent, /rangePreviewExpandedRows/)
    assert.match(pageContent, /importRangeItems/)
  })
})
