import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGE_FILE = path.join(ROOT, 'src/views/collaborate/BomSupplement.vue')
const API_FILE = path.join(ROOT, 'src/api/quoteBomSupplement.js')
const ROUTER_FILE = path.join(ROOT, 'src/router/index.js')

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')

describe('QBP-07 OA 技术员 BOM 协作页', () => {
  it('协作路由保持公开且不进入常规侧边栏布局', () => {
    assert.match(routerContent, /path:\s*'\/collaborate'/)
    assert.match(routerContent, /CollaborateLayout\.vue/)
    assert.match(routerContent, /path:\s*'bom-supplement'/)
    assert.match(routerContent, /meta:\s*\{\s*title:\s*'BOM 补充数据',\s*public:\s*true\s*\}/)
  })

  it('封装 QBP-06 token 上下文、包装参考、草稿和提交接口', () => {
    assert.match(apiContent, /\/api\/v1\/collaborate\/bom-supplement/)
    assert.match(apiContent, /fetchBomSupplementContext/)
    assert.match(apiContent, /fetchBomPackageReference/)
    assert.match(apiContent, /saveBomSupplementDraft/)
    assert.match(apiContent, /submitBomSupplement/)
    assert.match(apiContent, /\/context/)
    assert.match(apiContent, /\/package-reference/)
    assert.match(apiContent, /\/save-draft/)
    assert.match(apiContent, /\/submit/)
  })

  it('页面按 token 拉取上下文并展示任务头字段', () => {
    assert.match(pageContent, /useRoute/)
    assert.match(pageContent, /route\.query\.token/)
    assert.match(pageContent, /fetchBomSupplementContext\(token\.value\)/)
    ;[
      '报价单号',
      '客户',
      '产品料号',
      '产品名称',
      '规格',
      '裸品 / 非裸品',
      '包装方式',
      '任务说明',
    ].forEach((label) => assert.match(pageContent, new RegExp(label)))
  })

  it('覆盖正式 BOM 只读和缺 BOM 可补录两个本体分支', () => {
    assert.match(pageContent, /hasExistingBodyBom/)
    assert.match(pageContent, /v-if="hasExistingBodyBom"/)
    assert.match(pageContent, /正式 BOM/)
    assert.match(pageContent, /技术员补录/)
    assert.match(pageContent, /addSupplementLine/)
    assert.match(pageContent, /removeSupplementLine/)
    assert.match(pageContent, /createBlankSupplementLine/)
    assert.match(pageContent, /v-model="row\.materialCode"/)
    assert.match(pageContent, /v-model="row\.qtyPerParent"/)
    assert.match(pageContent, /v-model="row\.parentBaseQty"/)
  })

  it('包装参考区支持参考成品查询、目件展示、勾选和调整字段', () => {
    assert.match(pageContent, /showPackageReference/)
    assert.match(pageContent, /packageReferenceVisible/)
    assert.match(pageContent, /loadPackageReference/)
    assert.match(pageContent, /fetchBomPackageReference/)
    assert.match(pageContent, /参考成品料号/)
    assert.match(pageContent, /目件料号/)
    assert.match(pageContent, /v-model="row\.selected"/)
    ;[
      'adjustedPackageQtyPerParent',
      'adjustedPackageQtyPerTop',
      'adjustedPackageParentBaseQty',
      'adjustedChildQtyPerParent',
      'adjustedChildQtyPerTop',
      'adjustedChildParentBaseQty',
    ].forEach((field) => assert.match(pageContent, new RegExp(field)))
  })

  it('保存和提交使用统一 payload，提交后只进入财务审核', () => {
    assert.match(pageContent, /buildBomSupplementPayload/)
    assert.match(pageContent, /saveDraft/)
    assert.match(pageContent, /submitForReview/)
    assert.match(pageContent, /saveBomSupplementDraft/)
    assert.match(pageContent, /submitBomSupplement/)
    assert.match(pageContent, /提交财务审核/)
    assert.doesNotMatch(pageContent, /成本核算/)
    assert.doesNotMatch(pageContent, /build-costing-rows/)
  })

  it('表格和按钮有长字段溢出保护', () => {
    assert.match(pageContent, /show-overflow-tooltip/)
    assert.match(pageContent, /min-width/)
    assert.match(pageContent, /word-break:\s*break-word/)
    assert.match(pageContent, /white-space:\s*normal/)
  })
})
