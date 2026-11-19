import { sourceColumns } from './workbookSourceColumns.js'
const c = (field, label, type = 'text', help = '', example = '') => ({ field, label, type, help, example })
const columns = entries => entries.map(entry => c(...entry))
const define = (title, sheet, entries, notes = [], purpose = '') => ({ title, sheet, columns: columns(entries), notes, purpose })
const formula = (sheet, address, expression) => { sheet[address] = { t: 'n', f: expression, v: 0, z: '0.############' } }

export const workbookDefinitions = {
  materials: define('物料资料', '物料资料', [
    ['materialCode','物料编码','text','必填，按文本填写'],['materialName','物料名称'],['itemSpec','规格'],['itemModel','型号'],
    ['drawingNo','图号'],['shapeAttr','物料形态属性'],['material','材质'],['theoreticalWeightG','理论重量g','number'],
    ['netWeightKg','单品净重kg','number'],['bizUnit','属生产事业部'],['productionDept','生产部门'],['productionWorkshop','生产车间'],
  ]),
  bom: define('手工BOM', 'BOM明细', [
    ['bomCode','BOM编码'],['itemCode','料号'],['itemName','名称'],['itemSpec','规格'],['itemModel','型号'],
    ['bomLevel','层级','number'],['parentCode','父件'],['shapeAttr','形态属性'],['bomQty','BOM用量','number'],['material','材质'],
  ]),
  manufacture: define('制造费用率', '制造费用', [
    ['businessDivision','事业部'],['productCategory','产品大类'],['productCode','料号'],['productName','产品名称'],
    ['productModel','产品型号'],['productSpec','产品规格'],['feeRate','制造费用率','percent','按百分比填写，例如10%','10%'],['remark','备注'],
  ], ['导入年度在页面选择；同一年度原有更新规则保持。']),
  department: define('部门经费率', '部门经费率', [
    ['businessDivision','事业部'],['expenseSubject','费用科目'],['budgetAmount','预算费用','number'],['totalWorkMinutes','总工时','number'],
    ['planRate','计划（元/分钟）','number'],['upliftRatio','上浮比例','number','填写倍率，例如1.05'],
    ['quoteRatio','报价比例（元/分钟）','number','必填；填写最终费率，计划和上浮均填写时须等于计划×上浮'],['manhourRate','工时率','number'],['remark','备注'],
  ], ['年度在页面选择。']),
  other: define('其他费用', '其他费用', [
    ['materialCode','物料编码'],['productName','产品名称'],['spec','规格'],['model','型号'],['customer','客户'],['expenseType','费用类型'],['expenseAmount','费用','number'],
  ]),
  quality: define('质量损失率', '报价系统展示', [
    ['bareProductCode','料号'],['productName','品名'],['materialSpec','规格'],['productModel','型号'],
    ['businessDivision','事业部'],['productCategory','大类'],['productSubcategory','小类'],['categorySpec','规格'],['fourthLevel','四级'],['lossRate','净损失率','percent','例如0.475%','0.475%'],
  ], ['年度在页面选择。填写实际裸品料号，保留表头和列顺序。']),
  property: define('产品属性', '产品属性', [
    ['productCode','料号'],['productName','品名'],['productSpec','规格'],['productModel','型号'],
    ['productAttr','产品属性','text','标准品、非标品、定制品或OEM'],['businessDivision','生产事业部'],
    ['propertyYear','年度','number','填写与页面所选导入年度一致的年份','2026'],
    ['estimatedAnnualUsageWan','预计年用量（万只）','number','填10表示10万只；留空表示未填写；支持最多6位小数','10'],
  ], ['修改已导出的数据时选择增量导入，按当前业务单元、年度和料号更新。']),
  supplier: define('供应商供货比例', '供货比率', [
    ['materialCode','物料代码'],['materialName','物料名称'],['specification','规格'],['specModel','型号'],['unit','单位'],
    ['materialShape','物料形态属性'],['supplierCode','供应商代码'],['supplierName','供应商名称'],
    ['supplyRatio','供货比例','percent','20%表示二成；0%表示退出，空白表示未填写','20%'],
    ['explanation','说明','text','仅供核对，不参与导入'],['selectionRule','取价规则','text','可填写“无供货比率，取最高价”'],
  ], [
    '按料号整组更新：导入同一料号时请保留该料号完整供应商集合。文件未出现的料号保持原值。',
    '供货比例填写实际百分比，如20%；0%表示退出供货，空白表示未填写。',
    '没有供货比率时，可在“供货比例”或“取价规则”列填写“无供货比率，取最高价”。',
    '规格与型号分别填写，型号未维护时留空；说明列仅供核对，不参与导入。',
  ], '在第一个工作表填写实际数据后保存，再通过供货比率页面导入。'),
  plate: define('板片材质映射', '提供财务', [['_sequence','序号'],['normalizedModel','产品型号'],['plateMaterial','产品应用材质','text','按原导入器支持的材质填写']],
    ['保留“提供财务”工作表及第2行B/C列表头。']),
  invoice: define('发票价格', '发票价格', [
    ['document_no','单据编号'],['supplier_code','立账供应商.供应商编码'],['supplier_name','立账供应商'],
    ['material_code','应付单表行.料品.料号'],['material_name','应付单表行.料品.料品名称'],['specification','应付单表行.料品.料品规格'],
    ['pricing_unit','计量单位'],['unit_price','应付单表行.未税单价','number'],['currency','币种','text','例如CNY'],
    ['voucher_no','凭证编号'],['business_type','来源业务类型'],['document_type','单据类型'],['price_type','价格类型'],
  ], ['单据编号、供应商编码、料号、计量单位、未税单价和币种必填。单价不含税；本表不可填写公式。']),
  inquiry: define('询价', '询价', [
    ['source.rule.materialCode','料号'],['source.rule.materialName','零件名称'],['source.rule.specification','规格型号'],
    ['source.rule.supplierName','供方名称'],['source.rule.unit','计量单位'],['source.rule.priceType','价格类型','text','固定价或联动价'],
    ['source.rule.originalPrice','批量价总价(元)','number'],['price','不含税价格','number'],['source.rule.formula','备注及联动公式'],
  ], ['料号和规格型号至少填写一项。固定价填写批量价总价；联动价在“不含税价格”保存实际Excel公式，并保留引用的影响因素工作表。']),
  household: define('家用询价', '明细表2', [
    ['materialCode','料号'],['materialName','名称'],['specification','规格'],['_unit','单位'],['unitPrice','报价总成本（含两项费用、不含运费）','number'],
    ['copperWeight','铜重（克）','number'],['zincWeight','锌重（克）','number'],['householdRate','两项费用比例%','percent','例如8.5%','8.5%'],
  ], ['保留第1行B列“明细表2”和第2行表头。来源年月在页面选择，价格及两项费用率按原规则填写。']),
  linked: define('联动价', 'ImportData', [
    ['priceOrgCode','组织','text','210商用；220板换'],['materialCode','物料代码'],['materialName','物料名称'],
    ['supplierCode','供应商代码'],['supplierName','供应商名称'],['specModel','规格型号'],['unit','单位'],['taxIncluded','是否含税','boolean','填写是或否'],
    ['blankWeight','下料重量（克）','number'],['scrapWeight','废料重量（克）','number'],['processFee','加工费（元）','number'],
    ['sourceTaxExcludedPrice','单价','number','必须为真实Excel公式，不能仅填文字说明或固定数值'],['formulaExpr','联动公式'],
  ], ['“ImportData”是唯一物料主表，保留“影响因素10”工作表。填完后在Excel中计算并保存，再上传完整工作簿。',
    '首行单价提供“(下料克重×铜价−废料克重×废料价)/1000，加加工费，再除1.13”的填写示范。请按实际报价公式修改，不适用的项应明确填0。',
    '影响因素价格填写原报价使用的实际参考值（元/公斤）；发布后仍按原财务因素规则取价。示范公式为未税价，“是否含税”应填否。']),
  settlement: define('结算价格', '结算价格', [
    ['rule.materialCode','料号'],['rule.materialName','料品名称'],['rule.specModel','型号'],['rule.plannedPrice','计划价','number'],
    ['rule.markupRatio','上浮倍率','number','倍率示例1.05，修改倍率时同步修改联动公式末尾倍率'],['rule.baseSettlePrice','基准结算价','number','本行计划价×上浮倍率'],
    ['rule.copperWeightG','铜重（克）','number'],['rule.zincWeightG','锌重（克）','number'],['rule.givenPrice','联动结算价','number','固定价也在此列填写给定价'],
    ['rule.remark','备注'],['rule.priceType','价格类型','text','填写结算固定价或结算联动价'],['rule.formulaExpr','联动公式'],
  ], ['先填写本表铜、锌预算价与原稿参考价，单位元/公斤；系统结算联动仍引用商用财务已发布基价。',
    '首行预置1.05倍率、13%税率的四位小数联动公式作为填写示范，按实际业务核对。若调整倍率，E列和L列公式末尾倍率须一致。',
    '固定价填写给定价；联动价铜重必填，空白锌重按0克。复制行时保留铜锌基价的绝对引用。填完计算并保存后再导入。']),
  scrap: define('废料价格', '废料清单', [
    ['materialCode','回收料号'],['materialName','回收料品名'],['unit','回收料单位'],['supplierName','供应商名称'],['supplierCode','供应商代码'],
    ['price','不含税价','number'],['priceType','价格类型','text','固定价或联动价'],['formulaExpression','联动公式'],['source','来源'],['approvalType','批单类型'],['approvalNo','批单编号'],
  ], ['固定价填写数值；联动价在“不含税价”中保留实际公式及本表引用的原材料基价。']),
}

