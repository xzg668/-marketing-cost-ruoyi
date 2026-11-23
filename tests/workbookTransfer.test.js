import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { collectExportRows, createWorkbook, excelCell } from '../src/utils/workbookTransfer.js'
import { workbookDefinitions as definitions } from '../src/utils/workbookCatalog.js'
import { parseManufactureRateRows } from '../src/pages/manufactureRateImportUtils.js'
import { parseDepartmentFundRateRows } from '../src/pages/departmentFundRateImportUtils.js'
import { parseThreeExpenseRateRows } from '../src/pages/threeExpenseRateImportUtils.js'
import { parseQualityLossRateWorkbook } from '../src/utils/qualityLossRateImportUtils.js'
const roundtrip = book => XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'})
const fill = (kind, values, extras={}) => {
 const definition=definitions[kind], book=createWorkbook(XLSX,definition,[],true), sheet=book.Sheets[book.SheetNames[0]]
 const columns=definition.templateColumns||definition.columns, row=(definition.leadingRows?.length||0)+1
 columns.forEach((column,index)=>{if(column.field in values) sheet[XLSX.utils.encode_cell({r:row,c:index})]=excelCell(values[column.field],column)})
 Object.entries(extras).forEach(([address,value])=>sheet[address]=excelCell(value,{type:typeof value==='number'?'number':'text'}))
 return roundtrip(book)
}
const rows=book=>XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false})

