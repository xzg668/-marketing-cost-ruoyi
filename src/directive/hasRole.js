import { useUserStore } from '../store/modules/user'

const SUPER_ADMIN = 'admin'

/**
 * v-hasRole="['ADMIN']"
 * - 大小写不敏感比对（后端 role_key 为大写 ADMIN / BU_STAFF 等）
 * - 持有 admin 角色视为超级管理员，始终显示
 * - 无权限：从 DOM 中移除元素
 */
export default {
  mounted(el, binding) {
    const { value } = binding
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(
        "v-hasRole 需要传入非空数组，例如 v-hasRole=\"['ADMIN']\""
      )
    }
    const userStore = useUserStore()
    const roles = (userStore.roles || []).map((r) => String(r).toLowerCase())
    const want = value.map((r) => String(r).toLowerCase())
    const allowed =
      roles.includes(SUPER_ADMIN) || want.some((r) => roles.includes(r))
    if (!allowed && el.parentNode) {
      el.parentNode.removeChild(el)
    }
  },
}
