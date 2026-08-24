<template>
  <section class="costing-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h1>单产品核算工作台</h1>
        <p>{{ oaNo }} / {{ item.materialNo || '-' }} / 核算月份 {{ displayedPeriodMonth }}</p>
      </div>
      <div class="page-actions">
        <el-button
          v-if="!historyViewMode"
          type="primary"
          :loading="costRunActionLoading"
          :disabled="costRunRepriceLocked"
          @click="submitProductCosting('USER_REQUEST')"
        >
          {{ productCostingActionLabel }}
        </el-button>
        <el-button v-else type="primary" plain @click="openCurrentCosting">
          进入当前核算
        </el-button>
        <el-button :icon="ArrowLeft" @click="goBack">返回报价单</el-button>
        <el-button :icon="Refresh" :loading="loading || refreshingTabs" @click="refreshWorkbench">刷新</el-button>
      </div>
    </div>

    <el-alert
      v-if="historyViewMode"
      class="inline-alert"
      type="info"
      show-icon
      :closable="false"
      :title="`正在查看 ${displayedPeriodMonth} ${historyResultLabel}；该结果只读，不代表当前月份核算状态。`"
    />

    <el-alert
      v-if="workflowGuideVisible"
      class="inline-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="workflowGuideText"
    />

    <section class="section-block">
      <div class="section-head">
        <span>报价单信息</span>
        <small>{{ statusLabel('sourceType', header.sourceType) }} / {{ header.processName || header.processCode || '-' }}</small>
      </div>
      <el-descriptions class="detail-descriptions" :column="3" border>
        <el-descriptions-item label="报价单号">{{ header.oaNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="外部单号">{{ header.externalFormNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报价场景">{{ statusLabel('quoteScenario', header.quoteScenario) }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ header.customer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请日期">{{ header.applyDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请单位">{{ header.applicantUnit || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请部门">{{ header.applicantDept || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请处室">{{ header.applicantOffice || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ header.applicantName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="核算状态">
          <el-tag effect="plain" :type="costRunStatusTagType">
            {{ costRunWorkbenchStatusText }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前阻断步骤">
          {{ historyViewMode ? '-' : workflowStepLabel(workbench.workflowStatus?.currentBlockedStep) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ header.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </section>

    <section class="section-block">
      <div class="section-head">
        <span>金属及基础价格</span>
        <small>用于当前报价单报价参数展示</small>
      </div>
      <el-table :data="priceMatrixRows" border :show-header="false" class="price-matrix-table">
        <el-table-column prop="leftLabel" width="140" class-name="matrix-label" />
        <el-table-column min-width="180">
          <template #default="{ row }">{{ formatMoney(row.leftValue) }}</template>
        </el-table-column>
        <el-table-column prop="rightLabel" width="140" class-name="matrix-label" />
        <el-table-column min-width="180">
          <template #default="{ row }">{{ formatMoney(row.rightValue) }}</template>
        </el-table-column>
      </el-table>
    </section>

    <section class="section-block">
      <div class="section-head">
        <span>当前报价料号</span>
        <small>当前产品单独核算</small>
      </div>
      <el-table
        :data="currentItemRows"
        border
        stripe
        scrollbar-always-on
        row-key="id"
        class="current-item-table"
      >
        <el-table-column prop="seq" label="行号" width="72" fixed="left" />
        <el-table-column prop="materialNo" label="产品料号" min-width="160" fixed="left" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="sunlModel" label="三花型号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="businessType" label="业务类型" width="120" />
        <el-table-column prop="packageType" label="包装类型" width="120" />
        <el-table-column prop="packageMethod" label="包装方式" width="130" />
        <el-table-column prop="packageComponentCode" label="包装组件" min-width="140" show-overflow-tooltip />
        <el-table-column prop="annualVolume" label="预计年用量" width="120" align="right" />
        <el-table-column prop="totalWithShip" label="含运费总价" width="120" align="right" />
        <el-table-column prop="totalNoShip" label="不含运费总价" width="130" align="right" />
        <el-table-column label="BOM 状态" width="150">
          <template #default>
            <el-tag effect="plain" :type="statusTagType('bomStatus', workbench.bomStatus?.bomStatus)">
              {{ statusLabel('bomStatus', workbench.bomStatus?.bomStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="technicianName" label="技术员" width="120" />
        <template #empty>
          <el-empty description="暂无当前报价料号" />
        </template>
      </el-table>
    </section>

    <section class="workspace-band section-block">
      <div class="workspace-meta">
        <span><small>核算月份</small><strong>{{ displayedPeriodMonth }}</strong></span>
        <span><small>{{ historyViewMode ? '历史部品行数' : 'BOM 行数' }}</small><strong>{{ historyViewMode ? costPartRows.length : bomRows.length }}</strong></span>
        <span><small>整体状态</small><strong>{{ historyViewMode ? '历史结果' : tabStatusLabel(workbench.workflowStatus?.overallStatus) }}</strong></span>
      </div>

      <el-tabs v-model="activeTab" class="costing-tabs" :before-leave="beforeWorkbenchTabLeave">
        <el-tab-pane v-for="(tab, index) in tabs" :key="tab.code" :name="tab.code">
          <template #label>
            <span class="tab-label">
              <span class="tab-index">{{ index + 1 }}</span>
              <span class="tab-copy">
                <span class="tab-name">{{ tab.name }}</span>
                <el-tag class="tab-state" size="small" effect="plain" :type="tabBadgeType(tab)">
                  {{ tabBadgeLabel(tab) }}
                </el-tag>
              </span>
            </span>
          </template>

          <div
            v-if="tab.code === 'PRODUCT_DETAIL'"
            v-loading="effectiveBomPreparing"
            element-loading-text="正在生成报价物料明细"
            class="product-detail-tab"
          >
            <template v-if="effectiveBomFeatureEnabled">
            <div class="pricing-bom-summary">
              <div>
                <strong>本次计价 BOM</strong>
                <span>
                  产品 {{ presentedEffectiveBom.topProductCode || item.materialNo || '-' }}
                  · {{ presentedEffectiveBom.costPeriodMonth || workbench.periodMonth || '-' }}
                  · {{ presentedEffectiveBom.nodes.length }} 个计价节点
                </span>
              </div>
              <div class="pricing-bom-summary-status">
                <el-tag v-if="effectiveBomPreviewActive" type="warning" effect="light">
                  预览中 · 尚未保存
                </el-tag>
                <el-tag :type="effectiveBomStateInfo.type" effect="plain">
                  {{ effectiveBomStateInfo.label }}
                </el-tag>
                <span>{{ effectiveAlternativeSummaryText }}</span>
              </div>
            </div>

            <el-alert
              v-if="effectiveBomBlocked"
              type="error"
              show-icon
              :closable="false"
              class="inline-alert"
              title="本次计价 BOM 暂时无法生成，请处理以下数据问题。"
            >
              <template #default>
                <ul class="effective-bom-message-list">
                  <li v-for="issue in presentedEffectiveBom.blockIssues" :key="`${issue.issueCode}-${issue.materialCode}-${issue.sourcePath}`">
                    {{ issue.message || issue.issueCode }}<template v-if="issue.materialCode">（料号：{{ issue.materialCode }}）</template>
                  </li>
                </ul>
              </template>
            </el-alert>

            <el-alert
              v-if="presentedEffectiveBom.warnings.length > 0"
              type="warning"
              show-icon
              :closable="false"
              class="inline-alert"
              :title="presentedEffectiveBom.warnings.join('；')"
            />

            <div class="pricing-bom-designer">
              <div class="pricing-bom-tree-column">
            <div class="tab-toolbar">
              <div>
                <strong>计价物料树</strong>
                <span>按 BOM 层级展示，特殊规则与替代料已标注</span>
              </div>
              <div class="toolbar-actions">
                <el-button
                  v-if="alternativeFeatureEnabled"
                  v-hasPermi="['quote:costing:bom:alternative-select']"
                  type="warning"
                  plain
                  :loading="alternativeLoading"
                  :disabled="effectiveBomLoading"
                  @click="openAlternativeDrawer"
                >
                  选择计价方案
                </el-button>
                <el-button size="small" :disabled="effectiveBomTreeData.length === 0" @click="expandBomTree">展开全部</el-button>
                <el-button size="small" :disabled="effectiveBomTreeData.length === 0" @click="collapseBomTree">收起全部</el-button>
              </div>
            </div>
            <div class="bom-tree-panel" v-loading="effectiveBomLoading">
              <div v-if="!item.materialNo" class="empty-tip">当前产品行无产品料号</div>
              <div v-else-if="effectiveBomTreeData.length === 0 && !effectiveBomLoading" class="empty-tip">
                {{ effectiveBomBlocked ? '当前存在数据问题，暂时无法生成计价 BOM' : '暂无本次计价 BOM' }}
              </div>
              <el-tree
                v-else
                ref="bomTreeRef"
                class="effective-bom-tree"
                :data="effectiveBomTreeData"
                :props="bomTreeProps"
                node-key="nodeKey"
                :indent="0"
                :default-expanded-keys="effectiveBomDefaultExpandedKeys"
                :expand-on-click-node="false"
                @node-click="openBomNodeDetail"
              >
                <template #default="{ data }">
                  <div
                    class="tree-node effective-tree-node"
                    :class="{
                      'effective-tree-parent': hasEffectiveBomChildren(data),
                      'effective-tree-root': isStructureRootNode(data),
                      'effective-tree-preview-change': isEffectiveBomPreviewChanged(data),
                    }"
                  >
                    <div class="effective-node-main">
                      <span class="node-code">{{ data.materialCode }}</span>
                      <span class="node-name">{{ data.materialName || '' }}</span>
                      <span v-if="!isStructureRootNode(data) && data.qtyPerParent != null" class="node-qty">× {{ data.qtyPerParent }}</span>
                      <el-tag
                        v-if="!isStructureRootNode(data)"
                        class="effective-shape-tag"
                        size="small"
                        :type="effectiveShapeInfo(data).type"
                        effect="light"
                        :disable-transitions="true"
                      >
                        {{ effectiveShapeInfo(data).label }}
                      </el-tag>
                      <el-tag
                        v-if="effectiveAlternativeInfo(data)"
                        class="effective-alternative-tag"
                        size="small"
                        :type="effectiveAlternativeInfo(data).type"
                        effect="light"
                        :disable-transitions="true"
                      >
                        {{ effectiveAlternativeInfo(data).label }}
                      </el-tag>
                      <span v-if="hasEffectiveBomChildren(data)" class="node-child-count">
                        {{ data.children.length }} 个子项
                      </span>
                    </div>
                    <div v-if="shouldShowEffectiveNodeEvidence(data)" class="effective-node-evidence">
                      <span>规则：{{ effectiveShapeSourceText(data) }}</span>
                      <span v-if="effectiveSupplierText(data)">{{ effectiveSupplierText(data) }}</span>
                    </div>
                  </div>
                </template>
              </el-tree>
            </div>

              </div>

            </div>

            <QuoteBomAlternativeDrawer
              v-if="alternativeFeatureEnabled"
              v-model="alternativeDrawerVisible"
              :loading="alternativeLoading"
              :saving-group-key="alternativeSavingGroupKey"
              :previewing-group-key="alternativePreviewLoadingGroup"
              :summary="alternativeSummary"
              :can-select="canSelectAlternative"
              :histories="alternativeHistories"
              :history-loading-group="alternativeHistoryLoadingGroup"
              @save="saveAlternativeSelection"
              @preview="previewAlternativeSelection"
              @restore-preview="clearAlternativePreview"
              @cancel-preview="clearAlternativePreview"
              @load-history="loadAlternativeHistory"
            />
            </template>

            <template v-else>
              <el-alert
                class="inline-alert"
                type="info"
                show-icon
                :closable="false"
                title="最终有效 BOM 当前未启用，本页使用原始 BOM 层级树；原报价流程和历史结果不受影响。"
              />
              <div class="tab-toolbar">
                <div>
                  <strong>BOM 层级树</strong>
                  <span>顶层料号：{{ item.materialNo || '-' }}</span>
                </div>
                <div class="toolbar-actions">
                  <el-button size="small" :disabled="!bomTree" @click="expandBomTree">展开全部</el-button>
                  <el-button size="small" :disabled="!bomTree" @click="collapseBomTree">收起全部</el-button>
                </div>
              </div>
              <div class="bom-tree-panel" v-loading="bomTreeLoading">
                <div v-if="!item.materialNo" class="empty-tip">当前产品行无产品料号</div>
                <div v-else-if="!bomTree && !bomTreeLoading" class="empty-tip">暂无 BOM 层级树</div>
                <div v-else-if="bomTreeEmpty" class="empty-tip">该产品料号未查询到 BOM 层级树</div>
                <el-tree
                  v-else
                  ref="bomTreeRef"
                  :data="bomTreeData"
                  :props="bomTreeProps"
                  node-key="path"
                  :expand-on-click-node="false"
                  @node-click="openBomNodeDetail"
                >
                  <template #default="{ data }">
                    <span class="tree-node">
                      <span class="node-code">{{ data.materialCode }}</span>
                      <span class="node-name">{{ data.materialName || '' }}</span>
                      <span v-if="data.qtyPerParent" class="node-qty">x {{ data.qtyPerParent }}</span>
                      <el-tag
                        v-if="bomNodeShapeAttr(data)"
                        size="small"
                        :type="bomNodeShapeTagType(data)"
                        effect="plain"
                      >{{ bomNodeShapeAttr(data) }}</el-tag>
                      <el-tag v-if="isTakeoverNode(data)" size="small" type="warning">接管</el-tag>
                      <el-tag v-if="data.isLeaf === 1" size="small" type="success" effect="plain">叶子</el-tag>
                    </span>
                  </template>
                </el-tree>
              </div>
            </template>
          </div>

          <div v-else-if="isQuoteBomTab(tab.code)" class="quote-bom-tab">
            <div class="status-strip">
              <div class="metric">
                <span>当前状态</span>
                <strong>{{ quoteBomWorkspaceStatusText }}</strong>
              </div>
              <div class="metric">
                <span>构建编号</span>
                <strong>{{ workbench.buildBatchId || '-' }}</strong>
              </div>
              <div class="metric">
                <span>结算行数</span>
                <strong>{{ bomRows.length }}</strong>
              </div>
              <div v-if="alternativeFeatureEnabled" class="metric">
                <span>可替代组</span>
                <strong>{{ alternativeSummary.groupCount ?? 0 }}</strong>
              </div>
              <div v-if="alternativeFeatureEnabled" class="metric">
                <span>已选替代</span>
                <strong>{{ alternativeSummary.manualAlternativeCount ?? 0 }}</strong>
              </div>
            </div>

            <el-alert
              v-if="alternativeFeatureEnabled && alternativeReviewMessage"
              type="error"
              show-icon
              :closable="false"
              class="inline-alert alternative-review-alert"
              :title="alternativeReviewMessage"
            />

            <div class="tab-toolbar">
              <div>
                <strong>报价物料明细</strong>
                <span>
                  {{ tab.blockedReason || '已按当前规则生成 BOM 结算行' }}
                  <template v-if="rollupDisplayRowCount > 0">
                    ；上卷父件已按命中子件生成展示名称，不增加结算行
                  </template>
                  <template v-if="alternativeFeatureEnabled">；标准/替代方案保存后，需重新生成才会更新当前明细</template>
                </span>
              </div>
              <div class="toolbar-actions">
                <el-button
                  type="primary"
                  :loading="effectiveBomPreparing"
                  :disabled="effectiveBomBlocked || alternativeNeedsReview"
                  @click="regenerateCurrentBom"
                >
                  按当前规则重新生成
                </el-button>
              </div>
            </div>

            <el-table
              :data="displayBomRows"
              border
              stripe
              scrollbar-always-on
              max-height="calc(100vh - 420px)"
              row-key="displayKey"
              class="bom-table"
            >
              <el-table-column label="子件料号" min-width="220" fixed="left" show-overflow-tooltip>
                <template #default="{ row }"><span class="rollup-identity">{{ row.childCode || '-' }}</span></template>
              </el-table-column>
              <el-table-column label="品名" min-width="180" fixed="left" show-overflow-tooltip>
                <template #default="{ row }"><span class="rollup-identity">{{ row.childName || '-' }}</span></template>
              </el-table-column>
              <el-table-column label="型号" min-width="170" show-overflow-tooltip>
                <template #default="{ row }"><span class="rollup-identity">{{ row.childModel || '-' }}</span></template>
              </el-table-column>
              <el-table-column label="用量" width="140" align="right">
                <template #default="{ row }">{{ formatSnapshotDecimal(row.usageQty, 8) }}</template>
              </el-table-column>
              <el-table-column label="顶层用量" width="120" align="right">
                <template #default="{ row }">{{ formatSnapshotDecimal(row.qtyPerTop, 8) }}</template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="100" />
              <el-table-column prop="materialAttribute" label="材料属性" width="150" show-overflow-tooltip />
              <el-table-column prop="shapeAttribute" label="形态属性" width="150" show-overflow-tooltip />
              <template #empty>
                <el-empty description="暂无 BOM 行" />
              </template>
            </el-table>
          </div>

          <div v-else-if="isPriceTypeTab(tab.code)" class="price-type-tab" v-loading="priceTypeLoading">
            <div class="status-strip">
              <div class="metric">
                <span>BOM 行数</span>
                <strong>{{ priceTypeSummary.bomRowCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>采购件</span>
                <strong>{{ priceTypeSummary.normalCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>自制件</span>
                <strong>{{ priceTypeSummary.makePartCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>包装件</span>
                <strong>{{ priceTypeSummary.packageComponentCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>缺价格类型</span>
                <strong>{{ priceTypeSummary.missingTypeCount ?? latestPriceType.gapCount ?? 0 }}</strong>
              </div>
              <div class="metric">
                <span>参考单价</span>
                <strong>{{ priceTypeSummary.referencePriceCount ?? latestPriceType.referencePriceCount ?? 0 }}</strong>
              </div>
              <div class="metric">
                <span>可准备价格</span>
                <strong>{{ priceTypeSummary.readyForPricePrepareCount ?? latestPriceType.confirmedCount ?? 0 }}</strong>
              </div>
            </div>

            <div class="filter-bar">
              <el-radio-group v-model="priceTypeFilter" size="small">
                <el-radio-button value="ALL">全部</el-radio-button>
                <el-radio-button value="MISSING">缺价格类型</el-radio-button>
                <el-radio-button value="NORMAL">采购件</el-radio-button>
                <el-radio-button value="MAKE_PART">自制件</el-radio-button>
                <el-radio-button value="PACKAGE">包装件</el-radio-button>
              </el-radio-group>
              <div class="toolbar-actions">
                <el-input
                  v-model="priceTypeKeyword"
                  clearable
                  placeholder="搜索料号 / 品名"
                  class="search-control"
                />
                <el-button
                  :disabled="isBlockedTab(tab) || missingPriceTypeRows.length === 0"
                  @click="openMaterialPriceTypePage"
                >
                  去物料价格类型维护
                </el-button>
              </div>
            </div>

            <el-table
              :data="filteredPriceTypeRows"
              border
              stripe
              row-key="rowKey"
              scrollbar-always-on
              default-expand-all
              :tree-props="{ children: 'children' }"
              max-height="calc(100vh - 430px)"
              class="price-type-table"
            >
              <el-table-column prop="materialCode" label="料号" min-width="220" fixed="left" show-overflow-tooltip />
              <el-table-column prop="materialName" label="品名" min-width="180" fixed="left" show-overflow-tooltip>
                <template #default="{ row }">{{ row.materialName || '-' }}</template>
              </el-table-column>
              <el-table-column label="对象类型" width="130">
                <template #default="{ row }">{{ priceTypeObjectLabel(row.objectType) }}</template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="110" align="right" />
              <el-table-column label="价格类型" width="150">
                <template #default="{ row }">
                  <el-tag :type="priceTypeTagType(row)" effect="plain">
                    {{ priceTypeDisplay(row) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="类型来源" width="150" show-overflow-tooltip>
                <template #default="{ row }">{{ priceTypeSourceLabel(row) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">{{ priceTypeStatusLabel(row.typeStatus) }}</template>
              </el-table-column>
              <el-table-column prop="referenceUnitPrice" label="参考单价" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.referenceUnitPrice) }}</template>
              </el-table-column>
              <el-table-column prop="effectiveFrom" label="生效开始" width="120" />
              <el-table-column prop="effectiveTo" label="生效结束" width="120" />
              <el-table-column prop="message" label="原因" min-width="220" show-overflow-tooltip />
              <template #empty>
                <el-empty description="暂无价格类型识别结果" />
              </template>
            </el-table>
          </div>

          <div v-else-if="isPriceSourceSupplementTab(tab.code)" class="price-source-tab" v-loading="pricePrepareLoading">
            <div class="action-panel">
              <div>
                <h2>价格源维护</h2>
                <p>{{ priceSourceSupplementText(tab) }}</p>
              </div>
              <div class="toolbar-actions">
                <el-button
                  v-if="!priceSourceChecked"
                  type="primary"
                  :loading="pricePrepareActionLoading || autoPriceSourceChecking"
                  disabled
                >
                  {{ pricePrepareActionLoading || autoPriceSourceChecking ? '自动检查中' : '自动检查价格源' }}
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  :disabled="isBlockedTab(tab) || priceSourceGapSummary.total === 0"
                  @click="openPriceSource(pricePrepareGaps[0])"
                >
                  去维护价格源
                </el-button>
              </div>
            </div>

            <div class="source-gap-cards">
              <div class="source-gap-card">
                <span>待补价格源</span>
                <strong>{{ priceSourceGapSummary.total }}</strong>
              </div>
              <div class="source-gap-card">
                <span>固定采购价缺口</span>
                <strong>{{ priceSourceGapSummary.fixed }}</strong>
              </div>
              <div class="source-gap-card">
                <span>结算固定价缺口</span>
                <strong>{{ priceSourceGapSummary.settleFixed }}</strong>
              </div>
              <div class="source-gap-card">
                <span>联动价缺口</span>
                <strong>{{ priceSourceGapSummary.linked }}</strong>
              </div>
              <div class="source-gap-card">
                <span>区间价缺口</span>
                <strong>{{ priceSourceGapSummary.range }}</strong>
              </div>
              <div class="source-gap-card">
                <span>废料映射缺口</span>
                <strong>{{ priceSourceGapSummary.scrapMapping }}</strong>
              </div>
            </div>

            <el-alert
              v-if="isBlockedTab(tab)"
              type="warning"
              show-icon
              :closable="false"
              title="请先补齐缺失的价格类型，系统才能判断需要补充哪类价格源"
              class="inline-alert"
            />
            <el-alert
              v-else-if="!priceSourceChecked"
              type="warning"
              show-icon
              :closable="false"
              title="系统将自动检查价格源，完成后生成缺口清单"
              class="inline-alert"
            />
            <el-alert
              v-else-if="priceSourceReady"
              type="success"
              show-icon
              :closable="false"
              title="价格源已齐全，可生成最终价格"
              class="inline-alert"
            />

            <el-table
              :data="pricePrepareGaps"
              border
              stripe
              scrollbar-always-on
              max-height="calc(100vh - 430px)"
              class="source-gap-table"
            >
              <el-table-column prop="gapMaterialCode" label="料号" min-width="170" fixed="left" show-overflow-tooltip>
                <template #default="{ row }">{{ row.gapMaterialCode || row.materialCode || '-' }}</template>
              </el-table-column>
              <el-table-column prop="materialName" label="品名" min-width="180" fixed="left" show-overflow-tooltip>
                <template #default="{ row }">{{ row.materialName || '-' }}</template>
              </el-table-column>
              <el-table-column label="价格类型" width="130">
                <template #default="{ row }">{{ priceSourceGapTypeText(row) }}</template>
              </el-table-column>
              <el-table-column prop="gapType" label="缺口类型" width="140" show-overflow-tooltip />
              <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
              <el-table-column label="建议处理" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ priceSourceGapActionText(row) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="260" fixed="right">
                <template #default="{ row }">
                  <div class="row-actions">
                    <template v-if="isMissingScrapMappingGap(row)">
                      <el-button link type="primary" @click="goSupplementScrapMapping(row)">
                        补充废料映射
                      </el-button>
                      <el-button
                        v-if="canConfirmNoScrap(row)"
                        link
                        type="warning"
                        :loading="noScrapConfirming && currentNoScrapGap === row"
                        @click="openNoScrapConfirmDialog(row)"
                      >
                        确认无废料，按0处理
                      </el-button>
                      <el-tag v-else-if="isNoScrapConfirmed(row)" size="small" type="success" effect="plain">
                        已确认按0处理
                      </el-tag>
                    </template>
                    <el-button v-else link type="primary" @click="openPriceSource(row)">
                      {{ priceSourceGapButtonText(row) }}
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无价格源缺口" />
              </template>
            </el-table>
          </div>

          <div v-else-if="isPricePrepareTab(tab.code)" class="price-prepare-tab" v-loading="pricePrepareLoading">
            <div class="action-panel">
              <div>
                <h2>生成最终价格</h2>
                <p>一次生成财务基准与 OA 锁价两份明细，并自动计算材料金额差异</p>
              </div>
              <el-button
                type="primary"
                :loading="pricePrepareActionLoading"
                :disabled="isBlockedTab(tab)"
                @click="generatePricePrepare()"
              >
                生成最终价格
              </el-button>
            </div>

            <div class="status-strip price-compare-summary">
              <div class="metric">
                <span>财务 Cu 基准（元/公斤）</span>
                <strong>{{ formatPrice(pricePrepare.financeCuPricePerKg) }}</strong>
              </div>
              <div class="metric">
                <span>OA 锁定 Cu（元/公斤）</span>
                <strong>{{ formatPrice(oaCuPricePerKg) }}</strong>
              </div>
              <div class="metric">
                <span>材料金额差异（OA - 财务）</span>
                <strong :class="differenceAmountClass(pricePrepareDifferenceSummary.amountDifference)">
                  {{ formatSignedMoney(pricePrepareDifferenceSummary.amountDifference) }}
                </strong>
              </div>
              <div class="metric">
                <span>差异明细</span>
                <strong>{{ pricePrepareDifferenceSummary.differentCount || 0 }} / {{ pricePrepareDifferenceSummary.totalCount || 0 }}</strong>
              </div>
            </div>

            <el-alert
              v-if="pricePrepareReady"
              type="success"
              show-icon
              :closable="false"
              title="最终价格已生成，可进入成本核算"
              class="inline-alert"
            />
            <el-alert
              v-else-if="oaPricePrepareReady"
              type="info"
              show-icon
              :closable="false"
              title="价格源检查已完成；点击“生成最终价格”后会自动生成财务与 OA 两份结果"
              class="inline-alert"
            />
            <el-alert
              v-else-if="pricePrepare.readiness?.message"
              type="warning"
              show-icon
              :closable="false"
              :title="pricePrepare.readiness.message"
              class="inline-alert"
            />

            <el-alert
              v-if="priceHistoryWarningText"
              type="warning"
              show-icon
              :closable="false"
              :title="priceHistoryWarningText"
              class="inline-alert"
            />

            <el-tabs v-model="pricePrepareScenarioTab" class="price-scenario-tabs">
              <el-tab-pane label="财务基准" name="FINANCE">
                <div class="scenario-meta">
                  <span>Cu：{{ formatPrice(pricePrepare.financeCuPricePerKg) }} 元/公斤</span>
                  <span>prepare_no：{{ financePrepareBatch.prepareNo || '-' }}</span>
                </div>
                <el-table :data="financePricePrepareItems" border stripe scrollbar-always-on max-height="360" class="prepare-detail-table">
                  <el-table-column prop="materialCode" label="料号" min-width="170" fixed="left" show-overflow-tooltip />
                  <el-table-column prop="materialName" label="品名" min-width="180" fixed="left" show-overflow-tooltip />
                  <el-table-column prop="itemType" label="类型" width="110" />
                  <el-table-column prop="quantity" label="数量" width="110" align="right" />
                  <el-table-column prop="unitPrice" label="单价" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.unitPrice) }}</template>
                  </el-table-column>
                  <el-table-column prop="amount" label="金额" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
                  </el-table-column>
                  <el-table-column prop="priceSource" label="价格来源" min-width="160" show-overflow-tooltip />
                  <el-table-column label="价格有效性" min-width="300">
                    <template #default="{ row }">
                      <div class="price-validity-cell">
                        <el-tag v-if="isCarriedForwardPrice(row)" size="small" type="warning" effect="plain">
                          沿用历史价
                        </el-tag>
                        <span>{{ priceValidityText(row) }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
                  <template #empty>
                    <el-empty description="暂无财务基准明细" />
                  </template>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="OA 锁价" name="OA">
                <div class="scenario-meta">
                  <span>Cu：{{ formatPrice(oaCuPricePerKg) }} 元/公斤</span>
                  <span>prepare_no：{{ oaPrepareBatch.prepareNo || latestPrepare.prepareNo || '-' }}</span>
                </div>
                <el-table :data="oaPricePrepareItems" border stripe scrollbar-always-on max-height="360" class="prepare-detail-table">
                  <el-table-column prop="materialCode" label="料号" min-width="170" fixed="left" show-overflow-tooltip />
                  <el-table-column prop="materialName" label="品名" min-width="180" fixed="left" show-overflow-tooltip />
                  <el-table-column prop="itemType" label="类型" width="110" />
                  <el-table-column prop="quantity" label="数量" width="110" align="right" />
                  <el-table-column prop="unitPrice" label="单价" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.unitPrice) }}</template>
                  </el-table-column>
                  <el-table-column prop="amount" label="金额" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
                  </el-table-column>
                  <el-table-column prop="priceSource" label="价格来源" min-width="160" show-overflow-tooltip />
                  <el-table-column label="价格有效性" min-width="300">
                    <template #default="{ row }">
                      <div class="price-validity-cell">
                        <el-tag v-if="isCarriedForwardPrice(row)" size="small" type="warning" effect="plain">
                          沿用历史价
                        </el-tag>
                        <span>{{ priceValidityText(row) }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
                  <template #empty>
                    <el-empty description="暂无 OA 锁价明细" />
                  </template>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="差异对比" name="DIFFERENCE">
                <div class="scenario-meta difference-toolbar">
                  <span>同一料号按相同数量比较，差异口径为 OA - 财务</span>
                  <el-checkbox v-model="onlyDifferentPricePrepare">只看有差异</el-checkbox>
                </div>
                <el-table :data="visiblePricePrepareDifferences" border stripe scrollbar-always-on max-height="360" class="prepare-detail-table">
                  <el-table-column prop="materialCode" label="料号" min-width="160" fixed="left" show-overflow-tooltip />
                  <el-table-column prop="materialName" label="品名" min-width="160" fixed="left" show-overflow-tooltip />
                  <el-table-column prop="quantity" label="数量" width="90" align="right" />
                  <el-table-column prop="financeUnitPrice" label="财务单价" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.financeUnitPrice) }}</template>
                  </el-table-column>
                  <el-table-column prop="oaUnitPrice" label="OA 单价" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.oaUnitPrice) }}</template>
                  </el-table-column>
                  <el-table-column prop="unitPriceDifference" label="单价差异" width="120" align="right">
                    <template #default="{ row }"><span :class="differenceAmountClass(row.unitPriceDifference)">{{ formatSignedMoney(row.unitPriceDifference) }}</span></template>
                  </el-table-column>
                  <el-table-column prop="financeAmount" label="财务金额" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.financeAmount) }}</template>
                  </el-table-column>
                  <el-table-column prop="oaAmount" label="OA 金额" width="120" align="right">
                    <template #default="{ row }">{{ formatMoney(row.oaAmount) }}</template>
                  </el-table-column>
                  <el-table-column prop="amountDifference" label="金额差异" width="120" align="right">
                    <template #default="{ row }"><span :class="differenceAmountClass(row.amountDifference)">{{ formatSignedMoney(row.amountDifference) }}</span></template>
                  </el-table-column>
                  <el-table-column prop="differenceRate" label="差异率" width="100" align="right">
                    <template #default="{ row }">{{ formatPercent(row.differenceRate) }}</template>
                  </el-table-column>
                  <template #empty>
                    <el-empty description="暂无价格差异" />
                  </template>
                </el-table>
              </el-tab-pane>
            </el-tabs>

            <div v-if="pricePrepareGaps.length" class="subsection-head">
              <strong>价格生成缺口</strong>
              <span>{{ pricePrepareGaps.length }} 条待处理事项</span>
            </div>
            <el-table v-if="pricePrepareGaps.length" :data="pricePrepareGaps" border stripe scrollbar-always-on max-height="280" class="gap-table">
              <el-table-column prop="materialCode" label="来源料号" min-width="160" fixed="left" show-overflow-tooltip />
              <el-table-column prop="gapMaterialCode" label="缺口料号" min-width="160" show-overflow-tooltip />
              <el-table-column prop="gapType" label="缺口类型" width="130" />
              <el-table-column prop="actionType" label="处理动作" width="130" />
              <el-table-column prop="actionTarget" label="处理入口" min-width="160" show-overflow-tooltip />
              <el-table-column prop="oaPushStatus" label="OA 状态" width="120" />
              <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
              <template #empty>
                <el-empty description="暂无价格生成缺口" />
              </template>
            </el-table>
          </div>

          <div v-else-if="isCostRunTab(tab.code)" class="cost-run-tab" v-loading="costRunLoading">
            <div class="action-panel">
              <div>
                <h2>{{ historyViewMode ? historyResultLabel : '前置条件检查' }}</h2>
                <p>{{ historyViewMode ? '按保存时的成本版本展示，不重新读取当前 BOM、价格或费率。' : costRunBlockingText }}</p>
              </div>
              <div class="toolbar-actions">
                <el-button
                  v-if="!historyViewMode"
                  type="primary"
                  :loading="costRunActionLoading"
                  :disabled="costRunRepriceLocked"
                  @click="submitProductCosting('USER_REQUEST')"
                >
                  {{ productCostingActionLabel }}
                </el-button>
                <el-button
                  :disabled="!hasCostRunResult"
                  @click="openCostRunDetail()"
                >
                  查看完整成本表
                </el-button>
                <el-button
                  :loading="costRunActionLoading"
                  :disabled="!displayedCostVersion.id"
                  @click="exportCostRun"
                >
                  导出 XLSX
                </el-button>
              </div>
            </div>

            <div v-if="!historyViewMode" class="condition-list">
              <el-tag :type="canStartCostRun ? 'success' : 'warning'" effect="plain">
                {{ canStartCostRun ? '可以核算' : '暂不可核算' }}
              </el-tag>
              <el-tag type="info" effect="plain">
                核算成功后自动生成正式版本
              </el-tag>
              <el-tag
                v-for="reason in costRun.blockingReasons || []"
                :key="reason"
                type="danger"
                effect="plain"
              >
                {{ reason }}
              </el-tag>
            </div>

            <el-alert
              v-if="!historyViewMode && costRunRepriceLocked"
              class="inline-alert"
              type="warning"
              show-icon
              :closable="false"
              :title="activeRepriceLock.message || '当前业务单元正在月度调价，暂不能发起成本核算'"
            />

            <el-alert
              v-if="costRunError"
              class="inline-alert"
              type="error"
              show-icon
              :closable="false"
              :title="costRunError"
            />

            <el-alert
              v-if="!historyViewMode && hasRunningCostVersion"
              class="inline-alert"
              type="warning"
              show-icon
              :closable="false"
              title="存在旧的未完成试算，请重新核算生成成功版本"
            />

            <el-table
              :data="costRunVersions"
              border
              stripe
              scrollbar-always-on
              row-key="id"
              :row-class-name="costVersionRowClass"
              class="cost-version-table"
            >
              <el-table-column prop="displayVersionNo" label="成本版本" min-width="190" fixed="left" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="version-cell">
                    <div class="version-title-line">
                      <strong>{{ row.displayVersionNo || row.versionNo || row.costRunNo || '-' }}</strong>
                      <el-tag v-if="row.id === selectedCostRunVersionId" size="small" type="primary" effect="plain">
                        当前展示
                      </el-tag>
                    </div>
                    <span>{{ row.costRunNo || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag effect="plain" :type="costVersionStatusTagType(row)">
                    {{ row.displayStatus || costVersionStatusText(row) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="总成本" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.totalCost) }}</template>
              </el-table-column>
              <el-table-column prop="partItemCount" label="部品行数" width="100" align="right" />
              <el-table-column prop="costItemCount" label="费用项数" width="100" align="right" />
              <el-table-column label="核算完成时间" min-width="170">
                <template #default="{ row }">{{ formatDateTime(row.trialFinishedAt) }}</template>
              </el-table-column>
              <el-table-column label="版本完成时间" min-width="170">
                <template #default="{ row }">{{ formatDateTime(row.confirmedAt) }}</template>
              </el-table-column>
              <el-table-column prop="confirmedBy" label="核算人" width="110" show-overflow-tooltip>
                <template #default="{ row }">{{ row.confirmedBy || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="390" fixed="right">
                <template #default="{ row }">
                  <div class="row-actions">
                    <el-button
                      link
                      type="primary"
                      :loading="costRunLoading && row.id === selectedCostRunVersionId"
                      :disabled="row.id === selectedCostRunVersionId"
                      @click="selectCostRunVersion(row)"
                    >
                      查看本版本
                    </el-button>
                    <el-button
                      link
                      type="primary"
                      :disabled="!row.canViewSheet"
                      @click="openCostRunDetail(row)"
                    >
                      查看一览表
                    </el-button>
                    <el-button
                      link
                      type="primary"
                      :disabled="!row.canViewTrace"
                      @click="openCostRunTrace(row)"
                    >
                      核算底稿
                    </el-button>
                    <el-button
                      link
                      type="primary"
                      :loading="costRunActionLoading"
                      :disabled="!row.id"
                      @click="exportCostRun(row)"
                    >
                      导出 XLSX
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无成本核算版本，请先开始核算" />
              </template>
            </el-table>

          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="noScrapConfirmDialogVisible" title="确认无废料，按0处理" width="560px">
      <el-alert
        class="no-scrap-impact-alert"
        type="warning"
        show-icon
        :closable="false"
        title="确认后该料号在当前核算月份废料抵扣按 0 处理，系统会自动重新检查价格源。"
      />
      <el-descriptions :column="1" border class="no-scrap-context">
        <el-descriptions-item label="OA单号">{{ noScrapConfirmContext.oaNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="顶层产品">{{ noScrapConfirmContext.topProductCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="子项料号">{{ noScrapConfirmContext.materialNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务单元">{{ noScrapConfirmContext.businessUnitType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="核算月份">{{ noScrapConfirmContext.periodMonth || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="noScrapConfirmForm" label-width="86px">
        <el-form-item label="确认原因" required>
          <el-input
            v-model="noScrapConfirmForm.confirmReason"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入确认原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="noScrapConfirmDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="noScrapConfirming" @click="submitNoScrapConfirm">
          确认按0处理
        </el-button>
      </template>
    </el-dialog>

    <CostRunTraceDrawer
      v-model="traceDrawerVisible"
      :cost-run-no="traceVersion?.costRunNo || ''"
      :version-no="traceVersion?.displayVersionNo || traceVersion?.versionNo || ''"
    />

    <BomNodeDetailDrawer v-model="bomNodeDrawerVisible" :node="selectedBomNode" />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import BomNodeDetailDrawer from '../components/BomNodeDetailDrawer.vue'
import BasePagination from '../components/BasePagination.vue'
import CostRunTraceDrawer from '../components/CostRunTraceDrawer.vue'
import QuoteBomAlternativeDrawer from '../components/QuoteBomAlternativeDrawer.vue'
import { getBomHierarchy } from '../api/bom'
import { fetchMonthlyRepriceActiveLock } from '../api/monthlyReprice'
import { useUserStore } from '../store/modules/user'
import {
  checkQuotePriceSources,
  exportQuoteCostRunVersion,
  fetchQuoteBomAlternativeGroups,
  fetchQuoteBomAlternativeFeatureStatus,
  fetchQuoteBomAlternativeHistory,
  fetchQuoteCostRun,
  fetchQuoteCostingWorkbench,
  fetchQuoteEffectiveBom,
  fetchQuotePricePrepare,
  fetchQuotePriceTypeRecognition,
  generateQuotePricePrepare,
  prepareQuoteEffectiveBomCosting,
  previewQuoteEffectiveBomAlternative,
  selectQuoteBomAlternative,
  submitQuoteProductCostRun,
} from '../api/quoteRequests'
import { confirmPricePrepareNoScrap } from '../api/pricePrepare'
import {
  alternativeErrorMessage,
  alternativeReviewWarning,
  alternativeSelectionDisabled,
  canSelectQuoteBomAlternative,
  formatAlternativeRebuildSummary,
} from '../utils/quoteBomAlternativeUtils'
import { expandQuoteBomDisplayRows } from '../utils/quoteCostingBomRows'
import {
  buildQuoteEffectiveBomTree,
  effectiveAlternativeNodeMeta,
  effectiveBomCanPrepare,
  costingBomMatchesPreparedBuild,
  effectiveBomStateMeta,
  effectiveShapeMeta,
  effectiveShapeSourceLabel,
  effectiveNodeEvidenceVisible,
  effectiveSupplierEvidence,
  emptyQuoteEffectiveBom,
  normalizeQuoteEffectiveBom,
  workbenchCanLoadPriceType,
} from '../utils/quoteEffectiveBom'
import { formatDateTime, statusLabel, statusTagType } from '../utils/quoteRequestWorkbench'
import {
  countCarriedForwardPrices,
  isCarriedForwardPrice,
  priceValidityText,
} from '../utils/pricePrepareDisplay'
import {
  isCostRunLockedByMonthlyReprice,
  differenceAmountClass,
  formatSnapshotDecimal,
} from './quoteCuCostingUtils'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const oaNo = computed(() => String(route.params.oaNo || ''))
const itemId = computed(() => String(route.params.itemId || ''))
const historyVersionId = computed(() => {
  const value = Number(route.query.versionId)
  return Number.isInteger(value) && value > 0 ? value : null
})
const historyViewMode = computed(() => route.query.historyResult === 'quote' && Boolean(historyVersionId.value))
// 历史入口同时承载首次报价和后续重新核算，必须把两类结果明确区分，避免用户误认版本。
const historyResultLabel = computed(() => (
  route.query.historyResultKind === 'recalculation' ? '报价重新核算结果' : '原报价结果'
))
const loading = ref(false)
const refreshingTabs = ref(false)
const activeTab = ref('PRODUCT_DETAIL')
const bomTree = ref(null)
const bomTreeRef = ref(null)
const bomTreeLoading = ref(false)
const effectiveBom = ref(emptyQuoteEffectiveBom())
const effectiveBomPreview = ref(null)
const effectiveBomLoading = ref(false)
const effectiveBomPreparing = ref(false)
const bomNodeDrawerVisible = ref(false)
const selectedBomNode = ref(null)
const alternativeDrawerVisible = ref(false)
const alternativeFeatureEnabled = ref(false)
const alternativeLoading = ref(false)
const alternativeSavingGroupKey = ref('')
const alternativePreviewLoadingGroup = ref('')
let alternativePreviewRequestId = 0
const alternativeHistoryLoadingGroup = ref('')
const alternativeHistories = ref({})
const alternativeSummary = ref(emptyAlternativeSummary())
const priceTypeLoading = ref(false)
const priceType = ref(emptyPriceTypeResponse())
const priceTypeFilter = ref('ALL')
const priceTypeKeyword = ref('')
const pricePrepareLoading = ref(false)
const pricePrepareActionLoading = ref(false)
const pricePrepareScenarioTab = ref('FINANCE')
const onlyDifferentPricePrepare = ref(true)
const autoPriceSourceChecking = ref(false)
const returnPriceSourceRefreshing = ref(false)
const autoPriceSourceCheckedKey = ref('')
const noScrapConfirmDialogVisible = ref(false)
const noScrapConfirming = ref(false)
const currentNoScrapGap = ref(null)
const noScrapConfirmContext = ref(emptyNoScrapConfirmContext())
const noScrapConfirmForm = ref({ confirmReason: '' })
const pricePrepare = ref(emptyPricePrepareResponse())
const costRunLoading = ref(false)
const costRunActionLoading = ref(false)
const costRun = ref(emptyCostRunResponse())
const costRunError = ref('')
const activeRepriceLock = ref({ locked: false })
const selectedCostRunVersionId = ref(null)
const traceDrawerVisible = ref(false)
const traceVersion = ref(null)
const localWorkflowGuideText = ref('')
const workbench = ref({
  header: {},
  item: {},
  bomRows: [],
  tabs: [],
  workflowStatus: {},
})

const header = computed(() => workbench.value.header || {})
const item = computed(() => workbench.value.item || {})
const effectiveBomFeatureEnabled = computed(() => workbench.value.effectiveBomEnabled !== false)
const bomRows = computed(() => Array.isArray(workbench.value.bomRows) ? workbench.value.bomRows : [])
const displayBomRows = computed(() => expandQuoteBomDisplayRows(bomRows.value))
const rollupDisplayRowCount = computed(
  () => displayBomRows.value.filter((row) => row.rollupDisplay).length,
)
const currentItemRows = computed(() => item.value?.id ? [item.value] : [])
const costingWorkspace = computed(() => workbench.value.costingWorkspace || {})
const latestPriceType = computed(() => workbench.value.latestPriceTypeRecognition || {})
const latestPrepare = computed(() => {
  const generated = pricePrepare.value.generatedResult || {}
  return {
    ...(workbench.value.latestPricePrepare || {}),
    ...Object.fromEntries(Object.entries(generated).filter(([, value]) => value !== undefined && value !== null && value !== '')),
  }
})
const canSelectAlternative = computed(() => canSelectQuoteBomAlternative(userStore.permissions))
const alternativeNeedsReview = computed(() =>
  Boolean(alternativeSummary.value.reviewRequired)
  || (alternativeSummary.value.groups || []).some(
    (group) => group?.reviewRequired
      || String(group?.selectionStatus || '').toUpperCase() === 'STALE',
  ))
const alternativeReviewMessage = computed(() => alternativeReviewWarning({
  ...alternativeSummary.value,
  reviewRequired: alternativeNeedsReview.value,
}))
const quoteBomWorkspaceStatusText = computed(() => {
  const status = String(costingWorkspace.value.workspaceStatus || '').toUpperCase()
  if (status === 'STALE') return '规则或选择已变化，待重算'
  if (status === 'WAIT_BOM') return '缺 BOM，待技术补录'
  if (bomRows.value.length > 0) return '已生成'
  return '待生成'
})
const tabs = computed(() => {
  const serverTabs = Array.isArray(workbench.value.tabs) ? workbench.value.tabs : []
  const normalizedTabs = serverTabs.length > 0 ? serverTabs : [
    { code: 'PRODUCT_DETAIL', name: '产品明细', status: 'READY' },
    { code: 'QUOTE_BOM', name: '报价物料明细', status: 'PENDING' },
    { code: 'PRICE_TYPE_CONFIRMATION', name: '价格类型识别', status: 'BLOCKED', blockedReason: '请先生成报价物料' },
    { code: 'PRICE_PREPARE', name: '最终价格生成', status: 'BLOCKED', blockedReason: '请先补齐价格类型' },
    { code: 'COST_RUN', name: '成本核算', status: 'BLOCKED', blockedReason: '请先生成最终价格' },
  ]
  const byCode = new Map(normalizedTabs.map((tab) => [normalizeTabCode(tab.code), tab]))
  const priceTypeTab = buildTab(byCode, 'PRICE_TYPE_CONFIRMATION', '价格类型识别')
  const pricePrepareTab = buildTab(byCode, 'PRICE_PREPARE', '最终价格生成')
  if (historyViewMode.value) {
    return [{ ...buildTab(byCode, 'COST_RUN', '成本核算'), status: 'DONE', blockedReason: '' }]
  }
  return [
    buildTab(byCode, 'PRODUCT_DETAIL', '产品明细'),
    buildTab(byCode, 'QUOTE_BOM', '报价物料明细'),
    priceTypeTab,
    buildPriceSourceSupplementTab(priceTypeTab, pricePrepareTab),
    pricePrepareTab,
    buildTab(byCode, 'COST_RUN', '成本核算'),
  ]
})
const metalRows = computed(() => [
  { key: 'copperPrice', label: '铜价', value: header.value.copperPrice },
  { key: 'zincPrice', label: '锌价', value: header.value.zincPrice },
  { key: 'aluminumPrice', label: '铝价', value: header.value.aluminumPrice },
  { key: 'steelPrice', label: '钢价', value: header.value.steelPrice },
  { key: 'silverPrice', label: '银价', value: header.value.silverPrice },
  { key: 'goldPrice', label: '金价', value: header.value.goldPrice },
  { key: 'sus304Price', label: 'SUS304价', value: header.value.sus304Price },
  { key: 'sus316lPrice', label: 'SUS316L价', value: header.value.sus316lPrice },
  { key: 'otherMaterial', label: '其他材料', value: header.value.otherMaterial },
  { key: 'baseShipping', label: '基准运费', value: header.value.baseShipping },
])
const priceMatrixRows = computed(() => {
  const rows = []
  for (let index = 0; index < metalRows.value.length; index += 2) {
    const left = metalRows.value[index] || {}
    const right = metalRows.value[index + 1] || {}
    rows.push({
      leftLabel: left.label || '',
      leftValue: left.value,
      rightLabel: right.label || '',
      rightValue: right.value,
    })
  }
  return rows
})
const bomTreeProps = {
  label: 'materialCode',
  children: 'children',
}
const bomTreeData = computed(() => (bomTree.value ? [bomTree.value] : []))
const bomTreeEmpty = computed(() => bomTree.value && !bomTree.value.materialCode)
const presentedEffectiveBom = computed(() => effectiveBomPreview.value || effectiveBom.value)
const effectiveBomPreviewActive = computed(() => Boolean(effectiveBomPreview.value))
const effectiveBomTreeData = computed(() => buildQuoteEffectiveBomTree(presentedEffectiveBom.value.nodes))
const effectiveBomDefaultExpandedKeys = computed(() => effectiveBomTreeData.value.map((node) => node.nodeKey))
const effectiveBomStateInfo = computed(() => {
  if (String(costingWorkspace.value.workspaceStatus || '').toUpperCase() === 'STALE') {
    return { label: '待重算', type: 'warning' }
  }
  return effectiveBomStateMeta(presentedEffectiveBom.value.state)
})
const effectiveBomBlocked = computed(() => (
  presentedEffectiveBom.value.state === 'BLOCKED'
  || presentedEffectiveBom.value.state === 'ERROR'
))
const pricingBomReadyForNextStep = computed(() => workbenchCanLoadPriceType(workbench.value))
const effectiveAlternativeGroupKeys = computed(() => new Set(
  presentedEffectiveBom.value.alternativeSelections
    .map((selection) => String(selection?.alternativeGroupKey || '').trim())
    .filter(Boolean),
))
const effectiveAlternativeSummaryText = computed(() => {
  const selections = presentedEffectiveBom.value.alternativeSelections || []
  if (selections.length === 0) return '无候选组'
  const alternativeCount = selections.filter(
    (selection) => String(selection?.selectedChildType || '').toUpperCase() === 'ALTERNATIVE',
  ).length
  return alternativeCount > 0
    ? `${selections.length} 组，已选替代 ${alternativeCount} 组`
    : `${selections.length} 组，均使用标准料`
})
const effectiveBomPreviewChangedNodeKeys = computed(() => {
  if (!effectiveBomPreview.value) return new Set()
  const currentByKey = new Map(
    effectiveBom.value.nodes.map((node) => [String(node?.nodeKey || ''), effectiveNodeSignature(node)]),
  )
  return new Set(
    effectiveBomPreview.value.nodes
      .filter((node) => currentByKey.get(String(node?.nodeKey || '')) !== effectiveNodeSignature(node))
      .map((node) => String(node?.nodeKey || '')),
  )
})
const priceTypeSummary = computed(() => priceType.value.summary || {})
const flatPriceTypeRows = computed(() => flattenRows(priceType.value.rows || []))
const missingPriceTypeRows = computed(() => flatPriceTypeRows.value.filter((row) => isMissingPriceTypeRow(row)))
const filteredPriceTypeRows = computed(() => filterTreeRows(priceType.value.rows || []))
const pricePrepareItems = computed(() => Array.isArray(pricePrepare.value.items?.records) ? pricePrepare.value.items.records : [])
const oaPrepareBatch = computed(() => pricePrepare.value.oaScenario?.batch || {})
const financePrepareBatch = computed(() => pricePrepare.value.financeScenario?.batch || {})
const oaPricePrepareItems = computed(() => {
  const rows = pricePrepare.value.oaScenario?.items?.records
  return Array.isArray(rows) ? rows : pricePrepareItems.value
})
const financePricePrepareItems = computed(() => {
  const rows = pricePrepare.value.financeScenario?.items?.records
  return Array.isArray(rows) ? rows : []
})
const oaCarriedForwardPriceCount = computed(() => countCarriedForwardPrices(oaPricePrepareItems.value))
const financeCarriedForwardPriceCount = computed(() => countCarriedForwardPrices(financePricePrepareItems.value))
const priceHistoryWarningText = computed(() => {
  const oaCount = oaCarriedForwardPriceCount.value
  const financeCount = financeCarriedForwardPriceCount.value
  if (oaCount <= 0 && financeCount <= 0) return ''
  const scopes = []
  if (oaCount > 0) scopes.push(`OA 锁价 ${oaCount} 项`)
  if (financeCount > 0) scopes.push(`财务基准 ${financeCount} 项`)
  return `${scopes.join('、')}沿用最近一次已审批价格；不阻断核算，请财务后续更新价格审批。`
})
const pricePrepareDifferences = computed(() => Array.isArray(pricePrepare.value.differences) ? pricePrepare.value.differences : [])
const visiblePricePrepareDifferences = computed(() => onlyDifferentPricePrepare.value
  ? pricePrepareDifferences.value.filter((row) => row?.different)
  : pricePrepareDifferences.value)
const pricePrepareDifferenceSummary = computed(() => pricePrepare.value.differenceSummary || {})
const oaCuPricePerKg = computed(() => normalizeCuPricePerKg(header.value.copperPrice))
const pricePrepareGaps = computed(() => Array.isArray(pricePrepare.value.gaps?.records) ? pricePrepare.value.gaps.records : [])
const priceSourceGapSummary = computed(() => {
  const rows = pricePrepareGaps.value || []
  return {
    total: rows.length,
    fixed: rows.filter((row) => priceSourceGapKind(row) === 'FIXED').length,
    settleFixed: rows.filter((row) => priceSourceGapKind(row) === 'SETTLE_FIXED').length,
    linked: rows.filter((row) => priceSourceGapKind(row) === 'LINKED').length,
    range: rows.filter((row) => priceSourceGapKind(row) === 'RANGE').length,
    scrapMapping: rows.filter((row) => priceSourceGapKind(row) === 'SCRAP_MAPPING').length,
  }
})
const oaPricePrepareReady = computed(() => {
  const readiness = pricePrepare.value.readiness || {}
  const gapCount = Number(readiness.gapCount ?? pricePrepareGaps.value.length)
  return readiness.status === 'READY' && gapCount === 0
})
const financePricePrepareReady = computed(() => (
  financePrepareBatch.value.status === 'SUCCESS'
  && Number(financePrepareBatch.value.gapCount || 0) === 0
  && financePricePrepareItems.value.length > 0
))
const pricePrepareReady = computed(() => oaPricePrepareReady.value && financePricePrepareReady.value)
const priceSourceChecked = computed(() => {
  const readiness = pricePrepare.value.readiness || {}
  const status = String(readiness.status || '').toUpperCase()
  if (status && status !== 'NOT_PREPARED') return true
  return Boolean(latestPrepare.value.prepareNo || pricePrepareItems.value.length || pricePrepareGaps.value.length)
})
const priceSourceReady = computed(() => priceSourceChecked.value && oaPricePrepareReady.value && priceSourceGapSummary.value.total === 0)
const costRunRepriceLocked = computed(() => isCostRunLockedByMonthlyReprice(
  activeRepriceLock.value,
  { permissions: userStore.permissions, roles: userStore.roles },
))
const canStartCostRun = computed(() => Boolean(costRun.value.canStartTrial) && pricePrepareReady.value && !costRunRepriceLocked.value)
const costRunBlockingText = computed(() => {
  if (costRunRepriceLocked.value) {
    return activeRepriceLock.value.message || '当前业务单元正在月度调价，暂不能发起成本核算'
  }
  const reasons = costRun.value.blockingReasons || []
  if (reasons.length > 0) return displayBusinessText(reasons.join('；'))
  return 'BOM、价格类型、最终价格均通过后可开始核算'
})
const costRunVersions = computed(() => {
  const rows = Array.isArray(costRun.value.versions) ? costRun.value.versions : []
  const sourceRows = rows.length > 0 ? rows : [
    costRun.value.latestTrial,
    costRun.value.latestConfirmed,
    costRun.value.currentDisplayVersion,
  ].filter((row, index, list) => row?.id && list.findIndex((candidate) => candidate?.id === row.id) === index)
  return sourceRows.map(normalizeCostVersionRow)
})
const hasRunningCostVersion = computed(() => costRunVersions.value.some((row) => ['RUNNING', 'TRIAL'].includes(row?.status)))
const currentSuccessVersion = computed(() =>
  costRunVersions.value.find((row) => row?.currentConfirmed)
  || costRun.value.latestConfirmed
  || null
)
const productCostingActionLabel = computed(() => (
  currentSuccessVersion.value?.id ? '重新核算本产品' : '核算本产品'
))
const hasStaleCostVersion = computed(() => costRunVersions.value.some((row) => row?.stale))
const costRunWorkbenchStatusText = computed(() => {
  if (historyViewMode.value && displayedCostVersion.value.id) {
    return `历史结果 ${displayedPeriodMonth.value}`
  }
  const confirmedVersionNo =
    currentSuccessVersion.value?.displayVersionNo || currentSuccessVersion.value?.versionNo
  if (hasRunningCostVersion.value && confirmedVersionNo) {
    return '正在重新核算'
  }
  if (hasRunningCostVersion.value) return '正在核算'
  if (confirmedVersionNo) {
    return `核算成功 ${confirmedVersionNo}`
  }
  if (hasStaleCostVersion.value) return '历史版本需重新核算'
  return header.value.calcStatus || '未核算'
})
const costRunStatusTagType = computed(() => {
  if (hasRunningCostVersion.value) return 'warning'
  if (currentSuccessVersion.value?.id) return 'success'
  if (hasStaleCostVersion.value) return 'info'
  return statusTagType('calcStatus', header.value.calcStatus || '未核算')
})
const displayedCostVersion = computed(() => costRun.value.currentDisplayVersion || {})
const displayedPeriodMonth = computed(() => (
  historyViewMode.value
    ? displayedCostVersion.value.pricingMonth || displayedCostVersion.value.resultPeriod || '-'
    : workbench.value.periodMonth || '-'
))
const costPartRows = computed(() => (costRun.value.partItems || []).map((row, index) => ({
  key: `PART-${row.bomRowId || row.partCode || index}`,
  partName: row.partName || '-',
  partCode: row.partCode || '-',
  partDrawingNo: row.partDrawingNo || '-',
  unitPrice: row.unitPrice,
  partQty: row.partQty,
  amount: row.amount,
  material: row.material || '-',
  shapeAttr: row.shapeAttr || '-',
  priceSource: row.priceSource || row.priceType || '-',
  remark: row.remark || row.costElement || '',
})))
const hasCostRunResult = computed(() =>
  Boolean(costRun.value.resultHeader)
  || Boolean(costRun.value.currentDisplayVersion?.id)
  || costRunVersions.value.some((row) => row?.canViewSheet)
  || costPartRows.value.length > 0
)
const inputGapGuideVisible = computed(() => route.query.guide === 'costing-input-gap')
const workflowGuideVisible = computed(() =>
  !currentSuccessVersion.value?.id
  && (inputGapGuideVisible.value || Boolean(localWorkflowGuideText.value))
)
const workflowGuideText = computed(() => localWorkflowGuideText.value || inputGapGuideText.value)
const inputGapGuideText = computed(() => {
  const workspaceStatus = String(costingWorkspace.value.workspaceStatus || '').toUpperCase()
  const blockedStep = normalizeTabCode(workbench.value.workflowStatus?.currentBlockedStep)
  if (workspaceStatus === 'WAIT_BOM' || blockedStep === 'QUOTE_BOM') {
    return '当前产品缺少可核算 BOM，请由产品技术补录后重新核算本产品'
  }
  const missingTypeCount = currentMissingPriceTypeCount()
  if (missingTypeCount > 0) {
    return `发起核算发现 ${missingTypeCount} 项缺价格类型，请到“物料价格类型”导入或维护后再确认`
  }
  const gapCount = currentPriceSourceGapCount()
  if (gapCount > 0) {
    return `发起核算发现 ${gapCount} 项价格源缺口，请在“价格源维护”中查看缺口明细并维护价格`
  }
  return '发起核算未完成，请按工作台当前阻断步骤处理后继续'
})

async function loadWorkbench(options = {}) {
  const { resetTab = false, loadChildren = true } = options
  if (!oaNo.value || !itemId.value) return
  loading.value = true
  try {
    clearEffectiveBom()
    clearBomTree()
    workbench.value = await fetchQuoteCostingWorkbench(oaNo.value, itemId.value)
    if (historyViewMode.value) {
      activeTab.value = 'COST_RUN'
      resetCurrentInputTabs()
      await Promise.allSettled([loadCostRun(false), loadActiveRepriceLock()])
      return
    }
    if (resetTab || !activeTab.value) {
      activeTab.value = 'PRODUCT_DETAIL'
    }
    if (effectiveBomFeatureEnabled.value) {
      await loadEffectiveBom()
    } else {
      await loadBomTree()
    }
    if (loadChildren) {
      await refreshAllTabData()
    }
    applyInputGapGuide()
  } catch (error) {
    workbench.value = { header: {}, item: {}, bomRows: [], tabs: [], workflowStatus: {} }
    clearEffectiveBom('ERROR')
    clearBomTree()
    ElMessage.error(error?.message || '获取核算工作台失败')
  } finally {
    loading.value = false
  }
}

async function refreshWorkbench() {
  autoPriceSourceCheckedKey.value = ''
  await loadWorkbench({ resetTab: false, loadChildren: true })
  if (!historyViewMode.value) await ensurePriceSourceChecked()
}

async function refreshAllTabData() {
  refreshingTabs.value = true
  if (effectiveBomFeatureEnabled.value) {
    await loadAlternativeFeatureStatus(false)
  } else {
    alternativeFeatureEnabled.value = false
    alternativeSummary.value = emptyAlternativeSummary()
  }
  await Promise.allSettled([
    alternativeFeatureEnabled.value
      ? loadAlternativeGroups(false)
      : Promise.resolve(),
    pricingBomReadyForNextStep.value ? loadPriceType(false) : Promise.resolve(),
    loadPricePrepare(false),
    loadCostRun(false),
    loadActiveRepriceLock(),
  ])
  refreshingTabs.value = false
}

function resetCurrentInputTabs() {
  alternativeFeatureEnabled.value = false
  alternativeSummary.value = emptyAlternativeSummary()
  priceType.value = emptyPriceTypeResponse()
  pricePrepare.value = emptyPricePrepareResponse()
}

async function loadAlternativeFeatureStatus(showError = true) {
  if (!oaNo.value || !itemId.value) {
    alternativeFeatureEnabled.value = false
    alternativeSummary.value = emptyAlternativeSummary()
    return
  }
  try {
    const status = await fetchQuoteBomAlternativeFeatureStatus(
      oaNo.value,
      itemId.value,
    )
    alternativeFeatureEnabled.value = status?.enabled === true
  } catch (error) {
    alternativeFeatureEnabled.value = false
    if (showError) {
      ElMessage.error(error?.message || '获取标准/替代功能状态失败')
    }
  }
  if (!alternativeFeatureEnabled.value) {
    alternativeDrawerVisible.value = false
    clearAlternativePreview()
    alternativeSummary.value = emptyAlternativeSummary()
  }
}

async function loadAlternativeGroups(showError = true) {
  if (!alternativeFeatureEnabled.value) {
    alternativeSummary.value = emptyAlternativeSummary()
    return
  }
  if (!oaNo.value || !itemId.value || !workbench.value.periodMonth) {
    alternativeSummary.value = emptyAlternativeSummary()
    return
  }
  alternativeLoading.value = true
  try {
    alternativeSummary.value = await fetchQuoteBomAlternativeGroups(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    }) || emptyAlternativeSummary()
  } catch (error) {
    alternativeSummary.value = emptyAlternativeSummary()
    if (showError) {
      ElMessage.error(alternativeErrorMessage(error) || '获取标准/替代组失败')
    }
  } finally {
    alternativeLoading.value = false
  }
}

async function openAlternativeDrawer() {
  if (!alternativeFeatureEnabled.value) return
  clearAlternativePreview()
  alternativeDrawerVisible.value = true
  await loadAlternativeGroups()
  if (canSelectAlternative.value) {
    await Promise.allSettled(
      (alternativeSummary.value.groups || []).map((group) =>
        loadAlternativeHistory(group, false)),
    )
  }
}

async function previewAlternativeSelection({ group, selectedMaterialCode }) {
  const groupKey = String(group?.alternativeGroupKey || '').trim()
  const materialCode = String(selectedMaterialCode || '').trim()
  if (!groupKey || !materialCode || !workbench.value.periodMonth) return
  const requestId = ++alternativePreviewRequestId
  alternativePreviewLoadingGroup.value = groupKey
  try {
    const result = await previewQuoteEffectiveBomAlternative(
      oaNo.value,
      itemId.value,
      {
        periodMonth: workbench.value.periodMonth,
        alternativeGroupKey: groupKey,
        selectedMaterialCode: materialCode,
      },
    )
    if (requestId !== alternativePreviewRequestId) return
    effectiveBomPreview.value = normalizeQuoteEffectiveBom(result)
  } catch (error) {
    if (requestId !== alternativePreviewRequestId) return
    effectiveBomPreview.value = null
    ElMessage.error(alternativeErrorMessage(error) || '计价方案预览失败')
  } finally {
    if (requestId === alternativePreviewRequestId) {
      alternativePreviewLoadingGroup.value = ''
    }
  }
}

function clearAlternativePreview() {
  alternativePreviewRequestId += 1
  alternativePreviewLoadingGroup.value = ''
  effectiveBomPreview.value = null
}

async function loadAlternativeHistory(group, showError = true) {
  const groupKey = group?.alternativeGroupKey
  if (!groupKey || !workbench.value.periodMonth || !canSelectAlternative.value) return
  alternativeHistoryLoadingGroup.value = groupKey
  try {
    const rows = await fetchQuoteBomAlternativeHistory(
      oaNo.value,
      itemId.value,
      groupKey,
      { periodMonth: workbench.value.periodMonth },
    )
    alternativeHistories.value = {
      ...alternativeHistories.value,
      [groupKey]: Array.isArray(rows) ? rows : [],
    }
  } catch (error) {
    if (showError) ElMessage.error(alternativeErrorMessage(error))
  } finally {
    if (alternativeHistoryLoadingGroup.value === groupKey) {
      alternativeHistoryLoadingGroup.value = ''
    }
  }
}

async function saveAlternativeSelection({ group, selectedMaterialCode }) {
  if (!alternativeFeatureEnabled.value) return
  if (!group?.alternativeGroupKey || !selectedMaterialCode) return
  if (alternativeSelectionDisabled({
    canSelect: canSelectAlternative.value,
    summary: alternativeSummary.value,
    group,
  })) {
    ElMessage.warning(
      alternativeReviewMessage.value
      || '当前不能修改标准/替代选择',
    )
    return
  }

  alternativeSavingGroupKey.value = group.alternativeGroupKey
  try {
    const selectionBody = {
      periodMonth: workbench.value.periodMonth,
      selectedMaterialCode,
      expectedSelectionVersion: group.selectionVersion,
      expectedBuildBatchId: group.sourceBuildBatchId || workbench.value.buildBatchId,
      selectionRemark: '产品明细页面选择标准/替代件',
    }
    const result = await selectQuoteBomAlternative(
      oaNo.value,
      itemId.value,
      group.alternativeGroupKey,
      selectionBody,
    )
    clearAlternativePreview()
    await refreshAfterAlternativeSelection()
    await loadAlternativeHistory(
      alternativeSummary.value.groups?.find(
        (candidate) => candidate.alternativeGroupKey === group.alternativeGroupKey,
      ) || group,
      false,
    )
    ElMessage.success(formatAlternativeRebuildSummary(result))
    await offerImmediateRecalculation()
  } catch (error) {
    const message = alternativeErrorMessage(error)
    ElMessage.error(message)
    if (/ALT_SELECTION_CONFLICT|ALT_SOURCE_STALE/.test(String(error?.message || ''))) {
      await loadAlternativeGroups(false)
    }
  } finally {
    alternativeSavingGroupKey.value = ''
  }
}

async function refreshAfterAlternativeSelection() {
  autoPriceSourceCheckedKey.value = ''
  await loadWorkbench({ resetTab: false, loadChildren: true })
}

async function offerImmediateRecalculation() {
  try {
    await ElMessageBox.confirm(
      '当前产品的核算输入已变化，是否立即重新核算？',
      '规则保存成功',
      {
        confirmButtonText: '立即重新核算',
        cancelButtonText: '稍后处理',
        type: 'success',
      },
    )
  } catch {
    return
  }
  await submitProductCosting('RULE_CHANGED')
}

async function loadActiveRepriceLock() {
  try {
    activeRepriceLock.value = await fetchMonthlyRepriceActiveLock() || { locked: false }
  } catch (error) {
    activeRepriceLock.value = { locked: false }
  }
}

function applyInputGapGuide() {
  if (route.query.guide !== 'costing-input-gap') return
  if (effectiveBomFeatureEnabled.value && !pricingBomReadyForNextStep.value) {
    activeTab.value = 'PRODUCT_DETAIL'
    return
  }
  const missingTypeCount = currentMissingPriceTypeCount()
  if (missingTypeCount > 0) {
    priceTypeFilter.value = 'MISSING'
    activeTab.value = 'PRICE_TYPE_CONFIRMATION'
    return
  }
  const gapCount = currentPriceSourceGapCount()
  if (gapCount > 0) {
    activeTab.value = 'PRICE_SOURCE_SUPPLEMENT'
    return
  }
  const blockedStep = normalizeTabCode(workbench.value.workflowStatus?.currentBlockedStep)
  activeTab.value = blockedStep || 'COST_RUN'
}

async function applyRouteTab() {
  const requestedTab = normalizeTabCode(route.query.tab)
  if (!requestedTab) return false
  const exists = tabs.value.some((tab) => normalizeTabCode(tab.code) === requestedTab)
  if (!exists) return false
  activeTab.value = requestedTab
  return true
}

async function refreshAfterAction(successText) {
  await loadWorkbench({ resetTab: false, loadChildren: true })
  if (successText) ElMessage.success(successText)
}

function currentMissingPriceTypeCount() {
  return Number(priceTypeSummary.value.missingTypeCount ?? latestPriceType.value.gapCount ?? missingPriceTypeRows.value.length)
}

function currentPriceSourceGapCount() {
  return Number(pricePrepare.value.readiness?.gapCount ?? pricePrepareGaps.value.length)
}

function guidePriceTypeAfterBomBuild() {
  activeTab.value = 'PRICE_TYPE_CONFIRMATION'
  const missingTypeCount = currentMissingPriceTypeCount()
  if (missingTypeCount > 0) {
    priceTypeFilter.value = 'MISSING'
    localWorkflowGuideText.value = `报价物料明细已生成，系统发现 ${missingTypeCount} 项缺价格类型，请到“物料价格类型”导入或维护`
    ElMessage.warning(localWorkflowGuideText.value)
    return
  }
  priceTypeFilter.value = 'ALL'
  localWorkflowGuideText.value = '报价物料明细已生成，价格类型已自动识别，可继续检查价格源'
  ElMessage.success(localWorkflowGuideText.value)
}

async function loadPriceType(showError = true) {
  if (!oaNo.value || !itemId.value) return
  priceTypeLoading.value = true
  try {
    priceType.value = await fetchQuotePriceTypeRecognition(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
  } catch (error) {
    priceType.value = emptyPriceTypeResponse()
    if (showError) ElMessage.error(error?.message || '获取价格类型识别结果失败')
  } finally {
    priceTypeLoading.value = false
  }
}

async function loadPricePrepare(showError = true) {
  if (!oaNo.value || !itemId.value) return
  pricePrepareLoading.value = true
  try {
    pricePrepare.value = await fetchQuotePricePrepare(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
  } catch (error) {
    pricePrepare.value = emptyPricePrepareResponse()
    if (showError) ElMessage.error(error?.message || '获取最终价格生成失败')
  } finally {
    pricePrepareLoading.value = false
  }
}

async function loadCostRun(showError = true) {
  if (!oaNo.value || !itemId.value) return
  costRunLoading.value = true
  costRunError.value = ''
  try {
    const params = historyViewMode.value
      ? { versionId: historyVersionId.value }
      : { periodMonth: workbench.value.periodMonth }
    const response = await fetchQuoteCostRun(oaNo.value, itemId.value, params)
    await applyCostRunResponse(response)
  } catch (error) {
    const message = error?.message || '获取成本核算失败'
    resetCostRunResult()
    costRunError.value = message
    if (showError) ElMessage.error(message)
  } finally {
    costRunLoading.value = false
  }
}

function applyCostRunResponse(response) {
  costRun.value = response || emptyCostRunResponse()
  selectedCostRunVersionId.value = costRun.value.currentDisplayVersion?.id ?? null
  costRunError.value = ''
}

function resetCostRunResult() {
  costRun.value = emptyCostRunResponse()
  selectedCostRunVersionId.value = null
}

async function selectCostRunVersion(row) {
  if (!row?.id || row.id === selectedCostRunVersionId.value) return
  costRunLoading.value = true
  costRunError.value = ''
  selectedCostRunVersionId.value = row.id
  try {
    const response = await fetchQuoteCostRun(oaNo.value, itemId.value, {
      versionId: row.id,
    })
    await applyCostRunResponse(response)
  } catch (error) {
    const message = error?.message || '获取历史成本版本失败'
    costRunError.value = message
    selectedCostRunVersionId.value = displayedCostVersion.value.id ?? null
    ElMessage.error(message)
  } finally {
    costRunLoading.value = false
  }
}

function goBack() {
  router.push({
    path: `/ingest/quote-requests/${encodeURIComponent(oaNo.value)}`,
    query: { itemId: route.query.returnItemId || itemId.value },
  })
}

function openCurrentCosting() {
  router.replace({
    path: route.path,
    query: { tab: 'COST_RUN', returnItemId: route.query.returnItemId || itemId.value },
  })
}

function clearEffectiveBom(state = '') {
  clearAlternativePreview()
  effectiveBom.value = emptyQuoteEffectiveBom(state)
  selectedBomNode.value = null
  bomNodeDrawerVisible.value = false
}

function clearBomTree() {
  bomTree.value = null
  selectedBomNode.value = null
  bomNodeDrawerVisible.value = false
}

async function loadBomTree() {
  const topProductCode = String(item.value?.materialNo || '').trim()
  if (!topProductCode) {
    clearBomTree()
    return
  }
  bomTreeLoading.value = true
  try {
    bomTree.value = await getBomHierarchy(topProductCode, {
      sourceType: 'U9',
      priceOrgCode: resolveBomTreePriceOrgCode(),
    })
  } catch (error) {
    bomTree.value = null
    ElMessage.error(error?.message || '查询 BOM 层级树失败')
  } finally {
    bomTreeLoading.value = false
  }
}

function resolveBomTreePriceOrgCode() {
  return normalizePriceOrgCode(bomRows.value.find((row) => normalizePriceOrgCode(row?.priceOrgCode))?.priceOrgCode)
    || priceOrgCodeFromOrganization(bomRows.value.find((row) => priceOrgCodeFromOrganization(row?.materialOrganizationCode))?.materialOrganizationCode)
    || normalizePriceOrgCode(item.value?.priceOrgCode)
    || normalizePriceOrgCode(header.value?.priceOrgCode)
    || normalizePriceOrgCode(workbench.value?.priceOrgCode)
    || priceOrgCodeFromOrganization(item.value?.materialOrganizationCode)
    || priceOrgCodeFromOrganization(header.value?.materialOrganizationCode)
    || priceOrgCodeFromOrganization(workbench.value?.materialOrganizationCode)
    || priceOrgCodeFromProcess(oaNo.value)
    || priceOrgCodeFromProductText(item.value?.productName, item.value?.sunlModel)
    || priceOrgCodeFromOrganization(item.value?.businessUnitType)
    || priceOrgCodeFromOrganization(header.value?.businessUnitType)
    || priceOrgCodeFromOrganization(workbench.value?.businessUnitType)
    || priceOrgCodeFromOrganization(userStore.businessUnitType)
    || '210'
}

function normalizePriceOrgCode(value) {
  const priceOrgCode = String(value || '').trim()
  return ['210', '220'].includes(priceOrgCode) ? priceOrgCode : ''
}

function priceOrgCodeFromOrganization(value) {
  const organization = String(value || '').trim().toUpperCase()
  if (organization === 'PLATE' || organization === '220' || organization === '板换') return '220'
  if (organization === 'COMMERCIAL' || organization === '210' || organization === '商用') return '210'
  return ''
}

function priceOrgCodeFromProcess(value) {
  const process = String(value || '').trim().toUpperCase()
  const compact = process.replace(/[-_]/g, '')
  return process.startsWith('FI-SC-020') || compact.startsWith('FISC020') ? '220' : ''
}

function priceOrgCodeFromProductText(...values) {
  const text = values.map((value) => String(value || '')).join(' ')
  return /板换|板式换热器|板式热交换器|钎焊板式/.test(text) ? '220' : ''
}

async function loadEffectiveBom(showError = true) {
  if (!oaNo.value || !itemId.value) {
    clearEffectiveBom()
    return
  }
  effectiveBomLoading.value = true
  try {
    effectiveBom.value = normalizeQuoteEffectiveBom(
      await fetchQuoteEffectiveBom(oaNo.value, itemId.value),
    )
  } catch (error) {
    const message = error?.message || '查询最终有效 BOM 失败'
    effectiveBom.value = normalizeQuoteEffectiveBom({
      state: 'ERROR',
      blockIssues: [{ issueCode: 'EFFECTIVE_BOM_LOAD_FAILED', message }],
    })
    if (showError) ElMessage.error(message)
  } finally {
    effectiveBomLoading.value = false
  }
}

async function preparePricingBomForNextStep(force = false) {
  if (pricingBomReadyForNextStep.value && !force) return true
  if (effectiveBomPreparing.value) return false
  if (!effectiveBomCanPrepare(effectiveBom.value)) {
    ElMessage.warning(effectiveBomBlocked.value
      ? '请先处理本次计价 BOM 的数据问题'
      : '本次计价 BOM 尚未准备好')
    return false
  }
  effectiveBomPreparing.value = true
  try {
    const prepared = await prepareQuoteEffectiveBomCosting(oaNo.value, itemId.value)
    await loadWorkbench({ resetTab: false, loadChildren: true })
    if (!costingBomMatchesPreparedBuild(prepared, workbench.value)) {
      ElMessage.error('本次计价 BOM 自动生成失败，请联系管理员检查')
      return false
    }
    ElMessage.success('已按当前计价 BOM 生成报价物料明细')
    return true
  } catch (error) {
    ElMessage.error(error?.message || '生成报价物料明细失败')
    return false
  } finally {
    effectiveBomPreparing.value = false
  }
}

async function regenerateCurrentBom() {
  if (await preparePricingBomForNextStep(true)) {
    guidePriceTypeAfterBomBuild()
  }
}

function openBomNodeDetail(node) {
  selectedBomNode.value = node
  bomNodeDrawerVisible.value = true
}

function expandBomTree() {
  setBomTreeExpanded(true)
}

function collapseBomTree() {
  setBomTreeExpanded(false)
}

function setBomTreeExpanded(expanded) {
  // 此树位于 v-for 生成的标签页内，Vue 会把同名模板 ref 收集成数组；取当前真实的 ElTree 实例。
  const tree = Array.isArray(bomTreeRef.value)
    ? bomTreeRef.value.find((candidate) => candidate?.getNode)
    : bomTreeRef.value
  if (!tree?.getNode) return
  const roots = effectiveBomFeatureEnabled.value
    ? effectiveBomTreeData.value
    : bomTreeData.value
  const visitNode = (node) => {
    if (!node) return
    if (expanded) node.expand()
    // 折叠节点的子节点可能尚未渲染，不能再按 key 逐个 getNode；从公开 Node.childNodes 递归才完整。
    const childNodes = Array.isArray(node.childNodes) ? node.childNodes : []
    childNodes.forEach(visitNode)
    if (!expanded) node.collapse()
  }
  roots.forEach((data) => {
    const key = effectiveBomFeatureEnabled.value ? data?.nodeKey : data?.path
    visitNode(key ? tree.getNode(key) : null)
  })
}

function effectiveShapeInfo(node) {
  return effectiveShapeMeta(node?.effectiveMaterialShape)
}

function isStructureRootNode(node) {
  return node?.shapeResolutionSource === 'STRUCTURE_ROOT'
}

function effectiveNodeSignature(node) {
  return [
    node?.parentNodeKey,
    node?.materialCode,
    node?.effectiveMaterialShape,
    node?.alternativeChildType,
    node?.shapeResolutionSource,
  ].map((value) => String(value ?? '')).join('|')
}

function isEffectiveBomPreviewChanged(node) {
  return effectiveBomPreviewChangedNodeKeys.value.has(String(node?.nodeKey || ''))
}

function hasEffectiveBomChildren(node) {
  return Array.isArray(node?.children) && node.children.length > 0
}

function effectiveAlternativeInfo(node) {
  return effectiveAlternativeNodeMeta(node, effectiveAlternativeGroupKeys.value)
}

function shouldShowEffectiveNodeEvidence(node) {
  return !isStructureRootNode(node) && effectiveNodeEvidenceVisible(node)
}

function effectiveShapeSourceText(node) {
  return effectiveShapeSourceLabel(node?.shapeResolutionSource)
}

function effectiveSupplierText(node) {
  return effectiveSupplierEvidence(node)
}

function isTakeoverNode(node) {
  return (node?.materialName || '').includes('接管')
}

function bomNodeShapeAttr(node) {
  return node?.shapeAttr || ''
}

function bomNodeShapeTagType(node) {
  const shapeAttr = bomNodeShapeAttr(node)
  if (!shapeAttr) return 'info'
  if (shapeAttr.includes('采购')) return 'success'
  if (shapeAttr.includes('委外')) return 'warning'
  if (shapeAttr.includes('部品联动')) return 'warning'
  if (shapeAttr.includes('虚拟')) return 'info'
  return ''
}

function openMaterialPriceTypePage() {
  const first = missingPriceTypeRows.value[0] || {}
  router.push({
    path: '/base/map',
    query: {
      materialCode: first.materialCode || '',
      oaNo: oaNo.value,
      oaFormItemId: itemId.value,
      productCode: item.value.materialNo || '',
      periodMonth: workbench.value.periodMonth || '',
      returnTo: route.fullPath,
    },
  }).catch(() => {
    ElMessage.info('请到价格源管理下的物料价格类型页面导入或维护价格类型')
  })
}

async function generatePricePrepare(successText = '最终价格已生成') {
  pricePrepareActionLoading.value = true
  try {
    await generateQuotePricePrepare(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
    await refreshAfterAction(successText)
    return true
  } catch (error) {
    ElMessage.error(error?.message || '生成最终价格失败')
    return false
  } finally {
    pricePrepareActionLoading.value = false
  }
}

async function runPriceSourceCheck(successText = '价格源已自动检查') {
  if (pricePrepareActionLoading.value || autoPriceSourceChecking.value) {
    return false
  }
  autoPriceSourceChecking.value = true
  try {
    pricePrepare.value = await checkQuotePriceSources(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
    if (successText) ElMessage.success(successText)
    return true
  } catch (error) {
    ElMessage.error(error?.message || '检查价格源失败')
    return false
  } finally {
    autoPriceSourceChecking.value = false
  }
}

function currentPriceSourceTab() {
  return tabs.value.find((tab) => normalizeTabCode(tab.code) === 'PRICE_SOURCE_SUPPLEMENT')
}

function priceSourceAutoCheckKey() {
  return [
    oaNo.value,
    itemId.value,
    workbench.value.periodMonth || '',
  ].join('|')
}

async function ensurePriceSourceChecked() {
  if (activeTab.value !== 'PRICE_SOURCE_SUPPLEMENT') return
  if (route.query.refreshPriceSource === '1') return
  const tab = currentPriceSourceTab()
  if (isBlockedTab(tab)) return
  const checkKey = priceSourceAutoCheckKey()
  if (autoPriceSourceCheckedKey.value === checkKey) return
  const checked = await runPriceSourceCheck('价格源已自动检查')
  if (checked) {
    autoPriceSourceCheckedKey.value = checkKey
  }
}

function priceSourceReturnTo() {
  const url = new URL(route.fullPath || '/', 'http://local')
  url.searchParams.set('tab', 'PRICE_SOURCE_SUPPLEMENT')
  url.searchParams.set('refreshPriceSource', '1')
  return `${url.pathname}${url.search}${url.hash}`
}

async function refreshPriceSourceFromReturn() {
  if (route.query.refreshPriceSource !== '1' || returnPriceSourceRefreshing.value) return
  const tab = currentPriceSourceTab()
  if (isBlockedTab(tab)) return
  returnPriceSourceRefreshing.value = true
  activeTab.value = 'PRICE_SOURCE_SUPPLEMENT'
  const query = { ...route.query }
  delete query.refreshPriceSource
  query.tab = 'PRICE_SOURCE_SUPPLEMENT'
  await router.replace({ path: route.path, query }).catch(() => {})
  try {
    autoPriceSourceCheckedKey.value = ''
    const checked = await runPriceSourceCheck('价格源已自动刷新')
    if (checked) {
      autoPriceSourceCheckedKey.value = priceSourceAutoCheckKey()
    }
  } finally {
    returnPriceSourceRefreshing.value = false
  }
}

function openPriceSource(row) {
  const kind = priceSourceGapKind(row)
  if (kind === 'SCRAP_MAPPING') {
    ElMessage.info('该缺口请在缺口行选择“补充废料映射”或“确认无废料，按0处理”')
    return
  }
  const paths = {
    FIXED: '/price/fixed',
    SETTLE_FIXED: '/price/settle-fixed',
    LINKED: '/price/linked/result',
    RANGE: '/price/range',
    PRICE_TYPE: '/base/map',
  }
  const path = paths[kind]
  if (!path) {
    ElMessage.info('该缺口未返回可维护价格源类型，请重新检查价格源或按说明处理')
    return
  }
  const materialCode = row?.gapMaterialCode || row?.materialCode || ''
  const pricingMonth = workbench.value.periodMonth || ''
  router.push({
    path,
    query: {
      materialCode,
      pricingMonth,
      periodMonth: pricingMonth,
      oaNo: oaNo.value,
      oaFormItemId: itemId.value,
      productCode: item.value.materialNo || '',
      returnTo: priceSourceReturnTo(),
    },
  }).catch(() => {
    ElMessage.info('请到价格源管理下维护对应价格源')
  })
}

function goSupplementScrapMapping(row) {
  const materialCode = actionMaterialNo(row)
  router.push({
    path: '/base/cms-cost/material-scrap-refs',
    query: materialCode ? { materialCode } : {},
  }).catch(() => {
    ElMessage.info('请到基础数据下维护 CMS 回收废料映射')
  })
}

function openNoScrapConfirmDialog(row) {
  const materialNo = actionMaterialNo(row)
  const periodMonth = actionPeriodMonth(row)
  const businessUnitType = priceSourceBusinessUnitType(row)
  if (!materialNo) {
    ElMessage.warning('缺少无废料确认的料号')
    return
  }
  if (!periodMonth) {
    ElMessage.warning('缺少核算月份，无法确认无废料')
    return
  }
  if (!businessUnitType) {
    ElMessage.warning('缺少业务单元，无法确认无废料')
    return
  }
  currentNoScrapGap.value = row
  noScrapConfirmContext.value = {
    oaNo: row?.oaNo || oaNo.value,
    topProductCode: row?.topProductCode || item.value.materialNo || '',
    materialNo,
    materialName: row?.gapMaterialName || row?.materialName || '',
    businessUnitType,
    periodMonth,
  }
  noScrapConfirmForm.value = { confirmReason: '' }
  noScrapConfirmDialogVisible.value = true
}

async function submitNoScrapConfirm() {
  const reason = String(noScrapConfirmForm.value.confirmReason || '').trim()
  if (!reason) {
    ElMessage.warning('请输入确认原因')
    return
  }
  const row = currentNoScrapGap.value
  const context = noScrapConfirmContext.value
  if (!row || !context.materialNo || !context.businessUnitType || !context.periodMonth) {
    ElMessage.error('缺少无废料确认上下文，请刷新后重试')
    return
  }
  noScrapConfirming.value = true
  try {
    await confirmPricePrepareNoScrap({
      businessUnitType: context.businessUnitType,
      materialNo: context.materialNo,
      materialName: context.materialName,
      effectiveFromMonth: context.periodMonth,
      confirmReason: reason,
      sourceOaNo: context.oaNo,
      sourceGapId: row?.id,
    })
    noScrapConfirmDialogVisible.value = false
    autoPriceSourceCheckedKey.value = ''
    const checked = await runPriceSourceCheck('无废料已确认，价格源已刷新')
    if (checked) {
      autoPriceSourceCheckedKey.value = priceSourceAutoCheckKey()
    } else {
      await loadPricePrepare(false)
    }
  } catch (error) {
    ElMessage.error(error?.message || '确认无废料失败')
  } finally {
    noScrapConfirming.value = false
  }
}

function priceSourceSupplementText(tab) {
  if (isBlockedTab(tab)) {
    return tab.blockedReason || '请先补齐缺失的价格类型，系统才能判断需要补充哪类价格源'
  }
  if (priceSourceGapSummary.value.total > 0) {
    return '请根据缺口行的价格类型维护对应价格源'
  }
  if (!priceSourceChecked.value) {
    return '系统将自动检查价格源；如果价格源已维护完整，会同时生成最终价格'
  }
  return '价格源已齐全，可生成最终价格'
}

function priceSourceGapKind(row) {
  if (isMissingScrapMappingGap(row)) return 'SCRAP_MAPPING'
  const kind = normalizePriceSourceKind(row?.priceType)
  if (kind) return kind
  const gapType = String(row?.gapType || '')
  if (gapType.includes('MISSING_PRICE_TYPE')) return 'PRICE_TYPE'
  return 'UNRESOLVED'
}

function normalizePriceSourceKind(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const upper = text.toUpperCase()
  if (isSettleFixedPriceSource(text) || upper === 'SETTLE_FIXED') return 'SETTLE_FIXED'
  if (['FIXED', 'PURCHASE_FIXED'].includes(upper) || text.includes('固定')) return 'FIXED'
  if (upper === 'LINKED' || text.includes('联动')) return 'LINKED'
  if (upper === 'RANGE' || text.includes('区间')) return 'RANGE'
  if (upper === 'MAKE' || text.includes('自制')) return 'MAKE'
  return ''
}

function isSettleFixedPriceSource(text) {
  return ['SETTLE_FIXED', '结算固定', '固定结算', '家用结算', '结算价'].some((token) => text.includes(token))
}

function priceSourceGapTypeText(row) {
  const type = row?.priceType
  if (isMissingScrapMappingGap(row)) return '废料映射'
  if (type) return type
  const labels = {
    FIXED: '固定采购价',
    SETTLE_FIXED: '结算固定价',
    LINKED: '联动价',
    RANGE: '区间价',
    PRICE_TYPE: '价格类型',
    MAKE: '自制件',
    SCRAP_MAPPING: '废料映射',
    UNRESOLVED: '未返回价格类型',
  }
  return labels[priceSourceGapKind(row)] || '-'
}

function priceSourceGapActionText(row) {
  const materialCode = row?.gapMaterialCode || row?.materialCode || ''
  if (isMissingScrapMappingGap(row)) {
    const actionCode = actionMaterialNo(row) || materialCode
    const label = isNoScrapConfirmed(row)
      ? '已确认无废料，重新检查后按0处理'
      : '补充废料映射；如确无废料可确认按0处理'
    return actionCode ? `${label}：${actionCode}` : label
  }
  const labels = {
    FIXED: '维护固定采购价价格源',
    SETTLE_FIXED: '维护结算固定价价格源',
    LINKED: '维护联动价结果',
    RANGE: '维护区间价价格源',
    PRICE_TYPE: '维护物料价格类型',
    MAKE: '自制件价格由原材料/废料价格生成，请按缺口说明处理',
    UNRESOLVED: '缺口未带价格类型，请重新检查价格源',
  }
  const label = labels[priceSourceGapKind(row)] || labels.UNRESOLVED
  return materialCode ? `${label}：${materialCode}` : label
}

function priceSourceGapButtonText(row) {
  const labels = {
    FIXED: '去维护固定采购价',
    SETTLE_FIXED: '去维护结算固定价',
    LINKED: '去维护联动价',
    RANGE: '去维护区间价',
    PRICE_TYPE: '去维护价格类型',
    MAKE: '查看说明',
    SCRAP_MAPPING: '处理废料映射',
    UNRESOLVED: '查看说明',
  }
  return labels[priceSourceGapKind(row)] || labels.UNRESOLVED
}

function emptyNoScrapConfirmContext() {
  return {
    oaNo: '',
    topProductCode: '',
    materialNo: '',
    materialName: '',
    businessUnitType: '',
    periodMonth: '',
  }
}

function isScrapMappingSource(row) {
  return row?.sourceTable === 'lp_material_scrap_ref'
}

function isMissingScrapMappingGap(row) {
  const message = String(row?.message || '')
  return row?.gapType === 'MISSING_SCRAP_MAPPING'
    || row?.actionType === 'SUPPLEMENT_SCRAP_MAPPING'
    || row?.actionType === 'CONFIRM_NO_SCRAP'
    || row?.canConfirmNoScrap === true
    || isScrapMappingSource(row)
    || message.includes('缺废料映射')
    || message.includes('MISSING_SCRAP_MAPPING')
}

function actionMaterialNo(row) {
  return row?.actionMaterialNo || row?.gapMaterialCode || row?.materialCode || ''
}

function actionPeriodMonth(row) {
  return row?.periodMonth || row?.priceMonth || row?.effectiveFromMonth || workbench.value.periodMonth || ''
}

function priceSourceBusinessUnitType(row) {
  return row?.businessUnitType
    || item.value.businessUnitType
    || header.value.businessUnitType
    || workbench.value.businessUnitType
    || ''
}

function noScrapConfirmation(row) {
  return row?.noScrapConfirmation || {}
}

function noScrapConfirmationStatus(row) {
  return row?.noScrapConfirmationStatus
    || row?.confirmationStatus
    || row?.noScrapStatus
    || noScrapConfirmation(row).status
    || (row?.noScrapConfirmationId ? 'ACTIVE' : '')
}

function isNoScrapConfirmed(row) {
  return noScrapConfirmationStatus(row) === 'ACTIVE'
}

function canConfirmNoScrap(row) {
  return isMissingScrapMappingGap(row)
    && row?.canConfirmNoScrap !== false
    && !isNoScrapConfirmed(row)
}

async function submitProductCosting(reason = 'USER_REQUEST') {
  if (costRunRepriceLocked.value) {
    ElMessage.warning(activeRepriceLock.value.message || '当前业务单元正在月度调价，暂不能发起成本核算')
    return
  }
  costRunActionLoading.value = true
  costRunError.value = ''
  try {
    const result = await submitQuoteProductCostRun(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      reason,
    })
    await loadWorkbench({ resetTab: false, loadChildren: true })
    if (result?.pipelineStatus === 'SUCCESS') {
      localWorkflowGuideText.value = ''
      activeTab.value = 'COST_RUN'
      if (route.query.guide) {
        const nextQuery = { ...route.query }
        delete nextQuery.guide
        await router.replace({ query: nextQuery })
      }
      ElMessage.success(result.reusedSuccess ? '当前结果已是最新，无需重复核算' : '本产品核算完成并生成成功版本')
      return
    }
    localWorkflowGuideText.value = result?.message || '核算资料存在缺口，请按当前步骤处理'
    activeTab.value = productCostingResultTab(result?.currentStep)
    if (result?.pipelineStatus === 'BLOCKED') {
      ElMessage.warning(localWorkflowGuideText.value)
      return
    }
    costRunError.value = localWorkflowGuideText.value
    ElMessage.error(costRunError.value)
  } catch (error) {
    costRunError.value = error?.message || '开始核算失败'
    ElMessage.error(costRunError.value)
  } finally {
    costRunActionLoading.value = false
  }
}

function productCostingResultTab(step) {
  const normalized = normalizeTabCode(step)
  if (normalized === 'PRICE_PREPARE') return 'PRICE_SOURCE_SUPPLEMENT'
  if (normalized === 'PRICE_TYPE_CONFIRMATION') return 'PRICE_TYPE_CONFIRMATION'
  if (normalized === 'COST_RUN') return 'COST_RUN'
  return 'PRODUCT_DETAIL'
}

async function exportCostRun(row = null) {
  const versionId = row?.id || displayedCostVersion.value.id
  if (!versionId) return
  costRunActionLoading.value = true
  try {
    await exportQuoteCostRunVersion(oaNo.value, itemId.value, versionId)
  } catch (error) {
    ElMessage.error(error?.message || '导出成本核算失败')
  } finally {
    costRunActionLoading.value = false
  }
}

function openCostRunDetail(row = null) {
  if (!oaNo.value || !item.value.materialNo) {
    ElMessage.error('缺少 OA 单号或物料编码')
    return
  }
  const displayVersion = row || costRun.value.currentDisplayVersion || costRun.value.latestTrial || {}
  if (!displayVersion.costRunNo) {
    ElMessage.error('当前成本版本缺少核算单号')
    return
  }
  const productCode = costRun.value.resultHeader?.productCode || item.value.materialNo || ''
  router.push({
    name: 'cost-run-detail',
    params: { oaNo: oaNo.value },
    query: {
      customer: header.value.customer || '',
      productName: costRun.value.resultHeader?.productName || item.value.productName || '',
      productModel: costRun.value.resultHeader?.productModel || item.value.sunlModel || item.value.spec || '',
      productCode,
      materialCode: productCode,
      customerDrawing: item.value.customerDrawing || '',
      costRunNo: displayVersion.costRunNo || '',
      versionNo: displayVersion.versionNo || displayVersion.costRunNo || '',
    },
  })
}

async function openCostRunTrace(row) {
  if (!row?.costRunNo) {
    ElMessage.error('当前成本版本缺少核算单号')
    return
  }
  traceVersion.value = row
  traceDrawerVisible.value = true
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN') : value
}

function formatPrice(value) {
  return formatSnapshotDecimal(value, 3)
}

function formatSignedMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  const formatted = formatSnapshotDecimal(value, 3)
  return Number.isFinite(number) && number > 0 ? `+${formatted}` : formatted
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatSnapshotDecimal(value, 2)}%`
}

function normalizeCuPricePerKg(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replaceAll(',', ''))
  if (!Number.isFinite(number)) return value
  return number > 1000 ? number / 1000 : number
}

function normalizeTabCode(code) {
  const value = String(code || '')
  const aliases = {
    QUOTE_PRODUCT_BOM: 'QUOTE_BOM',
    PRODUCT_PRICE_TYPE: 'PRICE_TYPE_CONFIRMATION',
    PRICE_MANAGEMENT: 'PRICE_TYPE_CONFIRMATION',
    PRICE_PREPARATION: 'PRICE_PREPARE',
    COST_ACCOUNTING: 'COST_RUN',
  }
  return aliases[value] || value
}

function buildTab(byCode, code, name) {
  const tab = byCode.get(code) || {}
  return {
    ...tab,
    code,
    name,
    status: tab.status || 'PENDING',
  }
}

function buildPriceSourceSupplementTab(priceTypeTab, prepareTab) {
  const gapCount = currentPriceSourceGapCount()
  const priceTypeStatus = priceTypeTab?.status || 'BLOCKED'
  if (priceTypeStatus !== 'DONE') {
    return {
      code: 'PRICE_SOURCE_SUPPLEMENT',
      name: '价格源维护',
      status: 'BLOCKED',
      blockedReason: '请先补齐价格类型',
    }
  }
  if (gapCount > 0) {
    return {
      code: 'PRICE_SOURCE_SUPPLEMENT',
      name: '价格源维护',
      status: 'PARTIAL',
      blockedReason: `存在 ${gapCount} 项价格源缺口`,
    }
  }
  const hasGeneratedPrice = prepareTab?.status === 'DONE'
  if (!priceSourceChecked.value) {
    return {
      code: 'PRICE_SOURCE_SUPPLEMENT',
      name: '价格源维护',
      status: 'PENDING',
      blockedReason: '价格类型已识别，系统将自动检查价格源',
    }
  }
  return {
    code: 'PRICE_SOURCE_SUPPLEMENT',
    name: '价格源维护',
    status: hasGeneratedPrice ? 'DONE' : 'READY',
    blockedReason: hasGeneratedPrice ? '' : '价格类型已识别，可自动检查价格源并生成最终价格',
  }
}

function isQuoteBomTab(code) {
  return normalizeTabCode(code) === 'QUOTE_BOM'
}

function isPriceTypeTab(code) {
  return normalizeTabCode(code) === 'PRICE_TYPE_CONFIRMATION'
}

function isPriceSourceSupplementTab(code) {
  return normalizeTabCode(code) === 'PRICE_SOURCE_SUPPLEMENT'
}

function isPricePrepareTab(code) {
  return normalizeTabCode(code) === 'PRICE_PREPARE'
}

function isCostRunTab(code) {
  return normalizeTabCode(code) === 'COST_RUN'
}

function isBlockedTab(tab) {
  return tab?.status === 'BLOCKED'
}

function beforeWorkbenchTabLeave() {
  // 切换页签只负责浏览；生成/重算必须由用户点击明确按钮触发。
  return true
}

function tabBadgeLabel(tab) {
  const code = normalizeTabCode(tab?.code)
  if (code === 'PRODUCT_DETAIL') {
    return effectiveBomFeatureEnabled.value ? effectiveBomStateInfo.value.label : '旧版原始 BOM'
  }
  if (code === 'QUOTE_BOM') {
    const workspaceStatus = String(costingWorkspace.value.workspaceStatus || '').toUpperCase()
    if (workspaceStatus === 'STALE') return '待重算'
    if (workspaceStatus === 'WAIT_BOM') return '缺 BOM'
    if (bomRows.value.length > 0) return '已生成'
    return '待生成'
  }
  if (code === 'PRICE_TYPE_CONFIRMATION') {
    const missingTypeCount = currentMissingPriceTypeCount()
    if (missingTypeCount > 0) return `缺 ${missingTypeCount} 项`
    return tab?.status === 'DONE' ? '已识别' : '待识别'
  }
  if (code === 'PRICE_SOURCE_SUPPLEMENT') {
    const gapCount = currentPriceSourceGapCount()
    if (isBlockedTab(tab)) return '待价格类型'
    if (gapCount > 0) return `缺 ${gapCount} 项`
    if (!priceSourceChecked.value) return '自动检查'
    if (tab?.status === 'DONE') return '已齐全'
    return '自动检查'
  }
  if (code === 'PRICE_PREPARE') {
    const gapCount = currentPriceSourceGapCount()
    if (gapCount > 0) return `缺 ${gapCount} 项`
    if (tab?.status === 'DONE' && pricePrepareReady.value) return '已生成'
    return isBlockedTab(tab) ? '未就绪' : '待生成'
  }
  if (code === 'COST_RUN') {
    if (historyViewMode.value && displayedCostVersion.value.id) return '历史结果'
    const versionNo = currentSuccessVersion.value?.displayVersionNo || currentSuccessVersion.value?.versionNo
    if (hasRunningCostVersion.value && versionNo) return '正在重新核算'
    if (hasRunningCostVersion.value) return '正在核算'
    // 成本版本是最终事实来源。旧工作流步骤可能仍为 PENDING，不能把已有当前成功版本误标成待核算。
    if (currentSuccessVersion.value?.id && versionNo) return `核算成功 ${versionNo}`
    if (isBlockedTab(tab)) return '未就绪'
    return '待核算'
  }
  return tabStatusLabel(tab?.status)
}

function tabBadgeType(tab) {
  const code = normalizeTabCode(tab?.code)
  if (code === 'PRODUCT_DETAIL') {
    return effectiveBomFeatureEnabled.value ? effectiveBomStateInfo.value.type : 'info'
  }
  if (code === 'QUOTE_BOM') {
    const workspaceStatus = String(costingWorkspace.value.workspaceStatus || '').toUpperCase()
    if (workspaceStatus === 'WAIT_BOM') return 'danger'
    if (workspaceStatus === 'STALE') return 'warning'
    return bomRows.value.length > 0 ? 'success' : 'info'
  }
  if (code === 'PRICE_TYPE_CONFIRMATION') return currentMissingPriceTypeCount() > 0 ? 'danger' : (tab?.status === 'DONE' ? 'success' : 'warning')
  if (code === 'PRICE_SOURCE_SUPPLEMENT') {
    if (isBlockedTab(tab)) return 'info'
    if (currentPriceSourceGapCount() > 0) return 'danger'
    if (!priceSourceChecked.value) return 'warning'
    return tab?.status === 'DONE' ? 'success' : 'warning'
  }
  if (code === 'PRICE_PREPARE') {
    if (currentPriceSourceGapCount() > 0 || isBlockedTab(tab)) return 'warning'
    return tab?.status === 'DONE' && pricePrepareReady.value ? 'success' : 'warning'
  }
  if (code === 'COST_RUN') {
    if (historyViewMode.value && displayedCostVersion.value.id) return 'info'
    if (hasRunningCostVersion.value) return 'warning'
    if (currentSuccessVersion.value?.id) return 'success'
    return isBlockedTab(tab) ? 'info' : 'warning'
  }
  return tabStatusType(tab?.status)
}

function tabStatusLabel(status) {
  const labels = {
    READY: '就绪',
    PENDING: '待处理',
    BLOCKED: '阻断',
    PARTIAL: '部分完成',
    DONE: '已完成',
    STALE: '需更新',
  }
  return labels[status] || status || '-'
}

function tabStatusType(status) {
  const types = {
    READY: 'success',
    PENDING: 'warning',
    BLOCKED: 'danger',
    PARTIAL: 'warning',
    DONE: 'success',
    STALE: 'info',
  }
  return types[status] || 'info'
}

function normalizeCostVersionRow(row) {
  if (!row) return {}
  const status = String(row?.status || '').toUpperCase()
  const currentConfirmed = Boolean(row?.currentConfirmed)
  const inProgress = ['RUNNING', 'TRIAL'].includes(status)
  const canViewSheet = row?.canViewSheet ?? Boolean(row?.id && row?.costRunNo)
  const canViewTrace = row?.canViewTrace ?? (!inProgress && Boolean(row?.costRunNo))
  return {
    ...row,
    status,
    displayVersionNo: row?.displayVersionNo || row?.versionNo || row?.costRunNo || '-',
    displayStatus: row?.displayStatus || costVersionStatusText({ ...row, currentConfirmed }),
    canConfirm: false,
    canViewSheet,
    canViewTrace,
    currentConfirmed,
    stale: row?.stale ?? (!inProgress && !currentConfirmed),
  }
}

function costVersionRowClass({ row }) {
  return row?.id === selectedCostRunVersionId.value ? 'selected-version-row' : ''
}

function costVersionStatusText(row) {
  const status = String(row?.status || '').toUpperCase()
  if (status === 'RUNNING') return '核算中'
  if (status === 'TRIAL') return '旧试算未完成'
  if (row?.currentConfirmed) return '当前成功'
  if (['HISTORY', 'VOIDED', 'STALE'].includes(status) || row?.stale) return '历史版本'
  if (['SUCCESS', 'CONFIRMED'].includes(status)) return '核算成功'
  return status || '-'
}

function costVersionStatusTagType(row) {
  const status = String(row?.status || '').toUpperCase()
  if (['RUNNING', 'TRIAL'].includes(status)) return 'warning'
  if (row?.currentConfirmed) return 'success'
  if (['SUCCESS', 'CONFIRMED'].includes(status)) return 'success'
  if (row?.stale || ['HISTORY', 'VOIDED', 'STALE'].includes(status)) return 'info'
  return 'info'
}

function workflowStepLabel(step) {
  const labels = {
    QUOTE_BOM: '报价物料明细',
    PRICE_TYPE_CONFIRMATION: '价格类型识别',
    PRICE_SOURCE_SUPPLEMENT: '价格源维护',
    PRICE_PREPARE: '最终价格生成',
    COST_RUN: '成本核算',
  }
  return labels[step] || '-'
}

function displayBusinessText(text) {
  return String(text || '').replaceAll('价格准备', '最终价格生成')
}

function emptyPriceTypeResponse() {
  return {
    summary: {},
    rows: [],
  }
}

function emptyAlternativeSummary() {
  return {
    periodMonth: '',
    groupCount: 0,
    manualAlternativeCount: 0,
    reviewRequired: false,
    groups: [],
  }
}

function emptyPricePrepareResponse() {
  return {
    readiness: {},
    batches: { records: [] },
    items: { records: [] },
    gaps: { records: [] },
    oaScenario: { batch: null, items: { records: [] } },
    financeScenario: { batch: null, items: { records: [] } },
    differences: [],
    differenceSummary: {},
  }
}

function emptyCostRunResponse() {
  return {
    latestTrial: null,
    latestConfirmed: null,
    currentDisplayVersion: null,
    versions: [],
    resultHeader: null,
    partItems: [],
    costItems: [],
    canStartTrial: false,
    canConfirm: false,
    blockingReasons: [],
  }
}

function flattenRows(rows, out = []) {
  rows.forEach((row) => {
    out.push(row)
    flattenRows(row.children || [], out)
  })
  return out
}

function filterTreeRows(rows) {
  return rows.map((row) => {
    const children = filterTreeRows(row.children || [])
    const selfMatched = priceTypeRowMatched(row)
    if (!selfMatched && children.length === 0) return null
    return { ...row, children }
  }).filter(Boolean)
}

function priceTypeRowMatched(row) {
  const keyword = String(priceTypeKeyword.value || '').trim().toLowerCase()
  const keywordMatched = !keyword ||
    String(row.materialCode || '').toLowerCase().includes(keyword) ||
    String(row.materialName || '').toLowerCase().includes(keyword)
  if (!keywordMatched) return false
  if (priceTypeFilter.value === 'ALL') return true
  if (priceTypeFilter.value === 'MISSING') return isMissingPriceTypeRow(row)
  if (priceTypeFilter.value === 'NORMAL') return row.objectType === 'NORMAL' || row.objectType === 'PURCHASE'
  if (priceTypeFilter.value === 'MAKE_PART') return ['MAKE_PARENT', 'MAKE_RAW', 'MAKE_SCRAP', 'MAKE_NO_SCRAP', 'MAKE_PART'].includes(row.objectType)
  if (priceTypeFilter.value === 'PACKAGE') return ['PACKAGE_PARENT', 'PACKAGE_CHILD', 'PACKAGE', 'PACKAGE_COMPONENT'].includes(row.objectType)
  return true
}

function isPriceableTypeRow(row) {
  return row && !['MAKE_PARENT', 'PACKAGE_PARENT', 'MAKE_NO_SCRAP'].includes(row.objectType)
}

function isMissingPriceTypeRow(row) {
  return isPriceableTypeRow(row) && (!row.priceType || row.typeStatus === 'MISSING_TYPE')
}

function priceTypeStatusLabel(status) {
  const labels = {
    RECOGNIZED: '已识别',
    MISSING_TYPE: '缺价格类型',
    CHILD_MISSING_TYPE: '子项缺类型',
  }
  return labels[status] || status || '-'
}

function priceTypeObjectLabel(objectType) {
  const labels = {
    NORMAL: '采购件',
    PURCHASE: '采购件',
    MAKE_PARENT: '自制件',
    MAKE_RAW: '原材料',
    MAKE_SCRAP: '废料',
    MAKE_NO_SCRAP: '无废料确认',
    PACKAGE_PARENT: '包装组件',
    PACKAGE_CHILD: '包装子件',
    PACKAGE: '包装组件',
    PACKAGE_COMPONENT: '包装子件',
  }
  return labels[objectType] || objectType || '-'
}

function priceTypeSourceLabel(row) {
  const source = row?.priceTypeSource || row?.sourceText
  const labels = {
    MATERIAL_PRICE_TYPE: '价格类型维护',
    quote_price_type_confirmation: '历史报价确认',
    manual: '人工维护',
    MAKE_PARENT: '自制件生成',
    MAKE_RAW: '自制件生成',
    MAKE_SCRAP: '自制件生成',
    MAKE_NO_SCRAP: '人工确认',
    PACKAGE_PARENT: '包装结构',
    PACKAGE_CHILD: '包装结构',
    NORMAL: 'BOM明细',
  }
  return labels[source] || source || '-'
}

function priceTypeDisplay(row) {
  if (row?.priceType) return row.priceType
  if (row?.objectType === 'MAKE_PARENT') return '自制件价格'
  if (row?.objectType === 'MAKE_NO_SCRAP') return '按0处理'
  if (row?.objectType === 'PACKAGE_PARENT') return '包装组件价格'
  return '缺失'
}

function priceTypeTagType(row) {
  if (row?.objectType === 'MAKE_PARENT' || row?.objectType === 'PACKAGE_PARENT') return 'warning'
  return row?.priceType ? 'success' : 'danger'
}

async function initializeWorkbench() {
  await loadWorkbench({ resetTab: true, loadChildren: true })
  await applyRouteTab()
  if (historyViewMode.value) return
  await refreshPriceSourceFromReturn()
  await ensurePriceSourceChecked()
}

watch([oaNo, itemId, historyVersionId], () => {
  initializeWorkbench()
})

watch(activeTab, async (tabCode) => {
  if (
    isPriceTypeTab(tabCode)
    && pricingBomReadyForNextStep.value
    && !priceTypeLoading.value
  ) {
    // 第三步是当前 BOM 的实时只读投影。每次重新进入都取最新结果，
    // 避免页面仍展示 worker 重建 BOM 前留在内存中的旧批次或空品名。
    await loadPriceType(false)
  }
  ensurePriceSourceChecked()
})

watch(() => route.query.tab, async () => {
  await applyRouteTab()
  ensurePriceSourceChecked()
})

watch(() => route.query.refreshPriceSource, () => {
  refreshPriceSourceFromReturn()
})

onMounted(() => initializeWorkbench())
</script>

<style scoped>
.costing-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 1180px;
  color: #2f343d;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #e4e9f1;
  border-radius: 10px;
  background: #ffffff;
}

.page-head h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  color: #182230;
  letter-spacing: 0.01em;
}

.page-head p {
  margin: 6px 0 0;
  color: #697386;
  font-size: 13px;
}

.page-actions,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.inline-alert {
  margin: 0;
  border-radius: 8px;
}

.costing-page :deep(.el-table) {
  overflow: hidden;
  border-radius: 8px;
}

.costing-page :deep(.el-table th.el-table__cell) {
  height: 44px;
  color: #475467;
  font-weight: 650;
  background: #f8fafc;
}

.costing-page :deep(.el-table td.el-table__cell) {
  padding: 10px 0;
}

.costing-page :deep(.el-alert__title) {
  font-weight: 600;
}

.section-block {
  overflow: hidden;
  border: 1px solid #e4e9f1;
  border-radius: 10px;
  background: #ffffff;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 0 18px;
  border-bottom: 1px solid #e8ecf2;
  background: #fbfcfe;
}

.section-head span {
  color: #2f343d;
  font-size: 14px;
  font-weight: 650;
}

.section-head small {
  color: #697386;
  font-size: 12px;
}

.detail-descriptions,
.current-item-table,
.price-matrix-table {
  width: 100%;
}

.section-block :deep(.el-descriptions__body),
.section-block :deep(.el-table) {
  border-radius: 0;
}

.section-block :deep(.el-descriptions__table),
.section-block :deep(.el-table__inner-wrapper::before) {
  border-top: 0;
}

.price-matrix-table :deep(.matrix-label) {
  background: #f7f9fc;
  color: #606773;
  font-weight: 650;
}

.workspace-band {
  display: flex;
  flex-direction: column;
}

.workspace-meta {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 58px;
  padding: 0 18px;
  flex-wrap: wrap;
  border-bottom: 1px solid #e8ecf2;
  background: #fbfcfe;
}

.workspace-meta > span {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 18px;
  border-right: 1px solid #e1e6ee;
}

.workspace-meta > span:first-child {
  padding-left: 0;
}

.workspace-meta > span:last-child {
  border-right: 0;
}

.workspace-meta small {
  color: #8490a1;
  font-size: 12px;
}

.workspace-meta strong {
  color: #344054;
  font-size: 14px;
  font-weight: 650;
}

.costing-tabs {
  padding: 0 18px 18px;
  background: #ffffff;
}

.costing-tabs :deep(.el-tabs__header) {
  margin: 0 -18px 18px;
  padding: 0 18px;
  border-bottom: 1px solid #e4e9f1;
  background: #ffffff;
}

.costing-tabs :deep(.el-tabs__nav-prev),
.costing-tabs :deep(.el-tabs__nav-next) {
  display: none;
}

.costing-tabs :deep(.el-tabs__nav-scroll) {
  overflow-x: auto;
  scrollbar-width: none;
}

.costing-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.costing-tabs :deep(.el-tabs__nav) {
  display: grid;
  grid-template-columns: repeat(6, minmax(170px, 1fr));
  width: 100%;
  min-width: 1020px;
  border: 1px solid #e4e9f1;
  border-radius: 9px;
  background: #f8fafc;
  overflow: hidden;
}

.costing-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

.costing-tabs :deep(.el-tabs__item) {
  height: 64px;
  padding: 0 14px;
  border-right: 1px solid #e4e9f1;
  color: #475467;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.costing-tabs :deep(.el-tabs__item:last-child) {
  border-right: 0;
}

.costing-tabs :deep(.el-tabs__item:hover) {
  color: #2563a8;
  background: #f3f7fc;
}

.costing-tabs :deep(.el-tabs__item.is-active) {
  color: #1f66b1;
  background: #eef6ff;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.tab-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 1px solid #d5dce6;
  border-radius: 50%;
  background: #ffffff;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.costing-tabs :deep(.el-tabs__item.is-active) .tab-index {
  border-color: #2f7dcc;
  color: #ffffff;
  background: #2f7dcc;
}

.tab-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
}

.tab-name {
  color: inherit;
  font-size: 14px;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
}

.tab-state {
  max-width: 120px;
}

.tab-toolbar,
.action-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 13px 14px;
  border: 1px solid #e4e9f1;
  border-radius: 8px;
  background: #fbfcfe;
}

.tab-toolbar strong,
.action-panel h2 {
  display: block;
  margin: 0;
  color: #2f343d;
  font-size: 15px;
  font-weight: 650;
}

.tab-toolbar span,
.action-panel p,
.subsection-head span {
  display: block;
  margin-top: 4px;
  color: #697386;
  font-size: 13px;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.source-gap-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.source-gap-card {
  min-height: 68px;
  padding: 10px 12px;
  border: 1px solid #e4e9f1;
  border-radius: 8px;
  background: #fbfcfe;
}

.source-gap-card span {
  color: #697386;
  font-size: 13px;
}

.source-gap-card strong {
  display: block;
  margin-top: 4px;
  color: #2f343d;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
}

.metric {
  min-height: 68px;
  padding: 10px 12px;
  border: 1px solid #e4e9f1;
  border-radius: 8px;
  background: #fbfcfe;
}

.metric span {
  color: #697386;
  font-size: 13px;
}

.metric strong {
  display: block;
  margin-top: 4px;
  color: #2f343d;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.2;
  word-break: break-all;
}

.price-compare-summary {
  grid-template-columns: repeat(4, minmax(180px, 1fr));
}

.price-validity-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #697386;
  line-height: 1.4;
}

.price-compare-summary .metric strong.difference-positive {
  color: #d9485f;
}

.price-compare-summary .metric strong.difference-negative {
  color: #15803d;
}

.price-compare-summary .metric strong.difference-zero {
  color: #697386;
}

.price-scenario-tabs {
  margin-top: 14px;
}

.price-scenario-tabs :deep(.el-tabs__header) {
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  background: transparent;
}

.price-scenario-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0;
}

.price-scenario-tabs :deep(.el-tabs__nav) {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  width: 100%;
  min-width: 0;
  border: 1px solid #e4e9f1;
  border-radius: 8px;
  background: #f8fafc;
}

.price-scenario-tabs :deep(.el-tabs__item) {
  justify-content: center;
  height: 46px;
  padding: 0 18px;
  border-right: 1px solid #e4e9f1;
  color: #667085;
  font-weight: 600;
}

.price-scenario-tabs :deep(.el-tabs__item:last-child) {
  border-right: 0;
}

.price-scenario-tabs :deep(.el-tabs__item.is-active) {
  color: #1f66b1;
  background: #eef6ff;
}

.scenario-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
  color: #697386;
  font-size: 12px;
}

.difference-toolbar {
  min-height: 38px;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.search-control {
  width: 260px;
}

.bom-table,
.price-type-table,
.prepare-detail-table,
.gap-table,
.source-gap-table,
.cost-version-table {
  width: 100%;
}

.rollup-identity {
  white-space: pre-line;
  line-height: 1.45;
}

.product-detail-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pricing-bom-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #d8e5f3;
  border-radius: 8px;
  background: #f6faff;
}

.pricing-bom-summary > div,
.pricing-bom-summary-status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pricing-bom-summary span {
  color: #697386;
  font-size: 13px;
}

.pricing-bom-summary-status {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.effective-bom-message-list {
  margin: 8px 0 0;
  padding-left: 20px;
}

.effective-bom-message-list li + li {
  margin-top: 4px;
}

.pricing-bom-designer {
  display: block;
  min-width: 0;
}

.pricing-bom-tree-column {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.bom-tree-panel {
  min-height: 360px;
  max-height: calc(100vh - 360px);
  overflow: auto;
  padding: 12px;
  border: 1px solid #e4e9f1;
  border-radius: 8px;
  background: #ffffff;
}

.empty-tip {
  color: #909399;
  text-align: center;
  padding: 40px 0;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.effective-tree-node {
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
  width: max-content;
  max-width: calc(100% - 8px);
  padding: 5px 6px;
  border-radius: 6px;
  line-height: 1.4;
  white-space: normal;
}

.effective-bom-tree :deep(.el-tree-node__content) {
  height: auto;
  min-height: 32px;
  align-items: flex-start;
  width: max-content;
  min-width: 100%;
  padding-right: 10px;
  border-radius: 6px;
  box-sizing: border-box;
}

.effective-bom-tree :deep(.el-tree-node__content:hover),
.effective-bom-tree :deep(.el-tree-node:focus > .el-tree-node__content) {
  background: #f7f9fc;
}

.effective-bom-tree :deep(.el-tree-node__expand-icon) {
  flex-shrink: 0;
  margin-top: 8px;
  color: #8290a3;
}

.effective-bom-tree :deep(.el-tree-node__children) {
  overflow: visible;
  margin-left: 11px;
  padding-left: 17px;
  border-left: 1px solid #d8e1ec;
}

.effective-bom-tree :deep(.el-tree-node__children > .el-tree-node) {
  position: relative;
}

.effective-bom-tree :deep(.el-tree-node__children > .el-tree-node::before) {
  position: absolute;
  z-index: 1;
  top: 16px;
  left: -17px;
  width: 15px;
  border-top: 1px solid #d8e1ec;
  content: '';
}

.effective-bom-tree :deep(.el-tree-node__children > .el-tree-node:last-child::after) {
  position: absolute;
  z-index: 0;
  top: 17px;
  bottom: 0;
  left: -18px;
  width: 2px;
  background: #ffffff;
  content: '';
}

.effective-tree-parent {
  margin: 1px 0;
}

.effective-tree-parent .node-code,
.effective-tree-parent .node-name {
  color: #26364a;
  font-weight: 600;
}

.effective-tree-root {
  margin-bottom: 5px;
  padding: 7px 10px;
  border: 1px solid #dbe8f7;
  border-left: 3px solid #4d8fd8;
  border-radius: 7px;
  background: #f5f9fe;
}

.effective-tree-preview-change {
  box-shadow: inset 3px 0 0 #e6a23c;
  background: #fff9ef;
}

.node-child-count {
  color: #8a97a8;
  font-size: 11px;
}

.effective-node-main :deep(.el-tag) {
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 5px;
  font-weight: 500;
  line-height: 22px;
}

.effective-shape-tag.el-tag--primary {
  color: #3f73ad;
  background: #eaf2fb;
}

.effective-shape-tag.el-tag--success {
  color: #4d865e;
  background: #edf7ef;
}

.effective-shape-tag.el-tag--warning {
  color: #a66b22;
  background: #fff4e5;
}

.effective-alternative-tag {
  color: #7256b8;
  background: #f2effb;
}

.effective-node-main,
.effective-node-evidence {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.effective-node-evidence {
  color: #7f8b9c;
  font-size: 11px;
}

.node-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  color: #303133;
}

.node-name {
  font-size: 13px;
  color: #606266;
}

.node-qty {
  font-size: 12px;
  color: #909399;
}

.subsection-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  margin-top: 14px;
  color: #2f343d;
}

.condition-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.no-scrap-impact-alert,
.no-scrap-context {
  margin-bottom: 14px;
}

.version-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.version-cell strong {
  color: #1f2937;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
}

.version-cell span {
  color: #697386;
  font-size: 12px;
  line-height: 1.25;
}

.version-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cost-version-table :deep(.selected-version-row > td.el-table__cell) {
  background: #f0f7ff !important;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.difference-positive {
  color: #d9485f;
}

.difference-negative {
  color: #15803d;
}

.difference-zero {
  color: #697386;
}

.version-strip {
  display: grid;
  grid-template-columns: 1.4fr repeat(4, minmax(120px, 1fr));
  margin-bottom: 12px;
}

.trial-strip {
  border: 1px solid #f0c98d;
  background: #fff9ef;
}

.confirm-strip {
  border: 1px solid #b7d4ff;
  background: #f4f8ff;
}

.version-item {
  min-height: 58px;
  padding: 10px 12px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.version-item:last-child {
  border-right: 0;
}

.version-item span {
  color: #697386;
  font-size: 12px;
}

.version-item strong {
  color: #2f343d;
  font-size: 14px;
  font-weight: 650;
  word-break: break-all;
}

.cost-run-empty {
  border: 1px dashed #d8dfe9;
  background: #fff;
}

.cost-result-panel {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #cfe0ff;
  background: #fff;
  box-shadow: inset 4px 0 0 #5b9cff;
}

.cost-result-panel span {
  display: block;
  color: #697386;
  font-size: 13px;
}

.cost-result-panel strong {
  display: block;
  margin-top: 6px;
  color: #1f2937;
  font-size: 18px;
  font-weight: 700;
  word-break: break-all;
}

.cost-result-actions {
  display: flex;
  justify-content: flex-end;
}

.empty-sheet {
  color: #909399;
}

.drawer-control {
  width: 100%;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 860px) {
  .costing-page {
    min-width: 0;
  }

  .page-head,
  .tab-toolbar,
  .action-panel,
  .filter-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }

  .version-strip {
    grid-template-columns: 1fr;
  }

  .search-control {
    width: 100%;
  }
}
</style>
