<template>
  <div class="monthly-reprice-page">
    <el-card shadow="never">
      <div class="page-head">
        <div>
          <div class="page-title">月度调价</div>
          <div class="page-subtitle">批次、任务、结果和审计统一查询</div>
        </div>
        <div class="page-actions">
          <el-button
            v-hasPermi="['price:monthly-reprice:operate']"
            type="primary"
            @click="openCreateDialog"
          >
            发起月度调价
          </el-button>
          <el-button :loading="loading.batches || loading.results" @click="refreshActiveTab">
            刷新
          </el-button>
        </div>
      </div>
    </el-card>

    <el-tabs v-model="activeTab" class="main-tabs" @tab-change="refreshActiveTab">
      <el-tab-pane label="批次列表" name="batches">
        <el-card shadow="never">
          <el-form :inline="true" label-width="92px" class="filter-form">
            <el-form-item label="调价月份">
              <el-date-picker
                v-model="batchFilters.pricingMonth"
                type="month"
                format="YYYY-MM"
                value-format="YYYY-MM"
                placeholder="选择月份"
              />
            </el-form-item>
            <el-form-item label="业务单元">
              <el-input v-model="batchFilters.businessUnitType" placeholder="COMMERCIAL" clearable />
            </el-form-item>
            <el-form-item label="批次号">
              <el-input v-model="batchFilters.repriceNo" placeholder="MRP..." clearable />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="batchFilters.status" placeholder="全部" clearable style="width: 150px">
                <el-option v-for="item in batchStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadBatches">查询</el-button>
              <el-button @click="resetBatchFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <el-table :data="batchRows" stripe v-loading="loading.batches">
            <el-table-column prop="repriceNo" label="批次号" min-width="190" show-overflow-tooltip />
            <el-table-column prop="pricingMonth" label="月份" width="110" />
            <el-table-column prop="businessUnitType" label="业务单元" width="130" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="executionBackend" label="执行端" width="120" />
            <el-table-column prop="priceAsOfTime" label="取价时点" width="170" />
            <el-table-column prop="totalCount" label="总数" width="90" align="right" />
            <el-table-column prop="successCount" label="成功" width="90" align="right" />
            <el-table-column prop="failedCount" label="失败" width="90" align="right" />
            <el-table-column prop="skippedCount" label="跳过" width="90" align="right" />
            <el-table-column prop="createdName" label="发起人" width="110" />
            <el-table-column prop="startedAt" label="开始时间" width="170" />
            <el-table-column prop="finishedAt" label="结束时间" width="170" />
            <el-table-column prop="confirmedName" label="确认人" width="110" />
            <el-table-column prop="confirmedAt" label="确认时间" width="170" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openBatchDetail(row)">详情</el-button>
                <el-button
                  v-hasPermi="['price:monthly-reprice:operate']"
                  type="primary"
                  link
                  :disabled="!canConfirm(row)"
                  @click="confirmBatch(row)"
                >
                  确认
                </el-button>
                <el-button
                  v-hasPermi="['price:monthly-reprice:operate']"
                  type="warning"
                  link
                  :disabled="isTerminalStatus(row.status)"
                  @click="cancelBatch(row)"
                >
                  取消
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <BasePagination
            v-model:current-page="batchPager.page"
            v-model:page-size="batchPager.pageSize"
            :total="batchPager.total"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="结果查询" name="results">
        <el-card shadow="never">
          <el-form :inline="true" label-width="92px" class="filter-form">
            <el-form-item label="调价月份">
              <el-date-picker
                v-model="resultFilters.pricingMonth"
                type="month"
                format="YYYY-MM"
                value-format="YYYY-MM"
                placeholder="选择月份"
              />
            </el-form-item>
            <el-form-item label="业务单元">
              <el-input v-model="resultFilters.businessUnitType" placeholder="COMMERCIAL" clearable />
            </el-form-item>
            <el-form-item label="批次号">
              <el-input v-model="resultFilters.repriceNo" placeholder="为空查最新待确认/已确认批次" clearable />
            </el-form-item>
            <el-form-item label="OA 单号">
              <el-input v-model="resultFilters.oaNo" clearable />
            </el-form-item>
            <el-form-item label="产品料号">
              <el-input v-model="resultFilters.productCode" clearable />
            </el-form-item>
            <el-form-item label="客户">
              <el-input v-model="resultFilters.customerName" clearable />
            </el-form-item>
            <el-form-item label="核算状态">
              <el-select v-model="resultFilters.calcStatus" placeholder="全部" clearable style="width: 140px">
                <el-option label="成功" value="SUCCESS" />
                <el-option label="失败" value="FAILED" />
                <el-option label="跳过" value="SKIPPED" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadResults">查询</el-button>
              <el-button @click="resetResultFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <div class="selected-batch">
            当前结果批次：<strong>{{ selectedResultBatch?.repriceNo || '-' }}</strong>
            <span>{{ selectedResultBatch ? `${selectedResultBatch.pricingMonth} / ${selectedResultBatch.businessUnitType}` : '' }}</span>
          </div>
          <el-table :data="resultRows" stripe v-loading="loading.results">
            <el-table-column prop="oaNo" label="OA 单号" min-width="170" show-overflow-tooltip />
            <el-table-column prop="productCode" label="产品料号" min-width="150" show-overflow-tooltip />
            <el-table-column prop="packageMethod" label="包装方式" width="120" />
            <el-table-column prop="customerName" label="客户" min-width="170" show-overflow-tooltip />
            <el-table-column label="总成本" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.totalCost) }}</template>
            </el-table-column>
            <el-table-column label="材料费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.materialCost) }}</template>
            </el-table-column>
            <el-table-column label="人工费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.laborCost) }}</template>
            </el-table-column>
            <el-table-column label="辅料费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.auxiliaryCost) }}</template>
            </el-table-column>
            <el-table-column label="制造费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.manufacturingCost) }}</template>
            </el-table-column>
            <el-table-column label="管理费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.managementCost) }}</template>
            </el-table-column>
            <el-table-column label="销售费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.salesCost) }}</template>
            </el-table-column>
            <el-table-column label="财务费" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.financeCost) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="calcStatusTagType(row.calcStatus)">{{ calcStatusText(row.calcStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="calcMessage" label="核算消息" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openResultDrill(row)">明细</el-button>
              </template>
            </el-table-column>
          </el-table>
          <BasePagination
            v-model:current-page="resultPager.page"
            v-model:page-size="resultPager.pageSize"
            :total="resultPager.total"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="审计日志" name="audit">
        <el-card shadow="never">
          <el-form :inline="true" label-width="92px" class="filter-form">
            <el-form-item label="调价月份">
              <el-date-picker
                v-model="auditFilters.pricingMonth"
                type="month"
                format="YYYY-MM"
                value-format="YYYY-MM"
                placeholder="选择月份"
              />
            </el-form-item>
            <el-form-item label="业务单元">
              <el-input v-model="auditFilters.businessUnitType" clearable />
            </el-form-item>
            <el-form-item label="批次号">
              <el-input v-model="auditFilters.repriceNo" clearable />
            </el-form-item>
            <el-form-item label="操作类型">
              <el-input v-model="auditFilters.operationType" clearable />
            </el-form-item>
            <el-form-item label="操作人">
              <el-input v-model="auditFilters.operatorName" clearable />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadAuditLogs">查询</el-button>
              <el-button @click="resetAuditFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <el-table :data="auditRows" stripe v-loading="loading.audit">
            <el-table-column prop="operationTime" label="操作时间" width="170" />
            <el-table-column prop="repriceNo" label="批次号" min-width="180" />
            <el-table-column prop="pricingMonth" label="月份" width="100" />
            <el-table-column prop="businessUnitType" label="业务单元" width="120" />
            <el-table-column prop="operationType" label="操作类型" width="160" />
            <el-table-column prop="operatorName" label="操作人" width="130" />
            <el-table-column prop="changeSummary" label="说明" min-width="260" show-overflow-tooltip />
          </el-table>
          <BasePagination
            v-model:current-page="auditPager.page"
            v-model:page-size="auditPager.pageSize"
            :total="auditPager.total"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="detailDrawer.visible" size="86%" :title="detailTitle">
      <template v-if="detailDrawer.batch">
        <el-tabs v-model="detailDrawer.tab" @tab-change="loadDetailTab">
          <el-tab-pane label="批次概览" name="overview">
            <el-descriptions :column="4" border>
              <el-descriptions-item label="批次号">{{ detailDrawer.batch.repriceNo }}</el-descriptions-item>
              <el-descriptions-item label="月份">{{ detailDrawer.batch.pricingMonth }}</el-descriptions-item>
              <el-descriptions-item label="业务单元">{{ detailDrawer.batch.businessUnitType }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ statusText(detailDrawer.batch.status) }}</el-descriptions-item>
              <el-descriptions-item label="执行端">{{ detailDrawer.batch.executionBackend || '-' }}</el-descriptions-item>
              <el-descriptions-item label="取价时点">{{ detailDrawer.batch.priceAsOfTime || '-' }}</el-descriptions-item>
              <el-descriptions-item label="BOM口径">{{ detailDrawer.batch.bomSourcePolicy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="引擎版本">{{ detailDrawer.batch.costEngineVersion || '-' }}</el-descriptions-item>
              <el-descriptions-item label="价格版本">{{ detailDrawer.batch.priceVersion || '-' }}</el-descriptions-item>
              <el-descriptions-item label="规则版本">{{ detailDrawer.batch.ruleVersion || '-' }}</el-descriptions-item>
              <el-descriptions-item label="发起人">{{ detailDrawer.batch.createdName || detailDrawer.batch.createdBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="确认人">{{ detailDrawer.batch.confirmedName || detailDrawer.batch.confirmedBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="开始时间">{{ detailDrawer.batch.startedAt || '-' }}</el-descriptions-item>
              <el-descriptions-item label="结束时间">{{ detailDrawer.batch.finishedAt || '-' }}</el-descriptions-item>
            </el-descriptions>
            <div class="progress-block">
              <el-progress :percentage="progressPercent" :status="progressStatus" />
              <div class="progress-text">
                总数 {{ detailDrawer.progress?.totalCount || detailDrawer.batch.totalCount || 0 }}，
                成功 {{ detailDrawer.progress?.successCount || detailDrawer.batch.successCount || 0 }}，
                失败 {{ detailDrawer.progress?.failedCount || detailDrawer.batch.failedCount || 0 }}，
                跳过 {{ detailDrawer.progress?.skippedCount || detailDrawer.batch.skippedCount || 0 }}
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="核算任务" name="tasks">
            <div class="mini-filter">
              <el-select v-model="taskFilters.status" placeholder="全部状态" clearable style="width: 150px" @change="loadTasks">
                <el-option label="待执行" value="PENDING" />
                <el-option label="执行中" value="RUNNING" />
                <el-option label="成功" value="SUCCESS" />
                <el-option label="失败" value="FAILED" />
                <el-option label="跳过" value="SKIPPED" />
              </el-select>
              <el-input v-model="taskFilters.keyword" placeholder="OA/产品/客户/calc_object_key" clearable style="width: 280px" @keyup.enter="loadTasks" />
              <el-button type="primary" @click="loadTasks">查询</el-button>
              <el-button
                v-hasPermi="['price:monthly-reprice:operate']"
                :disabled="!hasFailedTasks"
                @click="retryFailedTasks"
              >
                重试失败任务
              </el-button>
            </div>
            <el-table :data="taskRows" stripe v-loading="loading.tasks">
              <el-table-column prop="calcObjectKey" label="核算对象" min-width="260" show-overflow-tooltip />
              <el-table-column prop="oaNo" label="OA 单号" min-width="160" />
              <el-table-column prop="productCode" label="产品料号" min-width="140" />
              <el-table-column prop="packageMethod" label="包装" width="100" />
              <el-table-column prop="customerName" label="客户" min-width="150" />
              <el-table-column prop="status" label="状态" width="110" />
              <el-table-column prop="retryCount" label="重试" width="80" align="right" />
              <el-table-column prop="workerId" label="Worker" width="130" />
              <el-table-column prop="lastErrorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
            </el-table>
            <BasePagination v-model:current-page="taskPager.page" v-model:page-size="taskPager.pageSize" :total="taskPager.total" />
          </el-tab-pane>
          <el-tab-pane label="调价结果" name="results">
            <el-table :data="detailResultRows" stripe v-loading="loading.detailResults">
              <el-table-column prop="oaNo" label="OA 单号" min-width="160" />
              <el-table-column prop="productCode" label="产品料号" min-width="140" />
              <el-table-column prop="customerName" label="客户" min-width="150" />
              <el-table-column label="总成本" width="120" align="right">
                <template #default="{ row }">{{ formatAmount(row.totalCost) }}</template>
              </el-table-column>
              <el-table-column prop="calcStatus" label="状态" width="110" />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button type="primary" link @click="openResultDrill(row)">明细</el-button>
                </template>
              </el-table-column>
            </el-table>
            <BasePagination v-model:current-page="detailResultPager.page" v-model:page-size="detailResultPager.pageSize" :total="detailResultPager.total" />
          </el-tab-pane>
          <el-tab-pane label="审计日志" name="audit">
            <el-table :data="detailAuditRows" stripe v-loading="loading.detailAudit">
              <el-table-column prop="operationTime" label="操作时间" width="170" />
              <el-table-column prop="operationType" label="操作类型" width="160" />
              <el-table-column prop="operatorName" label="操作人" width="130" />
              <el-table-column prop="changeSummary" label="说明" min-width="260" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <el-drawer v-model="drillDrawer.visible" size="88%" :title="drillTitle">
      <el-tabs v-model="drillDrawer.tab" @tab-change="loadDrillItems">
        <el-tab-pane label="产品成本计算一览表" name="sheet">
          <div class="sheet-wrapper">
            <table class="sheet-table">
              <colgroup>
                <col class="col-1" />
                <col class="col-2" />
                <col class="col-3" />
                <col class="col-4" />
                <col class="col-5" />
                <col class="col-6" />
                <col class="col-7" />
                <col class="col-8" />
                <col class="col-9" />
                <col class="col-10" />
              </colgroup>
              <tbody>
                <tr class="title-row no-left-strong">
                  <td colspan="10">产品成本计算一览表</td>
                </tr>
                <tr class="blank-row no-left-strong">
                  <td colspan="10"></td>
                </tr>
                <tr>
                  <td class="meta-label">OA单号</td>
                  <td>{{ drillDrawer.result?.oaNo || '' }}</td>
                  <td class="meta-label">报价员</td>
                  <td></td>
                  <td></td>
                  <td class="meta-label">{{ materials[0] }}</td>
                  <td></td>
                  <td class="meta-label">{{ materials[4] }}</td>
                  <td></td>
                  <td>元/公斤</td>
                </tr>
                <tr>
                  <td class="meta-label">客户名称</td>
                  <td>{{ drillDrawer.result?.customerName || '' }}</td>
                  <td class="meta-label">客户编码</td>
                  <td></td>
                  <td></td>
                  <td class="meta-label">{{ materials[1] }}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="meta-label">产品名称</td>
                  <td></td>
                  <td class="meta-label">物料编码</td>
                  <td>{{ drillDrawer.result?.productCode || '' }}</td>
                  <td></td>
                  <td class="meta-label">{{ materials[2] }}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="meta-label">产品型号</td>
                  <td>{{ drillDrawer.result?.packageMethod || '' }}</td>
                  <td class="meta-label">产品图号</td>
                  <td></td>
                  <td></td>
                  <td class="meta-label">{{ materials[3] }}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr class="part-header-row">
                  <td>部品名</td>
                  <td>部品料号</td>
                  <td>部品图号</td>
                  <td>部品单价</td>
                  <td>部品用量</td>
                  <td>部品价格</td>
                  <td>材质</td>
                  <td>形态属性</td>
                  <td>价格来源</td>
                  <td>备注</td>
                </tr>
                <tr
                  v-for="(item, index) in monthlySheetPartRows"
                  :key="`${item.partCode}-${index}`"
                  :class="{ 'row-miss': item.priceSource === 'NO_ROUTE' || item.priceSource === 'ERROR' }"
                >
                  <td>{{ item.partName }}</td>
                  <td class="part-code">{{ item.partCode }}</td>
                  <td>{{ item.drawingNo }}</td>
                  <td>{{ item.unitPrice }}</td>
                  <td>{{ item.qty }}</td>
                  <td>{{ item.amount }}</td>
                  <td>{{ item.material }}</td>
                  <td>{{ item.shape }}</td>
                  <td>{{ item.priceSource }}</td>
                  <td>{{ item.remark }}</td>
                </tr>
                <tr class="left-blue">
                  <td class="left-label">大修费</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyCostAmount('OVERHAUL') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="left-blue">
                  <td class="left-label">工装零星修理费</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyCostAmount('TOOLING_REPAIR') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="left-blue">
                  <td class="left-label">水电费</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyCostAmount('WATER_POWER') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="left-blue">
                  <td class="left-label">其他费用</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyCostAmount('DEPT_OTHER') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr v-for="(item, index) in monthlyAuxItems" :key="`${item.costItemCode}-${index}`">
                  <td class="left-label">{{ item.costItemName }}</td>
                  <td></td>
                  <td>{{ getAuxCode(item.costItemCode) }}</td>
                  <td></td><td></td>
                  <td class="formula">{{ formatSheetAmount(item.amount) }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="section-row">
                  <td colspan="3" class="section-center">材料费</td>
                  <td></td><td></td>
                  <td class="amount">{{ getMonthlyCostAmount('MATERIAL') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr>
                  <td class="row-label">直接人工工资</td>
                  <td></td><td></td><td></td><td></td>
                  <td>{{ getMonthlyCostAmount('DIRECT_LABOR') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr>
                  <td class="row-label">辅助人工工资</td>
                  <td></td><td></td><td></td><td></td>
                  <td>{{ getMonthlyCostAmount('INDIRECT_LABOR') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="left-blue">
                  <td class="row-label">净损失率</td>
                  <td></td>
                  <td class="rate">{{ getMonthlyCostRate('LOSS') }}</td>
                  <td></td><td></td>
                  <td>{{ getMonthlyCostAmount('LOSS') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="left-blue">
                  <td class="row-label">制造费用</td>
                  <td></td>
                  <td class="rate">{{ getMonthlyCostRate('MANUFACTURE') }}</td>
                  <td></td><td></td>
                  <td>{{ getMonthlyCostAmount('MANUFACTURE') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="section-row">
                  <td colspan="3" class="section-center">制造成本</td>
                  <td></td><td></td>
                  <td class="amount">{{ getMonthlyCostAmount('MANUFACTURE_COST') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="left-blue">
                  <td class="row-label">产品属性</td>
                  <td></td>
                  <td class="rate">{{ getMonthlyCostCoefficient('ADJUSTED_MANUFACTURE_COST') }}</td>
                  <td></td><td></td>
                  <td class="amount">{{ getMonthlyCostAmount('ADJUSTED_MANUFACTURE_COST') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr>
                  <td class="left-blue" rowspan="3">三项费用</td>
                  <td>管理费用</td>
                  <td>{{ getMonthlyCostRate('MGMT_EXP') }}</td>
                  <td></td><td></td>
                  <td>{{ getMonthlyCostAmount('MGMT_EXP') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr>
                  <td>营业费用</td>
                  <td>{{ getMonthlyCostRate('SALES_EXP') }}</td>
                  <td></td><td></td>
                  <td>{{ getMonthlyCostAmount('SALES_EXP') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr>
                  <td>财务费用</td>
                  <td>{{ getMonthlyCostRate('FIN_EXP') }}</td>
                  <td></td><td></td>
                  <td>{{ getMonthlyCostAmount('FIN_EXP') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="attr-row">
                  <td class="left-label">运费</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyCostAmount('OTHER_EXP_FREIGHT') || '-' }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="attr-row">
                  <td class="left-label">模具费</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyOtherExpenseByName('模具费') || '-' }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="attr-row">
                  <td class="left-label">认证费</td>
                  <td></td><td></td><td></td><td></td>
                  <td class="formula">{{ getMonthlyOtherExpenseByName('认证费') || '-' }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="total-row">
                  <td colspan="3" class="total-label">不含税总成本</td>
                  <td></td><td></td>
                  <td class="amount">{{ getMonthlyCostAmount('TOTAL') }}</td>
                  <td></td><td></td><td></td><td></td>
                </tr>
                <tr class="footer-row">
                  <td>编制：</td>
                  <td></td><td></td><td></td>
                  <td>审核：</td>
                  <td></td><td></td><td></td><td></td><td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="部品明细" name="parts">
          <el-table :data="partRows" stripe v-loading="loading.parts">
            <el-table-column prop="lineNo" label="行号" width="80" />
            <el-table-column prop="partName" label="部品名" min-width="150" />
            <el-table-column prop="partCode" label="部品料号" min-width="140" />
            <el-table-column prop="partDrawingNo" label="图号" min-width="140" />
            <el-table-column prop="material" label="材质" width="110" />
            <el-table-column prop="shapeAttr" label="形态" width="110" />
            <el-table-column label="用量" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.quantity) }}</template>
            </el-table-column>
            <el-table-column label="单价" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="金额" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="priceSource" label="价格来源" width="130" />
            <el-table-column prop="calcMessage" label="备注" min-width="180" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="成本项明细" name="costs">
          <el-table :data="costRows" stripe v-loading="loading.costs">
            <el-table-column prop="lineNo" label="行号" width="80" />
            <el-table-column prop="costItemCode" label="成本项编码" min-width="140" />
            <el-table-column prop="costItemName" label="成本项" min-width="160" />
            <el-table-column label="基数" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.baseAmount) }}</template>
            </el-table-column>
            <el-table-column label="费率" width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.rate) }}</template>
            </el-table-column>
            <el-table-column label="金额" width="120" align="right">
              <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="calcFormula" label="公式" min-width="220" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <el-dialog v-model="createDialog.visible" title="发起月度调价" width="620px">
      <el-alert
        type="warning"
        show-icon
        :closable="false"
        title="本次操作会锁定所选业务单元；锁定期间普通报价员不能发起该业务单元 OA 成本核算；月度调价结果不会覆盖原 OA 报价结果；失败数为 0 后才允许确认。"
      />
      <el-form label-width="110px" class="create-form">
        <el-form-item label="调价月份">
          <el-date-picker
            v-model="createForm.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-input v-model="createForm.businessUnitType" placeholder="COMMERCIAL" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="loading.create" @click="submitCreateBatch">确定发起</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  cancelMonthlyRepriceBatch,
  confirmMonthlyRepriceBatch,
  createMonthlyRepriceBatch,
  fetchMonthlyRepriceAuditLogs,
  fetchMonthlyRepriceBatches,
  fetchMonthlyRepriceCostItems,
  fetchMonthlyRepricePartItems,
  fetchMonthlyRepriceProgress,
  fetchMonthlyRepriceResults,
  fetchMonthlyRepriceTasks,
  retryMonthlyRepriceFailedTasks,
} from '../api/monthlyReprice'
import { useUserStore } from '../store/modules/user'

const userStore = useUserStore()

const activeTab = ref('batches')
const pollTimer = ref(null)
const loading = reactive({
  batches: false,
  results: false,
  audit: false,
  tasks: false,
  detailResults: false,
  detailAudit: false,
  parts: false,
  costs: false,
  create: false,
})

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const businessUnit = () => userStore.businessUnitType || ''

const batchStatusOptions = [
  { label: '运行中', value: 'RUNNING' },
  { label: '待确认', value: 'WAIT_CONFIRM' },
  { label: '已确认', value: 'CONFIRMED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '失败', value: 'FAILED' },
]

const batchFilters = reactive({
  pricingMonth: currentMonth(),
  businessUnitType: businessUnit(),
  repriceNo: '',
  status: '',
})
const batchPager = reactive({ page: 1, pageSize: 20, total: 0 })
const batchRows = ref([])

const resultFilters = reactive({
  pricingMonth: currentMonth(),
  businessUnitType: businessUnit(),
  repriceNo: '',
  oaNo: '',
  productCode: '',
  customerName: '',
  calcStatus: '',
})
const resultPager = reactive({ page: 1, pageSize: 20, total: 0 })
const resultRows = ref([])
const selectedResultBatch = ref(null)

const auditFilters = reactive({
  pricingMonth: currentMonth(),
  businessUnitType: businessUnit(),
  repriceNo: '',
  operationType: '',
  operatorName: '',
})
const auditPager = reactive({ page: 1, pageSize: 20, total: 0 })
const auditRows = ref([])

const detailDrawer = reactive({
  visible: false,
  tab: 'overview',
  batch: null,
  progress: null,
})
const taskFilters = reactive({ status: '', keyword: '' })
const taskPager = reactive({ page: 1, pageSize: 20, total: 0 })
const taskRows = ref([])
const detailResultPager = reactive({ page: 1, pageSize: 20, total: 0 })
const detailResultRows = ref([])
const detailAuditRows = ref([])

const drillDrawer = reactive({
  visible: false,
  tab: 'parts',
  result: null,
})
const partRows = ref([])
const costRows = ref([])

const createDialog = reactive({ visible: false })
const createForm = reactive({
  pricingMonth: currentMonth(),
  businessUnitType: businessUnit(),
  remark: '',
})

const materials = ['不锈钢-316L', '不锈钢-304', '电解铜', '电解锌', '电解铝']

const detailTitle = computed(() => `月度调价批次：${detailDrawer.batch?.repriceNo || ''}`)
const drillTitle = computed(() => {
  const row = drillDrawer.result
  return row ? `${row.oaNo || '-'} / ${row.productCode || '-'} 明细` : '调价结果明细'
})
const hasFailedTasks = computed(() => Number(detailDrawer.batch?.failedCount || 0) > 0)
const progressPercent = computed(() => Number(detailDrawer.progress?.progressPercent || 0))
const progressStatus = computed(() => (progressPercent.value >= 100 ? 'success' : ''))

const statusText = (status) => ({
  RUNNING: '运行中',
  WAIT_CONFIRM: '待确认',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  FAILED: '失败',
  PENDING: '待执行',
}[status] || status || '-')

const statusTagType = (status) => ({
  CONFIRMED: 'success',
  WAIT_CONFIRM: 'warning',
  RUNNING: 'primary',
  FAILED: 'danger',
  CANCELLED: 'info',
}[status] || 'info')

const calcStatusText = (status) => ({
  SUCCESS: '成功',
  FAILED: '失败',
  SKIPPED: '跳过',
}[status] || status || '-')

const calcStatusTagType = (status) => ({
  SUCCESS: 'success',
  FAILED: 'danger',
  SKIPPED: 'info',
}[status] || 'info')

const isTerminalStatus = (status) => ['CONFIRMED', 'CANCELLED', 'FAILED'].includes(status)
const canConfirm = (row) => row?.status === 'WAIT_CONFIRM' && Number(row?.failedCount || 0) === 0

const formatAmount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

const formatRate = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number.toFixed(4)}`
}

const toText = (value) => (value === null || value === undefined ? '' : String(value))
const formatSheetAmount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(3) : ''
}
const formatSheetRate = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : ''
}
const formatSheetCoefficient = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : ''
}

const monthlySheetPartRows = computed(() =>
  partRows.value.map((item) => ({
    partName: toText(item.partName),
    partCode: toText(item.partCode),
    drawingNo: toText(item.partDrawingNo),
    unitPrice: formatSheetAmount(item.unitPrice),
    qty: formatSheetAmount(item.quantity),
    amount: formatSheetAmount(item.amount),
    material: toText(item.material),
    shape: toText(item.shapeAttr),
    priceSource: toText(item.priceSource),
    remark: toText(item.calcMessage),
  }))
)
const monthlyCostMap = computed(() => {
  const map = {}
  for (const item of costRows.value) {
    if (item?.costItemCode) {
      map[item.costItemCode] = item
    }
  }
  return map
})
const monthlyAuxItems = computed(() =>
  costRows.value.filter((item) => String(item?.costItemCode || '').startsWith('AUX_'))
)
const monthlyOtherExpenseItems = computed(() =>
  costRows.value.filter((item) => String(item?.costItemCode || '').startsWith('OTHER_EXP_'))
)
const getMonthlyCostAmount = (code) => formatSheetAmount(monthlyCostMap.value?.[code]?.amount)
const getMonthlyCostRate = (code) => formatSheetRate(monthlyCostMap.value?.[code]?.rate)
const getMonthlyCostCoefficient = (code) =>
  formatSheetCoefficient(monthlyCostMap.value?.[code]?.rate)
const getMonthlyOtherExpenseByName = (name) => {
  const item = monthlyOtherExpenseItems.value.find((candidate) => candidate.costItemName === name)
  return item ? formatSheetAmount(item.amount) : ''
}
const getAuxCode = (value) => String(value || '').replace(/^AUX_/, '')

const pagePayload = (filters, pager) => ({
  ...filters,
  page: pager.page,
  pageSize: pager.pageSize,
})

const loadBatches = async () => {
  loading.batches = true
  try {
    const data = await fetchMonthlyRepriceBatches(pagePayload(batchFilters, batchPager))
    batchRows.value = data?.list || []
    batchPager.total = Number(data?.total || 0)
  } catch (error) {
    batchRows.value = []
    ElMessage.error(error?.message || '查询月度调价批次失败')
  } finally {
    loading.batches = false
  }
}

const resolveResultBatch = async () => {
  if (resultFilters.repriceNo) {
    return {
      repriceNo: resultFilters.repriceNo,
      pricingMonth: resultFilters.pricingMonth,
      businessUnitType: resultFilters.businessUnitType,
    }
  }
  // 结果查询不指定批次时，优先看刚算完待确认的结果；没有待确认结果再看最新已确认结果。
  const waitConfirmData = await fetchMonthlyRepriceBatches({
    pricingMonth: resultFilters.pricingMonth,
    businessUnitType: resultFilters.businessUnitType,
    status: 'WAIT_CONFIRM',
    page: 1,
    pageSize: 1,
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  })
  if (waitConfirmData?.list?.[0]) {
    return waitConfirmData.list[0]
  }
  const data = await fetchMonthlyRepriceBatches({
    pricingMonth: resultFilters.pricingMonth,
    businessUnitType: resultFilters.businessUnitType,
    status: 'CONFIRMED',
    page: 1,
    pageSize: 1,
    sortBy: 'confirmedAt',
    sortDirection: 'desc',
  })
  return data?.list?.[0] || null
}

const loadResults = async () => {
  loading.results = true
  try {
    const batch = await resolveResultBatch()
    selectedResultBatch.value = batch
    if (!batch?.repriceNo) {
      resultRows.value = []
      resultPager.total = 0
      return
    }
    const data = await fetchMonthlyRepriceResults(batch.repriceNo, {
      oaNo: resultFilters.oaNo,
      productCode: resultFilters.productCode,
      customerName: resultFilters.customerName,
      calcStatus: resultFilters.calcStatus,
      page: resultPager.page,
      pageSize: resultPager.pageSize,
    })
    resultRows.value = data?.list || []
    resultPager.total = Number(data?.total || 0)
  } catch (error) {
    resultRows.value = []
    resultPager.total = 0
    ElMessage.error(error?.message || '查询月度调价结果失败')
  } finally {
    loading.results = false
  }
}

const loadAuditLogs = async () => {
  loading.audit = true
  try {
    const data = await fetchMonthlyRepriceAuditLogs(pagePayload(auditFilters, auditPager))
    auditRows.value = data?.list || []
    auditPager.total = Number(data?.total || 0)
  } catch (error) {
    auditRows.value = []
    ElMessage.error(error?.message || '查询审计日志失败')
  } finally {
    loading.audit = false
  }
}

const loadProgress = async () => {
  if (!detailDrawer.batch?.repriceNo) return
  detailDrawer.progress = await fetchMonthlyRepriceProgress(detailDrawer.batch.repriceNo)
}

const loadTasks = async () => {
  if (!detailDrawer.batch?.repriceNo) return
  loading.tasks = true
  try {
    const data = await fetchMonthlyRepriceTasks(detailDrawer.batch.repriceNo, pagePayload(taskFilters, taskPager))
    taskRows.value = data?.list || []
    taskPager.total = Number(data?.total || 0)
  } finally {
    loading.tasks = false
  }
}

const loadDetailResults = async () => {
  if (!detailDrawer.batch?.repriceNo) return
  loading.detailResults = true
  try {
    const data = await fetchMonthlyRepriceResults(detailDrawer.batch.repriceNo, {
      page: detailResultPager.page,
      pageSize: detailResultPager.pageSize,
    })
    detailResultRows.value = data?.list || []
    detailResultPager.total = Number(data?.total || 0)
  } finally {
    loading.detailResults = false
  }
}

const loadDetailAuditLogs = async () => {
  if (!detailDrawer.batch?.repriceNo) return
  loading.detailAudit = true
  try {
    const data = await fetchMonthlyRepriceAuditLogs({ repriceNo: detailDrawer.batch.repriceNo, page: 1, pageSize: 50 })
    detailAuditRows.value = data?.list || []
  } finally {
    loading.detailAudit = false
  }
}

const loadDetailTab = async () => {
  if (detailDrawer.tab === 'overview') await loadProgress()
  if (detailDrawer.tab === 'tasks') await loadTasks()
  if (detailDrawer.tab === 'results') await loadDetailResults()
  if (detailDrawer.tab === 'audit') await loadDetailAuditLogs()
}

const openBatchDetail = async (row) => {
  detailDrawer.batch = row
  detailDrawer.tab = 'overview'
  detailDrawer.visible = true
  await loadProgress()
  startPollingIfNeeded(row)
}

const startPollingIfNeeded = (row) => {
  clearPolling()
  if (!['RUNNING', 'WAIT_CONFIRM'].includes(row?.status)) return
  pollTimer.value = window.setInterval(async () => {
    await loadProgress()
    if (!['RUNNING', 'WAIT_CONFIRM'].includes(detailDrawer.progress?.status)) {
      clearPolling()
      await loadBatches()
    }
  }, 5000)
}

const clearPolling = () => {
  if (pollTimer.value) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

const openResultDrill = async (row) => {
  drillDrawer.result = row
  drillDrawer.tab = 'sheet'
  drillDrawer.visible = true
  await loadDrillItems()
}

const drillRepriceNo = () => drillDrawer.result?.repriceNo || selectedResultBatch.value?.repriceNo || detailDrawer.batch?.repriceNo

const loadDrillItems = async () => {
  const repriceNo = drillRepriceNo()
  const resultId = drillDrawer.result?.id
  if (!repriceNo || !resultId) return
  if (drillDrawer.tab === 'sheet') {
    loading.parts = true
    loading.costs = true
    try {
      const [parts, costs] = await Promise.all([
        fetchMonthlyRepricePartItems(repriceNo, resultId),
        fetchMonthlyRepriceCostItems(repriceNo, resultId),
      ])
      partRows.value = parts
      costRows.value = costs
    } finally {
      loading.parts = false
      loading.costs = false
    }
  } else if (drillDrawer.tab === 'parts') {
    loading.parts = true
    try {
      partRows.value = await fetchMonthlyRepricePartItems(repriceNo, resultId)
    } finally {
      loading.parts = false
    }
  } else {
    loading.costs = true
    try {
      costRows.value = await fetchMonthlyRepriceCostItems(repriceNo, resultId)
    } finally {
      loading.costs = false
    }
  }
}

const openCreateDialog = async () => {
  createForm.pricingMonth = currentMonth()
  createForm.businessUnitType = businessUnit()
  createForm.remark = ''
  createDialog.visible = true
}

const submitCreateBatch = async () => {
  if (!createForm.pricingMonth || !createForm.businessUnitType) {
    ElMessage.warning('调价月份和业务单元必填')
    return
  }
  loading.create = true
  try {
    await createMonthlyRepriceBatch({ ...createForm })
    ElMessage.success('月度调价批次已创建')
    createDialog.visible = false
    await loadBatches()
  } catch (error) {
    ElMessage.error(error?.message || '发起月度调价失败')
  } finally {
    loading.create = false
  }
}

const confirmBatch = async (row) => {
  if (!canConfirm(row)) return
  await ElMessageBox.confirm('确认后该批次作为正式月度调价结果。是否继续？', '确认月度调价', {
    type: 'warning',
  })
  await confirmMonthlyRepriceBatch(row.repriceNo)
  ElMessage.success('已确认')
  await loadBatches()
}

const cancelBatch = async (row) => {
  await ElMessageBox.confirm('确定取消该月度调价批次？', '取消批次', { type: 'warning' })
  await cancelMonthlyRepriceBatch(row.repriceNo)
  ElMessage.success('已取消')
  await loadBatches()
}

const retryFailedTasks = async () => {
  if (!detailDrawer.batch?.repriceNo) return
  await retryMonthlyRepriceFailedTasks(detailDrawer.batch.repriceNo)
  ElMessage.success('已提交失败任务重试')
  await loadTasks()
}

const refreshActiveTab = () => {
  if (activeTab.value === 'batches') loadBatches()
  if (activeTab.value === 'results') loadResults()
  if (activeTab.value === 'audit') loadAuditLogs()
}

const resetBatchFilters = () => {
  Object.assign(batchFilters, { pricingMonth: currentMonth(), businessUnitType: businessUnit(), repriceNo: '', status: '' })
  batchPager.page = 1
  loadBatches()
}

const resetResultFilters = () => {
  Object.assign(resultFilters, { pricingMonth: currentMonth(), businessUnitType: businessUnit(), repriceNo: '', oaNo: '', productCode: '', customerName: '', calcStatus: '' })
  resultPager.page = 1
  loadResults()
}

const resetAuditFilters = () => {
  Object.assign(auditFilters, { pricingMonth: currentMonth(), businessUnitType: businessUnit(), repriceNo: '', operationType: '', operatorName: '' })
  auditPager.page = 1
  loadAuditLogs()
}

watch(() => [batchPager.page, batchPager.pageSize], loadBatches)
watch(() => [resultPager.page, resultPager.pageSize], loadResults)
watch(() => [auditPager.page, auditPager.pageSize], loadAuditLogs)
watch(() => [taskPager.page, taskPager.pageSize], loadTasks)
watch(() => [detailResultPager.page, detailResultPager.pageSize], loadDetailResults)
watch(() => detailDrawer.visible, (visible) => {
  if (!visible) clearPolling()
})

onMounted(loadBatches)
onBeforeUnmount(clearPolling)
</script>

<style scoped>
.monthly-reprice-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head,
.page-actions,
.mini-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.page-subtitle,
.selected-batch,
.progress-text {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
}

.main-tabs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.progress-block,
.create-form {
  margin-top: 16px;
}

.mini-filter {
  justify-content: flex-start;
  margin-bottom: 12px;
}

.sheet-wrapper {
  overflow-x: auto;
  background: #fff;
}

.sheet-table {
  width: 100%;
  min-width: 980px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 12px;
  color: #1f2a37;
}

.sheet-table td {
  border: 1px solid #8b8b8b;
  padding: 6px 8px;
  text-align: center;
}

.sheet-table td:first-child {
  border-left: 2px solid #111;
}

.sheet-table td:last-child {
  border-right: 2px solid #111;
}

.no-left-strong td:first-child {
  border-left: 1px solid #8b8b8b;
}

.title-row td {
  font-size: 18px;
  font-weight: 700;
  padding: 12px 0 6px;
}

.blank-row td {
  height: 10px;
}

.meta-label,
.part-header-row td,
.section-row td,
.left-label,
.row-label,
.left-blue td:first-child,
.attr-row td:nth-child(-n + 3),
.total-row td,
.footer-row td {
  font-weight: 700;
}

.part-header-row td {
  background: #49a8ff;
  color: #fff;
}

.part-code {
  white-space: nowrap;
  font-size: 11px;
}

.section-center,
.total-label {
  text-align: center;
}

.left-label,
.row-label,
.formula,
.footer-row td {
  text-align: left;
}

.rate {
  font-weight: 600;
}

.amount {
  font-weight: 700;
}

.footer-row td {
  border-bottom: 2px solid #111;
}

.row-miss td {
  background: #fde2e2 !important;
  color: #c0392b !important;
}

.col-1,
.col-2,
.col-3,
.col-4,
.col-5,
.col-6,
.col-7,
.col-8,
.col-9 {
  width: 90px;
}

.col-10 {
  width: 110px;
}
</style>
