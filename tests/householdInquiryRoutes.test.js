import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const source = readFileSync(new URL('../src/store/modules/permission.js', import.meta.url), 'utf8')
const conversion = source.slice(source.indexOf('const componentAliasMap ='), source.indexOf('export const usePermissionStore'))
const loader = () => Promise.resolve({})
const toRoute = new Function('viewModules', 'pageModules', 'MainLayout', 'ParentView', 'markRaw', 'console', `${conversion}\nreturn toRoute`)(
  {}, { '../../pages/HouseholdInquiryPage.vue': loader }, {}, {}, value => value, { warn() {} },
)
test('家用询价只由授权菜单节点生成，并采用冻结路径与路由名', () => {
  const route = toRoute({ menuId: 50000, path: '/price/household-inquiry', component: 'pages:HouseholdInquiryPage', meta: { title: '家用部件询价' } })
  assert.equal(route.component, loader); assert.equal(route.path, '/price/household-inquiry'); assert.equal(route.name, 'price-household-inquiry'); assert.equal(route.meta.menuId, 50000)
})
test('无授权节点不会补出家用页面，目录也不会静态补菜单', () => {
  assert.equal(toRoute(null), null)
  assert.equal(toRoute({ path: '/price', component: 'Layout', children: [] }), null)
  assert.deepEqual([].map(node => toRoute(node)), [])
})
