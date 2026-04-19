<template>
  <div class="oa-detail">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div class="header-title">OA 表单关键信息</div>
        <el-button @click="goBack">返回列表</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="section-title">关键信息</div>
      <el-descriptions :column="4" border>
        <el-descriptions-item label="OA单号">
          {{ detail.key.oaNo }}
        </el-descriptions-item>
        <el-descriptions-item label="表单类型">
          {{ detail.key.formType }}
        </el-descriptions-item>
        <el-descriptions-item label="申请日期">
          {{ detail.key.applyDate }}
        </el-descriptions-item>
        <el-descriptions-item label="客户名称">
          {{ detail.key.customer }}
        </el-descriptions-item>
        <el-descriptions-item label="铜基价（含税）">
          {{ detail.key.copperPrice }}
        </el-descriptions-item>
        <el-descriptions-item label="锌基价（含税）">
          {{ detail.key.zincPrice }}
        </el-descriptions-item>
        <el-descriptions-item label="铝基价（含税）">
          {{ detail.key.aluminumPrice }}
        </el-descriptions-item>
        <el-descriptions-item label="不锈钢基价（含税）">
          {{ detail.key.steelPrice }}
        </el-descriptions-item>
        <el-descriptions-item label="其他材料价">
          {{ detail.key.otherMaterial }}
        </el-descriptions-item>
        <el-descriptions-item label="基准运输费">
          {{ detail.key.baseShipping }}
        </el-descriptions-item>
        <el-descriptions-item label="销售价格联动情况">
          {{ detail.key.saleLink }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ detail.key.remark }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <div class="section-title">表体明细（关键列）</div>
      <el-table :data="detail.items" stripe v-loading="loading">
        <el-table-column prop="seq" label="序号" width="70" />
        <el-table-column prop="productName" label="产品名称" min-width="160" />
        <el-table-column prop="customerDrawing" label="客户图号" min-width="140" />
        <el-table-column prop="materialNo" label="料号" min-width="120" />
        <el-table-column prop="sunlModel" label="三花型号" min-width="120" />
        <el-table-column prop="spec" label="规格" min-width="120" />
        <el-table-column prop="shippingFee" label="运输费/元/只" min-width="140" />
        <el-table-column prop="supportQty" label="三花配套量/万只" min-width="140" />
        <el-table-column prop="totalWithShip" label="含运输费总成本(不含税)" min-width="170" />
        <el-table-column prop="totalNoShip" label="不含运输费总成本(不含税)" min-width="170" />
        <el-table-column prop="materialCost" label="直接材料费" min-width="120" />
        <el-table-column prop="laborCost" label="直接人工费" min-width="120" />
        <el-table-column prop="manufacturingCost" label="制造费用" min-width="120" />
        <el-table-column prop="managementCost" label="企业管理费" min-width="120" />
        <el-table-column prop="validDate" label="成本有效期" min-width="120" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :disabled="isAudited" @click="goCostRun(row)">
              成本试算
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchOaFormDetail } from '../api/oaForms'

const route = useRoute()
const router = useRouter()

const isAudited = computed(() => route.query.status === '已核算')

const emptyKey = () => ({
  oaNo: '',
  formType: '',
  applyDate: '',
  customer: '',
  copperPrice: '',
  zincPrice: '',
  aluminumPrice: '',
  steelPrice: '',
  otherMaterial: '',
  baseShipping: '',
  saleLink: '',
  remark: '',
})

const loading = ref(false)
const detail = ref({
  key: emptyKey(),
  items: [],
})

const fetchDetail = async (oaNo) => {
  if (!oaNo) {
    ElMessage.error('缺少 OA 单号')
    return
  }

  loading.value = true
  try {
    const data = await fetchOaFormDetail(oaNo)
    detail.value = {
      key: { ...emptyKey(), ...(data?.key || {}) },
      items: Array.isArray(data?.items) ? data.items : [],
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取 OA 表单详情失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  (oaNo) => {
    fetchDetail(oaNo)
  },
  { immediate: true },
)

const goBack = () => {
  router.push('/ingest/oa-form')
}

const goCostRun = (row) => {
  const query = {
    oaNo: detail.value.key.oaNo,
  }

  if (detail.value.key.customer) {
    query.customer = detail.value.key.customer
  }
  if (row.productName) {
    query.productName = row.productName
  }
  if (row.sunlModel) {
    query.sunlModel = row.sunlModel
  }
  if (row.spec) {
    query.spec = row.spec
  }

  if (row.materialNo) {
    query.materialCode = row.materialNo
  } else if (row.customerDrawing) {
    query.customerDrawing = row.customerDrawing
  }

  if (route.query.status) {
    query.status = String(route.query.status)
  }

  router.push({
    path: `/cost/run/${detail.value.key.oaNo}`,
    query,
  })
}
</script>

<style scoped>
.oa-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card {
  padding-bottom: 4px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2a37;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
  margin-bottom: 10px;
}
</style>
