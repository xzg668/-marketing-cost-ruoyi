import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildQuoteEffectiveBomTree,
  effectiveAlternativeMeta,
  effectiveAlternativeNodeMeta,
  effectiveBomExclusionItems,
  effectiveNodeEvidenceVisible,
  effectiveShapeMeta,
  effectiveShapeSourceLabel,
  effectiveSupplierEvidence,
} from '../src/utils/quoteEffectiveBom.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('QEB-14 最终有效 BOM 树', () => {
  it('只按后端返回的有效节点组树，不把被采购件截断的原始子树补回来', () => {
    const roots = buildQuoteEffectiveBomTree([
      { nodeKey: 'P', parentNodeKey: null, sortSeq: 1, materialCode: 'P' },
      { nodeKey: 'A', parentNodeKey: 'P', sortSeq: 1, materialCode: 'A', effectiveMaterialShape: 'PURCHASE' },
    ])

    assert.equal(roots.length, 1)
    assert.deepEqual(roots[0].children.map((node) => node.materialCode), ['A'])
    assert.deepEqual(roots[0].children[0].children, [])
  })

  it('改选替代后展示替代整支，未返回的标准支不会出现', () => {
    const roots = buildQuoteEffectiveBomTree([
      { nodeKey: 'P', parentNodeKey: null, sortSeq: 1, materialCode: 'P' },
      { nodeKey: 'T', parentNodeKey: 'P', sortSeq: 1, materialCode: 'T', alternativeChildType: 'ALTERNATIVE' },
      { nodeKey: 'T1', parentNodeKey: 'T', sortSeq: 1, materialCode: 'T1' },
    ])

    assert.deepEqual(roots[0].children.map((node) => node.materialCode), ['T'])
    assert.deepEqual(roots[0].children[0].children.map((node) => node.materialCode), ['T1'])
    assert.deepEqual(effectiveAlternativeMeta('ALTERNATIVE'), { label: '替代料', type: 'warning' })
  })

  it('节点展示最终形态、规则来源以及主供应商比例证据', () => {
    assert.deepEqual(effectiveShapeMeta('OUTSOURCE'), { label: '委外加工件', type: 'warning' })
    assert.equal(effectiveShapeSourceLabel('STRUCTURE_ROOT'), '产品结构根')
    assert.equal(effectiveShapeSourceLabel('SUPPLIER_RATIO'), '供货比例规则')
    assert.equal(effectiveSupplierEvidence({
      selectedSupplierName: '外部供应商',
      selectedSupplyRatio: '0.80',
    }), '主供应商：外部供应商（80%）')
  })

  it('产品结构根不伪装成普通制造件，双行节点使用自适应高度', () => {
    assert.match(pageContent, /v-if="!isStructureRootNode\(data\)"/)
    assert.match(pageContent, /shapeResolutionSource === 'STRUCTURE_ROOT'/)
    assert.match(pageContent, /\.effective-bom-tree :deep\(\.el-tree-node__content\)[\s\S]*height: auto/)
  })

  it('主树突出父子层级并隐藏重复的默认说明', () => {
    assert.equal(effectiveAlternativeNodeMeta({ alternativeChildType: 'STANDARD' }), null)
    const groupedStandardNode = {
      alternativeGroupKey: 'ALT-1',
      alternativeChildType: 'STANDARD',
    }
    assert.equal(effectiveAlternativeNodeMeta(groupedStandardNode), null)
    assert.deepEqual(effectiveAlternativeNodeMeta(groupedStandardNode, new Set(['ALT-1'])), {
      label: '标准料',
      type: 'primary',
    })
    assert.equal(effectiveNodeEvidenceVisible({ shapeResolutionSource: 'U9' }), false)
    assert.equal(effectiveNodeEvidenceVisible({ shapeResolutionSource: 'FIXED_POLICY' }), true)
    assert.match(pageContent, /:indent="0"/)
    assert.match(pageContent, /\.el-tree-node__children > \.el-tree-node::before/)
    assert.match(pageContent, /\{\{ data\.children\.length \}\} 个子项/)
    assert.match(pageContent, /effectiveAlternativeGroupKeys/)
  })

  it('烧结基座委外排除只进入摘要，不进入主树', () => {
    const items = effectiveBomExclusionItems({
      excludedNodeCount: 1,
      reasonCounts: { POLICY_DIRECT_CHILD_EXCLUSION: 1 },
    })
    assert.deepEqual(items, [{
      reason: 'POLICY_DIRECT_CHILD_EXCLUSION',
      label: '形态规则排除直接子件',
      count: 1,
    }])
  })

  it('展开和收起递归调用 Element Plus 公开节点 API', () => {
    assert.match(pageContent, /Array\.isArray\(bomTreeRef\.value\)/)
    assert.match(pageContent, /find\(\(candidate\) => candidate\?\.getNode\)/)
    assert.match(pageContent, /tree\.getNode\(key\)/)
    assert.match(pageContent, /if \(expanded\) node\.expand\(\)/)
    assert.match(pageContent, /if \(!expanded\) node\.collapse\(\)/)
    assert.match(pageContent, /Array\.isArray\(node\.childNodes\)/)
    assert.match(pageContent, /childNodes\.forEach\(visitNode\)/)
    assert.doesNotMatch(pageContent, /store\?\._getAllNodes/)
    assert.match(pageContent, /effectiveBomDefaultExpandedKeys/)
  })
})
