/**
 * 将静态 menuGroups 适配为 permission store 路由树的等价结构。
 * 过渡期（T17 → T18 完成前）：permissionStore.routes 可能为空，需要 fallback 到静态菜单。
 */
export function menuGroupsToRoutes(menuGroups) {
  if (!Array.isArray(menuGroups)) return []
  return menuGroups.map((group) => adaptNode(group)).filter(Boolean)
}

function adaptNode(node) {
  if (!node) return null
  const children = Array.isArray(node.children)
    ? node.children.map(adaptNode).filter(Boolean)
    : null
  return {
    path: node.index,
    meta: { title: node.title },
    ...(children && children.length ? { children } : {}),
  }
}
