<template>
  <el-dialog :model-value="true" :title="`${user.userName}的报价范围`" width="500px" @close="$emit('close')">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-alert v-else-if="scope?.allQuotes" title="该账号是管理员或业务总监，可查看全部报价。" type="info" :closable="false" />
      <template v-else-if="scope">
        <el-radio-group v-model="scope.quoteScope" class="scope-options">
          <el-radio value="COMMERCIAL">商用：商用产品报价单</el-radio>
          <el-radio value="PLATE">板换：板换产品报价单</el-radio>
        </el-radio-group>
        <p>板换沿用系统的产品识别规则，历史混合单双方均可查看。报价单与补录工作台使用相同范围，保存后刷新页面即生效。</p>
      </template>
    </div>
    <template #footer>
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button v-if="scope && !scope.allQuotes" type="primary" :loading="saving" :disabled="loading" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getQuoteScope, saveQuoteScope } from '../../../api/system/user'
const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['close'])
const loading = ref(true)
const saving = ref(false)
const scope = ref(null)
const error = ref('')
onMounted(async () => {
  try { scope.value = await getQuoteScope(props.user.userId) }
  catch (e) { error.value = e.message || '读取报价范围失败' }
  finally { loading.value = false }
})
async function save() {
  saving.value = true
  try {
    await saveQuoteScope(props.user.userId, scope.value.quoteScope)
    ElMessage.success('报价范围已保存')
    emit('close')
  } catch (e) { error.value = e.message || '保存报价范围失败' }
  finally { saving.value = false }
}
</script>
<style scoped>
.scope-options { display: flex; align-items: flex-start; flex-direction: column; }
p { color: #606266; line-height: 1.6; }
</style>
