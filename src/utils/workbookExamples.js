const product = { code: '00001234', name: '示例阀体', spec: 'DN15', model: 'VL-15' }
const supplier = { code: 'S000001', name: '示例供应商' }
const date = '2026-11-01'
const period = '2026-11'

export const settlementExample = {
  budgetCu: 90, referenceCu: 95, budgetZn: 20, referenceZn: 22,
  plannedPrice: 10, markupRatio: 1.05, copperWeightG: 20, zincWeightG: 5,
}
const { budgetCu, referenceCu, budgetZn, referenceZn, plannedPrice, markupRatio, copperWeightG, zincWeightG } = settlementExample
export const settlementBasePrice = plannedPrice * markupRatio
const settlementDelta = ((referenceCu - budgetCu) * copperWeightG + (referenceZn - budgetZn) * zincWeightG) / 1000
export const settlementLinkedPrice = Number((settlementBasePrice + settlementDelta / 1.13 * markupRatio).toFixed(4))

export const scrapExample = { copperPrice: 95, brassPrice: 65, aluminumPrice: 20, copperRatio: 0.8 }
export const scrapLinkedPrice = scrapExample.copperPrice * scrapExample.copperRatio / 1.13

// Demo identities belong in the reference sheet. The import sheets keep those cells available for real IDs.
export const workbookExamples = {
  materials: [{ materialCode: product.code, materialName: product.name, itemSpec: product.spec, itemModel: product.model,
    shapeAttr: '制造件', material: '黄铜', theoreticalWeightG: 80, netWeightKg: 0.08, bizUnit: '商用' }],
  bom: [{ bomCode: 'BOM-EX01', itemCode: '00001235', itemName: '示例阀盖', itemSpec: product.spec,
    itemModel: 'CAP-15', bomLevel: 1, parentCode: product.code, shapeAttr: '采购件', bomQty: 2, material: '黄铜' }],
  manufacture: [{ businessDivision: '商用', productCategory: '阀类', productCode: product.code, productName: product.name,
    productModel: product.model, productSpec: product.spec, feeRate: 0.1 }],
  department: [{ businessDivision: '商用', expenseSubject: '间接工资', budgetAmount: 20000, totalWorkMinutes: 10000,
    planRate: 2, upliftRatio: 1.05, quoteRatio: 2.1 }],
  other: [{ materialCode: product.code, productName: product.name, spec: product.spec, model: product.model,
    customer: '示例客户', expenseType: '包装费', expenseAmount: 0.25 }],
  quality: [{ bareProductCode: product.code, productName: product.name, materialSpec: product.spec, productModel: product.model,
    businessDivision: '商用', productCategory: '阀类', productSubcategory: '阀体', categorySpec: '小口径', lossRate: 0.00475 }],
  property: [{ productCode: product.code, productName: product.name, productSpec: product.spec, productModel: product.model,
    productAttr: '标准品', businessDivision: '商用', propertyYear: 2026, estimatedAnnualUsageWan: 10 }],
  supplier: [
    { title: '供应商一', materialCode: product.code, materialName: product.name, specification: product.spec,
      specModel: product.model, unit: '只', materialShape: '采购件', supplierCode: supplier.code, supplierName: supplier.name + '甲', supplyRatio: 0.6 },
    { title: '供应商二', materialCode: product.code, materialName: product.name, specification: product.spec,
      specModel: product.model, unit: '只', materialShape: '采购件', supplierCode: 'S000002', supplierName: supplier.name + '乙', supplyRatio: 0.4 },
  ],
  plate: [{ _sequence: '1', normalizedModel: product.model, plateMaterial: '水氟SUS304' }],
  invoice: [{ document_no: 'INV-EX001', supplier_code: supplier.code, supplier_name: supplier.name,
    material_code: product.code, material_name: product.name, specification: product.spec, pricing_unit: '只', unit_price: 2.25, currency: 'CNY' }],
  inquiry: [{ 'source.rule.materialCode': product.code, 'source.rule.materialName': product.name,
    'source.rule.specification': product.spec, 'source.rule.supplierName': supplier.name, 'source.rule.unit': '只',
    'source.rule.priceType': '固定价', 'source.rule.originalPrice': 2.25, price: 2.25 }],
  household: [{ materialCode: product.code, materialName: product.name, specification: product.spec,
    'priceContext.unit': '只', unitPrice: 10, copperWeight: 20, zincWeight: 5, householdRate: 0.085 }],
  settlement: [
    { title: '联动结算价', 'rule.materialCode': product.code, 'rule.materialName': product.name, 'rule.specModel': product.model,
      'rule.plannedPrice': settlementExample.plannedPrice, 'rule.markupRatio': settlementExample.markupRatio,
      'rule.baseSettlePrice': settlementBasePrice, 'rule.copperWeightG': copperWeightG, 'rule.zincWeightG': zincWeightG,
      'rule.givenPrice': settlementLinkedPrice, 'rule.priceType': '结算联动价', 'rule.sourceFormula': '在结算价格表 L5 编辑', ...settlementExample },
    { title: '固定结算价', 'rule.materialCode': '00001235', 'rule.materialName': '示例阀盖', 'rule.specModel': 'CAP-15',
      'rule.plannedPrice': 8, 'rule.markupRatio': 1.05, 'rule.baseSettlePrice': 8.4,
      'rule.copperWeightG': 0, 'rule.zincWeightG': 0, 'rule.givenPrice': 8.4, 'rule.priceType': '结算固定价', ...settlementExample },
  ],
  scrap: [
    { title: '联动价', materialCode: '00009876', materialName: '示例紫铜屑', supplierName: supplier.name, supplierCode: supplier.code,
      fixedPrice: Number(scrapLinkedPrice.toFixed(6)), priceType: '联动价', sourceFormula: '在废料清单 F5 编辑', specification: '紫铜屑', ...scrapExample },
    { title: '固定价', materialCode: '00009877', materialName: '示例铝屑', supplierName: supplier.name, supplierCode: supplier.code,
      fixedPrice: 15, priceType: '固定价', specification: '铝屑' },
  ],
  fixed: [{ externalRowId: 'SRM-EX001', srmDocNo: 'SRM-EX001', materialCode: product.code, materialName: product.name,
    specModel: product.model, unit: '只', fixedPrice: 2.25, currentTaxIncludedPrice: 2.5425,
    currentSupplierName: supplier.name, executionPeriodText: date }],
  u9material: [{ materialCode: product.code, materialName: product.name, materialSpec: product.spec, materialModel: product.model,
    unit: '只', shapeAttr: '制造件', departmentCode: '001', departmentName: '示例车间', productionDivision: '商用' }],
  u9byproduct: [{ parentMaterialNo: product.code, parentMaterialName: product.name, parentMaterialSpec: product.spec,
    bomPurpose: '制造', versionNo: 'F001', outputType: '副产品', byproductMaterialNo: '00009876', byproductMaterialName: '示例紫铜屑',
    operationNo: '010', outputQty: 0.02, unit: '公斤', status: '已核准', productionDeptCode: '001', productionDeptName: '示例车间', effectiveFrom: date }],
  cmsWorkshop: [{ period, firstUnitCode: '001', firstUnitName: '示例车间', parentCode: product.code, parentName: product.name,
    workingHours: 2, workingCostCent: 123, materialPrice: 500, sourceRowId: 'CMS-EX001' }],
  cmsSubject: [{ period, parentCode: product.code, parentName: product.name, firstSubjectCode: '01', firstSubjectName: '辅助材料',
    secondSubjectCode: '0101', secondSubjectName: '焊接', materialPrice: 456, sourceRowId: 'CMS-EX002' }],
  cmsSetting: [{ firstSubjectCode: '01', firstSubjectName: '辅助材料', secondSubjectCode: '0101', secondSubjectName: '焊接' }],
  cmsScrap: [{ materialCode: product.code, materialName: product.name, materialUnit: '公斤', scrapCode: '00009876',
    scrapName: '示例紫铜屑', scrapUnit: '公斤', sourceRowId: 'CMS-EX003', effectiveDate: date, postingPeriod: period }],
  cmsPlan: [{ firstUnitCode: '001', firstUnitName: '示例车间', parentCode: product.code, parentName: product.name,
    parentSpec: product.spec, parentType: product.model, unit: '只', workingHours: 2, effectiveDate: date,
    mainMaterialCost: 4, auxMaterialCost: 1, salaryCost: 3, fundCost: 2, lossCost: 0, totalPlanCost: 10,
    businessStatus: '已审批', oaNo: 'OA-EX001' }],
  three: [{ periodYear: '2026', productCategory: '商用直销产品', productLine: '国内产线', company: '示例公司', businessUnit: '商用',
    applicantDepartment: '销售部', applicantOffice: '营销处', managementExpenseRate: 0.01, financeExpenseRate: 0.02,
    salesExpenseRate: 0.03, threeExpenseTotalRate: 0.06, oemExpenseRate: 0.05, overseasSales: '否' }],
  range: [
    { title: '第一档', orgCode: '210', materialCode: product.code, supplierName: supplier.name, supplierCode: supplier.code,
      specModel: product.model, unit: '米', priceExclTax: 5, taxIncluded: false, band: '90000-94999', bandNet: 5, bandGross: 5.65 },
    { title: '第二档', orgCode: '210', materialCode: product.code, supplierName: supplier.name, supplierCode: supplier.code,
      specModel: product.model, unit: '米', priceExclTax: 5, taxIncluded: false, band: '95000-99999', bandNet: 5.2, bandGross: 5.876 },
  ],
  financeCommercial: [{ factorName: '1#电解铜', shortName: 'Cu', unit: '元/公斤', average: 90, price: 95 }],
  financePlate: [{ factorName: '1#电解铜', shortName: 'Cu', source: '平均价', unit: '元/公斤', average: 90, nonTender: 95, tender: 94 }],
}
