import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/store/modules/permission.js', import.meta.url), 'utf8')
// 执行生产环境的转换函数，只替换 Vite 组件加载器和 Vue 的 markRaw。
const routingSource = source.slice(
  source.indexOf('const componentAliasMap ='),
  source.indexOf('export const usePermissionStore'),
)
const loadLinked = () => Promise.resolve({})
const loadFinance = () => Promise.resolve({})
const mainLayout = {}
const parentView = {}
const warnings = []
const toRoute = new Function(
  'viewModules', 'pageModules', 'MainLayout', 'ParentView', 'markRaw', 'console',
  `${routingSource}\nreturn toRoute`,
)(
  { '../../views/price/linked/result/index.vue': loadLinked },
  { '../../pages/FinanceCuBasePricePage.vue': loadFinance },
  mainLayout, parentView, value => value, { warn: message => warnings.push(message) },
)
const oldFactor = {
  menuId: 10, path: '/price/linked/finance-base',
  component: 'pages:PriceLinkedFinanceBasePage', meta: { title: '影响因素表' },
}
const linked = { menuId: 11, path: 'result', component: 'price/price-linked/index' }

test('旧菜单组件已删除时不生成路由或示例页', () => {
  assert.equal(toRoute(oldFactor), null)
  assert.ok(warnings.some(message => message.includes('menuId=10')))
})

test('过滤失效菜单后仍保留同目录的正常菜单和布局', () => {
  const route = toRoute({ menuId: 1, path: '/price', children: [oldFactor, linked] })
  assert.equal(route.component, mainLayout)
  assert.deepEqual(route.children.map(child => child.name), ['dyn-11'])
  assert.equal(route.children[0].component, loadLinked)
})

test('失效菜单形成的空目录逐层移除', () => {
  assert.equal(toRoute({ path: '/price', children: [{ path: 'linked', children: [oldFactor] }] }), null)
  assert.equal(toRoute({ path: '/empty', component: 'Layout' }), null)
})

test('嵌套目录使用 ParentView，保留财务基价的真实组件和元信息', () => {
  const meta = { title: '财务基价', hidden: true }
  const route = toRoute({ path: '/rules', children: [{
    path: 'finance', children: [{ menuId: 12, path: 'base', component: 'pages:FinanceCuBasePricePage', meta }],
  }] })
  assert.equal(route.children[0].component, parentView)
  assert.equal(route.children[0].children[0].component, loadFinance)
  assert.deepEqual(route.children[0].children[0].meta, { ...meta, menuId: 12 })
  assert.equal(meta.menuId, undefined)
})

test('旧目录组件缺失时仅保留其有效子菜单', () => {
  const route = toRoute({ path: '/price', component: 'removed/directory', children: [linked, oldFactor] })
  assert.equal(route.component, mainLayout)
  assert.equal(route.children.length, 1)
  assert.equal(toRoute({ path: '/price', component: 'removed/directory', children: [oldFactor] }), null)
})

test('空授权菜单不会扩展成其他业务菜单', () => {
  assert.equal(toRoute(null), null)
  assert.deepEqual([oldFactor].map(node => toRoute(node)).filter(Boolean), [])
})