workbookDefinitions.plate.leadingRows = [['板片材质映射']]
workbookDefinitions.household.leadingRows = [['', '明细表2']]
workbookDefinitions.settlement.leadingRows = [
  ['结算价格填写表'], ['铜（元/公斤）', '', '', 'B列填写预算价；C列填写原稿参考价'], ['锌（元/公斤）', '', ''],
]
workbookDefinitions.settlement.customizeTemplate = book => {
  const sheet = book.Sheets['结算价格']
  sheet.E5 = { t: 'n', v: 1.05 }
  formula(sheet, 'F5', 'D5*E5')
  formula(sheet, 'L5', 'ROUND(F5+(($C$2-$B$2)*G5+($C$3-$B$3)*H5)/1000/1.13*1.05,4)')
  formula(sheet, 'I5', 'L5')
}
workbookDefinitions.linked.customizeTemplate = (book, XLSX) => {
  const factors = XLSX.utils.aoa_to_sheet([
    ['序号','价表影响因素名称','简称','取价来源','价格','单位'],
    ['','电解铜','Cu','平均价','','元/公斤'],['','美国柜装黄铜','Brass','平均价','','元/公斤'],
  ])
  factors['!cols'] = [{wch:10},{wch:26},{wch:16},{wch:16},{wch:20},{wch:12}]
  XLSX.utils.book_append_sheet(book, factors, '影响因素10')
  formula(book.Sheets.ImportData, 'L2', "((I2*'影响因素10'!E2-J2*'影响因素10'!E3)/1000+K2)/1.13")
}

