import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createUuid } from '../src/utils/uuid.js'
import * as folderUtils from '../src/components/monthlyPriceFolderUtils.js'

const { descriptor } = parse(readFileSync(new URL('../src/components/MonthlyPriceFolderDialog.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'monthly-folder-http' }).content
  .replace(/import\s*\{([^}]+)\}\s*from 'vue'/, 'const {$1} = Vue')
  .replace(/^import .+ from .+$/gm, '')
  .replace('export default', 'return')
const renderer = Vue.createRenderer({
  createComment: () => ({}), insert: () => {}, remove: () => {},
  parentNode: () => null, nextSibling: () => null,
})
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('HTTP 文件夹入口在 randomUUID 不可用时仍创建批次并逐个上传，完成后可再次导入', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
  })
  const starts = [], uploads = []
  const api = {
    startPriceFolder: async body => {
      starts.push(body)
      return { id: starts.length, files: body.paths.map((path, i) => ({ id: i + 1, path })) }
    },
    uploadPriceFolderFile: async (...args) => { uploads.push(args) },
    readPriceFolder: async id => ({ id, status: 'COMPLETE', files: [], groups: [], summary: {} }),
  }
  const names = ['Vue', 'useUserStore', 'api', 'createUuid', ...Object.keys(folderUtils)]
  const component = new Function(...names, script)(Vue, () => ({ businessUnitType: 'COMMERCIAL' }), api, createUuid, ...Object.values(folderUtils))
  component.render = () => null
  const app = renderer.createApp(component, { modelValue: false, month: '2026-11' })
  try {
    const state = app.mount({}).$.setupState
    const files = [
      { name: '联动价.xlsx', webkitRelativePath: '11月/供管部/联动价.xlsx', size: 100 },
      { name: '区间价.xlsx', webkitRelativePath: '11月/区间价.xlsx', size: 100 },
    ]
    const event = () => ({ target: { files, value: 'selected-folder' } })
    await state.onFolder(event())
    assert.equal(state.error, '', '选择文件夹不应因 HTTP 缺少 randomUUID 而终止')
    assert.equal(starts.length, 1)
    assert.match(starts[0].requestKey, uuid)
    assert.equal(starts[0].pricingMonth, '2026-11')
    assert.deepEqual(starts[0].paths, ['供管部/联动价.xlsx', '区间价.xlsx'])
    assert.deepEqual(uploads.map(call => call[2]), files)
    assert.equal(state.busy, false)
    await state.onFolder(event())
    assert.equal(state.error, '')
    assert.equal(starts.length, 2)
    assert.notEqual(starts[0].requestKey, starts[1].requestKey)
    assert.equal(uploads.length, 4)
  } finally {
    app.unmount()
    if (original) Object.defineProperty(globalThis, 'crypto', original)
    else delete globalThis.crypto
  }
})
