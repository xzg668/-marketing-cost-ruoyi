import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { comparisonDisplayRows, comparisonCell, comparisonDifferenceCell } from '../src/utils/monthlyCostComparison.js'
const object={businessUnitType:'COMMERCIAL',oaNo:'OA1',oaFormItemId:1}
const parent={code:'000A',name:'父件A'}
const amount='123456789012345.123456'
const product={object,parent,baseline:{amounts:{MATERIAL:'30',DIRECT_LABOR:'5',MANUFACTURE_COST:'40'}},comparison:{amounts:{MATERIAL:'32',DIRECT_LABOR:'6',MANUFACTURE_COST:'43'}},differences:{DIRECT_LABOR:{amount:'1.000000',rate:'20.00%'}}}
const part=(code,before,after,difference)=>({key:{object,materialCode:code,pricingPaths:['A/'+code]},parent,baseline:before==null?null:{name:code,amounts:{MATERIAL:before}},comparison:after==null?null:{name:code,amounts:{MATERIAL:after}},differences:{MATERIAL:{amount:difference,rate:difference==='-'?'-':'20.00%'}}})
describe('MRP-08 父件与部品成本对比',()=>{
 it('父件费用只在汇总行出现，选择材料差异可逐项看到B/C',()=>{
  const rows=comparisonDisplayRows({products:[product],rows:[part('B','10','12','2.000000'),part('C','20','20','0.000000')]})
  assert.equal(rows.length,3)
  assert.equal(rows[0].kind,'PRODUCT');assert.equal(rows[0].groupRows,3)
  assert.equal(comparisonCell(rows[0],'baseline','DIRECT_LABOR'),'5')
  assert.equal(comparisonCell(rows[1],'baseline','DIRECT_LABOR'),'')
  assert.equal(comparisonDifferenceCell(rows[1],'MATERIAL','amount'),'2.000000')
  assert.equal(comparisonDifferenceCell(rows[2],'MATERIAL','amount'),'0.000000')
 })
 it('新增部品保留缺失侧空白和差异横线',()=>{
  const rows=comparisonDisplayRows({products:[product],rows:[part('000D',null,'2','-')]})
  assert.equal(rows[1].childCode,'000D');assert.equal(comparisonCell(rows[1],'baseline','MATERIAL'),'')
  assert.equal(comparisonDifferenceCell(rows[1],'MATERIAL','rate'),'-')
 })
 it('金额原样展示，不经过浮点数转换',()=>{
  const rows=comparisonDisplayRows({products:[product],rows:[part('B',amount,amount,'0.000000')]})
  assert.equal(comparisonCell(rows[1],'baseline','MATERIAL'),amount)
 })
 it('同一料号在不同OA分别归属',()=>{
  const other={...object,oaNo:'OA2',oaFormItemId:2},p2={...product,object:other}
  const a=part('B','10','12','2'),b={...a,key:{...a.key,object:other}}
  const rows=comparisonDisplayRows({products:[product,p2],rows:[a,b]})
  assert.equal(rows.length,4);assert.equal(rows[0].groupRows,2);assert.equal(rows[2].groupRows,2)
 })
})