for (const [kind, title, sheet] of [
  ['fixed','固定采购价','固定采购价'],['u9material','U9料品主档','物料主档'],['u9byproduct','U9BOM副产品','BOM母项'],
  ['cmsWorkshop','CMS车间料工费','车间料工费'],['cmsSubject','CMS科目成本','科目成本'],['cmsSetting','CMS科目设置','科目设置'],['cmsScrap','CMS废料映射','废料映射'],
]) {
  workbookDefinitions[kind] = { title, sheet, columns: sourceColumns[kind].map(column => ({ ...column,
    type: /^(fixedPrice|blankWeight|netWeight|.*Price|.*Fee|changeAmount|changeRate|outputQty|workingHours|workingCostCent|funding|materialPrice)$/.test(column.field) ? 'number' : 'text',
  })), notes: ['保留原表头及列顺序；填写内容仍按该入口现有规则校验。'] }
  if (kind.startsWith('cms')) workbookDefinitions[kind].leadingRows = [
    sourceColumns[kind].map(column => column.sourceField), sourceColumns[kind].map(column => column.label),
  ]
}
workbookDefinitions.fixed.notes.push('id、物料代码、物料名称、现不含税价格为必需列；请填写实际来源身份和执行日期。')
workbookDefinitions.u9byproduct.notes.push('两个“母件料品.生产部门”列分别填写部门编码、名称。报价组织按原规则填写，不能跨组织混用。')
workbookDefinitions.cmsWorkshop.notes.push('工资workingCost和材料计价materialPrice单位为分；系统沿原规则转换为元。期间、父件编码和CMS原始id必填。')
workbookDefinitions.cmsSubject.notes.push('材料计价materialPrice单位为分。期间、父件编码、一级／二级科目及CMS原始id必填。')
workbookDefinitions.cmsPlan = define('CMS计划成本', '计划成本', [
  ['firstUnitCode','一级编码'],['firstUnitName','一级编码名称'],['parentCode','父件编码'],['parentName','父件名称'],['parentSpec','父件规格'],
  ['parentType','父件型号'],['unit','单位'],['workingHours','工时','number'],['effectiveDate','生效时间'],['mainMaterialCost','主材成本','number'],
  ['auxMaterialCost','辅材成本','number'],['salaryCost','工资成本','number'],['fundCost','经费成本','number'],['lossCost','损失成本','number'],
  ['totalPlanCost','计划价(总)','number'],['businessStatus','业务状态'],['unapprovedItems','未审批项'],['description','制定说明'],['oaNo','OA单号'],
])
workbookDefinitions.three = define('三项费用率', '三项费用', [
  ['periodYear','年份/期间'],['productCategory','产品口径'],['productLine','产线'],['company','公司'],['businessUnit','生产事业部'],
  ['applicantDepartment','申请部门'],['applicantOffice','申请处室'],['managementExpenseRate','管理费用','percent'],
  ['financeExpenseRate','财务费用','percent'],['salesExpenseRate','营业费用','percent'],['threeExpenseTotalRate','三项费用合计','percent'],
  ['oemExpenseRate','OEM费用率','percent'],['overseasSales','是否通过海外销'],
], ['填写年份，并在实际对应的配置区域填写；比例使用百分比，合计须等于管理＋财务＋营业费用。'])
workbookDefinitions.three.customizeTemplate = (book, XLSX) => {
  const labels = workbookDefinitions.three.columns.filter(column => !['periodYear','productCategory','productLine'].includes(column.field)).map(column => column.label)
  const rows = [['年份',''],[]]
  for (const title of ['商用直销产品-国内产线','商用直销产品-墨西哥产线','商用直销产品-越南事业部','家代商代销产品-国内产线','家代商代销产品-墨西哥产线','家代商代销产品-越南事业部']) {
    rows.push([title], labels, labels.map(() => ''), [])
  }
  book.Sheets['三项费用'] = XLSX.utils.aoa_to_sheet(rows)
  book.Sheets['三项费用']['!cols'] = labels.map(() => ({ wch: 23 }))
}
workbookDefinitions.partCosts = define('成品零件成本配置', '成品零件成本配置', [
  ['productCode','成品料号'],['productName','成品品名'],['productModel','成品型号'],['productSpec','成品规格'],
  ['partCode','零件料号'],['partName','零件品名'],['partModel','零件型号'],['shape','零件形态属性'],['manufactureRate','零件制造费用率','percent'],
])

