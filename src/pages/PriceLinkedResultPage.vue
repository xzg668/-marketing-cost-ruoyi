<template>
  <div class="linked-result">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">
          联动价格表
          <!-- T6：顶部徽章 —— 行局部绑定待确认数量 -->
          <el-tag
            v-if="pendingTotal > 0"
            class="filter-badge"
            type="danger"
            effect="light"
            @click="openPendingList"
          >
            待绑定 {{ pendingTotal }} 🔴
          </el-tag>
          <el-tag
            v-else-if="pendingLoaded"
            class="filter-badge"
            type="success"
            effect="light"
          >
            绑定已全部确认
          </el-tag>
        </div>
        <div class="filter-actions">
          <el-button v-if="returnToWorkbenchVisible" @click="returnToWorkbench">
            返回核算工作台
          </el-button>
          <el-button
            v-hasPermi="['price:linked-item:import']"
            :loading="importing"
            @click="openMonthlyImport"
          >
            导入月度联动价与影响因素 Excel
          </el-button>
          <!-- T6：绑定 CSV 导入 —— 与联动价导入分开，字段契约不同 -->
          <el-upload
            v-hasPermi="['price:linked:binding:admin']"
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".csv"
            :on-change="handleBindingCsvChange"
          >
            <el-button :loading="bindingImporting">绑定 CSV</el-button>
          </el-upload>
          <el-button
            v-hasPermi="['price:linked-item:add']"
            type="primary"
            @click="openCreate"
          >
            新增
          </el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="业务单元">
          <el-input
            v-model="filters.businessUnitType"
            placeholder="COMMERCIAL"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="filters.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="MAT-1001" />
        </el-form-item>
        <el-form-item label="导入状态">
          <el-select
            v-model="filters.importStatus"
            placeholder="全部"
            clearable
            style="width: 150px"
          >
            <el-option label="全部" value="" />
            <el-option label="成功" value="SUCCESS" />
            <el-option label="冲突" value="CONFLICT" />
            <el-option label="失败" value="FAILED" />
            <el-option label="人工跳过" value="MANUAL_SKIPPED" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定状态">
          <el-select
            v-model="filters.bindingStatus"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option label="全部" value="" />
            <el-option label="已自动绑定" value="AUTO" />
            <el-option label="冲突" value="CONFLICT" />
            <el-option label="失败" value="FAILED" />
            <el-option label="人工绑定" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="monthly-import-card">
      <div class="section-header">
        <div>
          <div class="section-title">月度导入结果</div>
          <div class="section-subtitle">
            {{ lastImportMetaText }}
          </div>
          <div class="section-subtitle">
            本区只用于核对本次导入和自动绑定结果；影响因素长期维护请进入影响因素表。
          </div>
        </div>
        <div class="section-actions">
          <el-button link type="primary" @click="goFactorMonthlySummary">
            去影响因素表查看本月汇总
          </el-button>
          <el-button link type="primary" @click="toggleFactorPreview">
            {{ showFactorPreview ? '收起本次影响因素' : '本次影响因素预览' }}
          </el-button>
          <el-button
            v-hasPermi="['price:linked-item:import-history:list']"
            link
            type="primary"
            @click="toggleImportLogs"
          >
            {{ showImportLogs ? '收起日志' : '导入历史和日志' }}
          </el-button>
        </div>
      </div>

      <div class="summary-grid">
        <div
          v-for="item in importSummaryItems"
          :key="item.key"
          class="summary-item"
        >
          <div class="summary-label">{{ item.label }}</div>
          <div class="summary-value">
            <el-tag v-if="item.tag" :type="item.tag" effect="light">
              {{ item.value }}
            </el-tag>
            <span v-else>{{ item.value }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasQuoteBaseDetectData" class="quote-base-summary">
        <div>
          <div class="section-title">公共基价识别</div>
          <div class="section-subtitle">
            本次导入已完成 OA 公共基价识别，明细请到影响因素表查看和维护。
          </div>
        </div>
        <div class="quote-base-stats">
          <div>
            <el-tag type="success" effect="light">
              已识别 {{ quoteBaseRecognizedCount }} 条
            </el-tag>
            <el-tag :type="quoteBaseConflictCount ? 'danger' : 'info'" effect="light">
              冲突 {{ quoteBaseConflictCount }} 条
            </el-tag>
            <el-tag type="info" effect="light">
              未识别 {{ quoteBaseUnrecognizedCount }} 条
            </el-tag>
          </div>
          <el-button link type="primary" @click="goFactorMonthlySummary">
            去影响因素表查看公共基价
          </el-button>
        </div>
      </div>

      <el-table
        v-if="showFactorPreview"
        :data="factorPreviewRows"
        class="result-table"
        size="small"
        border
        empty-text="暂无影响因素明细"
      >
        <el-table-column prop="seqNo" label="序号" width="80" />
        <el-table-column prop="factorName" label="价表影响因素名称" min-width="160" />
        <el-table-column prop="shortName" label="简称" width="120" />
        <el-table-column prop="priceSource" label="取价来源" width="120" />
        <el-table-column prop="newPrice" label="本月价格" width="120" />
        <el-table-column prop="oldPrice" label="原价格" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="uploadedBy" label="上传人" width="100" />
        <el-table-column prop="uploadedAt" label="上传时间" width="160" />
        <el-table-column prop="action" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="monthlyActionTag(row.action)" effect="light">
              {{ monthlyActionText(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceSheetName" label="来源 sheet" min-width="140" />
        <el-table-column prop="sourceRowNumber" label="来源行号" width="100" />
      </el-table>

      <el-tabs v-if="hasImportDetails" v-model="importDetailTab" class="result-tabs">
        <el-tab-pane label="冲突处理" name="conflicts">
          <el-table
            :data="conflictRows"
            size="small"
            border
            empty-text="本次没有冲突项"
          >
            <el-table-column prop="conflictTypeText" label="冲突类型" width="140" />
            <el-table-column prop="materialCode" label="料号" width="140" />
            <el-table-column prop="tokenName" label="token" width="150" />
            <el-table-column prop="factorName" label="影响因素" min-width="150" />
            <el-table-column prop="priceText" label="价格差异" width="150" />
            <el-table-column prop="existingFactorIdentity" label="历史绑定影响因素" width="160" />
            <el-table-column prop="newFactorIdentity" label="本次公式识别影响因素" width="170" />
            <el-table-column prop="refText" label="引用位置" width="160" />
            <el-table-column prop="formula" label="本次公式" min-width="240" />
            <el-table-column prop="reason" label="冲突原因" min-width="220" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.conflictType === 'BINDING_HISTORY'"
                  v-hasPermi="['price:linked:binding:admin']"
                  link
                  type="primary"
                  @click="openBindingByMaterial(row)"
                >
                  进入人工绑定
                </el-button>
                <el-button
                  v-if="row.conflictType === 'BINDING_HISTORY'"
                  v-hasPermi="['price:linked:binding:admin']"
                  link
                  type="info"
                  @click="keepManualBinding(row)"
                >
                  保持人工绑定
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="失败明细" name="failures">
          <el-table
            :data="failedRows"
            size="small"
            border
            empty-text="本次没有失败明细"
          >
            <el-table-column prop="rowNumber" label="Excel 行号" width="110" />
            <el-table-column prop="failureTypeText" label="失败类型" width="150" />
            <el-table-column prop="materialCode" label="料号" width="140" />
            <el-table-column prop="refText" label="影响因素引用" width="160" />
            <el-table-column prop="formula" label="公式原文" min-width="260" />
            <el-table-column prop="message" label="失败原因" min-width="240" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.formula" link type="primary" @click="copyFormula(row.formula)">
                  查看公式原文
                </el-button>
                <el-button
                  v-if="row.canOpenBinding"
                  v-hasPermi="['price:linked:binding:admin']"
                  link
                  type="primary"
                  @click="openBindingByMaterial(row)"
                >
                  人工绑定
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <el-form
        v-if="showImportLogs"
        :inline="true"
        class="history-filter"
        label-width="80px"
      >
        <el-form-item label="历史范围">
          <el-select
            v-model="importHistoryFilter.scope"
            style="width: 160px"
            @change="onImportHistoryScopeChange"
          >
            <el-option label="我的导入" value="mine" />
            <el-option
              v-if="canViewAllUploaders"
              label="全部上传人"
              value="all"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canViewAllUploaders" label="上传人">
          <el-input
            v-model="importHistoryFilter.uploadedBy"
            placeholder="为空表示全部"
            clearable
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadImportHistory({ loadLatest: true })">
            查询历史
          </el-button>
          <el-button
            v-if="importHistoryLimit < 50"
            @click="loadMoreImportHistory"
          >
            查看更多
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="showImportLogs" class="history-hint">
        默认显示当前月份、当前业务单元下最近 {{ importHistoryLimit }} 条导入记录；普通用户只看自己的记录。
      </div>

      <el-table
        v-if="showImportLogs"
        :data="importHistoryRows"
        class="result-table"
        size="small"
        border
        v-loading="importHistoryLoading"
        empty-text="暂无导入历史"
      >
        <el-table-column prop="batchId" label="上传批次ID" width="180" />
        <el-table-column prop="fileName" label="文件名" min-width="180" />
        <el-table-column prop="pricingMonth" label="月份" width="100" />
        <el-table-column prop="businessUnitType" label="业务单元" width="120" />
        <el-table-column prop="uploadedBy" label="上传人" width="120" />
        <el-table-column prop="uploadedAt" label="上传时间" width="170" />
        <el-table-column prop="summary" label="结果摘要" min-width="260" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="loadImportBatchDetail(row.batchId)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-table
        v-if="showImportLogs && bindingLogRows.length"
        :data="bindingLogRows"
        class="result-table"
        size="small"
        border
      >
        <el-table-column prop="createdAt" label="时间" width="170" />
        <el-table-column prop="materialCode" label="料号" width="140" />
        <el-table-column prop="tokenName" label="变量" width="130" />
        <el-table-column prop="action" label="动作" width="130" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="factorIdentityId" label="影响因素ID" width="120" />
        <el-table-column prop="sourceText" label="来源" min-width="180" />
        <el-table-column prop="message" label="日志" min-width="260" />
      </el-table>
    </el-card>

    <el-card shadow="never">
      <el-table :data="visibleRows" stripe v-loading="loading">
        <el-table-column prop="orgCode" label="组织" width="90" />
        <el-table-column prop="sourceName" label="来源" width="120" />
        <el-table-column prop="supplierName" label="供应商名称" min-width="140" />
        <el-table-column prop="supplierCode" label="供应商代码" width="120" />
        <el-table-column prop="purchaseClass" label="采购分类" width="120" />
        <el-table-column prop="materialName" label="物料名称" min-width="140" />
        <el-table-column prop="materialCode" label="物料代码" width="140" />
        <el-table-column label="联动公式" min-width="260">
          <template #default="{ row }">
            <div class="expr-primary">{{ row.formulaExpr }}</div>
            <!-- V36 起：后端 FormulaDisplayRenderer 已派生 formulaExprCn（认得
                 __material/__scrap 占位符）；优先展示后端派生值，客户端
                 toChineseExpr 仅作为兜底（离线模式/旧 DTO 缺字段时）。 -->
            <div class="expr-secondary">
              {{ row.formulaExprCn || toChineseExpr(row.formulaExpr, formulaIndex) }}
            </div>
            <div v-if="row.formulaIssue" class="expr-issue">
              缺少: {{ row.formulaIssue }}
            </div>
            <!-- 方案 A：后端 toDto 跑过 FormulaNormalizer，坏公式行级标红 -->
            <div v-if="row.formulaValid === false" class="expr-issue">
              ⚠️ 公式语法错误：{{ row.formulaError }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="specModel" label="规格型号" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="blankWeight" label="下料量" width="110" />
        <el-table-column prop="netWeight" label="净重" width="110" />
        <el-table-column prop="processFee" label="加工费" width="110" />
        <el-table-column prop="agentFee" label="代理费" width="110" />
        <!-- T24：Excel 金标 = 人工录入的单价，用作对照 -->
        <el-table-column prop="manualPrice" label="Excel 金标" width="120">
          <template #default="{ row }">
            <span v-if="row.manualPrice !== null && row.manualPrice !== ''">
              {{ formatNumber(row.manualPrice) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <!-- T24：系统结果 = 客户端按 formulaExpr 计算出的 calcPrice -->
        <el-table-column label="系统结果" width="120">
          <template #default="{ row }">
            <span v-if="row.calcPrice !== null">
              {{ formatNumber(row.calcPrice) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <!-- T24：差异 = |系统结果 - Excel 金标|，> 0.01 时红色高亮 -->
        <el-table-column label="差异" width="110">
          <template #default="{ row }">
            <span
              v-if="row.diffValue !== null"
              :class="{ 'diff-exceeds': row.diffExceeds }"
            >
              {{ formatNumber(row.diffValue) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="是否含税" width="100">
          <template #default="{ row }">
            {{ row.taxIncluded ? '含税' : '未税' }}
          </template>
        </el-table-column>
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
        <el-table-column prop="effectiveTo" label="失效日期" width="120" />
        <el-table-column prop="orderType" label="订单类型" width="120" />
        <el-table-column prop="quota" label="配额" width="100" />
        <el-table-column prop="pricingMonth" label="月份" width="110" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['price:linked-item:edit']"
              type="primary"
              link
              @click="openEditRow(row)"
            >
              编辑
            </el-button>
            <el-button
              v-hasPermi="['price:linked-item:edit']"
              type="primary"
              link
              @click="openFormulaEditor(row)"
            >
              公式
            </el-button>
            <!-- T24：查看 trace —— 打开右侧抽屉展示计算追踪 -->
            <el-button type="primary" link @click="openTrace(row)">
              查看 Trace
            </el-button>
            <!-- T6：行局部变量绑定 —— 打开抽屉管理 B 组 token → 影响因素 的映射 -->
            <el-button
              v-hasPermi="['price:linked:binding:view']"
              type="primary"
              link
              @click="openBinding(row)"
            >
              变量绑定
              <el-badge
                v-if="row.unbound"
                is-dot
                class="binding-dot"
                type="danger"
              />
            </el-button>
            <el-button
              v-hasPermi="['price:linked-item:remove']"
              type="danger"
              link
              @click="removeRow(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <el-dialog
      v-model="importDialogVisible"
      title="导入月度联动价与影响因素 Excel"
      width="720px"
    >
      <el-form :model="importForm" label-width="120px">
        <el-form-item label="导入月份" required>
          <el-date-picker
            v-model="importForm.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="业务单元" required>
          <el-input v-model="importForm.businessUnitType" placeholder="COMMERCIAL" />
        </el-form-item>
        <el-form-item label="公式生效日期" required>
          <el-date-picker
            v-model="importForm.formulaEffectiveDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择公式生效日期"
          />
        </el-form-item>
        <el-form-item label="影响因素价格冲突" required>
          <el-radio-group v-model="importForm.factorPriceConflictStrategy">
            <el-radio-button label="KEEP_EXISTING">
              保留已有价格，冲突行跳过
            </el-radio-button>
            <el-radio-button label="OVERWRITE">
              仅覆盖冲突价格行
            </el-radio-button>
          </el-radio-group>
          <div class="strategy-help">
            <div>影响因素：缺失新增，相同跳过，价格不同按上方策略处理。</div>
            <div>覆盖只更新本次 Excel 命中的冲突行，不会清空数据库，也不会删除 Excel 未包含的价格。</div>
            <div>联动公式：新料号新增，公式变化生成新版本，公式相同跳过。</div>
          </div>
        </el-form-item>
        <el-form-item label="Excel 文件" required>
          <el-upload
            class="monthly-upload"
            drag
            :limit="1"
            :show-file-list="true"
            :auto-upload="false"
            accept=".xlsx,.xls"
            :on-change="handleMonthlyImportFileChange"
            :on-remove="clearMonthlyImportFile"
          >
            <div class="upload-placeholder">
              <div class="upload-title">请上传同时包含影响因素 sheet 和联动公式 sheet 的 Excel</div>
              <div class="upload-hint">系统会读取原始公式并生成行级变量绑定</div>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>
      <el-steps
        v-if="importing"
        :active="importProgressActiveStep"
        finish-status="success"
        simple
      >
        <el-step
          v-for="step in importStepList"
          :key="step"
          :title="step"
        />
      </el-steps>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitMonthlyImport">
          开始导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="formModel.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="组织">
          <el-input v-model="formModel.orgCode" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="formModel.sourceName" />
        </el-form-item>
        <el-form-item label="供应商名称">
          <el-input v-model="formModel.supplierName" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="formModel.supplierCode" />
        </el-form-item>
        <el-form-item label="采购分类">
          <el-input v-model="formModel.purchaseClass" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="规格型号">
          <el-input v-model="formModel.specModel" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" />
        </el-form-item>
        <el-form-item label="联动公式">
          <el-input
            v-model="formModel.formulaExpr"
            type="textarea"
            :rows="3"
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
          />
        </el-form-item>
        <el-form-item label="中文说明">
          <el-input
            :model-value="formulaPreview"
            type="textarea"
            :rows="2"
            readonly
          />
        </el-form-item>
        <el-form-item label="下料量">
          <el-input v-model="formModel.blankWeight" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input v-model="formModel.netWeight" />
        </el-form-item>
        <el-form-item label="加工费">
          <el-input v-model="formModel.processFee" />
        </el-form-item>
        <el-form-item label="代理费">
          <el-input v-model="formModel.agentFee" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="formModel.manualPrice" />
        </el-form-item>
        <el-form-item label="是否含税">
          <el-select v-model="formModel.taxIncluded" placeholder="选择">
            <el-option label="含税" :value="true" />
            <el-option label="未税" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="formModel.effectiveFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker
            v-model="formModel.effectiveTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-input v-model="formModel.orderType" />
        </el-form-item>
        <el-form-item label="配额">
          <el-input v-model="formModel.quota" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="formulaDialogVisible" title="编辑联动公式" width="640px">
      <div class="formula-meta" v-if="formulaRow">
        <span>物料代码: {{ formulaRow.materialCode }}</span>
        <span>规格型号: {{ formulaRow.specModel || '-' }}</span>
      </div>
      <el-form :model="formulaModel" label-width="90px">
        <el-form-item label="中文公式">
          <el-input
            v-model="formulaModel.formulaExprCn"
            type="textarea"
            :rows="3"
            placeholder="例如 (铜基价*0.59+锌基价*0.41)*下料量+加工费"
          />
        </el-form-item>
        <el-form-item label="表达式(编码)">
          <el-input
            v-model="formulaModel.formulaExpr"
            type="textarea"
            :rows="3"
            readonly
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
          />
        </el-form-item>
        <div v-if="formulaConvertWarning" class="formula-warning">
          {{ formulaConvertWarning }}
        </div>
        <el-form-item label="中文预览">
          <el-input
            :model-value="formulaEditorPreview"
            type="textarea"
            :rows="2"
            readonly
          />
        </el-form-item>
        <el-form-item label="变量">
          <div class="formula-vars">
            <el-tag
              v-for="item in formulaVarOptions"
              :key="item.code"
              class="formula-var-tag"
              @click="appendVariable(item.code)"
            >
              {{ item.label }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formulaDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFormula">保存</el-button>
      </template>
    </el-dialog>

    <!-- T24：trace 抽屉 —— 展示后端 /items/{id}/trace 返回的结构化计算追踪 -->
    <el-drawer
      v-model="traceDrawerVisible"
      title="计算追踪 Trace"
      direction="rtl"
      size="520px"
    >
      <div v-loading="traceLoading" class="trace-drawer">
        <!-- 顶部基础信息：row id + 物料 -->
        <div v-if="traceRow" class="trace-header">
          <div><span class="trace-label">记录 ID</span>{{ traceRow.id }}</div>
          <div>
            <span class="trace-label">物料</span>{{ traceRow.materialCode || '-' }}
          </div>
          <div>
            <span class="trace-label">价格月份</span>{{ traceRow.pricingMonth || '-' }}
          </div>
        </div>

        <!-- 无 trace 或解析失败的降级展示 -->
        <el-alert
          v-if="traceError"
          type="info"
          :closable="false"
          :title="traceError"
          class="trace-empty"
        />

        <!-- 规范化 / 变量 / 求值 / 错误 四段时间轴 -->
        <el-timeline v-if="traceSteps.length > 0" class="trace-timeline">
          <el-timeline-item
            v-for="(step, index) in traceSteps"
            :key="index"
            :type="step.step === 'error' ? 'danger' : 'primary'"
            :timestamp="step.title"
            placement="top"
          >
            <!-- normalize：原始表达式 → 规范化表达式 -->
            <div v-if="step.step === 'normalize'" class="trace-block">
              <div class="trace-row">
                <span class="trace-label">原始</span>
                <code>{{ step.rawExpr || '-' }}</code>
              </div>
              <div class="trace-row">
                <span class="trace-label">规范化</span>
                <code>{{ step.normalizedExpr || '-' }}</code>
              </div>
            </div>

            <!-- resolve：变量赋值列表 -->
            <div v-else-if="step.step === 'resolve'" class="trace-block">
              <el-table
                :data="step.variables"
                size="small"
                border
                stripe
                class="trace-vars-table"
              >
                <el-table-column prop="code" label="变量" width="180" />
                <el-table-column prop="value" label="取值" />
              </el-table>
            </div>

            <!-- evaluate：系统结果 + legacy 对照 + diff -->
            <div v-else-if="step.step === 'evaluate'" class="trace-block">
              <div class="trace-row">
                <span class="trace-label">结果</span>
                <strong>{{ step.result ?? '-' }}</strong>
              </div>
              <div v-if="step.legacyResult !== null" class="trace-row">
                <span class="trace-label">Legacy</span>
                <span>{{ step.legacyResult }}</span>
              </div>
              <div v-if="step.diff !== null" class="trace-row">
                <span class="trace-label">Diff</span>
                <span>{{ step.diff }}</span>
              </div>
              <div v-if="step.mode" class="trace-row">
                <span class="trace-label">模式</span>
                <el-tag size="small">{{ step.mode }}</el-tag>
              </div>
            </div>

            <!-- error：致命错误 -->
            <div v-else-if="step.step === 'error'" class="trace-block">
              <el-alert
                type="error"
                :closable="false"
                :title="step.error"
              />
            </div>
          </el-timeline-item>
        </el-timeline>

        <!-- 原始 JSON（折叠） -->
        <div v-if="traceRaw" class="trace-raw">
          <el-button link type="primary" @click="traceRawVisible = !traceRawVisible">
            {{ traceRawVisible ? '收起原始 JSON' : '展开原始 JSON' }}
          </el-button>
          <pre v-if="traceRawVisible" class="trace-raw-pre">{{
            JSON.stringify(traceRaw, null, 2)
          }}</pre>
        </div>
      </div>
    </el-drawer>

    <!-- T6：行局部变量绑定 —— 抽屉组件，表格行"变量绑定"按钮触发 -->
    <PriceLinkedBindingDrawer
      v-model:visible="bindingDrawerVisible"
      :row="bindingRow"
      @changed="onBindingChanged"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import {
  fetchLinkedItemsPage,
  createLinkedItem,
  updateLinkedItem,
  deleteLinkedItem,
  importLinkedItemsExcel,
  fetchLinkedImportHistory,
  fetchLinkedImportBatchDetail,
  fetchTrace,
  previewFormula,
} from '../api/priceLinkedItems'
import { formulaVariables, toChineseExpr, toCodeExpr, buildFormulaIndex } from '../utils/formula'
import { fetchPriceVariables, fetchRowLocalPlaceholders } from '../api/priceVariables'
// T6：行局部变量绑定 —— pending 徽章 + CSV 导入 + drawer
import {
  fetchPending,
  importBindings,
} from '../api/priceLinkedBindings'
import PriceLinkedBindingDrawer from '../components/PriceLinkedBindingDrawer.vue'
import BasePagination from '../components/BasePagination.vue'
// T24：trace drawer + 系统结果/Excel 金标/差异 所需的纯函数辅助层
import {
  DIFF_THRESHOLD,
  buildTraceTimeline,
  buildImportSummaryItems,
  diffWithGolden,
  parseTraceJson,
  pickImportResultValue,
  splitImportDetailRows,
} from './priceLinkedResultUtils'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const tableRows = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
// 系统结果来自后端 /items/{id}/trace —— key=row.id，value={calcPrice, error, variables}
// Plan B 改造后公式以 [code] 形式入库，JS new Function 无法解析 [xx] 语法（会被当数组字面量导致默默算错），
// 所以不再客户端本地 eval，改为 fetchList 后并行拉 trace 展示后端口径的计算结果。
const rowTraceMap = ref({})
const rowTraceLoading = ref(false)
const dialogVisible = ref(false)
const importing = ref(false)
const importDialogVisible = ref(false)
const selectedImportFile = ref(null)
const lastImportResult = ref(null)
const showFactorPreview = ref(false)
const showImportLogs = ref(false)
const importDetailTab = ref('conflicts')
const importHistoryRows = ref([])
const bindingLogRows = ref([])
const returnToWorkbenchVisible = computed(() => Boolean(route.query.returnTo))

const returnToWorkbench = () => {
  const target = String(route.query.returnTo || '')
  if (!target) return
  router.push(target)
}
const importHistoryLoading = ref(false)
const importProgressActiveStep = ref(0)
const editingId = ref(null)
const formulaDialogVisible = ref(false)
const formulaEditingId = ref(null)
const formulaRow = ref(null)
// T-sanity：打开编辑器时快照的"旧 formulaExpr"，用于提交时与新公式对比影响幅度
const originalFormulaExpr = ref('')

// T24：trace drawer 状态 —— 展示 /items/{id}/trace 的结构化内容
const traceDrawerVisible = ref(false)
const traceLoading = ref(false)
const traceRow = ref(null)
const traceRaw = ref(null)
const traceError = ref('')
const traceSteps = ref([])
const traceRawVisible = ref(false)

// T6：行局部变量绑定相关状态
// pendingTotal —— 顶部徽章展示的"待绑定"联动行总数
// pendingItemIds —— Set<linkedItemId>，用于给表格行标一个红点
// pendingLoaded —— 首次拉取完成标记，避免把"加载中"误判为"已全部确认"
const pendingTotal = ref(0)
const pendingItemIds = ref(new Set())
const pendingLoaded = ref(false)
const bindingImporting = ref(false)
const bindingDrawerVisible = ref(false)
const bindingRow = ref(null)
const userStore = useUserStore()

const currentMonthText = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const firstDayOfMonth = (monthText) => {
  const value = String(monthText || '').trim()
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : ''
}

// V4-10 历史兼容回归：支持从 URL query 直接打开历史月份，避免刷新或分享
// /price/linked/result?pricingMonth=2026-02 时又回到当前月份。
const queryString = (key, fallback = '') => {
  const value = route.query?.[key]
  if (Array.isArray(value)) {
    return value[0] || fallback
  }
  return value || fallback
}

const importStepList = [
  '上传中',
  '解析影响因素中',
  '汇总月度价格中',
  '解析联动公式中',
  '写入行级绑定中',
]

const importForm = ref({
  pricingMonth: queryString('pricingMonth', currentMonthText()),
  businessUnitType: queryString('businessUnitType', userStore.businessUnitType || ''),
  overwriteManual: false,
  formulaEffectiveDate: firstDayOfMonth(queryString('pricingMonth', currentMonthText())),
  factorPriceConflictStrategy: 'KEEP_EXISTING',
})

const importHistoryFilter = ref({
  scope: 'mine',
  uploadedBy: '',
})
const importHistoryLimit = ref(10)

const formModel = ref({
  pricingMonth: '',
  orgCode: '',
  sourceName: '',
  supplierName: '',
  supplierCode: '',
  purchaseClass: '',
  materialName: '',
  materialCode: '',
  specModel: '',
  unit: '',
  formulaExpr: '',
  blankWeight: '',
  netWeight: '',
  processFee: '',
  agentFee: '',
  manualPrice: '',
  taxIncluded: true,
  effectiveFrom: '',
  effectiveTo: '',
  orderType: '',
  quota: '',
})

const formulaModel = ref({
  formulaExpr: '',
  formulaExprCn: '',
})

// V36 统一索引：同时覆盖变量 codeToName 和反向 aliasToCode（含行局部占位符）。
// 两个函数 toChineseExpr / toCodeExpr 都接受 index 对象作为第二参数。
// 页面历史用 variableMap.value（扁平 code→name）给旧的"变量选项列表"等场景展示，
// 保留以免影响未迁移的下游逻辑；新代码应优先用 formulaIndex。
const formulaIndex = ref(buildFormulaIndex({ variables: [], placeholders: [] }))
const variableMap = ref({ ...formulaVariables })
const variableList = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑联动价' : '新增联动价',
)

const formulaPreview = computed(() =>
  toChineseExpr(formModel.value.formulaExpr, formulaIndex.value),
)
const formulaEditorPreview = computed(() =>
  toChineseExpr(formulaModel.value.formulaExpr, formulaIndex.value),
)

const normalizeFormulaExpr = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return { formulaExpr: '', formulaExprCn: '' }
  }
  const formulaExpr = toCodeExpr(trimmed, formulaIndex.value)
  return {
    formulaExpr,
    formulaExprCn: toChineseExpr(formulaExpr, formulaIndex.value),
  }
}

const formulaVarOptions = computed(() =>
  Object.entries(formulaIndex.value).map(([code, label]) => ({
    code,
    name: label,
    label: `${label}(${code})`,
  })),
)

const formulaConvertWarning = computed(() => {
  const encoded = formulaModel.value.formulaExpr || ''
  return /[\u4e00-\u9fa5]/.test(encoded)
    ? '编码表达式含未识别中文变量，请补充变量映射'
    : ''
})

const currentUsername = computed(() => userStore.username || '')

const canViewAllUploaders = computed(() => {
  const roles = Array.isArray(userStore.roles) ? userStore.roles : []
  const permissions = Array.isArray(userStore.permissions)
    ? userStore.permissions
    : []
  return (
    roles.some((role) => String(role).toLowerCase() === 'admin') ||
    permissions.includes('*:*:*') ||
    permissions.includes('price:linked-item:import-history:all') ||
    permissions.includes('price:linked-item:admin')
  )
})

const filters = ref({
  businessUnitType: queryString('businessUnitType', userStore.businessUnitType || ''),
  pricingMonth: queryString('pricingMonth', currentMonthText()),
  materialCode: queryString('materialCode', ''),
  importStatus: '',
  bindingStatus: '',
})

const buildParams = () => ({
  pricingMonth: filters.value.pricingMonth,
  materialCode: filters.value.materialCode?.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const normalizePageRows = (data) => {
  if (Array.isArray(data)) {
    return { rows: data, total: data.length }
  }
  const rows = data?.list || data?.records || []
  return {
    rows: Array.isArray(rows) ? rows : [],
    total: Number(data?.total || 0),
  }
}

const fetchList = async ({ loadLatestImport = true } = {}) => {
  loading.value = true
  try {
    const data = await fetchLinkedItemsPage(buildParams())
    const page = normalizePageRows(data)
    tableRows.value = page.rows
    total.value = page.total
    if (tableRows.value.length === 0 && total.value > 0 && currentPage.value > 1) {
      currentPage.value = Math.max(1, Math.ceil(total.value / pageSize.value))
      return
    }
    if (!filters.value.pricingMonth && tableRows.value.length > 0) {
      filters.value.pricingMonth = tableRows.value[0].pricingMonth || ''
    }
  } catch (error) {
    tableRows.value = []
    total.value = 0
    rowTraceMap.value = {}
    ElMessage.error(error?.message || '获取联动价失败')
  } finally {
    loading.value = false
  }
  // 列表刷完后异步批量拉 trace —— 不阻塞主表渲染，后端算好再填"系统结果"列
  loadRowTraces()
  if (loadLatestImport) {
    loadImportHistory({ loadLatest: true })
  }
}

/**
 * 并行拉所有含公式行的 trace —— 后端 /items/{id}/trace 返回规范公式真实解析结果。
 * 放弃了之前客户端 new Function eval 的路径（Plan B 改成 [code] 后 JS 把它当数组字面量，
 * 数值结果会被 `+[...]` 静默转成字符串，最终显示"-"）。
 * 失败行写入 error，UI 上会变红提示，不中断其他行。
 */
const loadRowTraces = async () => {
  const rows = tableRows.value.filter((r) => r?.id && r?.formulaExpr)
  if (rows.length === 0) {
    rowTraceMap.value = {}
    return
  }
  rowTraceLoading.value = true
  const next = {}
  await Promise.all(
    rows.map(async (row) => {
      try {
        const resp = await fetchTrace(row.id)
        const parsed = parseTraceJson(resp?.traceJson)
        if (!parsed) {
          next[row.id] = { calcPrice: null, error: '', variables: {} }
          return
        }
        next[row.id] = {
          calcPrice: parsed.result != null ? Number(parsed.result) : null,
          error: parsed.error || '',
          variables: parsed.variables || {},
        }
      } catch (error) {
        next[row.id] = {
          calcPrice: null,
          error: error?.message || '',
          variables: {},
        }
      }
    }),
  )
  rowTraceMap.value = next
  rowTraceLoading.value = false
}

const fetchVariables = async () => {
  try {
    // V36：并行拉变量 + 行局部占位符，合并成 formulaIndex
    const [variables, placeholders] = await Promise.all([
      fetchPriceVariables({ status: 'active' }),
      fetchRowLocalPlaceholders().catch((err) => {
        // 占位符接口在部分老后端不存在，降级为空数组（兜底只走变量）
        console.warn('fetchRowLocalPlaceholders failed, fallback empty:', err?.message)
        return []
      }),
    ])
    variableList.value = Array.isArray(variables) ? variables : []
    const placeholderList = Array.isArray(placeholders) ? placeholders : []

    // 统一索引 —— codeToName / aliasToCode 一次构建，后续 toChineseExpr/toCodeExpr 都用它
    formulaIndex.value = buildFormulaIndex({
      variables: variableList.value,
      placeholders: placeholderList,
    })
    // 兼容层：variableMap 仍作为 code→name 扁平 map 给"变量选择器"等现有 UI 用
    variableMap.value = { ...formulaIndex.value.codeToName }

    return variableMap.value
  } catch (error) {
    ElMessage.warning(error?.message || '获取变量列表失败')
    return variableMap.value
  }
}

const applyFilters = () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    businessUnitType: userStore.businessUnitType || '',
    pricingMonth: currentMonthText(),
    materialCode: '',
    importStatus: '',
    bindingStatus: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    pricingMonth: filters.value.pricingMonth,
    orgCode: '',
    sourceName: '',
    supplierName: '',
    supplierCode: '',
    purchaseClass: '',
    materialName: '',
    materialCode: '',
    specModel: '',
    unit: '',
    formulaExpr: '',
    blankWeight: '',
    netWeight: '',
    processFee: '',
    agentFee: '',
    manualPrice: '',
    taxIncluded: true,
    effectiveFrom: '',
    effectiveTo: '',
    orderType: '',
    quota: '',
  }
  dialogVisible.value = true
}

const openEditRow = (row) => {
  editingId.value = row.id
  formModel.value = {
    pricingMonth: row.pricingMonth,
    orgCode: row.orgCode,
    sourceName: row.sourceName,
    supplierName: row.supplierName,
    supplierCode: row.supplierCode,
    purchaseClass: row.purchaseClass,
    materialName: row.materialName,
    materialCode: row.materialCode,
    specModel: row.specModel,
    unit: row.unit,
    formulaExpr: row.formulaExpr || '',
    blankWeight: row.blankWeight ?? '',
    netWeight: row.netWeight ?? '',
    processFee: row.processFee ?? '',
    agentFee: row.agentFee ?? '',
    manualPrice: row.manualPrice ?? '',
    taxIncluded: row.taxIncluded === null ? true : !!row.taxIncluded,
    effectiveFrom: row.effectiveFrom || '',
    effectiveTo: row.effectiveTo || '',
    orderType: row.orderType,
    quota: row.quota ?? '',
  }
  dialogVisible.value = true
}

const openFormulaEditor = (row) => {
  formulaEditingId.value = row.id
  formulaRow.value = row
  const normalizedFormulaExpr = toCodeExpr(
    row.formulaExpr || '',
    formulaIndex.value,
  )
  const currentFormulaExprCn = row.formulaExprCn?.trim() || ''
  const resolvedFormulaExprCn =
    currentFormulaExprCn &&
    toCodeExpr(currentFormulaExprCn, formulaIndex.value) ===
      normalizedFormulaExpr
      ? currentFormulaExprCn
      : toChineseExpr(normalizedFormulaExpr, formulaIndex.value)
  formulaModel.value = {
    formulaExpr: normalizedFormulaExpr,
    formulaExprCn: resolvedFormulaExprCn,
  }
  // 快照旧公式 —— submitFormula 做"变更影响对比"用
  originalFormulaExpr.value = normalizedFormulaExpr
  formulaDialogVisible.value = true
}

const appendVariable = (code) => {
  const name = variableMap.value[code] || code
  const current = formulaModel.value.formulaExprCn || ''
  const suffix = current && !current.endsWith(' ') ? ' ' : ''
  formulaModel.value.formulaExprCn = `${current}${suffix}${name} `
}

/**
 * T-sanity：保存前变更影响预览
 * - 调用后端 preview 拿新公式结果；若有旧公式则并行拿旧结果做对比
 * - 触发确认对话框的两个条件（任一满足即弹）：
 *   1. 后端 warnings 非空（如"出现 /1000 疑似旧口径"）
 *   2. 结果变化幅度 > SANITY_DIFF_THRESHOLD（默认 5%）
 * - 首次建档（旧公式空）只校验 warnings，不做幅度对比
 * - preview 自身报错不阻断保存，给提示但允许继续
 */
const SANITY_DIFF_THRESHOLD = 0.05

const submitFormula = async () => {
  if (!formulaEditingId.value) {
    return
  }
  const newFormulaExpr = formulaModel.value.formulaExpr?.trim() || ''
  const oldFormulaExpr = originalFormulaExpr.value?.trim() || ''
  const payload = {
    formulaExpr: newFormulaExpr,
    formulaExprCn: formulaModel.value.formulaExprCn?.trim() || '',
  }
  if (!newFormulaExpr) {
    ElMessage.warning('公式不能为空')
    return
  }

  // === 保存前预览 + 影响对比 ===
  const row = formulaRow.value || {}
  const previewBody = {
    materialCode: row.materialCode || '',
    pricingMonth: row.pricingMonth || '',
    taxIncluded: row.taxIncluded ?? null,
  }
  let newPreview = null
  let oldPreview = null
  try {
    const tasks = [previewFormula({ ...previewBody, formulaExpr: newFormulaExpr })]
    if (oldFormulaExpr && oldFormulaExpr !== newFormulaExpr) {
      tasks.push(previewFormula({ ...previewBody, formulaExpr: oldFormulaExpr }))
    }
    const results = await Promise.all(tasks)
    newPreview = results[0]
    oldPreview = results[1] || null
  } catch (err) {
    // preview 本身失败不阻断保存，但提示用户
    ElMessage.warning('保存前预览失败：' + (err?.message || '未知错误') + '；将直接保存')
  }

  // 收集告警文案：后端 warnings + 前端算的幅度差
  const notices = []
  if (newPreview?.error) {
    notices.push(`⚠️ 新公式解析失败：${newPreview.error}`)
  }
  if (Array.isArray(newPreview?.warnings)) {
    for (const w of newPreview.warnings) {
      // 过滤掉纯上下文类提示，只留"公式本身的可疑写法"
      if (w && !/materialCode|未在 lp_price_linked_item/.test(w)) {
        notices.push(w)
      }
    }
  }

  const oldResult = toFiniteNumber(oldPreview?.result)
  const newResult = toFiniteNumber(newPreview?.result)
  let changePct = null
  if (
    oldFormulaExpr &&
    oldFormulaExpr !== newFormulaExpr &&
    oldResult != null &&
    newResult != null
  ) {
    const denom = Math.abs(oldResult)
    if (denom > 1e-9) {
      changePct = (newResult - oldResult) / denom
      if (Math.abs(changePct) > SANITY_DIFF_THRESHOLD) {
        notices.push(
          `⚠️ 本次改动会让系统结果从 ${formatNum(oldResult)} 变成 ${formatNum(newResult)}，` +
            `变化幅度 ${(changePct * 100).toFixed(1)}%，请确认。`,
        )
      }
    } else if (Math.abs(newResult) > 1e-9) {
      // 旧结果 ~0 而新结果非零 —— 也算显著变动
      notices.push(
        `⚠️ 原结果接近 0（${formatNum(oldResult)}），改动后变为 ${formatNum(newResult)}，请确认。`,
      )
    }
  }

  if (notices.length > 0) {
    try {
      await ElMessageBox.confirm(notices.join('\n\n'), '保存前确认', {
        confirmButtonText: '仍要保存',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false,
        customClass: 'formula-sanity-box',
      })
    } catch (_) {
      // 用户点取消 —— 不保存
      return
    }
  }

  try {
    const updated = await updateLinkedItem(formulaEditingId.value, payload)
    tableRows.value = tableRows.value.map((item) =>
      item.id === formulaEditingId.value ? updated : item,
    )
    ElMessage.success('公式已更新')
    formulaDialogVisible.value = false
    // 公式改了之后，"系统结果"列和"缺少:"红色提示都来自 rowTraceMap —— 必须重拉 trace，
    // 否则列表还显示旧公式的 calcPrice / error
    loadRowTraces()
  } catch (error) {
    ElMessage.error(error?.message || '公式保存失败')
  }
}

/** 兜底数字转换 —— 字符串 / BigDecimal 字面量 / null 都要处理 */
const toFiniteNumber = (v) => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 展示用格式化，保留 6 位（浮点尾数级别），去掉末尾 0 */
const formatNum = (n) => {
  if (n == null) return '-'
  const s = Number(n).toFixed(6)
  return s.replace(/\.?0+$/, '')
}

watch(
  [() => formulaModel.value.formulaExprCn, () => formulaIndex.value],
  ([value, index]) => {
    formulaModel.value.formulaExpr = toCodeExpr(value, index)
  },
  { immediate: true },
)

const toNumber = (value) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const submitRow = async () => {
  if (!formModel.value.pricingMonth || !formModel.value.materialCode) {
    ElMessage.warning('月份和物料代码必填')
    return
  }
  const normalizedFormula = normalizeFormulaExpr(formModel.value.formulaExpr)
  const payload = {
    pricingMonth: formModel.value.pricingMonth,
    orgCode: formModel.value.orgCode,
    sourceName: formModel.value.sourceName,
    supplierName: formModel.value.supplierName,
    supplierCode: formModel.value.supplierCode,
    purchaseClass: formModel.value.purchaseClass,
    materialName: formModel.value.materialName,
    materialCode: formModel.value.materialCode,
    specModel: formModel.value.specModel,
    unit: formModel.value.unit,
    formulaExpr: normalizedFormula.formulaExpr,
    formulaExprCn: normalizedFormula.formulaExprCn,
    blankWeight: toNumber(formModel.value.blankWeight),
    netWeight: toNumber(formModel.value.netWeight),
    processFee: toNumber(formModel.value.processFee),
    agentFee: toNumber(formModel.value.agentFee),
    manualPrice: toNumber(formModel.value.manualPrice),
    taxIncluded: formModel.value.taxIncluded,
    effectiveFrom: formModel.value.effectiveFrom || null,
    effectiveTo: formModel.value.effectiveTo || null,
    orderType: formModel.value.orderType,
    quota: toNumber(formModel.value.quota),
  }
  try {
    if (editingId.value) {
      await updateLinkedItem(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createLinkedItem(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    // 这个 form 能改公式 / blankWeight / netWeight / taxIncluded，都影响后端 trace 口径。
    // 分页后保存统一重拉当前页，避免新增行硬塞到当前页导致顺序和总数不一致。
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  try {
    await deleteLinkedItem(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const normalizeMonth = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\d{4})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`
  }
  return text
}

const getCurrentMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const normalizeDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return text.replace(/\//g, '-')
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseBoolean = (value) => {
  if (value === true || value === false) {
    return value
  }
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) {
    return null
  }
  if (['1', 'true', 'yes', 'y', '是', '含税'].includes(text)) {
    return true
  }
  if (['0', 'false', 'no', 'n', '否', '未税'].includes(text)) {
    return false
  }
  return null
}

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }
  return Number(value).toFixed(4)
}

const derivedRows = computed(() =>
  tableRows.value.map((row) => {
    // T6：若 /bindings/pending 把该行标为"待绑定"，就在操作列打红点提示
    const unbound = pendingItemIds.value.has(row.id)
    // 系统结果口径统一来自后端 trace —— 见 loadRowTraces
    const trace = rowTraceMap.value[row.id]
    const calcPrice =
      trace && trace.calcPrice != null && !Number.isNaN(trace.calcPrice)
        ? Number(Number(trace.calcPrice).toFixed(4))
        : null
    const formulaIssue = trace?.error || ''
    // T24：系统结果 vs Excel 金标（row.manualPrice）差异（无公式行 calcPrice=null，diff 兼容 null）
    const { diff, exceeds } = diffWithGolden(calcPrice, row.manualPrice)
    return {
      ...row,
      unbound,
      calcPrice,
      formulaIssue,
      diffValue: diff,
      diffExceeds: exceeds,
    }
  }),
)

const visibleRows = computed(() => {
  const status = filters.value.bindingStatus
  if (!status) {
    return derivedRows.value
  }
  return derivedRows.value.filter((row) => {
    if (status === 'AUTO') {
      return !!row.formulaExpr && !row.unbound && !row.formulaIssue
    }
    if (status === 'FAILED') {
      return !!row.formulaIssue || row.unbound
    }
    if (status === 'CONFLICT') {
      return conflictRows.value.some((it) => it.materialCode === row.materialCode)
    }
    if (status === 'MANUAL') {
      return String(row.bindingSource || row.source || '').toUpperCase() === 'MANUAL'
    }
    return true
  })
})

const resultValue = (...keys) => {
  return pickImportResultValue(lastImportResult.value || {}, ...keys)
}

const normalizeFactorPreviewRow = (row) => ({
  seqNo: row?.seqNo || row?.factorSeqNo || row?.sequenceNo || '-',
  factorName: row?.factorName || row?.priceFactorName || '-',
  shortName: row?.shortName || row?.factorShortName || '-',
  priceSource: row?.priceSource || row?.source || '-',
  newPrice: row?.newPrice ?? row?.price ?? row?.currentPrice ?? '-',
  oldPrice: row?.originalPrice ?? row?.oldPrice ?? '-',
  unit: row?.unit || '-',
  uploadedBy: row?.uploadedBy || '-',
  uploadedAt: row?.uploadedAt || '-',
  action: row?.monthlyPriceAction || row?.action || row?.status || '',
  sourceSheetName: row?.sourceSheetName || row?.sheetName || '-',
  sourceRowNumber: row?.sourceRowNumber || row?.rowNumber || '-',
  quoteBaseDetectStatus: row?.quoteBaseDetectStatus || '',
  quoteBaseQuoteFieldCode: row?.quoteBaseQuoteFieldCode || '',
  quoteBaseQuoteFieldName: row?.quoteBaseQuoteFieldName || '',
  quoteBaseVariableCode: row?.quoteBaseVariableCode || '',
  quoteBaseMatchedKeyword: row?.quoteBaseMatchedKeyword || '',
  quoteBaseMatchSource: row?.quoteBaseMatchSource || row?.quoteBaseMatchSourceText || 'AUTO',
  quoteBaseDetectMessage: row?.quoteBaseDetectMessage || '',
})

const factorPreviewRows = computed(() => {
  const result = lastImportResult.value || {}
  const rows =
    result.factorRows ||
    result.factorPreviewRows ||
    result.monthlyPriceRows ||
    result.factorMonthlyPriceRows ||
    result.upsertRows ||
    []
  return Array.isArray(rows) ? rows.map(normalizeFactorPreviewRow) : []
})

const quoteBaseRowsWithStatus = computed(() =>
  factorPreviewRows.value.filter((row) => row.quoteBaseDetectStatus),
)

const countQuoteBaseRows = (status) =>
  quoteBaseRowsWithStatus.value.filter(
    (row) => String(row.quoteBaseDetectStatus).toUpperCase() === status,
  ).length

const quoteBaseRecognizedCount = computed(() =>
  resultValue('quoteBaseRecognizedCount') ?? countQuoteBaseRows('RECOGNIZED'),
)

const quoteBaseConflictCount = computed(() =>
  resultValue('quoteBaseConflictCount') ?? countQuoteBaseRows('CONFLICT'),
)

const quoteBaseUnrecognizedCount = computed(() =>
  resultValue('quoteBaseUnrecognizedCount') ?? countQuoteBaseRows('UNRECOGNIZED'),
)

const hasQuoteBaseDetectData = computed(() =>
  quoteBaseRowsWithStatus.value.length > 0 ||
  quoteBaseRecognizedCount.value > 0 ||
  quoteBaseConflictCount.value > 0 ||
  quoteBaseUnrecognizedCount.value > 0,
)

const importDetailRows = computed(() =>
  splitImportDetailRows(lastImportResult.value || {}, factorPreviewRows.value),
)

const bindingErrorRows = computed(() => importDetailRows.value.bindingErrorRows)

const conflictRows = computed(() => importDetailRows.value.conflictRows)

const failedRows = computed(() => importDetailRows.value.failedRows)

const hasImportDetails = computed(
  () => conflictRows.value.length > 0 || failedRows.value.length > 0,
)

const importSummaryItems = computed(() =>
  buildImportSummaryItems(lastImportResult.value || {}, {
    factorPreviewRows: factorPreviewRows.value,
    quoteBaseRecognizedCount: quoteBaseRecognizedCount.value,
    quoteBaseConflictCount: quoteBaseConflictCount.value,
    quoteBaseUnrecognizedCount: quoteBaseUnrecognizedCount.value,
    conflictRows: conflictRows.value,
    failedRows: failedRows.value,
  }),
)

const lastImportMetaText = computed(() => {
  const row = importHistoryRows.value[0]
  if (!row) {
    return `当前上下文：${filters.value.businessUnitType || '-'} / ${filters.value.pricingMonth || '-'}`
  }
  return `${row.fileName || '-'} · ${row.uploadedBy || '-'} · ${row.uploadedAt || '-'}`
})

const monthlyActionText = (action) => {
  const text = String(action || '').toUpperCase()
  if (text === 'CREATE' || text === 'NEW') return '新增'
  if (text === 'UPDATE') return '更新'
  if (text === 'NO_CHANGE') return '不变'
  if (text.includes('CONFLICT')) return '冲突跳过'
  if (text === 'UNCHANGED' || text === 'SKIP') return '重复'
  return action || '-'
}

const monthlyActionTag = (action) => {
  const text = String(action || '').toUpperCase()
  if (text === 'CREATE' || text === 'NEW') return 'success'
  if (text === 'UPDATE') return 'warning'
  if (text.includes('CONFLICT')) return 'danger'
  if (text === 'UNCHANGED' || text === 'SKIP' || text === 'IMPORTED') return 'info'
  return 'info'
}

const normalizeImportHistoryRow = (row) => ({
  batchId: row?.id || row?.batchId || '-',
  batchNo: row?.batchNo || '-',
  fileName: row?.fileName || '-',
  pricingMonth: row?.priceMonth || row?.pricingMonth || '-',
  businessUnitType: row?.businessUnitType || '-',
  uploadedBy: row?.uploadedBy || '-',
  uploadedAt: row?.finishedAt || row?.startedAt || '-',
  summary:
    `影响因素 ${row?.factorRowCount ?? '-'}，` +
    `联动价 ${row?.linkedRowCount ?? '-'}，` +
    `自动绑定 ${row?.autoBindingCount ?? '-'}，` +
    `告警 ${row?.warningCount ?? '-'}，` +
    `失败 ${row?.errorCount ?? '-'}`,
})

const normalizeBindingLogRow = (row) => ({
  ...row,
  sourceText: [
    row?.sourceWorkbookName,
    row?.sourceSheetName,
    row?.sourceCellRef,
  ].filter(Boolean).join(' / ') || '-',
})

const buildImportHistoryParams = () => {
  const scope = importHistoryFilter.value.scope
  const includeAllUploaders = canViewAllUploaders.value && scope === 'all'
  return {
    pricingMonth: filters.value.pricingMonth,
    businessUnitType: filters.value.businessUnitType,
    uploadedBy: includeAllUploaders
      ? importHistoryFilter.value.uploadedBy?.trim()
      : currentUsername.value,
    includeAllUploaders,
    limit: importHistoryLimit.value,
  }
}

const loadImportHistory = async ({ loadLatest = false } = {}) => {
  importHistoryLoading.value = true
  try {
    const rows = await fetchLinkedImportHistory(buildImportHistoryParams())
    importHistoryRows.value = Array.isArray(rows)
      ? rows.map(normalizeImportHistoryRow)
      : []
    if (loadLatest && importHistoryRows.value.length > 0) {
      await loadImportBatchDetail(importHistoryRows.value[0].batchId, { silent: true })
    }
  } catch (error) {
    importHistoryRows.value = []
    if (!error?.message?.includes('canceled')) {
      ElMessage.warning(error?.message || '获取导入历史失败')
    }
  } finally {
    importHistoryLoading.value = false
  }
}

const onImportHistoryScopeChange = () => {
  if (importHistoryFilter.value.scope === 'mine') {
    importHistoryFilter.value.uploadedBy = ''
  }
  importHistoryLimit.value = 10
  loadImportHistory({ loadLatest: true })
}

const loadMoreImportHistory = () => {
  importHistoryLimit.value = Math.min(importHistoryLimit.value + 10, 50)
  loadImportHistory({ loadLatest: false })
}

const loadImportBatchDetail = async (batchId, { silent = false } = {}) => {
  if (!batchId || batchId === '-') {
    return
  }
  try {
    const detail = await fetchLinkedImportBatchDetail(batchId)
    lastImportResult.value = detail || {}
    bindingLogRows.value = Array.isArray(detail?.bindingLogs)
      ? detail.bindingLogs.map(normalizeBindingLogRow)
      : []
    if (!silent) {
      ElMessage.success('已加载该批次导入明细')
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(error?.message || '加载导入批次明细失败')
    }
  }
}

const toggleFactorPreview = async () => {
  showFactorPreview.value = !showFactorPreview.value
  if (showFactorPreview.value && factorPreviewRows.value.length === 0) {
    await loadImportHistory({ loadLatest: true })
  }
}

const toggleImportLogs = async () => {
  showImportLogs.value = !showImportLogs.value
  if (showImportLogs.value) {
    await loadImportHistory({ loadLatest: true })
  }
}

/**
 * 联动价格表只保留本次导入核对能力。
 * 长期汇总、调价、来源追溯统一跳到影响因素表页面处理。
 */
const goFactorMonthlySummary = () => {
  router.push({
    path: '/price/linked/finance-base',
    query: {
      priceMonth: filters.value.pricingMonth || '',
      businessUnitType: filters.value.businessUnitType || '',
    },
  })
}

/**
 * T24：打开 trace 抽屉 —— 拉取后端结构化计算追踪并扁平化为时间轴。
 * 历史数据 traceJson 可能为 null / 解析失败，降级为"暂无追踪"。
 */
const openTrace = async (row) => {
  traceRow.value = row
  traceRaw.value = null
  traceSteps.value = []
  traceError.value = ''
  traceRawVisible.value = false
  traceDrawerVisible.value = true
  if (!row?.id) {
    traceError.value = '该行缺少计算 ID，无法拉取 trace'
    return
  }
  traceLoading.value = true
  try {
    const resp = await fetchTrace(row.id)
    const parsed = parseTraceJson(resp?.traceJson)
    if (!parsed) {
      traceError.value = '暂无追踪数据（该记录可能是旧数据或未启用 trace）'
      return
    }
    traceRaw.value = parsed
    traceSteps.value = buildTraceTimeline(parsed)
    if (traceSteps.value.length === 0) {
      traceError.value = 'trace 解析成功，但内容为空'
    }
  } catch (error) {
    // 404 / 网络异常 —— 不阻塞抽屉，只展示提示
    traceError.value = error?.message || '拉取 trace 失败'
  } finally {
    traceLoading.value = false
  }
}

// ============================ T6：行局部变量绑定 ============================

/**
 * 拉取"待绑定"列表 —— 驱动顶部徽章 + 每行红点。
 * 不阻塞主列表加载；失败时降级（徽章不显示，不报错打扰用户）。
 */
const loadPending = async () => {
  try {
    const resp = await fetchPending()
    pendingTotal.value = resp?.total || 0
    const ids = new Set()
    for (const it of resp?.items || []) {
      if (it?.linkedItemId != null) {
        ids.add(it.linkedItemId)
      }
    }
    pendingItemIds.value = ids
  } catch (error) {
    // /bindings/pending 404 / 503 / 权限不足 —— 徽章保持 0，不打扰用户
    pendingTotal.value = 0
    pendingItemIds.value = new Set()
  } finally {
    pendingLoaded.value = true
  }
}

/** 点击徽章 → 跳回第一条 unbound 行；这里简化为滚动到表格顶部并给用户提示 */
const openPendingList = () => {
  if (pendingItemIds.value.size === 0) {
    ElMessage.info('当前没有待绑定的联动行')
    return
  }
  ElMessage.info(
    `共 ${pendingTotal.value} 行待绑定，请在下表定位带红点的行点击"变量绑定"`,
  )
}

/** 打开变量绑定抽屉 */
const openBinding = (row) => {
  bindingRow.value = row
  bindingDrawerVisible.value = true
}

/** 绑定变更（新增 / 编辑 / 删除）回调 —— 刷新 pending 徽章 + 重算 trace */
const onBindingChanged = () => {
  loadPending()
  // binding 一改，__material / __scrap 的解析结果就变了，rowTraceMap 缓存立刻失效，
  // 不重拉的话列表"系统结果"列和红色"缺少:"错误会停在旧状态（用户困惑）
  loadRowTraces()
}

/** 绑定 CSV 导入 —— 走后端 /bindings/import multipart 端点 */
const handleBindingCsvChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  bindingImporting.value = true
  try {
    const resp = await importBindings(rawFile)
    const errors = Array.isArray(resp?.errors) ? resp.errors : []
    const summary = `共 ${resp?.total ?? 0} 行：新增 ${resp?.inserted ?? 0}，更新 ${resp?.updated ?? 0}，过期 ${resp?.expired ?? 0}，失败 ${errors.length}`
    if (errors.length === 0) {
      ElMessage.success(`绑定导入成功 — ${summary}`)
    } else {
      const firstFew = errors
        .slice(0, 3)
        .map((e) => `第${e.line}行：${e.reason}`)
        .join('；')
      const more = errors.length > 3 ? `…等 ${errors.length} 条` : ''
      ElMessageBox.alert(`${summary}\n\n${firstFew}${more}`, '绑定导入结果', {
        type: errors.length === resp?.total ? 'error' : 'warning',
      })
    }
    // 导入后刷新徽章；主列表不刷，用户可继续查看
    loadPending()
  } catch (error) {
    ElMessage.error(error?.message || '绑定 CSV 导入失败')
  } finally {
    bindingImporting.value = false
  }
}

const openMonthlyImport = () => {
  const pricingMonth = filters.value.pricingMonth || currentMonthText()
  importForm.value = {
    pricingMonth,
    businessUnitType:
      filters.value.businessUnitType || userStore.businessUnitType || '',
    overwriteManual: false,
    formulaEffectiveDate: firstDayOfMonth(pricingMonth),
    factorPriceConflictStrategy: 'KEEP_EXISTING',
  }
  selectedImportFile.value = null
  importProgressActiveStep.value = 0
  importDialogVisible.value = true
}

const handleMonthlyImportFileChange = (uploadFile) => {
  selectedImportFile.value = uploadFile?.raw || null
}

const clearMonthlyImportFile = () => {
  selectedImportFile.value = null
}

const isExcelFile = (file) => {
  const name = String(file?.name || '').toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

const submitMonthlyImport = async () => {
  const rawFile = selectedImportFile.value
  if (!importForm.value.pricingMonth) {
    ElMessage.warning('导入月份必填')
    return
  }
  if (!importForm.value.businessUnitType) {
    ElMessage.warning('业务单元必填')
    return
  }
  if (!importForm.value.formulaEffectiveDate) {
    ElMessage.warning('公式生效日期必填')
    return
  }
  if (!importForm.value.factorPriceConflictStrategy) {
    ElMessage.warning('影响因素价格冲突策略必填')
    return
  }
  if (!rawFile) {
    ElMessage.warning('请选择 Excel 文件')
    return
  }
  if (!isExcelFile(rawFile)) {
    ElMessage.warning('文件必须是 Excel 格式')
    return
  }
  importing.value = true
  importProgressActiveStep.value = 0
  try {
    importProgressActiveStep.value = 1
    const result = await importLinkedItemsExcel(rawFile, importForm.value.pricingMonth, {
      businessUnitType: importForm.value.businessUnitType,
      overwriteManual: importForm.value.overwriteManual,
      formulaEffectiveDate: importForm.value.formulaEffectiveDate,
      factorPriceConflictStrategy: importForm.value.factorPriceConflictStrategy,
    })
    importProgressActiveStep.value = importStepList.length
    lastImportResult.value = result || {}
    filters.value.pricingMonth = importForm.value.pricingMonth
    filters.value.businessUnitType = importForm.value.businessUnitType
    importDialogVisible.value = false
    showFactorPreview.value = true
    showImportLogs.value = true
    importDetailTab.value = conflictRows.value.length ? 'conflicts' : 'failures'
    const detailRows = splitImportDetailRows(result || {}, factorPreviewRows.value)
    const failed = detailRows.failedRows.length
    const conflicts = detailRows.conflictRows.length
    const created = result?.linkedVersionCreatedCount ?? result?.linkedCreatedCount ?? 0
    const updated = result?.linkedExpiredCount ?? result?.linkedUpdatedCount ?? 0
    const skipped = result?.linkedUnchangedSkippedCount ?? result?.linkedSkippedCount ?? 0
    if (failed || conflicts) {
      ElMessage.warning(`导入完成：新增版本 ${created}，旧版本失效 ${updated}，未变化跳过 ${skipped}，需处理 ${failed + conflicts} 条`)
    } else {
      ElMessage.success(`导入完成：新增版本 ${created}，旧版本失效 ${updated}，未变化跳过 ${skipped}`)
    }
    fetchList({ loadLatestImport: false })
    await loadImportHistory({ loadLatest: false })
    loadPending()
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const openBindingByMaterial = (row) => {
  const target = tableRows.value.find((item) => item.materialCode === row?.materialCode)
  if (!target) {
    ElMessage.warning('当前列表未找到该料号，请先查询对应月份和料号')
    return
  }
  openBinding(target)
}

const keepManualBinding = (row) => {
  ElMessage.info(`已保持人工绑定：${row?.materialCode || '-'}`)
}

const copyFormula = async (formula) => {
  if (!formula) {
    ElMessage.info('该行没有公式原文')
    return
  }
  try {
    await navigator.clipboard.writeText(formula)
    ElMessage.success('公式原文已复制')
  } catch (_) {
    ElMessage.info(formula)
  }
}

watch(
  () => importForm.value.pricingMonth,
  (month, oldMonth) => {
    const oldDefault = firstDayOfMonth(oldMonth)
    if (
      !importForm.value.formulaEffectiveDate ||
      importForm.value.formulaEffectiveDate === oldDefault
    ) {
      importForm.value.formulaEffectiveDate = firstDayOfMonth(month)
    }
  },
)

watch(
  () => userStore.businessUnitType,
  (value) => {
    if (!value) {
      return
    }
    if (!filters.value.businessUnitType) {
      filters.value.businessUnitType = value
    }
    if (!importForm.value.businessUnitType) {
      importForm.value.businessUnitType = value
    }
  },
)

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

watch(currentPage, () => {
  fetchList()
})

onMounted(fetchList)
onMounted(fetchVariables)
onMounted(loadPending)
</script>

<style scoped>
.linked-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

/* T6：顶部"待绑定"徽章 —— 点击可跳转到红点行 */
.filter-badge {
  cursor: pointer;
  user-select: none;
}

/* T6：行操作列"变量绑定"按钮上的红点 —— pending 行有未绑定 token */
.binding-dot {
  margin-left: 4px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.expr-primary {
  font-family: 'SFMono-Regular', Menlo, monospace;
  color: #111827;
}

.expr-secondary {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

.expr-issue {
  margin-top: 2px;
  font-size: 12px;
  color: #dc2626;
}

.text-muted {
  color: #9ca3af;
}

.formula-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  color: #6b7280;
  font-size: 12px;
}

.formula-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.formula-var-tag {
  cursor: pointer;
}

.formula-warning {
  margin: -8px 0 12px 90px;
  font-size: 12px;
  color: #dc2626;
}

.upload-btn {
  margin-left: 8px;
}

.monthly-import-card {
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.section-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.summary-item {
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.summary-label {
  font-size: 12px;
  color: #6b7280;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.quote-base-summary {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.quote-base-stats {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

.quote-base-stats > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.result-table,
.result-tabs {
  margin-top: 14px;
}

.history-filter {
  margin-top: 14px;
}

.history-hint {
  margin: 4px 0 10px;
  color: #6b7280;
  font-size: 12px;
}

.monthly-upload {
  width: 100%;
}

.upload-placeholder {
  padding: 12px 0;
}

.upload-title {
  font-size: 14px;
  color: #1f2a37;
}

.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.strategy-help {
  margin-top: 8px;
  line-height: 1.7;
  font-size: 12px;
  color: #6b7280;
}

/* T24：差异超阈值（> 0.01）红色高亮 */
.diff-exceeds {
  color: #dc2626;
  font-weight: 600;
}

/* T24：trace 抽屉排版 */
.trace-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 13px;
  color: #1f2a37;
}

.trace-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.trace-label {
  display: inline-block;
  min-width: 72px;
  color: #6b7280;
  margin-right: 8px;
}

.trace-empty {
  margin: 8px 0;
}

.trace-timeline {
  padding-left: 4px;
}

.trace-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trace-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.trace-row code {
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  color: #111827;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}

.trace-vars-table {
  margin-top: 4px;
}

.trace-raw {
  border-top: 1px dashed #e5e7eb;
  padding-top: 10px;
}

.trace-raw-pre {
  margin: 8px 0 0;
  padding: 10px;
  max-height: 320px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>
