<template>
  <el-button link type="danger" :disabled="busy" :loading="busy" @click="withdraw">失效</el-button>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { request } from '../api/http.js'

const props = defineProps({ path: { type: String, required: true }, description: String })
const emit = defineEmits(['withdrawn'])
const busy = ref(false)

async function withdraw() {
  if (busy.value) return
  busy.value = true
  const path = props.path
  try {
    await ElMessageBox.confirm(
      `${props.description || '所选价格'}失效后停止参与后续取价。已保存的核算结果可以继续查看。`,
      '失效这条价格', { type: 'warning', confirmButtonText: '确认失效', cancelButtonText: '取消' },
    )
    await request(path, { method: 'POST', suppressErrorToast: true })
    ElMessage.success('这条价格已失效')
    emit('withdrawn')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '失效失败，请刷新后重试')
  } finally {
    busy.value = false
  }
}
</script>