// Template columns follow the upload contract; exports also retain the saved/current price basis.
workbookDefinitions.settlement.templateColumns = workbookDefinitions.settlement.columns.map(column =>
  column.field === 'rule.formulaExpr' ? { ...column, field: 'rule.sourceFormula' } : column)
workbookDefinitions.settlement.columns = [...workbookDefinitions.settlement.templateColumns,
  ...columns([['unitPrice','当前单价（元）','number'],['mode','取价方式'],['rule.materialUnit','物料单位'],
    ['effectivePrice.priceMonth','结果月份'],['effectivePrice.revisionNo','结果版本'],['rule.priceMonth','原稿月份'],['rule.revisionNo','原稿版本'],
    ['rule.budgetCu','预算铜价','number'],['rule.budgetZn','预算锌价','number'],['rule.referenceCu','原稿参考铜价','number'],['rule.referenceZn','原稿参考锌价','number'],
    ['base.priceMonth','商用基价月份'],['failureCode','失败代码'],['message','说明']])]
workbookDefinitions.household.columns = workbookDefinitions.household.columns.map(column =>
  column.field === '_unit' ? { ...column, field: 'priceContext.unit' } : column)
workbookDefinitions.household.templateColumns = workbookDefinitions.household.columns
workbookDefinitions.household.columns = [...workbookDefinitions.household.columns, ...columns([
  ['sourceMonth','来源年月'],['revisionNo','来源版本'],['priceContext.currency','币种'],['priceContext.taxBasis','税口径'],
])]
workbookDefinitions.scrap.columns = workbookDefinitions.scrap.columns.map(column =>
  column.field === 'price' ? { ...column, field: 'fixedPrice' } : column.field === 'formulaExpression' ? { ...column, field: 'sourceFormula' } : column.field === 'unit' ? { ...column, field: () => '公斤' } : column)
