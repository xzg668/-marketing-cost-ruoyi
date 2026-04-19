<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-form :inline="true" class="table-toolbar">
      <el-form-item label="字典名称">
        <el-input v-model="queryParams.dictName" placeholder="请输入" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="字典类型">
        <el-input v-model="queryParams.dictType" placeholder="请输入" clearable @keyup.enter="handleQuery" />
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
        <el-button v-hasPermi="['system:dict:add']" type="primary" @click="handleAdd">新增</el-button>
      </el-form-item>
    </el-form>

    <!-- 字典类型列表 -->
    <el-table v-loading="loading" :data="typeList" border>
      <el-table-column prop="dictId" label="字典编号" width="80" />
      <el-table-column prop="dictName" label="字典名称" min-width="150" />
      <el-table-column label="字典类型" min-width="180">
        <template #default="{ row }">
          <!-- 点击字典类型跳转到字典数据页 -->
          <el-link type="primary" @click="goToDictData(row)">{{ row.dictType }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" />
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button v-hasPermi="['system:dict:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-hasPermi="['system:dict:list']" link type="primary" @click="goToDictData(row)">字典数据</el-button>
          <el-button v-hasPermi="['system:dict:remove']" link type="danger" @click="handleDelete(row)">删除</el-button>
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
      @size-change="loadTypes"
      @current-change="loadTypes"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="字典名称" prop="dictName">
          <el-input v-model="form.dictName" placeholder="请输入字典名称" />
        </el-form-item>
        <el-form-item label="字典类型" prop="dictType">
          <el-input v-model="form.dictType" placeholder="如 sys_user_sex" />
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
 * 字典类型管理页面
 * 功能：分页列表、搜索、新增、编辑、删除、跳转字典数据
 */
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listDictTypes, createDictType, updateDictType, deleteDictType } from '../../../api/system/dict'

const router = useRouter()

// 加载状态
const loading = ref(false)
// 字典类型列表
const typeList = ref([])
// 总条数
const total = ref(0)

// 查询参数
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  dictName: '',
  dictType: '',
  status: '',
})

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitLoading = ref(false)
const formRef = ref()

// 表单数据
const form = reactive({
  dictId: null,
  dictName: '',
  dictType: '',
  status: '0',
  remark: '',
})

// 表单验证规则
const formRules = {
  dictName: [{ required: true, message: '请输入字典名称', trigger: 'blur' }],
  dictType: [{ required: true, message: '请输入字典类型', trigger: 'blur' }],
}

/** 加载字典类型列表 */
async function loadTypes() {
  loading.value = true
  try {
    const res = await listDictTypes({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      dictName: queryParams.dictName || undefined,
      dictType: queryParams.dictType || undefined,
      status: queryParams.status || undefined,
    })
    typeList.value = res.records || []
    total.value = res.total || 0
  } catch (err) {
    ElMessage.error(err.message || '加载字典类型失败')
  } finally {
    loading.value = false
  }
}

/** 搜索 */
function handleQuery() {
  queryParams.pageNum = 1
  loadTypes()
}

/** 重置搜索 */
function resetQuery() {
  queryParams.dictName = ''
  queryParams.dictType = ''
  queryParams.status = ''
  handleQuery()
}

/** 重置表单 */
function resetForm() {
  form.dictId = null
  form.dictName = ''
  form.dictType = ''
  form.status = '0'
  form.remark = ''
}

/** 新增字典类型 */
function handleAdd() {
  resetForm()
  dialogTitle.value = '新增字典类型'
  dialogVisible.value = true
}

/** 编辑字典类型 */
function handleEdit(row) {
  resetForm()
  form.dictId = row.dictId
  form.dictName = row.dictName || ''
  form.dictType = row.dictType || ''
  form.status = row.status || '0'
  form.remark = row.remark || ''
  dialogTitle.value = '编辑字典类型'
  dialogVisible.value = true
}

/** 提交表单 */
async function handleSubmit() {
  if (formRef.value) {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
  }
  submitLoading.value = true
  try {
    const data = {
      dictName: form.dictName,
      dictType: form.dictType,
      status: form.status,
      remark: form.remark || null,
    }
    if (form.dictId) {
      await updateDictType(form.dictId, data)
      ElMessage.success('修改成功')
    } else {
      await createDictType(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadTypes()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

/** 删除字典类型 */
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除字典类型「${row.dictName}」？删除后该类型下的所有字典数据也将被删除。`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deleteDictType(row.dictId)
    ElMessage.success('删除成功')
    loadTypes()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

/** 跳转到字典数据页面 */
function goToDictData(row) {
  router.push({ path: '/system/dict/data', query: { dictType: row.dictType } })
}

onMounted(() => loadTypes())
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.table-toolbar {
  margin-bottom: 12px;
}
</style>
