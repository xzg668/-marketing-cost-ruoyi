import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layout/index.vue'
import CostRunDetailPage from '../pages/CostRunDetailPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import { useUserStore } from '../store/modules/user'
import { usePermissionStore } from '../store/modules/permission'

/**
 * 静态路由只保留三类：
 *   1. 公共页：/login、/404、技术资料一次性短票入口
 *   2. 业务详情页（带路由参数，业务代码硬编码跳转依赖）：
 *      - /ingest/quote-requests/:oaNo/items/:itemId/costing/result
 *   3. 后台工具页：/system/dict/data
 *
 * 所有业务列表页（/ingest/quote-requests、/base/* 等）改由
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
  {
    path: '/technical-data-access',
    name: 'technical-data-ticket-entry',
    component: () => import('../pages/TechnicalDataAccessTicketPage.vue'),
    meta: { title: '技术资料待办验证', public: true },
  },
  {
    path: '/technical-data-access/tasks/:taskId',
    component: () => import('../layout/TechnicalDataEntryLayout.vue'),
    meta: { title: '补录工作台', public: true, technicalDataEntry: true, technicalDataShortSession: true },
    children: [{ path: '', name: 'technical-data-access-workbench', component: () => import('../views/technical-data/tasks/index.vue') }],
  },
  {
    path: '/collaboration/technical-data',
    component: () => import('../layout/TechnicalDataEntryLayout.vue'),
    meta: { public: true, technicalDataEntry: true },
    children: [
      {
        path: 'forms/:formId',
        name: 'technical-data-document-workbench',
        component: () => import('../views/technical-data/tasks/index.vue'),
        meta: { title: '补录工作台' },
      },
      {
        path: 'tasks/:taskId',
        name: 'technical-data-workbench',
        component: () => import('../views/technical-data/tasks/index.vue'),
        meta: { title: '补录工作台' },
      },
    ],
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '/ingest/quote-requests/:oaNo/items/:itemId/costing/result',
        name: 'cost-run-detail',
        component: CostRunDetailPage,
        meta: { title: '产品成本计算一览表', activeMenu: '/ingest/quote-requests' },
      },
      {
        path: '/ingest/quote-requests/import',
        name: 'ingest-quote-request-import',
        component: () => import('../views/ingest/quote-requests/import/index.vue'),
        meta: { title: '报价单导入', activeMenu: '/ingest/quote-requests/import' },
      },
      {
        path: '/ingest/quote-requests/:oaNo',
        name: 'ingest-quote-request-detail',
        component: () => import('../pages/QuoteRequestDetailPage.vue'),
        meta: { title: '报价单详情', activeMenu: '/ingest/quote-requests' },
      },
      {
        path: '/ingest/quote-requests/:oaNo/items/:itemId/electronic-drawing/:taskId/material-resolution',
        name: 'electronic-drawing-material-resolution',
        component: () => import('../pages/ElectronicDrawingMaterialResolutionPage.vue'),
        meta: { title: '选择 U9 料号', activeMenu: '/ingest/quote-requests' },
      },
      {
        path: '/ingest/quote-requests/:oaNo/items/:itemId/costing',
        name: 'ingest-quote-product-costing',
        component: () => import('../pages/QuoteProductCostingWorkbenchPage.vue'),
        meta: { title: '单产品核算工作台', activeMenu: '/ingest/quote-requests' },
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
const QUOTE_REQUEST_LIST_PATH = '/ingest/quote-requests'
const TECHNICAL_TASK_LIST_PATH = '/collaboration/tasks'

function hasWorkbenchWithoutQuoteList() {
  const paths = new Set(router.getRoutes().map(route => route.path))
  return paths.has(TECHNICAL_TASK_LIST_PATH) && !paths.has(QUOTE_REQUEST_LIST_PATH)
}

function resolveLandingPath() {
  return hasWorkbenchWithoutQuoteList()
    ? TECHNICAL_TASK_LIST_PATH
    : QUOTE_REQUEST_LIST_PATH
}

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

  if (to.meta?.technicalDataShortSession) {
    const shortToken = sessionStorage.getItem('technicalDataAccessToken')
    const scopedTaskId = sessionStorage.getItem('technicalDataAccessTaskId')
    if (!shortToken || String(to.params.taskId) !== scopedTaskId) {
      return next({ name: 'technical-data-ticket-entry', query: { taskId: to.params.taskId }, replace: true })
    }
  }

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
      if (to.path === '/') {
        return next({ path: resolveLandingPath(), replace: true })
      }
      if (hasWorkbenchWithoutQuoteList() && to.path === QUOTE_REQUEST_LIST_PATH) {
        return next({ path: TECHNICAL_TASK_LIST_PATH, replace: true })
      }
      // replace:true 避免历史栈出现加载跳板
      return next({ ...to, replace: true })
    } catch (err) {
      console.error('[router] 动态路由初始化失败', err)
      userStore.logout()
      resetDynamicRoutes()
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }
  }

  if (to.path === '/') {
    return next({ path: resolveLandingPath(), replace: true })
  }
  if (hasWorkbenchWithoutQuoteList() && to.path === QUOTE_REQUEST_LIST_PATH) {
    return next({ path: TECHNICAL_TASK_LIST_PATH, replace: true })
  }

  next()
})

export default router
