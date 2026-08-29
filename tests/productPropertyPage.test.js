import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../src/pages/ProductPropertyPage.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/api/productProperties.js', import.meta.url), 'utf8')

test('产品属性页面以年度业务清单和独立上浮规则为准', () => {
  assert.match(page, /唯一键为年度 \+ 料号/)
  assert.match(page, /系数 = 1 \+ 上浮比例/)
  assert.match(page, /非标品.*标准品.*定制品.*OEM/s)
  assert.doesNotMatch(page, /预计年用量|OA报价|新增产品属性|编辑产品属性/)
})

test('导入支持 A-E A-F、增量和全量，并直接上传原始 Excel', () => {
  assert.match(page, /A–E \/ A–F/)
  assert.match(page, /INCREMENTAL/)
  assert.match(page, /FULL/)
  assert.match(api, /new FormData\(\)/)
  assert.match(api, /body\.append\('file', file\)/)
  assert.match(api, /body\.append\('importMode', importMode\)/)
})

test('产品列表使用服务端分页，规则与清单同页维护', () => {
  assert.match(page, /el-pagination/)
  assert.match(api, /product-properties\/rules/)
  assert.match(api, /method: 'PUT'/)
})
