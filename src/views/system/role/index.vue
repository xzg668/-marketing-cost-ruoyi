<template>
  <div class="app-container">
    <!-- 操作栏 -->
    <div class="table-toolbar">
      <el-button v-hasPermi="['system:role:add']" type="primary" @click="handleAdd">新增角色</el-button>
    </div>

    <!-- 表格 -->
    <el-table v-loading="loading" :data="roleList" border stripe>
      <el-table-column prop="roleId" label="ID" width="70" />
      <el-table-column prop="roleName" label="角色名称" width="150" />
      <el-table-column prop="roleKey" label="角色编码" width="150" />
      <el-table-column prop="roleSort" label="排序" width="80" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="170" />
      <el-table-column prop="remark" label="备注" min-width="150" />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button v-hasPermi="['system:role:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-hasPermi="['system:role:edit']" link type="primary" @click="handleAssignMenus(row)">分配权限</el-button>
          <el-button v-hasPermi="['system:role:remove']" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="form.roleName" placeholder="请输入" />
        </el-form-item>
        <el-form-item label="角色编码" prop="roleKey">
          <el-input v-model="form.roleKey" placeholder="如 ADMIN / BU_STAFF" :disabled="!!form.roleId" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.roleSort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 分配菜单权限弹窗 -->
    <el-dialog v-model="menuDialogVisible" title="分配菜单权限" width="480px" destroy-on-close>
      <el-tree
        ref="menuTreeRef"
        :data="menuTree"
        show-checkbox
        node-key="id"
        :default-checked-keys="checkedMenuIds"
        :props="{ label: 'label', children: 'children' }"
        check-strictly
      />
      <template #footer>
        <el-button @click="menuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="menuSubmitLoading" @click="handleMenuSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listRoles, createRole, updateRole, deleteRole,
  assignMenus, getRoleMenuIds, getMenuTreeSelect,
} from '../../../api/system/role'

const loading = ref(false)
const roleList = ref([])

const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitLoading = ref(false)
const formRef = ref()

const form = reactive({
  roleId: null,
  roleName: '',
  roleKey: '',
  roleSort: 0,
  status: '0',
  remark: '',
})

const formRules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleKey: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
}

const menuDialogVisible = ref(false)
const menuSubmitLoading = ref(false)
const menuTree = ref([])
const checkedMenuIds = ref([])
const menuTreeRef = ref()
let currentMenuRoleId = null

async function loadRoles() {
  loading.value = true
  try {
    roleList.value = (await listRoles()) || []
  } catch (err) {
    ElMessage.error(err.message || '加载角色列表失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.roleId = null
  form.roleName = ''
  form.roleKey = ''
  form.roleSort = 0
  form.status = '0'
  form.remark = ''
}

function handleAdd() {
  resetForm()
  dialogTitle.value = '新增角色'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  form.roleId = row.roleId
  form.roleName = row.roleName
  form.roleKey = row.roleKey
  form.roleSort = row.roleSort || 0
  form.status = row.status || '0'
  form.remark = row.remark || ''
  dialogTitle.value = '编辑角色'
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
      roleName: form.roleName,
      roleKey: form.roleKey,
      roleSort: form.roleSort,
      status: form.status,
      remark: form.remark,
    }
    if (form.roleId) {
      await updateRole(form.roleId, data)
      ElMessage.success('修改成功')
    } else {
      await createRole(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadRoles()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除角色「${row.roleName}」？`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deleteRole(row.roleId)
    ElMessage.success('删除成功')
    loadRoles()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

async function handleAssignMenus(row) {
  currentMenuRoleId = row.roleId
  try {
    const [tree, ids] = await Promise.all([
      getMenuTreeSelect(),
      getRoleMenuIds(row.roleId),
    ])
    menuTree.value = tree || []
    checkedMenuIds.value = ids || []
  } catch (err) {
    ElMessage.error(err.message || '加载菜单树失败')
    return
  }
  menuDialogVisible.value = true
  await nextTick()
  if (menuTreeRef.value) {
    menuTreeRef.value.setCheckedKeys(checkedMenuIds.value)
  }
}

async function handleMenuSubmit() {
  menuSubmitLoading.value = true
  try {
    const checkedKeys = menuTreeRef.value.getCheckedKeys()
    const halfCheckedKeys = menuTreeRef.value.getHalfCheckedKeys()
    const allIds = [...checkedKeys, ...halfCheckedKeys]
    await assignMenus(currentMenuRoleId, { menuIds: allIds })
    ElMessage.success('菜单权限分配成功')
    menuDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.message || '分配失败')
  } finally {
    menuSubmitLoading.value = false
  }
}

onMounted(() => loadRoles())
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.table-toolbar {
  margin-bottom: 12px;
}
</style>
