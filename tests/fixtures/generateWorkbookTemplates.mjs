// Generate actual UI downloads for the backend parser contract tests. No application or DB writes.
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { createWorkbook, excelCell } from '../../src/utils/workbookTransfer.js'
import { workbookDefinitions as definitions } from '../../src/utils/workbookCatalog.js'
const target=process.argv[2]
if(!target)throw Error('Provide an output directory')
fs.mkdirSync(target,{recursive:true})
const cases={
 settlement:{'rule.materialCode':'001234','rule.materialName':'测试阀','rule.specModel':'TEST-001','rule.plannedPrice':10,'rule.copperWeightG':20,'rule.zincWeightG':5,'rule.priceType':'结算联动价'},
 linked:{priceOrgCode:'210',materialCode:'001234',materialName:'测试阀',supplierCode:'S001',supplierName:'测试供应商',specModel:'SPEC',unit:'公斤',taxIncluded:false,blankWeight:100,scrapWeight:10,processFee:2},
 range:{orgCode:'210',materialCode:'001234',supplierName:'测试供应商',supplierCode:'S001',specModel:'SPEC',unit:'米',priceExclTax:5,taxIncluded:false},
 household:{materialCode:'001234',materialName:'测试阀',specification:'SPEC','priceContext.unit':'只',unitPrice:10,copperWeight:20,zincWeight:5,householdRate:.085},
 invoice:{document_no:'INV001',supplier_code:'S001',supplier_name:'测试供应商',material_code:'001234',material_name:'测试阀',specification:'SPEC',pricing_unit:'只',unit_price:2.25,currency:'CNY'},
 inquiry:{'source.rule.materialCode':'001234','source.rule.materialName':'测试阀','source.rule.specification':'SPEC','source.rule.supplierName':'测试供应商','source.rule.unit':'只','source.rule.priceType':'固定价','source.rule.originalPrice':2.25,price:2.25},
 supplier:{materialCode:'001234',materialName:'测试阀',specification:'SPEC',specModel:'MODEL',unit:'只',supplierName:'测试供应商',supplierCode:'S001',supplyRatio:.25},
 plate:{normalizedModel:'MODEL-001',plateMaterial:'水氟SUS304'},
 scrap:{materialCode:'001234',materialName:'铜屑',fixedPrice:20,priceType:'固定价'},
 cmsPlan:{firstUnitCode:'01',firstUnitName:'测试',parentCode:'001234',parentName:'测试阀',parentSpec:'SPEC',parentType:'MODEL',unit:'只',workingHours:2,effectiveDate:'2026-11-01',mainMaterialCost:1,auxMaterialCost:2,salaryCost:3,fundCost:4,lossCost:0,totalPlanCost:10,businessStatus:'已审批',unapprovedItems:'',description:'测试',oaNo:'TEST'},
 cmsWorkshop:{period:'2026-11',parentCode:'001234',parentName:'测试阀',sourceRowId:'CMS001',workingCostCent:123,materialPrice:500,workingHours:2},
 cmsSubject:{period:'2026-11',parentCode:'001234',parentName:'测试阀',sourceRowId:'CMS002',materialPrice:456,firstSubjectName:'辅助材料',secondSubjectName:'焊接'},
 cmsSetting:{firstSubjectCode:'01',firstSubjectName:'辅助材料',secondSubjectCode:'0101',secondSubjectName:'焊接'},
 cmsScrap:{materialCode:'001234',materialName:'测试铜料',scrapCode:'009876',scrapName:'铜屑',sourceRowId:'CMS003',unit:'公斤',scrapUnit:'公斤'},
 financeCommercial:{factorName:'1#电解铜',shortName:'Cu',unit:'元/公斤',average:90,price:95},
 financePlate:{factorName:'1#电解铜',shortName:'Cu',source:'平均价',unit:'元/公斤',average:90,nonTender:95,tender:94},
}
for(const [kind,definition] of Object.entries(definitions)) {
 const book=createWorkbook(XLSX,definition,[],true)
 XLSX.writeFile(book,path.join(target,kind+'-blank.xlsx'))
 if(!cases[kind])continue
 const columns=definition.templateColumns||definition.columns,s=book.Sheets[book.SheetNames[0]],r=(definition.leadingRows?.length||0)+1
 columns.forEach((c,index)=>{if(c.field in cases[kind])s[XLSX.utils.encode_cell({r,c:index})]=excelCell(cases[kind][c.field],c)})
 if(kind==='settlement')for(const [address,v] of Object.entries({B2:90,C2:95,B3:20,C3:22}))s[address]={t:'n',v}
 if(kind==='linked'){book.Sheets.影响因素10.E2={t:'n',v:95};book.Sheets.影响因素10.E3={t:'n',v:70}}
 if(kind==='range')['001234','SPEC','测试供应商',1,1.13,2,2.26].forEach((v,c)=>book.Sheets.铜价区间表[XLSX.utils.encode_cell({r:3,c})]=excelCell(v,{type:c>2?'number':'text'}))
 XLSX.writeFile(book,path.join(target,kind+'-filled.xlsx'))
}
console.log('Generated blank templates and '+Object.keys(cases).length+' filled fixtures in '+target)
