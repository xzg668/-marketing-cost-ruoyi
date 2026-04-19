<template>
  <div class="app-container">
    <div class="table-toolbar">
      <el-button v-hasPermi="['system:menu:add']" type="primary" @click="handleAdd(null)">新增菜单</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="menuTree"
      row-key="menuId"
      border
      :tree-props="{ children: 'children' }"
      default-expand-all
    >
      <el-table-column prop="menuName" label="菜单名称" min-width="180" />
      <el-table-column prop="icon" label="图标" width="80" />
      <el-table-column prop="orderNum" label="排序" width="70" />
      <el-table-column prop="perms" label="权限标识" min-width="180" />
      <el-table-column prop="component" label="组件路径" min-width="180" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.menuType === 'M'" size="small">目录</el-tag>
          <el-tag v-else-if="row.menuType === 'C'" type="success" size="small">菜单</el-tag>
          <el-tag v-else-if="row.menuType === 'F'" type="warning" size="small">按钮</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="业务单元" width="100">
        <template #default="{ row }">
          <span v-if="!row.businessUnitType">通用</span>
          <el-tag v-else size="small">{{ row.businessUnitType === 'COMMERCIAL' ? '商用' : '家用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.menuType !== 'F'" v-hasPermi="['system:menu:add']" link type="primary" @click="handleAdd(row)">新增</el-button>
          <el-button v-hasPermi="['system:menu:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-hasPermi="['system:menu:remove']" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="上级菜单">
          <el-tree-select
            v-model="form.parentId"
            :data="parentTreeData"
            :props="{ label: 'label', value: 'id', children: 'children' }"
            placeholder="顶级菜单"
            check-strictly
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="菜单类型" prop="menuType">
          <el-radio-group v-model="form.menuType">
            <el-radio value="M">目录</el-radio>
            <el-radio value="C">菜单</el-radio>
            <el-radio value="F">按钮</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="菜单名称" prop="menuName">
          <el-input v-model="form.menuName" placeholder="请输入" />
        </el-form-item>
        <el-form-item v-if="form.menuType !== 'F'" label="路由路径">
          <el-input v-model="form.path" placeholder="如 user" />
        </el-form-item>
        <el-form-item v-if="form.menuType === 'C'" label="组件路径">
          <el-input v-model="form.component" placeholder="如 system/user/index" />
        </el-form-item>
        <el-form-item label="权限标识">
          <el-input v-model="form.perms" placeholder="如 system:user:list" />
        </el-form-item>
        <el-form-item v-if="form.menuType !== 'F'" label="图标">
          <el-input v-model="form.icon" placeholder="Element Plus 图标名" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-select v-model="form.businessUnitType" placeholder="通用（不限）" clearable style="width: 100%">
            <el-option label="通用" :value="null" />
            <el-option label="商用部品" value="COMMERCIAL" />
            <el-option label="家用部品" value="HOUSEHOLD" />
          </el-select>
        </el-form-item>
        <el-form-item label="显示状态">
          <el-radio-group v-model="form.visible">
            <el-radio value="0">显示</el-radio>
            <el-radio value="1">隐藏</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="菜单状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listMenus, createMenu, updateMenu, deleteMenu, getMenuTreeSelect } from '../../../api/system/menu'

const loading = ref(false)
const menuList = ref([])
const parentTreeData = ref([])

const menuTree = computed(() => buildTree(menuList.value))

function buildTree(list) {
  const map = new Map()
  const roots = []
  list.forEach((m) => map.set(m.menuId, { ...m, children: [] }))
  list.forEach((m) => {
    const node = map.get(m.menuId)
    const pid = m.parentId
    if (!pid || pid === 0 || !map.has(pid)) {
      roots.push(node)
    } else {
      map.get(pid).children.push(node)
    }
  })
  return roots
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitLoading = ref(false)
const formRef = ref()

const form = reactive({
  menuId: null,
  menuName: '',
  parentId: null,
  menuType: 'M',
  orderNum: 0,
  path: '',
  component: '',
  perms: '',
  icon: '',
  visible: '0',
  status: '0',
  businessUnitType: null,
})

const formRules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  menuType: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
}

async function loadMenus() {
  loading.value = true
  try {
    menuList.value = (await listMenus()) || []
    parentTreeData.value = await getMenuTreeSelect()
  } catch (err) {
    ElMessage.error(err.message || '加载菜单失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.menuId = null
  form.menuName = ''
  form.parentId = null
  form.menuType = 'M'
  form.orderNum = 0
  form.path = ''
  form.component = ''
  form.perms = ''
  form.icon = ''
  form.visible = '0'
  form.status = '0'
  form.businessUnitType = null
}

function handleAdd(row) {
  resetForm()
  if (row) {
    form.parentId = row.menuId
  }
  dialogTitle.value = '新增菜单'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  form.menuId = row.menuId
  form.menuName = row.menuName || ''
  form.parentId = row.parentId || null
  form.menuType = row.menuType || 'M'
  form.orderNum = row.orderNum || 0
  form.path = row.path || ''
  form.component = row.component || ''
  form.perms = row.perms || ''
  form.icon = row.icon || ''
  form.visible = row.visible || '0'
  form.status = row.status || '0'
  form.businessUnitType = row.businessUnitType || null
  dialogTitle.value = '编辑菜单'
  dialogVisible.value = true
}

async function handleSubmit() {
  if (formRef.value) {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
  }
  submitLoading.value = true
  try {
    const data = {
      menuName: form.menuName,
      parentId: form.parentId || 0,
      menuType: form.menuType,
      orderNum: form.orderNum,
      path: form.path,
      component: form.menuType === 'F' ? null : form.component,
      perms: form.perms,
      icon: form.menuType === 'F' ? null : form.icon,
      visible: form.visible,
      status: form.status,
      businessUnitType: form.businessUnitType || null,
    }
    if (form.menuId) {
      await updateMenu(form.menuId, data)
      ElMessage.success('修改成功')
    } else {
      await createMenu(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadMenus()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除菜单「${row.menuName}」？`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deleteMenu(row.menuId)
    ElMessage.success('删除成功')
    loadMenus()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

onMounted(() => loadMenus())
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.table-toolbar {
  margin-bottom: 12px;
}
</style>
