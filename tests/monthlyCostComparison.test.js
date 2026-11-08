import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { comparisonDisplayRows, comparisonCell, comparisonDifferenceCell, comparisonChangeLabels } from '../src/utils/monthlyCostComparison.js'
const object={businessUnitType:'COMMERCIAL',oaNo:'OA1',oaFormItemId:1}
const parent={code:'000A',name:'父件A'}
const amount='123456789012345.123456'
const expandedRows = comparison => comparisonDisplayRows(comparison, new Set(comparison.products.map(product => product.objectKey)))
const product={objectKey:'CUSTOMER-A',object,parent,baseline:{amounts:{MATERIAL:'30',DIRECT_LABOR:'5',MANUFACTURE_COST:'40'}},comparison:{amounts:{MATERIAL:'32',DIRECT_LABOR:'6',MANUFACTURE_COST:'43'}},differences:{DIRECT_LABOR:{amount:'1.000000',rate:'20.00%'}}}
const part=(code,before,after,difference)=>({objectKey:'CUSTOMER-A',key:{object,materialCode:code,pricingPaths:['A/'+code]},parent,baseline:before==null?null:{name:code,amounts:{MATERIAL:before}},comparison:after==null?null:{name:code,amounts:{MATERIAL:after}},differences:{MATERIAL:{amount:difference,rate:difference==='-'?'-':'20.00%'}}})
describe('MRP-08 父件与部品成本对比',()=>{
 it('大页默认保留全部产品汇总及部品数量，金额不因收起而消失',()=>{
  const products=Array.from({length:20},(_,i)=>({...product,objectKey:`CUSTOMER-${i}`}))
  const parts=products.flatMap(p=>Array.from({length:100},(_,i)=>({...part(`P-${i}`,amount,amount,'0.000000'),objectKey:p.objectKey})))
  const report={products,rows:parts}
  const rows=comparisonDisplayRows(report)
  assert.equal(rows.length,20)
  assert.deepEqual(rows.map(row=>row.objectKey),products.map(p=>p.objectKey))
  assert.ok(rows.every(row=>row.kind==='PRODUCT' && row.partCount===100 && row.groupRows===1))
  assert.equal(comparisonCell(rows[0],'baseline','MANUFACTURE_COST'),'40')
  assert.equal(report.rows.length,2000)
  assert.equal(report.rows[1999].baseline.amounts.MATERIAL,amount)
 })
 it('只展开选中客户的完整部品，收起与再次展开保留原值及归属',()=>{
  const other={...product,objectKey:'CUSTOMER-B',identity:{customerValue:'B'}}
  const report={products:[product,other],rows:[part('X',amount,null,'-'),{...part('Y','20','22','2'),objectKey:'CUSTOMER-B'}]}
  const rows=comparisonDisplayRows(report,new Set(['CUSTOMER-B']))
  assert.deepEqual(rows.map(row=>[row.kind,row.objectKey]),[['PRODUCT','CUSTOMER-A'],['PRODUCT','CUSTOMER-B'],['COMPONENT','CUSTOMER-B']])
  assert.equal(rows[0].groupRows,1);assert.equal(rows[1].groupRows,2)
  assert.equal(comparisonCell(rows[2],'comparison','MATERIAL'),'22')
  assert.equal(comparisonDisplayRows(report).length,2)
  const reopened=comparisonDisplayRows(report,new Set(['CUSTOMER-A']))
  assert.equal(comparisonCell(reopened[1],'baseline','MATERIAL'),amount)
  assert.equal(comparisonCell(reopened[1],'comparison','MATERIAL'),'')
 })
 it('父件费用只在汇总行出现，选择材料差异可逐项看到B/C',()=>{
  const rows=expandedRows({products:[product],rows:[part('B','10','12','2.000000'),part('C','20','20','0.000000')]})
  assert.equal(rows.length,3)
  assert.equal(rows[0].kind,'PRODUCT');assert.equal(rows[0].groupRows,3)
  assert.equal(comparisonCell(rows[0],'baseline','DIRECT_LABOR'),'5')
  assert.equal(comparisonCell(rows[1],'baseline','DIRECT_LABOR'),'')
  assert.equal(comparisonDifferenceCell(rows[1],'MATERIAL','amount'),'2.000000')
  assert.equal(comparisonDifferenceCell(rows[2],'MATERIAL','amount'),'0.000000')
 })
 it('新增部品保留缺失侧空白和差异横线',()=>{
  const rows=expandedRows({products:[product],rows:[part('000D',null,'2','-')]})
  assert.equal(rows[1].childCode,'000D');assert.equal(comparisonCell(rows[1],'baseline','MATERIAL'),'')
  assert.equal(comparisonDifferenceCell(rows[1],'MATERIAL','rate'),'-')
 })
 it('金额原样展示，不经过浮点数转换',()=>{
  const rows=expandedRows({products:[product],rows:[part('B',amount,amount,'0.000000')]})
  assert.equal(comparisonCell(rows[1],'baseline','MATERIAL'),amount)
 })
 it('同一料号在不同客户分别归属',()=>{
  const other={...object,oaNo:'OA2',oaFormItemId:2},p2={...product,objectKey:'CUSTOMER-B',object:other}
  const a=part('B','10','12','2'),b={...a,objectKey:'CUSTOMER-B',key:{...a.key,object:other}}
  const rows=expandedRows({products:[product,p2],rows:[a,b]})
  assert.equal(rows.length,4);assert.equal(rows[0].groupRows,2);assert.equal(rows[2].groupRows,2)
 })
 it('同客户采用不同OA时部品仍在同一产品下且原始归属保持',()=>{
  const other={...object,oaNo:'OA2',oaFormItemId:2},a=part('B','10',null,'-')
  const rows=expandedRows({products:[{...product,object:other}],rows:[a]})
  assert.equal(rows.length,2);assert.equal(rows[0].groupRows,2)
  assert.equal(rows[1].object.oaNo,'OA1');assert.equal(rows[0].object.oaNo,'OA2')
 })
 it('两月未核算仍显示客户产品且不补零',()=>{
  const rows=expandedRows({products:[{...product,baseline:null,comparison:null}],rows:[]})
  assert.equal(rows.length,1);assert.equal(comparisonCell(rows[0],'comparison','MATERIAL'),'')
 })
 it('旧部品缺少路径时每条保存金额都保留并明确待匹配',()=>{
  const historical={...part('X','10',null,'-'),change:'PATH_UNMATCHED',key:{object,materialCode:'X',pricingPaths:[],unmatchedKey:'LEGACY:1:2'}}
  const another={...historical,key:{...historical.key,unmatchedKey:'LEGACY:1:3'},baseline:{name:'X',amounts:{MATERIAL:'20'}}}
  const current={...part('X',null,'31','-'),change:'PATH_UNMATCHED'}
  const rows=expandedRows({products:[product],rows:[historical,another,current]})
  assert.equal(rows.length,4)
  assert.equal(comparisonCell(rows[1],'baseline','MATERIAL'),'10')
  assert.equal(comparisonCell(rows[2],'baseline','MATERIAL'),'20')
  assert.equal(comparisonCell(rows[3],'comparison','MATERIAL'),'31')
  assert.equal(comparisonChangeLabels[rows[1].change],'历史部品待匹配')
  assert.equal(comparisonDifferenceCell(rows[1],'MATERIAL','amount'),'-')
 })
})
