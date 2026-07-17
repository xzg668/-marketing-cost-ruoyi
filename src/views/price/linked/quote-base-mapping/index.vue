<template>
  <section class="metal-policy-page">
    <div class="page-head">
      <div>
        <h1>金属基价取值规则</h1>
        <p>设置 Zn、Al 在报价核算时是否优先使用 OA 基价。</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadPolicies">刷新</el-button>
    </div>

    <div class="cu-rule">
      <div class="metal-code">Cu</div>
      <div class="cu-content">
        <div class="rule-title">铜价按财务月度基准核算</div>
        <div class="rule-note">
          成本核算读取“财务Cu报价基准”对应月份的价格；OA 铜基价只用于差异对比。
        </div>
      </div>
      <el-tag effect="plain">固定规则</el-tag>
    </div>

    <el-table :data="rows" border v-loading="loading" class="policy-table">
      <el-table-column prop="variableCode" label="金属" width="120">
        <template #default="{ row }">
          <span class="metal-name">{{ row.variableCode }}</span>
          <span class="metal-label">{{ row.metalName }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="quoteFieldName" label="OA字段" width="180" />
      <el-table-column label="取价方式" width="310">
        <template #default="{ row }">
          <el-radio-group
            v-model="row.pricePolicy"
            :disabled="!canEdit || savingCode === row.variableCode"
            @change="(value) => changePolicy(row, value)"
          >
            <el-radio value="OA_PRIORITY">OA优先</el-radio>
            <el-radio value="FACTOR_MONTHLY">影响因素表</el-radio>
          </el-radio-group>
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="360">
        <template #default="{ row }">
          {{ policyDescription(row.pricePolicy) }}
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无取价规则" />
      </template>
    </el-table>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import {
  fetchMetalBasePricePolicies,
  updateMetalBasePricePolicy,
} from '../../../../api/quoteBasePriceMappings'
import { useUserStore } from '../../../../store/modules/user'

const userStore = useUserStore()
const loading = ref(false)
const savingCode = ref('')
const rows = ref([])

const canEdit = computed(() => {
  const permissions = Array.isArray(userStore.permissions) ? userStore.permissions : []
  return (
    permissions.includes('*:*:*') ||
    permissions.includes('price:quote-base-mapping:edit') ||
    permissions.includes('price:finance-base:edit')
  )
})

const policyDescription = (pricePolicy) =>
  pricePolicy === 'FACTOR_MONTHLY'
    ? '直接读取核算月份的影响因素价格，不读取 OA 基价。'
    : 'OA 有值时使用 OA；OA 为空时自动回退到核算月份的影响因素价格。'

const loadPolicies = async () => {
  loading.value = true
  try {
    const data = await fetchMetalBasePricePolicies()
    rows.value = Array.isArray(data) ? data : []
  } catch (error) {
    rows.value = []
    ElMessage.error(error?.message || '获取金属基价取值规则失败')
  } finally {
    loading.value = false
  }
}

const changePolicy = async (row, pricePolicy) => {
  savingCode.value = row.variableCode
  try {
    const updated = await updateMetalBasePricePolicy(row.variableCode, pricePolicy)
    Object.assign(row, updated || { pricePolicy })
    ElMessage.success(`${row.variableCode}取价方式已更新`)
  } catch (error) {
    ElMessage.error(error?.message || '更新取价方式失败')
    await loadPolicies()
  } finally {
    savingCode.value = ''
  }
}

onMounted(loadPolicies)
</script>

<style scoped>
.metal-policy-page {
  padding: 20px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-head h1 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
  line-height: 32px;
  font-weight: 700;
}

.page-head p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.cu-rule {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.metal-code {
  width: 56px;
  color: #1f2937;
  font-size: 18px;
  font-weight: 700;
}

.cu-content {
  flex: 1;
  min-width: 0;
}

.rule-title {
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}

.rule-note {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.policy-table {
  background: #fff;
}

.metal-name {
  margin-right: 8px;
  color: #1f2937;
  font-weight: 600;
}

.metal-label {
  color: #6b7280;
}

@media (max-width: 760px) {
  .page-head {
    align-items: stretch;
    flex-direction: column;
  }

  .cu-rule {
    align-items: flex-start;
  }
}
</style>
