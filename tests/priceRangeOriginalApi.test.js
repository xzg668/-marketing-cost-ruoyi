import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 只替换HTTP传输边界，执行真实API客户端的FormData构造。
const source = readFileSync(new URL('../src/api/priceRangeItems.js', import.meta.url), 'utf8')
  .replace("import { request } from './http'", 'const request = async (path, options) => ({ path, ...options })')
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('预检发送完整原文件和月份，不发送前端解析的区间价格', async () => {
  const file = new File([new Uint8Array([0, 1, 2, 255])], '供管原稿.xls')
  const result = await api.previewRangeOriginal(file, '2026-11', 'COMMERCIAL')
  assert.equal(result.path, '/api/v1/price-range/items/original-preview')
  assert.equal(result.method, 'POST')
  assert.deepEqual([...result.body.keys()], ['file', 'pricingMonth', 'businessUnitType'])
  assert.equal(result.body.get('pricingMonth'), '2026-11')
  assert.equal(result.body.get('businessUnitType'), 'COMMERCIAL')
  assert.equal(result.body.get('file').name, file.name)
  assert.deepEqual(new Uint8Array(await result.body.get('file').arrayBuffer()), new Uint8Array([0, 1, 2, 255]))
})

test('发布携带同一原文件、文件摘要和完整预检版本', async () => {
  const file = new File(['original bytes'], '原稿.xlsx')
  const result = await api.publishRangeOriginal(file, '2026-10', '', { fileSha256: 'file-hash', previewFingerprint: 'version-hash' })
  assert.equal(result.path, '/api/v1/price-range/items/original-import')
  assert.equal(await result.body.get('file').text(), 'original bytes')
  assert.equal(result.body.get('expectedSha256'), 'file-hash')
  assert.equal(result.body.get('previewFingerprint'), 'version-hash')
  assert.equal(result.body.has('businessUnitType'), false)
})