workbookDefinitions.scrap.templateColumns = [...workbookDefinitions.scrap.columns, c('specification','回收料规格')]
workbookDefinitions.scrap.columns = [...workbookDefinitions.scrap.templateColumns,
  ...columns([['unitPrice','当前不含税单价','number'],['expression','计算表达式'],['calcStatus','取价状态'],['priceMonth','月份']])]
workbookDefinitions.scrap.leadingRows = [['1#电解铜价',''],['美国柜装黄铜',''],['长江现货A00','']]
workbookDefinitions.scrap.notes.push('联动时在B1/B2/B3填原稿铜、黄铜、铝参考价（元/公斤），公式按实际业务填写并绝对引用，例如=$B$1*0.8/1.13。固定价不需要填写这些因素。')

workbookDefinitions.quantityRange = define('数量区间价','数量区间',[
  ['orgCode','组织'],['materialCode','物料代码'],['materialName','物料名称'],['supplierCode','供应商代码'],['supplierName','供应商名称'],['specModel','规格型号'],['unit','单位'],
  ['rangeLow','区间下限','number'],['rangeHigh','区间上限','number'],['priceExclTax','不含税价','number'],['priceInclTax','含税价','number'],['taxIncluded','是否含税','boolean'],
  ['effectiveFrom','生效日期'],['effectiveTo','失效日期'],['blankWeight','下料重','number'],['netWeight','净重','number'],['processFee','加工费','number'],['agentFee','代理费','number'],
  ['sourceName','来源'],['purchaseClass','采购分类'],['orderType','订单类型'],['quota','配额','number'],
],['区间上下限表示采购数量，不填写原材料行情。每个档位填写一行，日期使用YYYY-MM-DD。'])
workbookDefinitions.range = {
  title: '区间价格', sheet: 'ImportData',
  templateColumns: columns([['orgCode','组织'],['materialCode','物料代码'],['supplierName','供应商名称'],['supplierCode','供应商代码'],['specModel','规格型号'],['unit','单位'],['priceExclTax','单价','number'],['taxIncluded','是否含税','boolean']]),
  columns: [...workbookDefinitions.quantityRange.columns, ...columns([['rangeBasis','区间依据'],['factorCode','行情因素'],['factorUnit','行情单位'],['formulaExpr','公式'],['currentFlag','当前标记']])],
  notes: ['行情区间请同时填写ImportData物料主表和“铜价区间表”，保留同一料号、规格和供应商名称。',
    '矩阵表头90000-94999和95000-99999为铜价档位示范（元/吨），请按实际报价改写并向右添加成对列。每档填写未税及含13%税价格。数量区间请使用页面的“数量区间模板”。'],
  customizeTemplate(book, XLSX) {
    const sheet = XLSX.utils.aoa_to_sheet([['铜价区间表'],['U9代码','图号','供应商名称','90000-94999','','95000-99999',''],['','','','不含税元/米','含13%税价','不含税元/米','含13%税价'],['','','','','','','']])
    sheet['!cols'] = Array.from({length:7}, () => ({wch:24}))
    XLSX.utils.book_append_sheet(book,sheet,'铜价区间表')
  },
}
for (const [kind,title,entries] of [
  ['financeCommercial','商用财务基价',[['factorName','基价名称'],['shortName','基价代号'],['unit','计量单位'],['average','上月均价','number'],['price','联动基价调整','number']]],
  ['financePlate','板换财务基价',[['factorName','价表影响因素名称'],['shortName','简称'],['source','取价来源'],['unit','单位'],['average','上月均价','number'],['nonTender','非招标基价','number'],['tender','招标基价','number']]],
]) {
  workbookDefinitions[kind] = define(title,title,entries,['填写实际含税基价，单位元/公斤或元/吨。商用必须保留Cu行，Cu值决定方案；可增加“联动基价调整”方案列。板换须同时填写招标与非招标价格。导入月份在页面选择。'])
  workbookDefinitions[kind].customizeTemplate = book => {
    const sheet=book.Sheets[title]
    sheet.A2={t:'s',v:'1#电解铜'};sheet.B2={t:'s',v:'Cu'}
    sheet.C2={t:'s',v:kind==='financePlate'?'平均价':'元/公斤'}
    if(kind==='financePlate')sheet.D2={t:'s',v:'元/公斤'}
  }
}

