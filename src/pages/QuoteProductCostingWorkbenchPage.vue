<template>
  <section class="costing-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h1>单产品核算工作台</h1>
        <p>{{ oaNo }} / {{ item.materialNo || '-' }} / 核算月份 {{ workbench.periodMonth || '-' }}</p>
      </div>
      <div class="page-actions">
        <el-button :icon="ArrowLeft" @click="goBack">返回报价单</el-button>
        <el-button :icon="Refresh" :loading="loading || refreshingTabs" @click="refreshWorkbench">刷新</el-button>
      </div>
    </div>

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
          {{ workflowStepLabel(workbench.workflowStatus?.currentBlockedStep) }}
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
        <span>核算月份：{{ workbench.periodMonth || '-' }}</span>
        <span>BOM 行数：{{ bomRows.length }}</span>
        <span>整体状态：{{ tabStatusLabel(workbench.workflowStatus?.overallStatus) }}</span>
      </div>

      <el-tabs v-model="activeTab" class="costing-tabs" :before-leave="beforeWorkbenchTabLeave">
        <el-tab-pane v-for="(tab, index) in tabs" :key="tab.code" :name="tab.code">
          <template #label>
            <span class="tab-label">
              <span class="tab-index">{{ index + 1 }}</span>
              <span>{{ tab.name }}</span>
              <el-tag size="small" effect="plain" :type="tabBadgeType(tab)">
                {{ tabBadgeLabel(tab) }}
              </el-tag>
            </span>
          </template>

          <div
            v-if="tab.code === 'PRODUCT_DETAIL'"
            v-loading="effectiveBomConfirming"
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
              v-else-if="effectiveBomReadOnly"
              type="success"
              show-icon
              :closable="false"
              class="inline-alert"
              :title="effectiveBom.state === 'REUSED'
                ? '本月已有相同计价结果，系统已自动沿用。'
                : '本月计价 BOM 已确定，后续步骤将继续使用当前结果。'"
            />

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
                  :disabled="isBomConfirmed || effectiveBomLoading"
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
              :confirmed="isBomConfirmed"
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
                <span>确认状态</span>
                <strong>{{ bomConfirmStatusText }}</strong>
              </div>
              <div class="metric">
                <span>确认单号</span>
                <strong>{{ bomConfirmation.confirmNo || '-' }}</strong>
              </div>
              <div class="metric">
                <span>结算行数</span>
                <strong>{{ bomConfirmation.rowCount ?? bomRows.length }}</strong>
              </div>
              <div v-if="alternativeFeatureEnabled" class="metric">
                <span>可替代组</span>
                <strong>{{ alternativeSummary.groupCount ?? 0 }}</strong>
              </div>
              <div v-if="alternativeFeatureEnabled" class="metric">
                <span>已选替代</span>
                <strong>{{ alternativeSummary.manualAlternativeCount ?? bomConfirmation.replaceCount ?? 0 }}</strong>
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
                  {{ tab.blockedReason || '已按当前产品行过滤 BOM 结算行' }}
                  <template v-if="rollupDisplayRowCount > 0">
                    ；上卷父件已按命中子件生成展示名称，不增加结算行
                  </template>
                  <template v-if="alternativeFeatureEnabled">；标准/替代选择会切换整棵 BOM 分支</template>
                </span>
              </div>
              <div class="toolbar-actions">
                <el-button
                  type="primary"
                  :loading="bomActionLoading"
                  :disabled="isBlockedTab(tab) || isBomConfirmed || bomRows.length === 0 || alternativeNeedsReview"
                  @click="confirmBomRows"
                >
                  确认报价物料明细
                </el-button>
                <el-button
                  :loading="bomActionLoading"
                  :disabled="!isBomConfirmed"
                  @click="cancelBomConfirm"
                >
                  撤销确认
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
                <template #default="{ row }">{{ row.childCode || '-' }}</template>
              </el-table-column>
              <el-table-column prop="childName" label="品名" min-width="180" fixed="left" show-overflow-tooltip />
              <el-table-column prop="childModel" label="型号" min-width="170" show-overflow-tooltip />
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
                <el-radio-button label="ALL">全部</el-radio-button>
                <el-radio-button label="MISSING">缺价格类型</el-radio-button>
                <el-radio-button label="NORMAL">采购件</el-radio-button>
                <el-radio-button label="MAKE_PART">自制件</el-radio-button>
                <el-radio-button label="PACKAGE">包装件</el-radio-button>
              </el-radio-group>
              <div class="toolbar-actions">
                <el-input
                  v-model="priceTypeKeyword"
                  clearable
                  placeholder="搜索料号 / 品名"
                  class="search-control"
                />
                <el-button
                  :loading="priceTypeActionLoading"
                  :disabled="isBlockedTab(tab) || missingPriceTypeRows.length === 0"
                  @click="openMaterialPriceTypePage"
                >
                  去物料价格类型维护
                </el-button>
                <el-button
                  type="primary"
                  :loading="priceTypeActionLoading"
                  :disabled="isBlockedTab(tab) || Number(priceTypeSummary.missingTypeCount || latestPriceType.gapCount || 0) > 0"
                  @click="confirmPriceTypes"
                >
                  确认价格类型
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
              <el-table-column prop="materialName" label="品名" min-width="180" fixed="left" show-overflow-tooltip />
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
              <el-table-column prop="typeStatus" label="状态" width="120" />
              <el-table-column prop="referenceUnitPrice" label="参考单价" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.referenceUnitPrice) }}</template>
              </el-table-column>
              <el-table-column prop="effectiveFrom" label="生效开始" width="120" />
              <el-table-column prop="effectiveTo" label="生效结束" width="120" />
              <el-table-column prop="message" label="原因" min-width="220" show-overflow-tooltip />
              <el-table-column label="操作" width="120" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="isPriceableTypeRow(row)"
                    link
                    type="primary"
                    :disabled="isBlockedTab(tab)"
                    @click="openAdjustDrawer(row)"
                  >
                    调整类型
                  </el-button>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无价格类型确认行" />
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
              title="请先确认价格类型，确认后系统才能判断需要补充哪类价格源"
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
              <el-table-column prop="materialName" label="品名" min-width="180" fixed="left" show-overflow-tooltip />
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
                <h2>前置条件检查</h2>
                <p>{{ costRunBlockingText }}</p>
              </div>
              <div class="toolbar-actions">
                <el-button
                  type="primary"
                  :loading="costRunActionLoading"
                  :disabled="isBlockedTab(tab) || !canStartCostRun"
                  @click="trialCostRun"
                >
                  开始核算
                </el-button>
                <el-button
                  :disabled="!hasCostRunResult"
                  @click="openCostRunDetail"
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

            <div class="condition-list">
              <el-tag :type="canStartCostRun ? 'success' : 'warning'" effect="plain">
                {{ canStartCostRun ? '允许开始试算' : '暂不可试算' }}
              </el-tag>
              <el-tag :type="costRun.canConfirm ? 'success' : 'info'" effect="plain">
                {{ costRun.canConfirm ? '允许确认核算' : '暂无可确认试算' }}
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
              v-if="costRunRepriceLocked"
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
              v-if="hasPendingTrial"
              class="inline-alert"
              type="warning"
              show-icon
              :closable="false"
              title="存在待确认试算，请确认后生成正式成本版本"
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
              <el-table-column label="试算完成时间" min-width="170">
                <template #default="{ row }">{{ formatDateTime(row.trialFinishedAt) }}</template>
              </el-table-column>
              <el-table-column label="确认时间" min-width="170">
                <template #default="{ row }">{{ formatDateTime(row.confirmedAt) }}</template>
              </el-table-column>
              <el-table-column prop="confirmedBy" label="确认人" width="110" show-overflow-tooltip>
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
                      v-if="row.canConfirm"
                      link
                      type="primary"
                      :loading="costRunActionLoading"
                      @click="confirmCostRun(row)"
                    >
                      确认核算
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

    <el-drawer v-model="priceTypeDrawerVisible" :title="priceTypeDrawerTitle" size="620px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="物料料号">
          <el-input v-model="priceTypeForm.materialCode" disabled />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="priceTypeForm.materialName" disabled />
        </el-form-item>
        <el-form-item label="对象类型">
          <el-input v-model="priceTypeForm.objectType" disabled />
        </el-form-item>
        <el-form-item label="价格类型">
          <el-select v-model="priceTypeForm.priceType" placeholder="请选择价格类型" class="drawer-control">
            <el-option label="固定价" value="固定价" />
            <el-option label="结算固定价" value="结算固定价" />
            <el-option label="联动价" value="联动价" />
            <el-option label="区间价" value="区间价" />
            <el-option label="自制件" value="自制件" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效月份">
          <el-date-picker
            v-model="priceTypeForm.effectiveFrom"
            type="month"
            value-format="YYYY-MM"
            class="drawer-control"
          />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="priceTypeForm.reason" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="priceTypeDrawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="priceTypeActionLoading" @click="submitPriceTypeDrawer">保存</el-button>
        </div>
      </template>
    </el-drawer>

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
  adjustPriceType,
  cancelCostingBomConfirm,
  checkQuotePriceSources,
  confirmCostingBom,
  confirmPriceType,
  confirmQuoteEffectiveBom,
  confirmQuoteCostRun,
  exportQuoteCostRunVersion,
  fetchQuoteBomAlternativeGroups,
  fetchQuoteBomAlternativeFeatureStatus,
  fetchQuoteBomAlternativeHistory,
  fetchQuoteCostRun,
  fetchQuoteCostingWorkbench,
  fetchQuoteEffectiveBom,
  fetchQuotePricePrepare,
  fetchQuotePriceTypeConfirmation,
  generateQuotePricePrepare,
  importMissingPriceType,
  prepareQuoteEffectiveBomCosting,
  previewQuoteEffectiveBomAlternative,
  selectQuoteBomAlternative,
  trialQuoteCostRun,
} from '../api/quoteRequests'
import { confirmPricePrepareNoScrap } from '../api/pricePrepare'
import {
  alternativeErrorMessage,
  alternativeReviewWarning,
  alternativeSelectionDisabled,
  canSelectQuoteBomAlternative,
  formatAlternativeRebuildSummary,
  hasManualCostingChanges,
} from '../utils/quoteBomAlternativeUtils'
import { expandQuoteBomDisplayRows } from '../utils/quoteCostingBomRows'
import {
  buildQuoteEffectiveBomTree,
  effectiveAlternativeNodeMeta,
  effectiveBomCanConfirm,
  effectiveBomMatchesCostingBuild,
  costingBomMatchesPreparedBuild,
  effectiveBomIsReadOnly,
  effectiveBomStateMeta,
  effectiveShapeMeta,
  effectiveShapeSourceLabel,
  effectiveNodeEvidenceVisible,
  effectiveSupplierEvidence,
  emptyQuoteEffectiveBom,
  normalizeQuoteEffectiveBom,
} from '../utils/quoteEffectiveBom'
import { formatDateTime, statusLabel, statusTagType } from '../utils/quoteRequestWorkbench'
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
const loading = ref(false)
const refreshingTabs = ref(false)
const activeTab = ref('PRODUCT_DETAIL')
const bomActionLoading = ref(false)
const bomTree = ref(null)
const bomTreeRef = ref(null)
const bomTreeLoading = ref(false)
const effectiveBom = ref(emptyQuoteEffectiveBom())
const effectiveBomPreview = ref(null)
const effectiveBomLoading = ref(false)
const effectiveBomConfirming = ref(false)
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
const priceTypeActionLoading = ref(false)
const priceType = ref(emptyPriceTypeResponse())
const priceTypeFilter = ref('ALL')
const priceTypeKeyword = ref('')
const priceTypeDrawerVisible = ref(false)
const priceTypeDrawerMode = ref('ADJUST')
const priceTypeForm = ref(emptyPriceTypeForm())
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
const bomConfirmation = computed(() => workbench.value.latestBomConfirmation || {})
const latestPriceType = computed(() => workbench.value.latestPriceTypeConfirmation || {})
const latestPrepare = computed(() => {
  const generated = pricePrepare.value.generatedResult || {}
  return {
    ...(workbench.value.latestPricePrepare || {}),
    ...Object.fromEntries(Object.entries(generated).filter(([, value]) => value !== undefined && value !== null && value !== '')),
  }
})
const isBomConfirmed = computed(() => bomConfirmation.value.confirmStatus === 'CONFIRMED')
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
const bomConfirmStatusText = computed(() => {
  if (bomConfirmation.value.confirmStatus === 'CONFIRMED') return '已确认'
  if (bomConfirmation.value.confirmStatus === 'VOIDED') return '已撤销'
  return '待确认'
})
const tabs = computed(() => {
  const serverTabs = Array.isArray(workbench.value.tabs) ? workbench.value.tabs : []
  const normalizedTabs = serverTabs.length > 0 ? serverTabs : [
    { code: 'PRODUCT_DETAIL', name: '产品明细', status: 'READY' },
    { code: 'QUOTE_BOM', name: '报价物料明细', status: 'PENDING' },
    { code: 'PRICE_TYPE_CONFIRMATION', name: '价格类型确认', status: 'BLOCKED', blockedReason: '请先确认报价物料' },
    { code: 'PRICE_PREPARE', name: '最终价格生成', status: 'BLOCKED', blockedReason: '请先确认价格类型' },
    { code: 'COST_RUN', name: '成本核算', status: 'BLOCKED', blockedReason: '请先生成最终价格' },
  ]
  const byCode = new Map(normalizedTabs.map((tab) => [normalizeTabCode(tab.code), tab]))
  const priceTypeTab = buildTab(byCode, 'PRICE_TYPE_CONFIRMATION', '价格类型确认')
  const pricePrepareTab = buildTab(byCode, 'PRICE_PREPARE', '最终价格生成')
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
  const state = presentedEffectiveBom.value.state
  if (!isBomConfirmed.value && effectiveBomIsReadOnly(state)) {
    return { label: '待确认', type: 'warning' }
  }
  return effectiveBomStateMeta(state)
})
const effectiveBomReadOnly = computed(() => (
  isBomConfirmed.value && effectiveBomIsReadOnly(effectiveBom.value.state)
))
const effectiveBomBlocked = computed(() => (
  presentedEffectiveBom.value.state === 'BLOCKED'
  || presentedEffectiveBom.value.state === 'ERROR'
))
const pricingBomReadyForNextStep = computed(() => (
  effectiveBomMatchesCostingBuild(effectiveBom.value, workbench.value)
))
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
const priceTypeDrawerTitle = computed(() => priceTypeDrawerMode.value === 'IMPORT_MISSING' ? '维护缺失价格类型' : '调整价格类型')
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
const hasPendingTrial = computed(() => costRunVersions.value.some((row) => row?.canConfirm || row?.status === 'TRIAL'))
const currentConfirmedVersion = computed(() =>
  costRunVersions.value.find((row) => row?.currentConfirmed)
  || costRun.value.latestConfirmed
  || null
)
const hasStaleCostVersion = computed(() => costRunVersions.value.some((row) => row?.stale))
const costRunWorkbenchStatusText = computed(() => {
  const confirmedVersionNo =
    currentConfirmedVersion.value?.displayVersionNo || currentConfirmedVersion.value?.versionNo
  if (hasPendingTrial.value && confirmedVersionNo) {
    return '新试算待确认'
  }
  if (hasPendingTrial.value) return '试算待确认'
  if (confirmedVersionNo) {
    return `已确认 ${confirmedVersionNo}`
  }
  if (hasStaleCostVersion.value) return '历史版本需重新试算'
  return header.value.calcStatus || '未核算'
})
const costRunStatusTagType = computed(() => {
  if (hasPendingTrial.value) return 'warning'
  if (currentConfirmedVersion.value?.id) return 'success'
  if (hasStaleCostVersion.value) return 'info'
  return statusTagType('calcStatus', header.value.calcStatus || '未核算')
})
const displayedCostVersion = computed(() => costRun.value.currentDisplayVersion || {})
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
const workflowGuideVisible = computed(() => inputGapGuideVisible.value || Boolean(localWorkflowGuideText.value))
const workflowGuideText = computed(() => localWorkflowGuideText.value || inputGapGuideText.value)
const inputGapGuideText = computed(() => {
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
  await ensurePriceSourceChecked()
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
    // 第 2 步尚未确认时，第 3 步接口按业务规则会拒绝访问。
    // 初始化和进入第 2 步只加载当前阶段数据，避免把正常门禁弹成错误提示。
    isBomConfirmed.value ? loadPriceType(false) : Promise.resolve(),
    loadPricePrepare(false),
    loadCostRun(false),
    loadActiveRepriceLock(),
  ])
  refreshingTabs.value = false
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
  if (isBomConfirmed.value && canSelectAlternative.value) {
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
    confirmed: isBomConfirmed.value,
    canSelect: canSelectAlternative.value,
    summary: alternativeSummary.value,
    group,
  })) {
    ElMessage.warning(
      alternativeReviewMessage.value
      || (isBomConfirmed.value
        ? '报价物料明细已确认，请先撤销确认'
        : '当前不能修改标准/替代选择'),
    )
    return
  }

  let confirmDiscardManualChanges = false
  if (hasManualCostingChanges(bomConfirmation.value, bomRows.value)) {
    confirmDiscardManualChanges = await confirmAlternativeManualChangesDiscard()
    if (!confirmDiscardManualChanges) return
  }

  alternativeSavingGroupKey.value = group.alternativeGroupKey
  try {
    const selectionBody = {
      periodMonth: workbench.value.periodMonth,
      selectedMaterialCode,
      expectedSelectionVersion: group.selectionVersion,
      expectedBuildBatchId: group.sourceBuildBatchId || workbench.value.buildBatchId,
      confirmDiscardManualChanges,
      selectionRemark: '产品明细页面选择标准/替代件',
    }
    let result
    try {
      result = await selectQuoteBomAlternative(
        oaNo.value,
        itemId.value,
        group.alternativeGroupKey,
        selectionBody,
      )
    } catch (error) {
      if (
        !selectionBody.confirmDiscardManualChanges
        && String(error?.message || '').includes('MANUAL_ROW_CHANGES_EXIST')
      ) {
        selectionBody.confirmDiscardManualChanges = await confirmAlternativeManualChangesDiscard()
        if (!selectionBody.confirmDiscardManualChanges) return
        result = await selectQuoteBomAlternative(
          oaNo.value,
          itemId.value,
          group.alternativeGroupKey,
          selectionBody,
        )
      } else {
        throw error
      }
    }
    clearAlternativePreview()
    await refreshAfterAlternativeSelection()
    await loadAlternativeHistory(
      alternativeSummary.value.groups?.find(
        (candidate) => candidate.alternativeGroupKey === group.alternativeGroupKey,
      ) || group,
      false,
    )
    ElMessage.success(formatAlternativeRebuildSummary(result))
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

async function confirmAlternativeManualChangesDiscard() {
  try {
    await ElMessageBox.confirm(
      '当前存在人工修改的结算行。切换整棵 BOM 分支会清除这些人工修改，并使后续价格类型、最终价格和成本核算结果失效，确认继续？',
      '切换标准/替代件',
      {
        type: 'warning',
        confirmButtonText: '确认切换并清除',
        cancelButtonText: '取消',
      },
    )
    return true
  } catch {
    return false
  }
}

async function refreshAfterAlternativeSelection() {
  autoPriceSourceCheckedKey.value = ''
  await loadWorkbench({ resetTab: false, loadChildren: true })
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
  if (
    effectiveBomFeatureEnabled.value
    && requestedTab !== 'PRODUCT_DETAIL'
    && !pricingBomReadyForNextStep.value
  ) {
    if (effectiveBomBlocked.value || !await preparePricingBomForNextStep()) {
      activeTab.value = 'PRODUCT_DETAIL'
      return false
    }
  }
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

function guidePriceTypeAfterBomConfirm() {
  activeTab.value = 'PRICE_TYPE_CONFIRMATION'
  const missingTypeCount = currentMissingPriceTypeCount()
  if (missingTypeCount > 0) {
    priceTypeFilter.value = 'MISSING'
    localWorkflowGuideText.value = `报价物料明细已确认，发现 ${missingTypeCount} 项缺价格类型，请到“物料价格类型”导入或维护后再确认`
    ElMessage.warning(localWorkflowGuideText.value)
    return
  }
  priceTypeFilter.value = 'ALL'
  localWorkflowGuideText.value = '报价物料明细已确认，价格类型已匹配，请在“价格类型确认”中确认后继续'
  ElMessage.success(localWorkflowGuideText.value)
}

async function loadPriceType(showError = true) {
  if (!oaNo.value || !itemId.value) return
  priceTypeLoading.value = true
  try {
    priceType.value = await fetchQuotePriceTypeConfirmation(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
  } catch (error) {
    priceType.value = emptyPriceTypeResponse()
    if (showError) ElMessage.error(error?.message || '获取价格类型确认失败')
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
    const response = await fetchQuoteCostRun(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
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
  router.push(`/ingest/quote-requests/${encodeURIComponent(oaNo.value)}`)
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

async function preparePricingBomForNextStep() {
  if (pricingBomReadyForNextStep.value) return true
  if (effectiveBomConfirming.value) return false
  if (!effectiveBomCanConfirm(effectiveBom.value) && !effectiveBomReadOnly.value) {
    ElMessage.warning(effectiveBomBlocked.value
      ? '请先处理本次计价 BOM 的数据问题'
      : '本次计价 BOM 尚未准备好')
    return false
  }
  effectiveBomConfirming.value = true
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
    effectiveBomConfirming.value = false
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
  const store = bomTreeRef.value?.store
  const allNodes = store?._getAllNodes?.() || Object.values(store?.nodesMap || {})
  allNodes.forEach((node) => {
    node.expanded = expanded
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

async function confirmBomRows() {
  if (alternativeNeedsReview.value) {
    alternativeDrawerVisible.value = true
    ElMessage.error(
      alternativeReviewMessage.value
      || '标准/替代选择需要重新确认，完成前不能确认报价物料明细',
    )
    return
  }
  bomActionLoading.value = true
  try {
    const request = {
      periodMonth: workbench.value.periodMonth,
      confirmRemark: '前端确认报价物料明细',
    }
    if (effectiveBomFeatureEnabled.value) {
      await confirmQuoteEffectiveBom(oaNo.value, itemId.value, request)
    } else {
      await confirmCostingBom(oaNo.value, itemId.value, request)
    }
    await loadWorkbench({ resetTab: false, loadChildren: true })
    guidePriceTypeAfterBomConfirm()
  } catch (error) {
    ElMessage.error(error?.message || '确认报价物料明细失败')
  } finally {
    bomActionLoading.value = false
  }
}

async function cancelBomConfirm() {
  try {
    await ElMessageBox.confirm('撤销后将阻断后续价格类型、最终价格生成和成本核算，确认撤销？', '撤销确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  bomActionLoading.value = true
  try {
    await cancelCostingBomConfirm(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      reason: '前端撤销报价物料明细确认',
    })
    await refreshAfterAction('报价物料明细确认已撤销')
  } catch (error) {
    ElMessage.error(error?.message || '撤销报价物料明细确认失败')
  } finally {
    bomActionLoading.value = false
  }
}

function openAdjustDrawer(row) {
  if (!isPriceableTypeRow(row)) {
    ElMessage.warning('父项不直接维护价格类型，请调整下方子项')
    return
  }
  const defaultEffectiveFrom = row.effectiveFrom || workbench.value.periodMonth || ''
  priceTypeDrawerMode.value = isMissingPriceTypeRow(row) ? 'IMPORT_MISSING' : 'ADJUST'
  priceTypeForm.value = {
    materialCode: row.materialCode || '',
    materialName: row.materialName || '',
    objectType: row.objectType || '',
    priceType: row.priceType || '',
    effectiveFrom: normalizeEffectiveMonth(defaultEffectiveFrom),
    reason: row.message || '',
  }
  priceTypeDrawerVisible.value = true
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

async function submitPriceTypeDrawer() {
  if (!priceTypeForm.value.materialCode) {
    ElMessage.error('缺少物料料号')
    return
  }
  if (!priceTypeForm.value.priceType) {
    ElMessage.error('请选择价格类型')
    return
  }
  priceTypeActionLoading.value = true
  try {
    const payload = {
      materialCode: priceTypeForm.value.materialCode,
      materialName: priceTypeForm.value.materialName,
      objectType: priceTypeForm.value.objectType,
      priceType: priceTypeForm.value.priceType,
      effectiveFrom: priceTypeForm.value.effectiveFrom,
      reason: priceTypeForm.value.reason,
    }
    if (priceTypeDrawerMode.value === 'IMPORT_MISSING') {
      await importMissingPriceType(oaNo.value, itemId.value, {
        periodMonth: workbench.value.periodMonth,
        items: [payload],
      })
    } else {
      await adjustPriceType(oaNo.value, itemId.value, payload)
    }
    priceTypeDrawerVisible.value = false
    await refreshAfterAction('价格类型已保存')
  } catch (error) {
    ElMessage.error(error?.message || '保存价格类型失败')
  } finally {
    priceTypeActionLoading.value = false
  }
}

async function confirmPriceTypes() {
  priceTypeActionLoading.value = true
  try {
    await confirmPriceType(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      message: '前端确认价格类型',
    })
    await refreshAfterAction('价格类型已确认')
  } catch (error) {
    ElMessage.error(error?.message || '确认价格类型失败')
  } finally {
    priceTypeActionLoading.value = false
  }
}

async function generatePricePrepare(successText = '最终价格已生成') {
  pricePrepareActionLoading.value = true
  try {
    await generateQuotePricePrepare(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      priceTypeConfirmNo: latestPriceType.value.confirmNo,
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
  if (!latestPriceType.value.confirmNo || pricePrepareActionLoading.value || autoPriceSourceChecking.value) {
    return false
  }
  autoPriceSourceChecking.value = true
  try {
    pricePrepare.value = await checkQuotePriceSources(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      priceTypeConfirmNo: latestPriceType.value.confirmNo,
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
    latestPriceType.value.confirmNo || '',
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
  if (!latestPriceType.value.confirmNo) return
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
    return tab.blockedReason || '请先确认价格类型，确认后系统才能判断需要补充哪类价格源'
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

async function trialCostRun() {
  if (costRunRepriceLocked.value) {
    ElMessage.warning(activeRepriceLock.value.message || '当前业务单元正在月度调价，暂不能发起成本核算')
    return
  }
  costRunActionLoading.value = true
  costRunError.value = ''
  try {
    const response = await trialQuoteCostRun(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      pricePrepareNo: oaPrepareBatch.value.prepareNo || pricePrepare.value.readiness?.prepareNo,
    })
    if (response) {
      await applyCostRunResponse(response)
    } else {
      await loadCostRun(false)
    }
    ElMessage.success('成本核算试算已完成')
    const trialRow = costRunVersions.value.find((row) => row?.status === 'TRIAL') || costRunVersions.value[0]
    if (trialRow?.canViewSheet) openCostRunDetail(trialRow)
  } catch (error) {
    costRunError.value = error?.message || '开始核算失败'
    ElMessage.error(costRunError.value)
  } finally {
    costRunActionLoading.value = false
  }
}

async function confirmCostRun(row = null) {
  const costRunNo = row?.costRunNo || costRun.value.latestTrial?.costRunNo
  if (!costRunNo) return
  costRunActionLoading.value = true
  costRunError.value = ''
  try {
    await confirmQuoteCostRun(oaNo.value, itemId.value, costRunNo, {
      confirmMessage: '前端确认成本核算',
    })
    await refreshAfterAction('成本核算已确认')
  } catch (error) {
    costRunError.value = error?.message || '确认成本核算失败'
    ElMessage.error(costRunError.value)
  } finally {
    costRunActionLoading.value = false
  }
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
      blockedReason: '请先确认价格类型',
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
      blockedReason: '价格类型已确认，系统将自动检查价格源',
    }
  }
  return {
    code: 'PRICE_SOURCE_SUPPLEMENT',
    name: '价格源维护',
    status: hasGeneratedPrice ? 'DONE' : 'READY',
    blockedReason: hasGeneratedPrice ? '' : '价格类型已确认，可自动检查价格源并生成最终价格',
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

async function beforeWorkbenchTabLeave(nextName, previousName) {
  const nextCode = normalizeTabCode(nextName)
  const previousCode = normalizeTabCode(previousName)
  if (previousCode !== 'PRODUCT_DETAIL' || nextCode === 'PRODUCT_DETAIL') return true
  if (!effectiveBomFeatureEnabled.value) return true
  if (pricingBomReadyForNextStep.value) return true
  if (effectiveBomBlocked.value) {
    ElMessage.error('本次计价 BOM 存在数据问题，暂时不能进入下一步')
    return false
  }
  return preparePricingBomForNextStep()
}

function tabBadgeLabel(tab) {
  const code = normalizeTabCode(tab?.code)
  if (code === 'PRODUCT_DETAIL') {
    return effectiveBomFeatureEnabled.value ? effectiveBomStateInfo.value.label : '旧版原始 BOM'
  }
  if (code === 'QUOTE_BOM') return isBomConfirmed.value ? '已确认' : '待确认'
  if (code === 'PRICE_TYPE_CONFIRMATION') {
    const missingTypeCount = currentMissingPriceTypeCount()
    if (missingTypeCount > 0) return `缺 ${missingTypeCount} 项`
    return tab?.status === 'DONE' ? '已确认' : '待确认'
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
    const versionNo = currentConfirmedVersion.value?.displayVersionNo || currentConfirmedVersion.value?.versionNo
    if (hasPendingTrial.value && versionNo) return '新试算待确认'
    if (hasPendingTrial.value) return '有试算'
    if (tab?.status === 'DONE' && versionNo) return `已确认 ${versionNo}`
    if (isBlockedTab(tab)) return '未就绪'
    return '待试算'
  }
  return tabStatusLabel(tab?.status)
}

function tabBadgeType(tab) {
  const code = normalizeTabCode(tab?.code)
  if (code === 'PRODUCT_DETAIL') {
    return effectiveBomFeatureEnabled.value ? effectiveBomStateInfo.value.type : 'info'
  }
  if (code === 'QUOTE_BOM') return isBomConfirmed.value ? 'success' : 'warning'
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
    if (hasPendingTrial.value) return 'warning'
    if (tab?.status === 'DONE' && currentConfirmedVersion.value?.id) return 'success'
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
  const status = row?.status || ''
  const currentConfirmed = Boolean(row?.currentConfirmed)
  const canConfirm = row?.canConfirm ?? status === 'TRIAL'
  const canViewSheet = row?.canViewSheet ?? Boolean(row?.id && row?.costRunNo)
  const canViewTrace = row?.canViewTrace ?? (status !== 'TRIAL' && Boolean(row?.costRunNo))
  return {
    ...row,
    displayVersionNo: row?.displayVersionNo || row?.versionNo || row?.costRunNo || '-',
    displayStatus: row?.displayStatus || costVersionStatusText({ ...row, currentConfirmed }),
    canConfirm,
    canViewSheet,
    canViewTrace,
    currentConfirmed,
    stale: row?.stale ?? (status !== 'TRIAL' && !currentConfirmed),
  }
}

function costVersionRowClass({ row }) {
  return row?.id === selectedCostRunVersionId.value ? 'selected-version-row' : ''
}

function costVersionStatusText(row) {
  if (row?.status === 'TRIAL') return '待确认'
  if (row?.currentConfirmed) return '当前已确认'
  if (row?.status === 'VOIDED' || row?.stale) return '历史版本'
  if (row?.status === 'CONFIRMED') return '已确认'
  return row?.status || '-'
}

function costVersionStatusTagType(row) {
  if (row?.status === 'TRIAL') return 'warning'
  if (row?.currentConfirmed) return 'success'
  if (row?.stale || row?.status === 'VOIDED') return 'info'
  return 'info'
}

function workflowStepLabel(step) {
  const labels = {
    QUOTE_BOM: '报价物料明细',
    PRICE_TYPE_CONFIRMATION: '价格类型确认',
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

function emptyPriceTypeForm() {
  return {
    materialCode: '',
    materialName: '',
    objectType: '',
    priceType: '',
    effectiveFrom: '',
    reason: '',
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

function normalizeEffectiveMonth(value) {
  const text = String(value || '').trim()
  if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7)
  return workbench.value.periodMonth || ''
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
    quote_price_type_confirmation: '报价确认维护',
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
  await refreshPriceSourceFromReturn()
  await ensurePriceSourceChecked()
}

watch([oaNo, itemId], () => {
  initializeWorkbench()
})

watch(activeTab, () => {
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
  gap: 14px;
  min-width: 1180px;
  color: #2f343d;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  color: #1f2a37;
}

.page-head p {
  margin: 4px 0 0;
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
}

.section-block {
  overflow: hidden;
  border: 1px solid #e5eaf3;
  border-radius: 4px;
  background: #ffffff;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 0 16px;
  border-bottom: 1px solid #e5eaf3;
  background: #f7f9fc;
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
  gap: 18px;
  min-height: 38px;
  padding: 0 16px;
  flex-wrap: wrap;
  color: #4b5563;
  font-size: 13px;
  border-bottom: 1px solid #e5eaf3;
  background: #fafbfe;
}

.tab-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #edf2f7;
  color: #4b5563;
  font-weight: 650;
}

.costing-tabs {
  padding: 0 16px 16px;
  background: #ffffff;
}

.costing-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.costing-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e5eaf3;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tab-index {
  width: 18px;
  height: 18px;
  font-size: 11px;
}

.tab-toolbar,
.action-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #e5eaf3;
  background: #fafbfe;
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
  gap: 10px;
  margin-bottom: 14px;
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
  border: 1px solid #e5eaf3;
  background: #fafbfe;
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
  border: 1px solid #e5eaf3;
  background: #fafbfe;
}

.metric span {
  color: #697386;
  font-size: 13px;
}

.metric strong {
  display: block;
  margin-top: 4px;
  color: #2f343d;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  word-break: break-all;
}

.price-compare-summary {
  grid-template-columns: repeat(4, minmax(180px, 1fr));
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
  margin-bottom: 10px;
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
  border: 1px solid #dbe7f5;
  border-radius: 6px;
  background: #f7faff;
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
  border: 1px solid #e5eaf3;
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
