import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/pricePrepare.js')
const PAGE_FILE = path.join(ROOT, 'src/views/cost/price-prepare/index.vue')

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('NSC-05 价格准备缺废料映射处理', () => {
  it('API 封装确认无废料接口和缺废料映射缺口类型', () => {
    assert.match(apiContent, /MISSING_SCRAP_MAPPING/)
    assert.match(apiContent, /label:\s*'缺废料映射'/)
    assert.match(apiContent, /export const confirmPricePrepareNoScrap/)
    assert.match(apiContent, /export const revokePricePrepareNoScrap/)
    assert.match(apiContent, /\/no-scrap-confirmations/)
    assert.match(apiContent, /\/no-scrap-confirmations\/\$\{id\}\/revoke/)
    assert.match(apiContent, /method:\s*'POST'/)
  })

  it('MISSING_SCRAP_MAPPING 行显示补充映射和确认无废料两个动作', () => {
    assert.match(pageContent, /GAP_TYPE_MISSING_SCRAP_MAPPING\s*=\s*'MISSING_SCRAP_MAPPING'/)
    assert.match(pageContent, /isMissingScrapMappingGap/)
    assert.match(pageContent, /补充废料映射/)
    assert.match(pageContent, /确认无废料，按0处理/)
    assert.match(pageContent, /canConfirmNoScrap\(row\)/)
  })

  it('其他缺口类型不显示确认无废料动作', () => {
    assert.match(pageContent, /v-if="isMissingScrapMappingGap\(row\)"/)
    assert.match(pageContent, /v-if="canConfirmNoScrap\(row\)"/)
    assert.match(pageContent, /按缺口说明处理/)
  })

  it('确认弹窗展示上下文、要求原因，并提示重新生成后生效', () => {
    assert.match(pageContent, /OA单号/)
    assert.match(pageContent, /顶层产品/)
    assert.match(pageContent, /子项料号/)
    assert.match(pageContent, /价格月份/)
    assert.match(pageContent, /确认原因/)
    assert.match(pageContent, /if \(!reason\)/)
    assert.match(pageContent, /请输入确认原因/)
    assert.match(pageContent, /需重新生成价格准备后生效/)
  })

  it('提交成功后保留当前缺口并标记确认信息', () => {
    assert.match(pageContent, /mergeNoScrapConfirmation/)
    assert.match(pageContent, /noScrapConfirmationId/)
    assert.match(pageContent, /confirmedBy/)
    assert.match(pageContent, /confirmReason/)
    assert.match(pageContent, /确认完成，需重新生成价格准备后生效/)
    assert.doesNotMatch(pageContent, /gapRows\.value\s*=\s*gapRows\.value\.filter/)
  })

  it('补充 CMS 映射跳转携带 materialCode 查询条件', () => {
    assert.match(pageContent, /goSupplementScrapMapping/)
    assert.match(pageContent, /path:\s*'\/base\/cms-cost\/material-scrap-refs'/)
    assert.match(pageContent, /query:\s*materialCode \? \{ materialCode \} : \{\}/)
  })

  it('NSC-06：确认和撤销按钮按权限展示', () => {
    assert.match(pageContent, /canConfirmNoScrapPermission = computed/)
    assert.match(pageContent, /cost:price-prepare:no-scrap-confirm/)
    assert.match(pageContent, /canRevokeNoScrapPermission = computed/)
    assert.match(pageContent, /cost:price-prepare:no-scrap-revoke/)
    assert.match(pageContent, /canConfirmNoScrapPermission\.value/)
    assert.match(pageContent, /canRevokeNoScrapPermission\.value/)
  })

  it('NSC-06：已确认记录可进入撤销确认弹窗', () => {
    assert.match(pageContent, /撤销确认/)
    assert.match(pageContent, /openNoScrapRevokeDialog\(row\)/)
    assert.match(pageContent, /noScrapRevokeDialogVisible/)
    assert.match(pageContent, /submitNoScrapRevoke/)
    assert.match(pageContent, /请输入撤销原因/)
    assert.match(pageContent, /撤销后重新生成价格准备/)
  })
})
