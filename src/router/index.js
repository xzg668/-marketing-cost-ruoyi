import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layout/index.vue'
import PlaceholderPage from '../pages/PlaceholderPage.vue'
import CostRunPage from '../pages/CostRunPage.vue'
import CostRunResultPage from '../pages/CostRunResultPage.vue'
import CostRunDetailPage from '../pages/CostRunDetailPage.vue'
import OaFormListPage from '../pages/OaFormListPage.vue'
import OaFormDetailPage from '../pages/OaFormDetailPage.vue'
import PriceLinkedResultPage from '../pages/PriceLinkedResultPage.vue'
import PriceLinkedOaResultPage from '../pages/PriceLinkedOaResultPage.vue'
import PriceLinkedFormulaPage from '../pages/PriceLinkedFormulaPage.vue'
import PriceLinkedFinanceBasePage from '../pages/PriceLinkedFinanceBasePage.vue'
import PriceMaterialWeightPage from '../pages/PriceMaterialWeightPage.vue'
import BomManualImportPage from '../pages/BomManualImportPage.vue'
import BomFilterRulePage from '../pages/BomFilterRulePage.vue'
import BomManagePage from '../pages/BomManagePage.vue'
import MaterialPriceTypePage from '../pages/MaterialPriceTypePage.vue'
import MaterialMasterPage from '../pages/MaterialMasterPage.vue'
import PriceFixedPage from '../pages/PriceFixedPage.vue'
import PriceRangePage from '../pages/PriceRangePage.vue'
import PriceSettlePage from '../pages/PriceSettlePage.vue'
import AuxSubjectPage from '../pages/AuxSubjectPage.vue'
import AuxItemPage from '../pages/AuxItemPage.vue'
import QualityLossRatePage from '../pages/QualityLossRatePage.vue'
import SalaryCostPage from '../pages/SalaryCostPage.vue'
import ManufactureRatePage from '../pages/ManufactureRatePage.vue'
import ThreeExpenseRatePage from '../pages/ThreeExpenseRatePage.vue'
import ProductPropertyPage from '../pages/ProductPropertyPage.vue'
import OtherExpenseRatePage from '../pages/OtherExpenseRatePage.vue'
import DepartmentFundRatePage from '../pages/DepartmentFundRatePage.vue'
import LoginPage from '../pages/LoginPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import { menuGroups } from '../menu'
import { useUserStore } from '../store/modules/user'
import { usePermissionStore } from '../store/modules/permission'

const routeComponentMap = {
  '/cost/run': CostRunPage,
  '/cost/run/completed': CostRunPage,
  '/ingest/oa-form': OaFormListPage,
  '/price/linked/result': PriceLinkedResultPage,
  '/price/linked/oa-result': PriceLinkedOaResultPage,
  '/price/linked/formula': PriceLinkedFormulaPage,
  '/price/linked/finance-base': PriceLinkedFinanceBasePage,
  '/base/material-weight': PriceMaterialWeightPage,
  '/base/addbom': BomManualImportPage,
  '/base/bomfilter': BomFilterRulePage,
  '/base/material': BomManagePage,
  '/base/materweight': MaterialMasterPage,
  '/base/map': MaterialPriceTypePage,
  '/base/aux/subject': AuxSubjectPage,
  '/base/aux/item': AuxItemPage,
  '/price/fixed': PriceFixedPage,
  '/price/range': PriceRangePage,
  '/price/settle': PriceSettlePage,
  '/base/quantityLoss': QualityLossRatePage,
  '/base/salary': SalaryCostPage,
  '/base/manufactureRate': ManufactureRatePage,
  '/base/threeExpenseRate': ThreeExpenseRatePage,
  '/base/productProperty': ProductPropertyPage,
  '/base/other': OtherExpenseRatePage,
  '/base/fixed': DepartmentFundRatePage,
}

