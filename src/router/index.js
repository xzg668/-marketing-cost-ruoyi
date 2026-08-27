import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layout/index.vue'
import CostRunDetailPage from '../pages/CostRunDetailPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import { useUserStore } from '../store/modules/user'
import { usePermissionStore } from '../store/modules/permission'
import { hasCollaborationPortalSession } from '../utils/collaborationPortal'

/**
 * 静态路由只保留三类：
 *   1. 公共页：/login、/404、/collaborate（协作者独立 token）
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
  // 技术协作者受限路由（无侧边栏，使用系统内协作令牌）
  {
    path: '/collaborate',
    component: () => import('../layout/CollaborateLayout.vue'),
    meta: { public: true },
    children: [
      {
        path: 'tasks',
        name: 'collaborate-tasks',
        component: () => import('../views/collaboration/technical/index.vue'),
        meta: { title: '技术协作任务', public: true, collaborationPortal: true },
      },
      {
        path: 'product-tasks/:taskId',
        name: 'collaborate-product-task',
        component: () => import('../pages/TechnicalCollaborationTaskPage.vue'),
        meta: { title: '技术协作任务', public: true, collaborationPortal: true },
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
        path: '/ingest/quote-requests/:oaNo/items/:itemId/costing',
        name: 'ingest-quote-product-costing',
        component: () => import('../pages/QuoteProductCostingWorkbenchPage.vue'),
        meta: { title: '单产品核算工作台', activeMenu: '/ingest/quote-requests' },
      },
      {
        path: '/collaboration/product-tasks/:taskId',
        name: 'technical-collaboration-task',
        component: () => import('../pages/TechnicalCollaborationTaskPage.vue'),
        meta: { title: '技术协作任务', activeMenu: '/collaboration/tasks' },
      },
      {
        path: '/collaboration/finance-reviews/:reviewId',
        name: 'finance-collaboration-review',
        component: () => import('../views/collaboration/finance/index.vue'),
        meta: { title: '补录审核', activeMenu: '/collaboration/finance-reviews' },
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

function isTechnicalOnlyUser(userStore) {
  return userStore.roles.some(
    (role) => String(role).toUpperCase() === 'TECHNICAL_COLLABORATOR'
  ) && !userStore.permissions.includes('ingest:quote:list')
}

function resolveLandingPath(userStore) {
  return isTechnicalOnlyUser(userStore)
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

  // 外部协作链接一旦在当前标签页建立受限会话，该标签页就只能访问协作门户。
  // 即便浏览器里残留普通用户 JWT，也不能借此跳进报价、成本或系统管理页面。
  if (hasCollaborationPortalSession() && !to.meta?.collaborationPortal) {
    return next({ path: '/collaborate/tasks', replace: true })
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
        return next({ path: resolveLandingPath(userStore), replace: true })
      }
      if (isTechnicalOnlyUser(userStore) && to.path === QUOTE_REQUEST_LIST_PATH) {
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
    return next({ path: resolveLandingPath(userStore), replace: true })
  }
  if (isTechnicalOnlyUser(userStore) && to.path === QUOTE_REQUEST_LIST_PATH) {
    return next({ path: TECHNICAL_TASK_LIST_PATH, replace: true })
  }

  next()
})

export default router
