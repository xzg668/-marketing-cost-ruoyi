import { useUserStore } from '../store/modules/user'

const ALL_PERMISSION = '*:*:*'

/**
 * v-hasPermi="['system:user:add']"
 * - 需求权限列表里只要有一条命中 userStore.permissions 即显示
 * - 持有 *:*:* 视为超级权限，始终显示
 * - 无权限：从 DOM 中移除元素（而非 display:none，防止占位 & 防止结构泄露）
 */
export default {
  mounted(el, binding) {
    const { value } = binding
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(
        "v-hasPermi 需要传入非空数组，例如 v-hasPermi=\"['system:user:add']\""
      )
    }
    const userStore = useUserStore()
    const permissions = userStore.permissions || []
    const allowed =
      permissions.includes(ALL_PERMISSION) ||
      value.some((perm) => permissions.includes(perm))
    if (!allowed && el.parentNode) {
      el.parentNode.removeChild(el)
    }
  },
}