const childRoutes = menuGroups.flatMap((group) =>
  group.children.flatMap((item) => {
    if (item.children) {
      return item.children.map((child) => ({
        path: child.index,
        name: child.index.replace(/\//g, '-').replace(/^-/, ''),
        component: routeComponentMap[child.index] || PlaceholderPage,
        meta: {
          title: child.title,
          activeMenu: child.index,
        },
      }))
    }
    return [
      {
        path: item.index,
        name: item.index.replace(/\//g, '-').replace(/^-/, ''),
        component: routeComponentMap[item.index] || PlaceholderPage,
        meta: {
          title: item.title,
        },
      },
    ]
  })
)

/** 基础静态路由 —— 登录/404 公共，/ 下保留当前 menu.js 驱动的子路由以便过渡期业务页面可用 */
const staticRoutes = [
  {
    path: '/login',
    component: LoginPage,
    meta: { title: '登录', public: true },
  },
  {
    path: '/404',
    component: NotFoundPage,
    meta: { title: '页面不存在', public: true },
  },
  // OA 协作者受限路由（无侧边栏，独立 Token 认证）
  {
    path: '/collaborate',
    component: () => import('../layout/CollaborateLayout.vue'),
    meta: { public: true },
    children: [
      {
        path: 'bom-supplement',
        name: 'collaborate-bom',
        component: () => import('../views/collaborate/BomSupplement.vue'),
        meta: { title: 'BOM 补充数据', public: true },
      },
      {
        path: 'price-supplement',
        name: 'collaborate-price',
        component: () => import('../views/collaborate/PriceSupplement.vue'),
        meta: { title: '价格补充数据', public: true },
      },
    ],
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/cost/run',
    children: [
      ...childRoutes,
      {
        path: '/cost/run/:oaNo',
        name: 'cost-run-result',
        component: CostRunResultPage,
        meta: { title: '成本试算结果', activeMenu: '/cost/run' },
      },
      {
        path: '/cost/run/:oaNo/detail',
        name: 'cost-run-detail',
        component: CostRunDetailPage,
        meta: { title: '产品成本计算一览表', activeMenu: '/cost/run' },
      },
      {
        path: '/ingest/oa-form/:id',
        name: 'ingest-oa-detail',
        component: OaFormDetailPage,
        meta: { title: 'OA表单详情', activeMenu: '/ingest/oa-form' },
      },
      {
        path: '/price/linked',
        redirect: '/price/linked/result',
      },
      {
        path: '/system/dict/data',
        name: 'system-dict-data',
        component: () => import('../views/system/dict/data.vue'),
        meta: { title: '字典数据', activeMenu: '/system/dict' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes,
})

const CATCH_ALL_NAME = 'dyn-catch-all'

/**
 * 将 permissionStore.generateRoutes() 返回的顶层路由逐一 addRoute。
 * - 顶层节点 path 需绝对化（后端通常返回 "system" 这种相对形式）
 * - 注册失败只 warn 不抛；由 static fallback 兜底
 */
function registerDynamicRoutes(routes, permissionStore) {
  routes.forEach((route) => {
    if (!route || !route.component) return
    const normalized = {
      ...route,
      path: route.path.startsWith('/') ? route.path : `/${route.path}`,
    }
    try {
      router.addRoute(normalized)
      if (normalized.name) permissionStore.markAdded(normalized.name)
    } catch (err) {
      console.warn('[router] 动态路由注册失败', normalized.path, err)
    }
  })
  if (!router.hasRoute(CATCH_ALL_NAME)) {
    router.addRoute({
      path: '/:pathMatch(.*)*',
      name: CATCH_ALL_NAME,
      redirect: '/404',
    })
  }
}

/** 清理所有动态注册的路由 —— 登出时调用 */
export function resetDynamicRoutes() {
  const permissionStore = usePermissionStore()
  permissionStore.addedRouteNames.forEach((name) => {
    if (router.hasRoute(name)) router.removeRoute(name)
  })
  if (router.hasRoute(CATCH_ALL_NAME)) router.removeRoute(CATCH_ALL_NAME)
  permissionStore.resetRoutes()
}

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const token = userStore.token || localStorage.getItem('token')
  const isPublic = to.meta?.public

  if (isPublic) {
    if (to.path === '/login' && token) return next('/')
    return next()
  }

  if (!token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (!permissionStore.loaded) {
    try {
      await userStore.getInfo()
      const dynRoutes = await permissionStore.generateRoutes()
      registerDynamicRoutes(dynRoutes, permissionStore)
      // replace:true 避免历史栈出现加载跳板
      return next({ ...to, replace: true })
    } catch (err) {
      console.error('[router] 动态路由初始化失败', err)
      userStore.logout()
      resetDynamicRoutes()
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }
  }

  next()
})

export default router