test('exports every filtered page with a fixed query, including server page-size caps',async()=>{
 const query={orgCode:'210',priceMonth:'2026-11',materialCode:'001'},calls=[]
 const result=await collectExportRows(async params=>{calls.push(params);query.materialCode='changed';const start=(params.current-1)*2;return{records:[0,1,2,3,4].slice(start,start+2),total:5}},query,{pageKey:'current',sizeKey:'size'})
 assert.deepEqual(result,[0,1,2,3,4]);assert.equal(calls.length,3);assert.ok(calls.every(c=>c.materialCode==='001'&&c.orgCode==='210'&&c.size===200))
})
test('empty and unpaged full arrays export successfully',async()=>{
 assert.deepEqual(await collectExportRows(async()=>({list:[],total:0})),[])
 assert.deepEqual(await collectExportRows(async()=>[{id:'001'}]),[{id:'001'}])
})
test('does not return partial rows on failure, changed count, repeated page or switched scope',async()=>{
 for(const fetch of [async({page})=>{if(page===2)throw Error('network');return{list:[1],total:2}},async({page})=>({list:[page],total:page===1?2:3}),async()=>({list:[1],total:2}),async()=>({list:[],total:1})])await assert.rejects(collectExportRows(fetch))
 let current=true;await assert.rejects(collectExportRows(async()=>{current=false;return{list:[1],total:1}},{},{isCurrent:()=>current}),/范围/)
})
test('Excel preserves zero, percentages, identifiers, formula-like text and long decimals',()=>{
 const definition={title:'test',columns:[{field:'code',label:'料号'},{field:'price',label:'价格',type:'number'},{field:'ratio',label:'比例',type:'percent'}]}
 const book=roundtrip(createWorkbook(XLSX,definition,[{code:'001234',price:'8.0821238905309735',ratio:0},{code:'=1+2',price:0,ratio:0.2}]))
 const s=book.Sheets.数据;assert.equal(s.A2.v,'001234');assert.equal(s.B2.v,'8.0821238905309735');assert.equal(s.C2.v,0);assert.equal(s.A3.v,'=1+2');assert.equal(s.A3.f,undefined);assert.equal(s.B3.v,0);assert.equal(s.C3.v,.2)
})
test('fill-in templates have examples and keep demo identities out of the import sheet',()=>{
 for(const [kind, definition] of Object.entries(definitions)){
  const book=roundtrip(createWorkbook(XLSX,definition,[],true));assert.ok(book.Sheets.填写说明,definition.title)
  const cols=definition.templateColumns||definition.columns,s=book.Sheets[book.SheetNames[0]],r=(definition.leadingRows?.length||0)+1
  cols.forEach((c,index)=>{if(/material.?code|supplier.?code|product.?code|itemcode|parentcode/i.test(String(c.field)))assert.ok(!s[XLSX.utils.encode_cell({r,c:index})]?.v,definition.title)})
  // Linked already has an in-place formula example; part costs download the server template.
  if (kind === 'linked' || kind === 'partCosts') continue
  const sample = book.Sheets.填写示例
  assert.ok(sample, definition.title)
  assert.ok(XLSX.utils.sheet_to_json(sample, { header: 1 }).slice(3).filter(row => row[1] !== '' && row[1] != null).length >= 3, definition.title)
  const exported = roundtrip(createWorkbook(XLSX, definition, []))
  assert.ok(!exported.Sheets.填写示例, definition.title)
 }
})
test('settlement and scrap templates retain editable native formulas, numeric inputs, and fixed-price examples', () => {
 const settlement = roundtrip(createWorkbook(XLSX, definitions.settlement, [], true))
 const sheet = settlement.Sheets.结算价格
 assert.deepEqual([sheet.B2.v, sheet.C2.v, sheet.B3.v, sheet.C3.v], [90, 95, 20, 22])
 assert.deepEqual([sheet.A5.v, sheet.K5.v], ['', '结算联动价'])
 assert.deepEqual([sheet.D5.v, sheet.E5.v, sheet.G5.v, sheet.H5.v], [10, 1.05, 20, 5])
 assert.equal(sheet.F5.f, 'D5*E5')
 assert.equal(sheet.I5.f, 'L5')
 assert.equal(sheet.L5.f, 'ROUND(F5+(($C$2-$B$2)*G5+($C$3-$B$3)*H5)/1000/1.13*1.05,4)')
 assert.equal(sheet.I5.v, 10.6022)
 assert.equal(settlement.Sheets.填写示例.C3.v, '固定结算价')

 const scrap = roundtrip(createWorkbook(XLSX, definitions.scrap, [], true))
 const waste = scrap.Sheets.废料清单
 assert.deepEqual([waste.B1.v, waste.B2.v, waste.B3.v], [95, 65, 20])
 assert.deepEqual([waste.A5.v, waste.E5.v, waste.G5.v], ['', '', '联动价'])
 assert.equal(waste.F5.f, '$B$1*0.8/1.13')
 assert.ok(Math.abs(waste.F5.v - 76 / 1.13) < 1e-9)
 assert.equal(scrap.Sheets.填写示例.C3.v, '固定价')
})
test('sample identities and percentages use their normal Excel types', () => {
 const sheet = roundtrip(createWorkbook(XLSX, definitions.supplier, [], true)).Sheets.填写示例
 assert.equal(sheet.B4.t, 's')
 assert.equal(sheet.B4.v, '00001234')
 assert.equal(sheet.B12.t, 'n')
 assert.equal(sheet.B12.w, '60%')
 assert.equal(sheet.C12.w, '40%')
})
test('linked-price template uses the native purchase workbook with an editable Excel formula', () => {
 const book = roundtrip(createWorkbook(XLSX,definitions.linked,[],true))
 assert.deepEqual(book.SheetNames,['ImportData','影响因素10','填写说明'])
 assert.deepEqual(rows(book)[0],['组织','来源','供应商名称','供应商代码','采购分类','物料名称','物料代码','规格型号','单位','联动公式','下料重','净重','加工费','代理费','单价','是否含税','生效日期','失效日期','订单类型'])
 const sheet = book.Sheets.ImportData, factors = book.Sheets.影响因素10
 assert.equal(sheet.G2.v,'')
 assert.equal(sheet.D2.v,'')
 assert.equal(sheet.O2.t,'n')
 assert.equal(sheet.O2.f,"((K2*'影响因素10'!$E$2-(K2-L2)*'影响因素10'!$E$3)/1000+M2+N2)/1.13")
 assert.ok(Math.abs(sheet.O2.v - 10.8 / 1.13) < 1e-10)
 assert.equal(sheet.P2.v,'否')
 assert.equal(sheet.N2.v,0)
 assert.equal(factors.E2.v,100)
 assert.equal(factors.E3.v,60)
 const exported = roundtrip(createWorkbook(XLSX,definitions.linked,[{materialCode:'001234',sourceFormulaExpr:sheet.O2.f}]))
 assert.deepEqual(exported.SheetNames,['ImportData','填写说明'])
 assert.equal(exported.Sheets.ImportData.B2.v,'001234')
 const expressionColumn = rows(exported)[0].indexOf('原稿Excel公式')
 const expression = exported.Sheets.ImportData[XLSX.utils.encode_cell({r:1,c:expressionColumn})]
 assert.equal(expression.v,sheet.O2.f)
 assert.equal(expression.f,undefined)
})
test('product property workbook includes each row year and annual usage in ten thousands', () => {
 const data = [
  {productCode:'000101',productName:'产品',productAttr:'非标品',propertyYear:2026,estimatedAnnualUsageWan:10},
  {productCode:'000102',productName:'产品',productAttr:'非标品',propertyYear:2026,estimatedAnnualUsageWan:0},
 ]
 const book = roundtrip(createWorkbook(XLSX,definitions.property,data))
 const sheet = book.Sheets.产品属性
 const headers = ['料号','品名','规格','型号','产品属性','生产事业部','年度','预计年用量（万只）']
 assert.deepEqual(rows(book)[0],[...headers,'上浮比例','系数'])
 assert.equal(sheet.A2.v,'000101');assert.equal(sheet.G2.v,2026)
 assert.equal(sheet.H2.v,10);assert.equal(sheet.H3.v,0)
 assert.deepEqual(rows(roundtrip(createWorkbook(XLSX,definitions.property,[],true)))[0],headers)
})
test('manufacture and department filled templates use the current import parsers',()=>{
 const m=parseManufactureRateRows(rows(fill('manufacture',{businessDivision:'商用',productCode:'001',feeRate:.1})),{rateYear:2026})
 assert.equal(m.error,null);assert.equal(m.rows[0].feeRate,.1);assert.equal(m.rows[0].productCode,'001')
 const d=parseDepartmentFundRateRows(rows(fill('department',{businessDivision:'商用',expenseSubject:'间接工资',planRate:2,upliftRatio:1.05,quoteRatio:2.1})))
 assert.deepEqual(d.errors,[]);assert.equal(d.rows[0].quoteRatio,2.1)
})
test('quality template preserves both specification columns and percentage units',()=>{
 const parsed=parseQualityLossRateWorkbook(fill('quality',{bareProductCode:'001',productName:'测试',materialSpec:'实物规格',categorySpec:'分类规格',lossRate:.00475}),XLSX)
 assert.equal(parsed.rows[0].bareProductCode,'001');assert.equal(parsed.rows[0].lossRate,.00475)
})
test('three-expense sections retain category and line identity',()=>{
 const b=createWorkbook(XLSX,definitions.three,[],true),s=b.Sheets.三项费用
 s.B1={t:'n',v:2026};['三花','商用','销售部','营销处',.01,.02,.03,.06,.05,'否'].forEach((v,c)=>s[XLSX.utils.encode_cell({r:4,c})]=excelCell(v,{type:c>=4&&c<=8?'percent':'text'}))
 const p=parseThreeExpenseRateRows(rows(roundtrip(b)));assert.deepEqual(p.errors,[]);assert.equal(p.rows[0].productCategory,'商用直销产品');assert.equal(p.rows[0].productLine,'国内产线');assert.equal(p.rows[0].threeExpenseTotalRate,.06)
})
test('price export includes current saved price per page, retaining source and duplicate range bands',async()=>{
 const {priceExportPage}=await import('../src/utils/priceWorkbookExport.js')
 const calls=[]
 const result=await priceExportPage({effectiveFrom:'2026-11'}, {
  kind:'range',fetchPage:async()=>({total:3,list:[{id:1,rangeBasis:'FACTOR',sourceCellRef:'D4',factorRuleId:10,priceExclTax:1},{id:2,rangeBasis:'FACTOR',sourceCellRef:'F4',factorRuleId:10,priceExclTax:2},{id:3,rangeBasis:'QTY',priceExclTax:0}]}),
  fetchEffective:async(ids,month)=>{calls.push({ids,month});return[{originalId:10,unitPrice:'3.123456789012345678',status:'READY',financeMonth:'2026-10'}]},
 })
 assert.deepEqual(calls,[{ids:[10],month:'2026-11'}]);assert.equal(result.rows.length,3);assert.equal(result.rows[0].priceExclTax,1);assert.equal(result.rows[0].exportPrice,'3.123456789012345678');assert.equal(result.rows[2].exportPrice,0)
})
test('missing or failed saved effective prices stop data export',async()=>{
 const {priceExportPage}=await import('../src/utils/priceWorkbookExport.js')
 await assert.rejects(priceExportPage({pricingMonth:'2026-11'},{kind:'linked',fetchPage:async()=>[{id:1,expressionVersion:'ORIGINAL_V1'}],fetchEffective:async()=>[]}),/未能读取/)
})
