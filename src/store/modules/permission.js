import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchRouters } from '../../api/auth'
import MainLayout from '../../layout/index.vue'
import ParentView from '../../layout/components/ParentView.vue'

const viewModules = import.meta.glob('../../views/**/*.vue')

function loadView(component) {
  if (!component) return null
  const key = `../../views/${component}.vue`
  return viewModules[key] || null
}

/**
 * 将后端 RouterVO 树节点转成 Vue Router 路由对象。
 * - 顶层目录（isTop=true）→ MainLayout；嵌套目录 → ParentView（避免双层 Layout）
 * - 其他 → 从 src/views/{component}.vue 动态加载；加载失败时返回 null（调用方 filter）
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
    if (!loader) {
      if (!hasChildrenRaw) return null
      component = isTop ? MainLayout : ParentView
    } else {
      component = loader
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
    routes.value = tree.map(toRoute).filter(Boolean)
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
