import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchRouters } from '../../api/auth'
import MainLayout from '../../layout/index.vue'
import ParentView from '../../layout/components/ParentView.vue'
import PlaceholderPage from '../../pages/PlaceholderPage.vue'

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
  // 成本试算
  'cost-trial/oa-form/index':       'pages:OaFormListPage',
  'cost-trial/trial-run/index':     'pages:CostRunPage',
  'cost-trial/trial-result/index':  'pages:CostRunResultPage',
  'cost-trial/cost-detail/index':   'pages:CostRunDetailPage',
  // 基础数据
  'base-data/material/index':        'views:base/materweight/index',
  'base-data/material-price/index':  'views:base/map/index',
  'base-data/product-property/index':'views:base/productProperty/index',
  'base-data/bom/index':             'pages:BomManagePage',
  'base-data/salary-cost/index':     'views:base/salary/index',
  // 费率管理
  'rate/manufacture-rate/index':     'views:base/manufactureRate/index',
  'rate/three-expense-rate/index':   'views:base/threeExpenseRate/index',
  'rate/quality-loss-rate/index':    'views:base/quantityLoss/index',
  'rate/department-fund-rate/index': 'views:base/fixed/index',
  'rate/other-expense-rate/index':   'views:base/other/index',
  'rate/aux-rate/index':             'views:base/aux/subject/index',
  'rate/finance-base-price/index':   'pages:PriceLinkedFinanceBasePage',
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
 * - 加载失败的叶子节点 → 降级为 PlaceholderPage，同时在控制台 warn
 *   （绝不返回 null 丢菜单，避免触发全量 fallback 把无权限菜单也展示给用户）
 * - route.name 统一用 dyn-{menuId} 避免与静态路由冲突、便于 logout 清理
 */
function toRoute(node, isTop = true) {
  if (!node) return null
  const hasChildrenRaw = Array.isArray(node.children) && node.children.length > 0
  const isLayout = !node.component || node.component === 'Layout'

  let component = null
  if (isLayout) {
    component = isTop ? MainLayout : ParentView
  } else {
    const loader = loadView(node.component)
    if (loader) {
      component = loader
    } else if (hasChildrenRaw) {
      component = isTop ? MainLayout : ParentView
    } else {
      console.warn(
        `[permission] 无法解析菜单组件: "${node.component}"（menuId=${node.menuId}, title="${node.meta?.title || ''}"）。` +
          ` 请在 src/views/${node.component}.vue 或 src/pages/ 下放置对应组件，或在 permission.js 的 componentAliasMap 中添加映射。暂以占位页兜底。`
      )
      component = PlaceholderPage
    }
  }

  const route = {
    path: node.path || '',
    component,
    meta: node.meta ? { ...node.meta } : {},
  }
  if (node.menuId != null) {
    route.name = `dyn-${node.menuId}`
    route.meta.menuId = node.menuId
  }

  if (hasChildrenRaw) {
    const kids = node.children.map((c) => toRoute(c, false)).filter(Boolean)
    if (kids.length) {
      route.children = kids
    } else if (isLayout) {
      return null
    }
  }
  return route
}

export const usePermissionStore = defineStore('permission', () => {
  /** 后端返回的全量菜单（含 component 未解析的） —— 供侧边栏渲染（T17） */
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
