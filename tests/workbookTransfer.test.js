import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { collectExportRows, createWorkbook, excelCell } from '../src/utils/workbookTransfer.js'
import { workbookDefinitions as definitions } from '../src/utils/workbookCatalog.js'
import { parseManufactureRateRows } from '../src/pages/manufactureRateImportUtils.js'
import { parseDepartmentFundRateRows } from '../src/pages/departmentFundRateImportUtils.js'
import { parseThreeExpenseRateRows } from '../src/pages/threeExpenseRateImportUtils.js'
import { parseQualityLossRateWorkbook } from '../src/utils/qualityLossRateImportUtils.js'
import { detectQuantityRangeWorkbookRoute } from '../src/pages/priceRangeImportUtils.js'
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
test('all blank templates have help and no fabricated material or supplier identity',()=>{
 for(const definition of Object.values(definitions)){
  const book=roundtrip(createWorkbook(XLSX,definition,[],true));assert.ok(book.Sheets.填写说明,definition.title)
  const cols=definition.templateColumns||definition.columns,s=book.Sheets[book.SheetNames[0]],r=(definition.leadingRows?.length||0)+1
  cols.forEach((c,index)=>{if(/materialCode|supplierCode|productCode/.test(String(c.field)))assert.ok(!s[XLSX.utils.encode_cell({r,c:index})]?.v,definition.title)})
 }
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
test('quantity workbook stays on the quantity route and does not trigger commodity detection',()=>{
 const b=fill('quantityRange',{materialCode:'001',rangeLow:0,rangeHigh:100,priceExclTax:2})
 const route=detectQuantityRangeWorkbookRoute(b.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(b.Sheets[name],{header:1,raw:false,defval:''})})))
 assert.equal(route.ok,true);assert.equal(route.standardSheet.name,'数量区间')
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