// Raw exports include fields that the corresponding stored records actually retain.
workbookDefinitions.cmsWorkshop.templateColumns = workbookDefinitions.cmsWorkshop.columns
workbookDefinitions.cmsWorkshop.columns = workbookDefinitions.cmsWorkshop.columns.filter(column => ["id", "importBatchId", "rowNo", "period", "firstUnitCode", "firstUnitName", "parentCode", "parentName", "parentSpec", "parentType", "lastUnitName", "lastUnitCode", "workingHours", "funding", "workingCostCent", "workingCostYuan", "buildFlag", "path", "sourceRowId", "sequenceNo", "sequenceStatus", "materialPrice", "firstSubjectCode", "firstSubjectName", "secondSubjectCode", "secondSubjectName", "thirdSubjectCode", "thirdSubjectName", "businessUnitType", "createdAt"].includes(column.field))
workbookDefinitions.cmsSubject.templateColumns = workbookDefinitions.cmsSubject.columns
workbookDefinitions.cmsSubject.columns = workbookDefinitions.cmsSubject.columns.filter(column => ["id", "importBatchId", "rowNo", "period", "firstUnitCode", "firstUnitName", "parentCode", "parentName", "parentSpec", "parentType", "lastSubjectCode", "lastSubjectName", "lastSubjectLevel", "materialPrice", "materialPriceYuan", "buildFlag", "path", "firstSubjectCode", "firstSubjectName", "secondSubjectCode", "secondSubjectName", "thirdSubjectCode", "thirdSubjectName", "sourceRowId", "sequenceNo", "sequenceStatus", "businessUnitType", "createdAt"].includes(column.field))
workbookDefinitions.cmsScrap.templateColumns = workbookDefinitions.cmsScrap.columns
workbookDefinitions.cmsScrap.columns = workbookDefinitions.cmsScrap.columns.map(column => ({ ...column, field: ({ sourceRowId: 'cmsRecordId', effectiveDate: 'cmsEffectiveDate', postingPeriod: 'cmsPostingPeriod' })[column.field] || column.field }))
workbookDefinitions.cmsScrap.columns = workbookDefinitions.cmsScrap.columns.filter(column => ["id", "materialCode", "materialName", "materialSpec", "materialUnit", "scrapCode", "scrapName", "scrapSpec", "scrapUnit", "ratio", "effectiveFrom", "effectiveTo", "businessUnitType", "sourceType", "sourceDocNo", "cmsRecordId", "linkDetailId", "cmsPostingPeriod", "cmsEffectiveDate", "approvalTime", "syncTime", "remark", "createdAt", "updatedAt"].includes(column.field))
workbookDefinitions.u9material.columns = workbookDefinitions.u9material.columns.map(column => ({ ...column, field: column.field.replace(/_(?=\d)/g, '') }))
workbookDefinitions.plate.notes.push('产品应用材质只允许：水氟SUS304、水氟316L、氟氟SUS304、氟氟316L、水水SUS304、水水316L。')

workbookDefinitions.linked.templateColumns = workbookDefinitions.linked.columns
workbookDefinitions.linked.columns = workbookDefinitions.linked.columns.filter(column => column.field !== 'scrapWeight').map(column =>
  column.field === 'priceOrgCode' ? { ...column, field: 'orgCode' } : column)
for (const kind of ['linked','range']) workbookDefinitions[kind].columns.push(...columns([
  ['exportPrice','当前不含税单价','number'],['exportStatus','取价状态'],['exportFinanceMonth','财务基价月份'],['exportMessage','取价说明'],
]))
workbookDefinitions.linked.columns.push(...columns([
  ['pricingMonth','价格月份'],['ruleRevision','原稿版本'],['sourceFormulaExpr','原稿Excel公式'],['sourceName','来源'],['effectiveFrom','生效日期'],['effectiveTo','失效日期'],
]))
// The household list exposes price/rate/context; weights remain in the separately authorized original file.
workbookDefinitions.household.columns = workbookDefinitions.household.columns.filter(column => !['copperWeight','zincWeight'].includes(column.field))

for (const [kind, entries] of [
  ['property',[['upliftRate','上浮比例','percent'],['coefficient','系数','number']]],
  ['manufacture',[['rateYear','年度'],['businessUnitType','业务单元']]],
  ['department',[['rateYear','年度'],['rateCalculationMode','费率口径']]],
  ['quality',[['rateYear','年度']]],
]) {
  const definition=workbookDefinitions[kind]
  definition.templateColumns ||= definition.columns
  definition.columns=[...definition.columns,...columns(entries)]
}
