<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-form :inline="true" :model="queryParams" class="search-form">
      <el-form-item label="用户名">
        <el-input v-model="queryParams.userName" placeholder="请输入" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="queryParams.phone" placeholder="请输入" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="正常" value="0" />
          <el-option label="停用" value="1" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleQuery">搜索</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作栏 -->
    <div class="table-toolbar">
      <el-button v-hasPermi="['system:user:add']" type="primary" @click="handleAdd">新增用户</el-button>
    </div>

    <!-- 表格 -->
    <el-table v-loading="loading" :data="userList" border stripe>
      <el-table-column prop="userId" label="ID" width="70" />
      <el-table-column prop="userName" label="用户名" width="120" />
      <el-table-column prop="nickName" label="昵称" width="120" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="businessUnitType" label="业务单元" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.businessUnitType" size="small">
            {{ row.businessUnitType === 'COMMERCIAL' ? '商用' : row.businessUnitType === 'HOUSEHOLD' ? '家用' : row.businessUnitType }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r.roleId" size="small" class="role-tag">{{ r.roleName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="170" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button v-hasPermi="['system:user:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-hasPermi="['system:user:edit']" link type="primary" @click="handleAssignRoles(row)">分配角色</el-button>
          <el-button v-hasPermi="['system:user:edit']" link type="warning" @click="handleResetPwd(row)">重置密码</el-button>
          <el-button v-hasPermi="['system:user:remove']" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-if="total > 0"
      class="pagination"
      :current-page="queryParams.page"
      :page-size="queryParams.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @current-change="(val) => { queryParams.page = val; loadUsers() }"
      @size-change="(val) => { queryParams.pageSize = val; queryParams.page = 1; loadUsers() }"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item v-if="!form.userId" label="用户名" prop="userName">
          <el-input v-model="form.userName" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item v-if="!form.userId" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="昵称" prop="nickName">
          <el-input v-model="form.nickName" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="form.sex" placeholder="请选择" clearable style="width: 100%">
            <el-option label="男" value="1" />
            <el-option label="女" value="2" />
            <el-option label="未知" value="0" />
          </el-select>
        </el-form-item>
        <!-- 部门：使用 tree-select，数据来自 /system/dept/tree-select -->
        <el-form-item label="部门">
          <el-tree-select
            v-model="form.deptId"
            :data="deptTree"
            :props="{ label: 'label', value: 'id', children: 'children' }"
            node-key="id"
            placeholder="请选择部门"
            check-strictly
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <!-- 岗位：多选 select，数据来自 /system/post/all -->
        <el-form-item label="岗位">
          <el-select
            v-model="form.postIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择岗位"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="p in postOptions"
              :key="p.postId"
              :label="p.postName"
              :value="p.postId"
            />
          </el-select>
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

    <!-- 分配角色弹窗 -->
    <el-dialog v-model="roleDialogVisible" title="分配角色" width="420px" destroy-on-close>
      <el-checkbox-group v-model="selectedRoleIds">
        <el-checkbox
          v-for="role in allRoles"
          :key="role.roleId"
          :value="role.roleId"
          :label="role.roleName + ' (' + role.roleKey + ')'"
        />
      </el-checkbox-group>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleSubmitLoading" @click="handleRoleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listUsers, createUser, updateUser, deleteUser,
  resetPassword, assignRoles, listRoles,
} from '../../../api/system/user'
// T04：新增用户表单需要部门树 + 岗位多选的下拉数据源
import { getDeptTreeSelect } from '../../../api/system/dept'
import { listAllPosts } from '../../../api/system/post'

const loading = ref(false)
const userList = ref([])
const total = ref(0)
const queryParams = reactive({
  userName: '',
  phone: '',
  status: '',
  page: 1,
  pageSize: 20,
})

const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitLoading = ref(false)
const formRef = ref()

const form = reactive({
  userId: null,
  userName: '',
  password: '',
  nickName: '',
  phone: '',
  sex: '',
  // 部门 ID（tree-select 绑定的单值）
  deptId: null,
  // 岗位 ID 列表（多选）
  postIds: [],
  status: '0',
  remark: '',
})

// 部门树（供 el-tree-select 使用），岗位选项列表
const deptTree = ref([])
const postOptions = ref([])
// 是否已加载过字典数据，避免每次打开弹窗都拉
const optionsLoaded = ref(false)

const formRules = {
  userName: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const roleDialogVisible = ref(false)
const roleSubmitLoading = ref(false)
const selectedRoleIds = ref([])
const allRoles = ref([])
let currentRoleUserId = null

async function loadUsers() {
  loading.value = true
  try {
    const data = await listUsers(queryParams)
    userList.value = data.rows || []
    total.value = data.total || 0
  } catch (err) {
    ElMessage.error(err.message || '加载用户列表失败')
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  queryParams.page = 1
  loadUsers()
}

function resetQuery() {
  queryParams.userName = ''
  queryParams.phone = ''
  queryParams.status = ''
  handleQuery()
}

function resetForm() {
  form.userId = null
  form.userName = ''
  form.password = ''
  form.nickName = ''
  form.phone = ''
  form.sex = ''
  form.deptId = null
  form.postIds = []
  form.status = '0'
  form.remark = ''
}

// 懒加载部门/岗位下拉；失败只提示不阻塞表单
async function ensureOptions() {
  if (optionsLoaded.value) return
  try {
    const [tree, posts] = await Promise.all([
      getDeptTreeSelect(),
      listAllPosts(),
    ])
    deptTree.value = tree || []
    postOptions.value = posts || []
    optionsLoaded.value = true
  } catch (err) {
    ElMessage.warning(err.message || '加载部门/岗位下拉失败')
  }
}

async function handleAdd() {
  resetForm()
  dialogTitle.value = '新增用户'
  dialogVisible.value = true
  await ensureOptions()
}

async function handleEdit(row) {
  resetForm()
  form.userId = row.userId
  form.nickName = row.nickName || ''
  form.phone = row.phone || ''
  form.sex = row.sex || ''
  form.deptId = row.deptId ?? null
  // 后端返回的 postIds 可能是 Number[] 或 null
  form.postIds = Array.isArray(row.postIds) ? [...row.postIds] : []
  form.status = row.status || '0'
  form.remark = row.remark || ''
  dialogTitle.value = '编辑用户'
  dialogVisible.value = true
  await ensureOptions()
}

async function handleSubmit() {
  if (formRef.value) {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
  }
  submitLoading.value = true
  try {
    if (form.userId) {
      await updateUser(form.userId, {
        nickName: form.nickName,
        phone: form.phone,
        sex: form.sex,
        deptId: form.deptId,
        // 空数组也要发，让后端清空岗位关联
        postIds: form.postIds,
        status: form.status,
        remark: form.remark,
      })
      ElMessage.success('修改成功')
    } else {
      await createUser({
        userName: form.userName,
        password: form.password,
        nickName: form.nickName,
        phone: form.phone,
        sex: form.sex,
        deptId: form.deptId,
        postIds: form.postIds,
        status: form.status,
        remark: form.remark,
      })
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadUsers()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.userName}」？`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deleteUser(row.userId)
    ElMessage.success('删除成功')
    loadUsers()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

async function handleResetPwd(row) {
  try {
    const { value } = await ElMessageBox.prompt(`请输入「${row.userName}」的新密码`, '重置密码', {
      confirmButtonText: '确认', cancelButtonText: '取消', inputType: 'password',
      inputValidator: (v) => (v && v.length >= 6) || '密码不能少于6位',
    })
    await resetPassword(row.userId, { newPassword: value })
    ElMessage.success('密码重置成功')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err.message || '重置失败')
    }
  }
}

async function handleAssignRoles(row) {
  currentRoleUserId = row.userId
  selectedRoleIds.value = (row.roles || []).map((r) => r.roleId)
  try {
    allRoles.value = await listRoles()
  } catch (err) {
    ElMessage.error(err.message || '加载角色列表失败')
    return
  }
  roleDialogVisible.value = true
}

async function handleRoleSubmit() {
  roleSubmitLoading.value = true
  try {
    await assignRoles(currentRoleUserId, { roleIds: selectedRoleIds.value })
    ElMessage.success('角色分配成功')
    roleDialogVisible.value = false
    loadUsers()
  } catch (err) {
    ElMessage.error(err.message || '角色分配失败')
  } finally {
    roleSubmitLoading.value = false
  }
}

onMounted(() => loadUsers())
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.search-form {
  margin-bottom: 12px;
}
.table-toolbar {
  margin-bottom: 12px;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.role-tag {
  margin-right: 4px;
}
</style>
