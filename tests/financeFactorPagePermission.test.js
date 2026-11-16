import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as utils from '../src/pages/financeFactorPublicationUtils.js'

const renderer = Vue.createRenderer({
  createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null,
})
const { descriptor } = parse(readFileSync(new URL('../src/pages/FinanceCuBasePricePage.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'finance-permissions' }).content
  .replace(/import\s*\{([^}]+)\}\s*from ['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '')
  .replace('export default', 'return')
const settle = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
function fixture({ roles = [], permissions = [], organization = '210', exportRequest = async () => {} } = {}) {
  const requests = [], exports = []
  const user = Vue.reactive({ userId: 17, businessUnitType: 'COMMERCIAL', roles, permissions })
  const bindings = { Vue, ...utils, WorkbookActions: {}, financePublicationMessage: () => '',
    useUserStore: () => user, useRoute: () => ({ query: { priceMonth: '2026-11', priceOrgCode: organization } }),
    ElMessage: { error() {}, success() {}, warning() {} },
    fetchFinanceFactorSnapshot: async (scope, copperOnly) => {
      requests.push({ scope, copperOnly })
      return { scope, schemeCodes: [], factors: {}, revision: 2 }
    },
    exportFinanceFactors: async (scope, options) => { exports.push({ scope, options }); await exportRequest() },
    previewFinanceFactors() {}, publishFinanceFactors() {}, previewFinanceCopper() {}, publishFinanceCopper() {},
  }
  const page = new Function(...Object.keys(bindings), script)(...Object.values(bindings))
  page.render = () => null
  const app = renderer.createApp(page)
  return { app, state: app.mount({}).$.setupState, user, requests, exports }
}

for (const role of ['bu_staff', 'bu_director', 'admin', 'BU_STAFF']) {
  for (const organization of ['210', '220']) {
    test(`${role} 可查看并导出 ${organization} 当月全基价，不借用导入或Cu编辑权限`, async () => {
      const f = fixture({ roles: [role], organization })
      try {
        await settle()
        assert.equal(f.requests[0].copperOnly, false)
        assert.equal(f.state.canExport, true)
        assert.equal(Boolean(f.state.canImport), false)
        assert.equal(Boolean(f.state.canEditCopper), false)
        await f.state.exportSelectedMonth()
        assert.equal(f.exports.length, 1)
        assert.equal(f.exports[0].scope.priceMonth, '2026-11')
        assert.equal(f.exports[0].scope.priceOrgCode, organization)
        assert.equal(f.exports[0].options.isCurrent(), true)
      } finally { f.app.unmount() }
    })
  }
}

test('原财务导入权限保留导出，无关角色和仅查看权限不自动获得导出', async () => {
  for (const [roles, permissions, allowed] of [
    [[], ['price:finance-base:import'], true], [[], ['*:*:*'], true],
    [['viewer'], ['price:finance-base:list'], false], [['bu_staff_other'], [], false],
    [[], ['cost:finance-cu-base:query'], false],
  ]) {
    const f = fixture({ roles, permissions })
    try {
      await settle(); await f.state.exportSelectedMonth()
      assert.equal(Boolean(f.state.canExport), allowed)
      assert.equal(f.exports.length, allowed ? 1 : 0)
    } finally { f.app.unmount() }
  }
})

test('导出等待期间切换月份、组织、用户、业务单元、权限或退出页面，旧下载均失效', async () => {
  const changes = [
    f => { f.state.scope.priceMonth = '2026-10' }, f => { f.state.scope.priceOrgCode = '220' },
    f => { f.user.userId = 18 }, f => { f.user.businessUnitType = 'HOUSEHOLD' },
    f => { f.user.roles = [] }, f => { f.app.unmount() },
  ]
  for (const change of changes) {
    let finish
    const pending = new Promise(resolve => { finish = resolve })
    const f = fixture({ roles: ['bu_staff'], exportRequest: () => pending })
    await settle()
    const request = f.state.exportSelectedMonth()
    assert.equal(f.exports[0].options.isCurrent(), true)
    await f.state.exportSelectedMonth()
    assert.equal(f.exports.length, 1)
    change(f)
    assert.equal(f.exports[0].options.isCurrent(), false)
    finish(); await request
    if (f.app._instance) f.app.unmount()
  }
})
