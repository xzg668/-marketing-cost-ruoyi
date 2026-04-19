<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-form :inline="true" class="table-toolbar">
      <el-form-item label="岗位编码">
        <el-input v-model="queryParams.postCode" placeholder="请输入" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="岗位名称">
        <el-input v-model="queryParams.postName" placeholder="请输入" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 100px">
          <el-option label="正常" value="0" />
          <el-option label="停用" value="1" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleQuery">搜索</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
      <el-form-item>
        <el-button v-hasPermi="['system:post:add']" type="primary" @click="handleAdd">新增</el-button>
      </el-form-item>
    </el-form>

    <!-- 岗位列表 -->
    <el-table v-loading="loading" :data="postList" border>
      <el-table-column prop="postId" label="岗位编号" width="80" />
      <el-table-column prop="postCode" label="岗位编码" min-width="120" />
      <el-table-column prop="postName" label="岗位名称" min-width="150" />
      <el-table-column prop="postSort" label="排序" width="70" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" />
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-hasPermi="['system:post:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-hasPermi="['system:post:remove']" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="queryParams.pageNum"
      v-model:page-size="queryParams.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 12px; justify-content: flex-end"
      @size-change="loadPosts"
      @current-change="loadPosts"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="岗位编码" prop="postCode">
          <el-input v-model="form.postCode" placeholder="如 CEO、HR" />
        </el-form-item>
        <el-form-item label="岗位名称" prop="postName">
          <el-input v-model="form.postName" placeholder="请输入岗位名称" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.postSort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
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
/**
 * 岗位管理页面
 * 功能：分页列表、搜索、新增、编辑、删除
 * 特殊逻辑：岗位编码唯一性由后端校验
 */
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listPosts, createPost, updatePost, deletePost } from '../../../api/system/post'

// 加载状态
const loading = ref(false)
// 岗位列表数据
const postList = ref([])
// 数据总条数
const total = ref(0)

// 查询参数
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  postCode: '',
  postName: '',
  status: '',
})

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitLoading = ref(false)
const formRef = ref()

// 表单数据
const form = reactive({
  postId: null,
  postCode: '',
  postName: '',
  postSort: 0,
  status: '0',
  remark: '',
})

// 表单验证规则
const formRules = {
  postCode: [{ required: true, message: '请输入岗位编码', trigger: 'blur' }],
  postName: [{ required: true, message: '请输入岗位名称', trigger: 'blur' }],
}

/** 加载岗位列表 */
async function loadPosts() {
  loading.value = true
  try {
    const res = await listPosts({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      postCode: queryParams.postCode || undefined,
      postName: queryParams.postName || undefined,
      status: queryParams.status || undefined,
    })
    // MyBatis Plus 分页返回 records + total
    postList.value = res.records || []
    total.value = res.total || 0
  } catch (err) {
    ElMessage.error(err.message || '加载岗位失败')
  } finally {
    loading.value = false
  }
}

/** 搜索 */
function handleQuery() {
  queryParams.pageNum = 1
  loadPosts()
}

/** 重置搜索条件 */
function resetQuery() {
  queryParams.postCode = ''
  queryParams.postName = ''
  queryParams.status = ''
  handleQuery()
}

/** 重置表单 */
function resetForm() {
  form.postId = null
  form.postCode = ''
  form.postName = ''
  form.postSort = 0
  form.status = '0'
  form.remark = ''
}

/** 新增岗位 */
function handleAdd() {
  resetForm()
  dialogTitle.value = '新增岗位'
  dialogVisible.value = true
}

/** 编辑岗位 */
function handleEdit(row) {
  resetForm()
  form.postId = row.postId
  form.postCode = row.postCode || ''
  form.postName = row.postName || ''
  form.postSort = row.postSort || 0
  form.status = row.status || '0'
  form.remark = row.remark || ''
  dialogTitle.value = '编辑岗位'
  dialogVisible.value = true
}

/** 提交表单（新增或修改） */
async function handleSubmit() {
  if (formRef.value) {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
  }
  submitLoading.value = true
  try {
    const data = {
      postCode: form.postCode,
      postName: form.postName,
      postSort: form.postSort,
      status: form.status,
      remark: form.remark || null,
    }
    if (form.postId) {
      await updatePost(form.postId, data)
      ElMessage.success('修改成功')
    } else {
      await createPost(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadPosts()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

/** 删除岗位 */
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除岗位「${row.postName}」？`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deletePost(row.postId)
    ElMessage.success('删除成功')
    loadPosts()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

onMounted(() => loadPosts())
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.table-toolbar {
  margin-bottom: 12px;
}
</style>
