import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSupplierRatioGap, priceSourceGapKind, summarizePriceSourceGaps, buildPriceSourceGapTree } from '../src/utils/priceSourceGaps.js'

describe('报价价格缺口分类', () => {
  it('月价返回 WAITING 时按实际审核物料区分供货比率和真正无价，不把包装母件误作缺价子件', () => {
    const gaps = [
      { gapMaterialCode: '201350006', reasonCode: 'WAITING', sourceTable: 'lp_material_monthly_price' },
      { materialCode: '9830000025700', gapMaterialCode: '250011632', reasonCode: 'WAITING', sourceTable: 'lp_package_component_price_detail' },
      { gapMaterialCode: '332030278', reasonCode: 'MISSING', sourceTable: 'lp_material_monthly_price' },
    ]
    const reviews = ['201350006', '250011632'].map(materialCode => ({ scope: { materialCode }, status: 'PENDING' }))
    const result = summarizePriceSourceGaps(gaps, reviews)
    assert.equal(result.ratioReview, 2)
    assert.equal(result.total, 1)
    assert.equal(isSupplierRatioGap(gaps[0], reviews), true)
    assert.equal(isSupplierRatioGap(gaps[0], [{ ...reviews[0], status: 'FALLBACK_HIGH' }]), false)
    assert.equal(isSupplierRatioGap(gaps[2], reviews), false)
  })
  it('把联动失败、供货比率和制造件缺口分开，全部数字能对上总数', () => {
    const gaps = [
      ...Array.from({ length: 19 }, () => ({ reasonCode: 'LINKED_RULE_ERROR', sourceTable: 'PriceResolver' })),
      ...Array.from({ length: 6 }, () => ({ reasonCode: 'SUPPLIER_RATIO_REVIEW_REQUIRED', priceType: 'FIXED' })),
      ...Array.from({ length: 4 }, () => ({ sourceTable: 'lp_package_component_price_detail', message: '路由=[固定价] 但未取到有效价格: 供货比率不足，请确认是否有新增审核' })),
      ...Array.from({ length: 5 }, () => ({ itemType: 'MAKE_PART', gapType: 'MISSING_PRICE' })),
      ...Array.from({ length: 4 }, () => ({ gapType: 'MISSING_PRICE', message: '该月份和组织没有可用价格来源' })),
      { itemType: 'MAKE_PART', gapType: 'MISSING_STRUCTURE', message: '缺废料映射' },
    ]
    const result = summarizePriceSourceGaps(gaps)
    assert.deepEqual(result, {
      all: 39, total: 29, ratioReview: 10, fixed: 0, settleFixed: 0, settleLinked: 0,
      linked: 19, range: 0, make: 5, raw: 0, scrap: 0, scrapMapping: 1, unresolved: 4,
    })
    assert.equal(isSupplierRatioGap(gaps[25]), true)
    assert.equal(priceSourceGapKind(gaps[0]), 'LINKED')
  })

  it('缺价原材料和废料不沿用自制母件的取价类型；来源异常仍显示但不冒充缺价', () => {
    const raw = { itemType: 'MAKE_PART', priceType: '自制件', reasonCode: 'MISSING_RAW_PRICE' }
    const scrap = { ...raw, reasonCode: 'MISSING_SCRAP_PRICE' }
    assert.equal(priceSourceGapKind(raw), 'RAW_PRICE')
    assert.equal(priceSourceGapKind(scrap), 'SCRAP_PRICE')
    assert.equal(priceSourceGapKind({ ...raw, reasonCode: 'RAW_PRICE_ERROR', gapType: 'PRICE_SOURCE_ERROR' }), 'RAW_PRICE')
    const summary = summarizePriceSourceGaps([raw, scrap])
    assert.equal(summary.make, 0)
    assert.equal(summary.raw, 1)
    assert.equal(summary.scrap, 1)
  })

  it('实际缺价料号显示在真实 BOM 父件下，父件只作上下文', () => {
    const gap = { materialCode: '201850068', gapMaterialCode: '201850068', materialName: '基座毛坯', reasonCode: 'MISSING_RAW_PRICE', itemType: 'MAKE_PART' }
    const tree = buildPriceSourceGapTree([gap], [
      { nodeKey: 'base', materialCode: '7218501041211', materialName: '基座' },
      { nodeKey: 'blank', parentNodeKey: 'base', materialCode: '201850068', materialName: '基座毛坯' },
    ])
    assert.equal(tree[0].gapMaterialCode, '7218501041211')
    assert.equal(tree[0].materialName, '基座')
    assert.equal(tree[0].isGapContext, true)
    assert.equal(tree[0].children[0].gapMaterialCode, '201850068')
    assert.equal(tree[0].children[0].isGapContext, undefined)
    assert.equal(gap.children, undefined)
  })

  it('同一缺价料在多个实际父件下出现时保留各处关系，不把上下文计入缺价数', () => {
    const gap = { materialCode: 'RAW', gapMaterialCode: 'RAW', reasonCode: 'MISSING_RAW_PRICE' }
    const tree = buildPriceSourceGapTree([gap], [
      { nodeKey: 'a', materialCode: 'P1', children: [{ nodeKey: 'r1', materialCode: 'RAW' }] },
      { nodeKey: 'b', materialCode: 'P2', children: [{ nodeKey: 'r2', materialCode: 'RAW' }] },
    ])
    assert.deepEqual(tree.map(row => row.gapMaterialCode), ['P1', 'P2'])
    assert.equal(new Set(tree.flatMap(row => row.children).map(row => row.gapTreeKey)).size, 2)
    assert.equal(summarizePriceSourceGaps([gap]).total, 1)
    const scrap = buildPriceSourceGapTree([{ materialCode: 'P1', gapMaterialCode: 'SCRAP', reasonCode: 'MISSING_SCRAP_PRICE' }], [])
    assert.equal(scrap[0].gapMaterialCode, 'P1')
    assert.equal(scrap[0].children[0].gapMaterialCode, 'SCRAP')
  })

  it('价格类型明确时才归入固定价、结算固定价或区间价缺口', () => {
    const result = summarizePriceSourceGaps([
      { priceType: 'FIXED' },
      { priceType: 'SETTLE_FIXED' },
      { priceType: 'RANGE' },
      { priceType: 'LINKED' },
    ])
    assert.equal(result.fixed, 1)
    assert.equal(result.settleFixed, 1)
    assert.equal(result.range, 1)
    assert.equal(result.linked, 1)
    assert.equal(result.total, 4)
  })
})
