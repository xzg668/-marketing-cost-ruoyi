import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGE_FILE = path.join(ROOT, 'src/pages/MakePartSpecPage.vue')

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('T10 自制件规格历史废料字段降级', () => {
  it('页面展示 CMS 映射和当前废料价状态，不再展示历史废料代号和废料单价列', () => {
    assert.match(pageContent, /CMS 回收废料/)
    assert.match(pageContent, /prop="cmsMappingStatus" label="映射状态"/)
    assert.match(pageContent, /CMS回收料号 \/ 名称/)
    assert.match(pageContent, /当前废料价/)
    assert.doesNotMatch(pageContent, /prop="recycleCode" label="代号"/)
    assert.doesNotMatch(pageContent, /prop="recycleUnitPrice" label="单价"/)
  })

  it('新增和编辑表单只读展示 CMS 回收明细，保存时剔除历史废料字段', () => {
    assert.match(pageContent, /label="回收明细"/)
    assert.match(pageContent, /cmsScraps/)
    assert.match(pageContent, /delete payload\.recycleCode/)
    assert.match(pageContent, /delete payload\.recycleUnitPrice/)
    assert.doesNotMatch(pageContent, /v-model="formModel\.recycleCode"/)
    assert.doesNotMatch(pageContent, /v-model="formModel\.recycleUnitPrice"/)
  })

  it('导入解析忽略历史废料代号和废料单价', () => {
    assert.doesNotMatch(pageContent, /废料代号:\s*'recycleCode'/)
    assert.doesNotMatch(pageContent, /回收代号:\s*'recycleCode'/)
    assert.doesNotMatch(pageContent, /废料单价:\s*'recycleUnitPrice'/)
    assert.doesNotMatch(pageContent, /回收单价:\s*'recycleUnitPrice'/)
  })
})
