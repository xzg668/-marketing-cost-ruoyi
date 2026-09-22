<template>
  <section v-if="error || (state && state.status !== 'NOT_REQUIRED')" id="auxiliary-classification" class="classification-panel" v-loading="busy">
    <h2>辅料归类</h2>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="state">
      <el-alert :title="state.message" :type="state.status === 'CLASSIFIED' ? 'success' : 'warning'" :closable="false" />
      <template v-if="state.items.length">
        <p>下载已审批辅料明细，只填写二级科目名称，再导入检查。技术资料和金额保持原值。</p>
        <div v-if="state.canClassify && !readonly" class="actions">
          <el-button :disabled="busy" @click="download">下载辅料表</el-button>
          <el-button :disabled="busy" @click="fileInput.click()">导入归类结果</el-button>
          <input ref="fileInput" type="file" accept=".xlsx,.xls" hidden @change="selectFile" />
          <span>{{ file?.name }}</span>
        </div>
        <el-table :data="state.items" border>
          <el-table-column prop="materialNo" label="辅料料号" />
          <el-table-column prop="name" label="辅料名称" />
          <el-table-column prop="amount" label="已审批金额（元/只）" />
          <el-table-column prop="subjectName" label="二级科目名称" />
        </el-table>
        <template v-if="preview">
          <el-alert :title="preview.valid ? '校验通过，请确认归类汇总' : '校验未通过，请按问题修改文件后重新导入'" :type="preview.valid ? 'success' : 'error'" :closable="false" />
          <el-table v-if="preview.issues.length" :data="preview.issues" border><el-table-column prop="row" label="Excel 行" width="110" /><el-table-column prop="message" label="问题" /></el-table>
          <el-button v-if="canConfirm" type="primary" :disabled="busy || readonly" @click="confirm">确认归类</el-button>
        </template>
        <el-table v-if="totals.length" :data="totals" border class="classification-totals">
          <el-table-column prop="subjectCode" label="二级科目编码" /><el-table-column prop="subjectName" label="二级科目名称" /><el-table-column prop="amount" label="辅料汇总（元/只）" />
        </el-table>
      </template>
    </template>
    <el-button v-if="error" :disabled="busy" @click="load">重新读取归类状态</el-button>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAuxiliaryClassification, downloadAuxiliaryClassification, previewAuxiliaryClassification, confirmAuxiliaryClassification } from '../../api/auxiliaryClassification'
import { classificationScope, canConfirmClassification } from '../../utils/auxiliaryClassification'
const props=defineProps({ oaNo:String,itemId:[String,Number],month:String,readonly:Boolean,revision:Number })
const emit=defineEmits(['classified'])
const state=ref(null),preview=ref(null),file=ref(null),fileInput=ref(null),busy=ref(false),error=ref(''),previewScope=ref('')
const scope=computed(() => classificationScope(props.oaNo,props.itemId,props.month))
const canConfirm=computed(() => canConfirmClassification(preview.value,file.value,previewScope.value,scope.value))
const totals=computed(() => preview.value?.valid ? preview.value.totals : state.value?.totals || [])
let generation=0
onBeforeUnmount(() => { generation++ })
async function load() {
  const current=++generation
  state.value=null;preview.value=null;file.value=null;error.value=''
  if (!props.month || props.month==='-' || !props.itemId) return
  busy.value=true
  try { const result=await fetchAuxiliaryClassification(props.oaNo,props.itemId,props.month);if(current===generation)state.value=result }
  catch(e) { if(current===generation)error.value=e.message || '读取辅料归类状态失败' }
  finally { if(current===generation)busy.value=false }
}
watch([scope,() => props.revision],load,{immediate:true})
async function download() {
  const current=generation
  busy.value=true
  try { await downloadAuxiliaryClassification(props.oaNo,props.itemId,props.month) }
  catch(e) { ElMessage.error(e.message) }
  finally { if(current===generation)busy.value=false }
}
async function selectFile(event) {
  const selected=event.target.files?.[0];event.target.value=''
  preview.value=null;file.value=selected || null
  if(!selected)return
  const current=++generation;const selectedScope=scope.value;busy.value=true;error.value=''
  try {
    const result=await previewAuxiliaryClassification(props.oaNo,props.itemId,props.month,selected)
    if(current!==generation)return
    preview.value=result;previewScope.value=selectedScope
  } catch(e) { if(current===generation)error.value=e.message || '归类文件预检失败' }
  finally { if(current===generation)busy.value=false }
}
async function confirm() {
  if(!canConfirm.value)return
  const current=generation;busy.value=true;error.value=''
  try {
    const result=await confirmAuxiliaryClassification(props.oaNo,props.itemId,props.month,file.value,preview.value.fingerprint)
    if(current!==generation)return
    state.value=result;preview.value=null;file.value=null
    ElMessage.success('辅料归类已完成');emit('classified')
  } catch(e) { if(current===generation){error.value=e.message || '归类确认失败';preview.value=null} }
  finally { if(current===generation)busy.value=false }
}
</script>
<style scoped>
.classification-panel { margin: 20px 0; padding: 20px; border: 1px solid #dcdfe6; border-radius: 6px; }
h2 { margin: 0 0 14px; font-size: 18px; }
.actions { display: flex; align-items: center; gap: 10px; margin: 14px 0; }
.el-alert,.el-table { margin-bottom: 12px; }
</style>
