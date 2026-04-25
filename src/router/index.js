import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layout/index.vue'
import CostRunResultPage from '../pages/CostRunResultPage.vue'
import CostRunDetailPage from '../pages/CostRunDetailPage.vue'
import OaFormDetailPage from '../pages/OaFormDetailPage.vue'
import BomPipelineAdvancedPage from '../pages/BomPipelineAdvancedPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import { useUserStore } from '../store/modules/user'
import { usePermissionStore } from '../store/modules/permission'

/**
 * 静态路由只保留三类：
 *   1. 公共页：/login、/404、/collaborate（协作者独立 token）
 *   2. 业务详情页（带路由参数，业务代码硬编码跳转依赖）：
 *      - /cost/run/:oaNo、/cost/run/:oaNo/detail
 *      - /ingest/oa-form/:id
 *   3. 后台工具页：/admin/bom-pipeline、/system/dict/data
 *
 * 所有业务列表页（/cost/run、/ingest/oa-form、/base/* 等）改由
 * permissionStore.generateRoutes() 根据后端 sys_menu 返回的 /auth/routers 动态 addRoute 注册。
 */
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
        // 老三阶段 BOM 流水线（隐藏路由，不挂菜单）——面向 IT / 测试单独重跑某阶段
        path: '/admin/bom-pipeline',
        name: 'admin-bom-pipeline',
        component: BomPipelineAdvancedPage,
        meta: { title: 'BOM 流水线（高级）', activeMenu: '/base/u9Bom' },
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
 * - 注册失败只 warn 不抛；permissionStore 内部已有 Placeholder 兜底
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
