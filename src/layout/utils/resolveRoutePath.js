/**
 * 解析菜单的完整 path —— 子路由可能是相对路径（如 "user"），需要和父路由拼接。
 * - 如果 path 以 / 开头 → 视为绝对路径直接返回
 * - 如果是外链（http/https） → 原样返回
 * - 否则 → 拼接 parent 并合并多余的 /
 */
export function resolveRoutePath(parentPath, path) {
  if (!path) return parentPath || '/'
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/')) return path
  const base = parentPath && parentPath !== '/' ? parentPath.replace(/\/$/, '') : ''
  return `${base}/${path}`.replace(/\/{2,}/g, '/')
}
