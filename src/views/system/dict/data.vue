<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-form :inline="true" class="table-toolbar">
      <el-form-item label="字典类型">
        <el-select v-model="queryParams.dictType" placeholder="请选择" style="width: 200px" @change="handleQuery">
          <el-option v-for="t in allTypes" :key="t.dictType" :label="t.dictName" :value="t.dictType" />
        </el-select>
      </el-form-item>
      <el-form-item label="字典标签">
        <el-input v-model="queryParams.dictLabel" placeholder="请输入" clearable @keyup.enter="handleQuery" />
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
        <el-button @click="goBack">返回字典类型</el-button>
      </el-form-item>
    </el-form>

    <!-- 字典数据列表 -->
    <el-table v-loading="loading" :data="dataList" border>
      <el-table-column prop="dictCode" label="字典编码" width="80" />
      <el-table-column prop="dictLabel" label="字典标签" min-width="120" />
      <el-table-column prop="dictValue" label="字典键值" min-width="100" />
      <el-table-column prop="dictSort" label="排序" width="70" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" />
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button v-hasPermi="['system:dict:edit']" link type="primary" @click="handleEdit(row)">编辑</el-button>
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
      @size-change="loadData"
      @current-change="loadData"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="字典类型">
          <el-input v-model="form.dictType" disabled />
        </el-form-item>
        <el-form-item label="字典标签" prop="dictLabel">
          <el-input v-model="form.dictLabel" placeholder="请输入字典标签" />
        </el-form-item>
        <el-form-item label="字典键值" prop="dictValue">
          <el-input v-model="form.dictValue" placeholder="请输入字典键值" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.dictSort" :min="0" />
        </el-form-item>
        <el-form-item label="回显样式">
          <el-select v-model="form.listClass" placeholder="请选择" clearable style="width: 100%">
            <el-option label="默认(default)" value="default" />
            <el-option label="主要(primary)" value="primary" />
            <el-option label="成功(success)" value="success" />
            <el-option label="信息(info)" value="info" />
            <el-option label="警告(warning)" value="warning" />
            <el-option label="危险(danger)" value="danger" />
          </el-select>
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
 * 字典数据管理页面
 * 通过 query 参数 dictType 从字典类型页跳转过来
 * 功能：分页列表、搜索、新增、编辑、删除、切换字典类型
 */
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listDictData, createDictData, updateDictData, deleteDictData, listAllDictTypes } from '../../../api/system/dict'

const route = useRoute()
const router = useRouter()

// 加载状态
const loading = ref(false)
// 字典数据列表
const dataList = ref([])
// 总条数
const total = ref(0)
// 所有字典类型（下拉切换用）
const allTypes = ref([])

// 查询参数
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  dictType: '',
  dictLabel: '',
  status: '',
})

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitLoading = ref(false)
const formRef = ref()

// 表单数据
const form = reactive({
  dictCode: null,
  dictType: '',
  dictLabel: '',
  dictValue: '',
  dictSort: 0,
  cssClass: '',
  listClass: '',
  isDefault: 'N',
  status: '0',
  remark: '',
})

// 表单验证规则
const formRules = {
  dictLabel: [{ required: true, message: '请输入字典标签', trigger: 'blur' }],
  dictValue: [{ required: true, message: '请输入字典键值', trigger: 'blur' }],
}

/** 加载字典数据列表 */
async function loadData() {
  if (!queryParams.dictType) return
  loading.value = true
  try {
    const res = await listDictData({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      dictType: queryParams.dictType,
      dictLabel: queryParams.dictLabel || undefined,
      status: queryParams.status || undefined,
    })
    dataList.value = res.records || []
    total.value = res.total || 0
  } catch (err) {
    ElMessage.error(err.message || '加载字典数据失败')
  } finally {
    loading.value = false
  }
}

/** 加载所有字典类型（供切换下拉） */
async function loadAllTypes() {
  try {
    allTypes.value = (await listAllDictTypes()) || []
  } catch {
    // 忽略，不影响主流程
  }
}

/** 搜索 */
function handleQuery() {
  queryParams.pageNum = 1
  loadData()
}

/** 重置搜索 */
function resetQuery() {
  queryParams.dictLabel = ''
  queryParams.status = ''
  handleQuery()
}

/** 重置表单 */
function resetForm() {
  form.dictCode = null
  form.dictType = queryParams.dictType
  form.dictLabel = ''
  form.dictValue = ''
  form.dictSort = 0
  form.cssClass = ''
  form.listClass = ''
  form.isDefault = 'N'
  form.status = '0'
  form.remark = ''
}

/** 新增字典数据 */
function handleAdd() {
  resetForm()
  dialogTitle.value = '新增字典数据'
  dialogVisible.value = true
}

/** 编辑字典数据 */
function handleEdit(row) {
  resetForm()
  form.dictCode = row.dictCode
  form.dictType = row.dictType || queryParams.dictType
  form.dictLabel = row.dictLabel || ''
  form.dictValue = row.dictValue || ''
  form.dictSort = row.dictSort || 0
  form.cssClass = row.cssClass || ''
  form.listClass = row.listClass || ''
  form.isDefault = row.isDefault || 'N'
  form.status = row.status || '0'
  form.remark = row.remark || ''
  dialogTitle.value = '编辑字典数据'
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
      dictType: form.dictType,
      dictLabel: form.dictLabel,
      dictValue: form.dictValue,
      dictSort: form.dictSort,
      cssClass: form.cssClass || null,
      listClass: form.listClass || null,
      isDefault: form.isDefault,
      status: form.status,
      remark: form.remark || null,
    }
    if (form.dictCode) {
      await updateDictData(form.dictCode, data)
      ElMessage.success('修改成功')
    } else {
      await createDictData(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

/** 删除字典数据 */
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除字典数据「${row.dictLabel}」？`, '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deleteDictData(row.dictCode)
    ElMessage.success('删除成功')
    loadData()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

/** 返回字典类型列表 */
function goBack() {
  router.push('/system/dict')
}

onMounted(() => {
  // 从 URL query 获取字典类型
  queryParams.dictType = route.query.dictType || ''
  loadAllTypes()
  if (queryParams.dictType) {
    loadData()
  }
})
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.table-toolbar {
  margin-bottom: 12px;
}
</style>
