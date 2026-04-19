<template>
  <div class="app-container">
    <div class="table-toolbar">
      <el-button v-hasPermi="['system:dept:add']" type="primary" @click="handleAdd(null)">新增部门</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="deptTree"
      row-key="deptId"
      border
      :tree-props="{ children: 'children' }"
      default-expand-all
    >
      <el-table-column prop="deptName" label="部门名称" min-width="200" />
      <el-table-column label="组织类型" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.orgType" size="small">{{ orgTypeLabel(row.orgType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderNum" label="排序" width="70" />
      <el-table-column prop="leader" label="负责人" width="120" />
      <el-table-column prop="phone" label="联系电话" width="140" />
      <el-table-column prop="email" label="邮箱" min-width="160" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button v-hasPermi="['system:dept:add']" link type="primary" @click="handleAdd(row)">新增</el-button>
          <el-button v-hasPermi="['system:dept:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-hasPermi="['system:dept:remove']" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="上级部门">
          <el-tree-select
            v-model="form.parentId"
            :data="parentTreeData"
            :props="{ label: 'label', value: 'id', children: 'children' }"
            placeholder="顶级部门"
            check-strictly
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="部门名称" prop="deptName">
          <el-input v-model="form.deptName" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="组织类型">
          <el-select v-model="form.orgType" placeholder="请选择" clearable style="width: 100%">
            <el-option label="法人实体" value="LEGAL_ENTITY" />
            <el-option label="事业部" value="DIVISION" />
            <el-option label="车间" value="WORKSHOP" />
            <el-option label="产品线" value="PRODUCT_LINE" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.leader" placeholder="请输入" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.phone" placeholder="请输入" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
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
import { listDepts, createDept, updateDept, deleteDept, getDeptTreeSelect } from '../../../api/system/dept'

const ORG_TYPE_MAP = {
  LEGAL_ENTITY: '法人实体',
  DIVISION: '事业部',
  WORKSHOP: '车间',
  PRODUCT_LINE: '产品线',
}

function orgTypeLabel(val) {
  return ORG_TYPE_MAP[val] || val
}

const loading = ref(false)
const deptList = ref([])
const parentTreeData = ref([])

const deptTree = computed(() => buildTree(deptList.value))

function buildTree(list) {
  const map = new Map()
  const roots = []
  list.forEach((d) => map.set(d.deptId, { ...d, children: [] }))
  list.forEach((d) => {
    const node = map.get(d.deptId)
    const pid = d.parentId
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
  deptId: null,
  deptName: '',
  parentId: null,
  orgType: '',
  orderNum: 0,
  leader: '',
  phone: '',
  email: '',
  status: '0',
})

const formRules = {
  deptName: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
}

async function loadDepts() {
  loading.value = true
  try {
    deptList.value = (await listDepts()) || []
    parentTreeData.value = await getDeptTreeSelect()
  } catch (err) {
    ElMessage.error(err.message || '加载部门失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.deptId = null
  form.deptName = ''
  form.parentId = null
  form.orgType = ''
  form.orderNum = 0
  form.leader = ''
  form.phone = ''
  form.email = ''
  form.status = '0'
}

function handleAdd(row) {
  resetForm()
  if (row) {
    form.parentId = row.deptId
  }
  dialogTitle.value = '新增部门'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  form.deptId = row.deptId
  form.deptName = row.deptName || ''
  form.parentId = row.parentId || null
  form.orgType = row.orgType || ''
  form.orderNum = row.orderNum || 0
  form.leader = row.leader || ''
  form.phone = row.phone || ''
  form.email = row.email || ''
  form.status = row.status || '0'
  dialogTitle.value = '编辑部门'
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
      deptName: form.deptName,
      parentId: form.parentId || 0,
      orgType: form.orgType || null,
      orderNum: form.orderNum,
      leader: form.leader,
      phone: form.phone,
      email: form.email,
      status: form.status,
    }
    if (form.deptId) {
      await updateDept(form.deptId, data)
      ElMessage.success('修改成功')
    } else {
      await createDept(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadDepts()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除部门「${row.deptName}」？`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deleteDept(row.deptId)
    ElMessage.success('删除成功')
    loadDepts()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

onMounted(() => loadDepts())
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.table-toolbar {
  margin-bottom: 12px;
}
</style>
