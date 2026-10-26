import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'
import { fetchRouters } from '../../api/auth'
import MainLayout from '../../layout/index.vue'
import ParentView from '../../layout/components/ParentView.vue'

const viewModules = import.meta.glob('../../views/**/*.vue')
const pageModules = import.meta.glob('../../pages/**/*.vue')

/**
 * 后端 sys_menu.component → 前端组件路径的显式别名。
 *
 * 仅在后端 component 写法跟前端文件名对不上时才需要加一条。优先约定：
 *   - 后端 component 写 "xxx/yyy/index"  → 前端在 src/views/xxx/yyy/index.vue 放组件
 *   - 后端 component 写 "XxxPage"        → 前端在 src/pages/XxxPage.vue 放组件
 * 只要任一约定满足，`loadView` 会自动解析，不需要在这里加映射。
 *
 * 支持前缀：
 *   - "views:foo/bar"  → src/views/foo/bar.vue
 *   - "pages:FooPage"  → src/pages/FooPage.vue
 *   - 无前缀           → 先找 views/，找不到再找 pages/
 */
const componentAliasMap = {
  'cost/price-prepare/index':       'views:cost/price-prepare/index',
  'cost-trial/cost-detail/index':   'pages:CostRunDetailPage',
  // 基础数据
  'base-data/material/index':        'views:base/materweight/index',
  'base-data/material-price/index':  'views:base/map/index',
  'base-data/product-property/index':'views:base/productProperty/index',
  'base-data/bom/index':             'pages:BomManagePage',
  // 费率管理
  'rate/manufacture-rate/index':     'views:base/manufactureRate/index',
  'rate/three-expense-rate/index':   'views:base/threeExpenseRate/index',
  'rate/quality-loss-rate/index':    'views:base/quantityLoss/index',
  'rate/department-fund-rate/index': 'views:base/fixed/index',
  'rate/other-expense-rate/index':   'views:base/other/index',
  // 价格管理
  'price/price-variable/index':      'pages:PriceVariableAdminPage',
  'price/price-fixed/index':         'views:price/fixed/index',
  'price/price-linked/index':        'views:price/linked/result/index',
  'price/price-range/index':         'views:price/range/index',
}

function loadView(component) {
  if (!component) return null
  const mapped = componentAliasMap[component] || component
  if (mapped.startsWith('views:')) {
    return viewModules[`../../views/${mapped.slice(6)}.vue`] || null
  }
  if (mapped.startsWith('pages:')) {
    return pageModules[`../../pages/${mapped.slice(6)}.vue`] || null
  }
  return (
    viewModules[`../../views/${mapped}.vue`] ||
    pageModules[`../../pages/${mapped}.vue`] ||
    null
  )
}

/**
 * 将后端 RouterVO 树节点转成 Vue Router 路由对象。
 * - 顶层目录（isTop=true）→ MainLayout；嵌套目录 → ParentView（避免双层 Layout）
 * - 叶子组件 → 从 src/views/{component}.vue 或 src/pages/{component}.vue 动态加载
 * - 页面文件已删除或配置无效的菜单不注册；空目录一并移除。
 * - 只使用后端授权菜单，不补全菜单，也不展示示例数据。
 * - route.name 默认使用 dyn-{menuId}；已授权家用询价节点采用冻结业务名，仍随父路由清理
 */
function toRoute(node, isTop = true) {
  if (!node) return null
  const children = Array.isArray(node.children)
    ? node.children.map((child) => toRoute(child, false)).filter(Boolean)
    : []
  const isLayout = !node.component || node.component === 'Layout'

  let component = null
  if (isLayout) {
    if (!children.length) return null
    component = isTop ? MainLayout : ParentView
  } else {
    const loader = loadView(node.component)
    if (loader) {
      component = loader
    } else if (children.length) {
      component = isTop ? MainLayout : ParentView
    } else {
      console.warn(
        `[permission] 无法解析菜单组件: "${node.component}"（menuId=${node.menuId}, title="${node.meta?.title || ''}"）。` +
          ' 已跳过该菜单，请核对菜单配置与页面文件。'
      )
      return null
    }
  }

  const route = {
    path: node.path || '',
    component: typeof component === 'object' ? markRaw(component) : component,
    meta: node.meta ? { ...node.meta } : {},
  }
  if (node.menuId != null) {
    route.name = node.component === 'pages:HouseholdInquiryPage' && node.path === '/price/household-inquiry'
      ? 'price-household-inquiry'
      : `dyn-${node.menuId}`
    route.meta.menuId = node.menuId
  }

  if (children.length) {
    route.children = children
  }
  return route
}

export const usePermissionStore = defineStore('permission', () => {
  /** 后端授权且组件可用的菜单，供侧边栏与路由共同使用。 */
  const routes = ref([])
  /** 已 router.addRoute 注册的顶级 dyn 路由名列表 —— 登出时用于 removeRoute */
  const addedRouteNames = ref([])
  /** 是否已完成一次 getInfo+generateRoutes —— beforeEach 判断是否需要加载 */
  const loaded = ref(false)

  async function generateRoutes() {
    const tree = (await fetchRouters()) || []
    // 显式包一层，避免 map 把 index 当作 toRoute 的 isTop 参数传进去 ——
    // 那样 tree[0] 的 isTop=0（falsy）会被误判为非顶级，拿不到 MainLayout，
    // 导致第一组菜单点进去没有侧边栏 / 导航栏。
    routes.value = tree.map((node) => toRoute(node)).filter(Boolean)
    loaded.value = true
    return routes.value
  }

  function markAdded(name) {
    if (name && !addedRouteNames.value.includes(name)) {
      addedRouteNames.value.push(name)
    }
  }

  function resetRoutes() {
    routes.value = []
    addedRouteNames.value = []
    loaded.value = false
  }

  return {
    routes,
    addedRouteNames,
    loaded,
    generateRoutes,
    markAdded,
    resetRoutes,
  }
})
