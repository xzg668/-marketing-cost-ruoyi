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
      v-if="workbench.snapshotGenerated"
      class="inline-alert"
      type="success"
      show-icon
      :closable="false"
      title="已生成当前核算月份 BOM 快照"
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
        <small>{{ workbench.buildBatchId ? `生成批次：${workbench.buildBatchId}` : '按产品行隔离核算' }}</small>
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

      <el-tabs v-model="activeTab" class="costing-tabs">
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

          <div v-if="tab.code === 'PRODUCT_DETAIL'" class="product-detail-tab">
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
                    <el-tag v-if="data.shapeAttr === '部品联动'" size="small" type="warning" effect="plain">部品联动</el-tag>
                    <el-tag v-if="isTakeoverNode(data)" size="small" type="warning">接管</el-tag>
                    <el-tag v-if="data.isLeaf === 1" size="small" type="success" effect="plain">叶子</el-tag>
                  </span>
                </template>
              </el-tree>
            </div>
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
              <div class="metric">
                <span>人工修改</span>
                <strong>{{ bomConfirmation.manualModifiedCount ?? modifiedBomCount }}</strong>
              </div>
              <div class="metric">
                <span>替换料号</span>
                <strong>{{ bomConfirmation.replaceCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>用量调整</span>
                <strong>{{ bomConfirmation.usageAdjustCount ?? '-' }}</strong>
              </div>
            </div>

            <div class="tab-toolbar">
              <div>
                <strong>报价物料明细</strong>
                <span>{{ tab.blockedReason || '已按当前产品行过滤 BOM 结算行' }}</span>
              </div>
              <div class="toolbar-actions">
                <el-button
                  type="primary"
                  :loading="bomActionLoading"
                  :disabled="isBlockedTab(tab) || isBomConfirmed || bomRows.length === 0"
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
              :data="bomRows"
              border
              stripe
              scrollbar-always-on
              max-height="calc(100vh - 420px)"
              row-key="id"
              class="bom-table"
            >
              <el-table-column label="子件料号" min-width="220" fixed="left" show-overflow-tooltip>
                <template #default="{ row }">{{ row.childCode || '-' }}</template>
              </el-table-column>
              <el-table-column prop="childName" label="品名" min-width="180" fixed="left" show-overflow-tooltip />
              <el-table-column prop="childModel" label="型号" min-width="170" show-overflow-tooltip />
              <el-table-column label="用量" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.usageQty) }}</template>
              </el-table-column>
              <el-table-column prop="qtyPerTop" label="顶层用量" width="120" align="right" />
              <el-table-column prop="unit" label="单位" width="100" />
              <el-table-column prop="materialAttribute" label="材料属性" width="150" show-overflow-tooltip />
              <el-table-column prop="shapeAttribute" label="形态属性" width="150" show-overflow-tooltip />
              <el-table-column label="人工修改" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.manualModified ? 'warning' : 'info'" effect="plain">
                    {{ row.manualModified ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="modifiedBy" label="修改人" width="120" />
              <el-table-column label="修改时间" width="180">
                <template #default="{ row }">{{ formatDateTime(row.modifiedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="140" fixed="right">
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :icon="Edit"
                    :disabled="Boolean(editingRowId) || isBomConfirmed"
                    @click="startEdit(row)"
                  >
                    替换/调整
                  </el-button>
                </template>
              </el-table-column>
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
                <p>{{ displayBusinessText(pricePrepare.readiness?.message || tab.blockedReason || '基于已确认价格类型和价格源生成当前产品行的最终价格') }}</p>
              </div>
              <el-button
                type="primary"
                :loading="pricePrepareActionLoading"
                :disabled="isBlockedTab(tab)"
                @click="generatePricePrepare"
              >
                生成最终价格
              </el-button>
            </div>

            <div class="status-strip">
              <div class="metric">
                <span>准备批次</span>
                <strong>{{ latestPrepare.prepareNo || pricePrepare.readiness?.prepareNo || '-' }}</strong>
              </div>
              <div class="metric">
                <span>状态</span>
                <strong>{{ latestPrepare.status || pricePrepare.readiness?.batchStatus || pricePrepare.readiness?.status || '-' }}</strong>
              </div>
              <div class="metric">
                <span>总数</span>
                <strong>{{ latestPrepare.totalCount ?? pricePrepare.generatedResult?.totalCount ?? pricePrepareItems.length }}</strong>
              </div>
              <div class="metric">
                <span>成功</span>
                <strong>{{ latestPrepare.successCount ?? pricePrepare.generatedResult?.successCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>告警</span>
                <strong>{{ latestPrepare.warningCount ?? pricePrepare.generatedResult?.warningCount ?? '-' }}</strong>
              </div>
              <div class="metric">
                <span>缺口</span>
                <strong>{{ latestPrepare.gapCount ?? pricePrepare.readiness?.gapCount ?? pricePrepareGaps.length }}</strong>
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
              v-else-if="pricePrepare.readiness?.message"
              type="warning"
              show-icon
              :closable="false"
              :title="pricePrepare.readiness.message"
              class="inline-alert"
            />

            <div class="subsection-head">
              <strong>最终价格明细</strong>
              <span>prepare_no：{{ latestPrepare.prepareNo || pricePrepare.readiness?.prepareNo || '-' }}</span>
            </div>
            <el-table :data="pricePrepareItems" border stripe scrollbar-always-on max-height="320" class="prepare-detail-table">
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
              <el-table-column prop="priceSource" label="价格来源" width="150" show-overflow-tooltip />
              <el-table-column prop="status" label="状态" width="110" />
              <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
              <template #empty>
                <el-empty description="暂无最终价格明细" />
              </template>
            </el-table>

            <div class="subsection-head">
              <strong>价格生成缺口</strong>
              <span>{{ pricePrepareGaps.length }} 条待处理事项</span>
            </div>
            <el-table :data="pricePrepareGaps" border stripe scrollbar-always-on max-height="280" class="gap-table">
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
                  :disabled="isBlockedTab(tab) || !costRun.canStartTrial"
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
                  :disabled="!costRun.currentDisplayVersion?.id"
                  @click="exportCostRun"
                >
                  导出
                </el-button>
              </div>
            </div>

            <div class="condition-list">
              <el-tag :type="costRun.canStartTrial ? 'success' : 'warning'" effect="plain">
                {{ costRun.canStartTrial ? '允许开始试算' : '暂不可试算' }}
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
              class="cost-version-table"
            >
              <el-table-column prop="displayVersionNo" label="成本版本" min-width="190" fixed="left" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="version-cell">
                    <strong>{{ row.displayVersionNo || row.versionNo || row.costRunNo || '-' }}</strong>
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
              <el-table-column label="操作" width="250" fixed="right">
                <template #default="{ row }">
                  <div class="row-actions">
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

    <el-drawer
      v-model="editDrawerVisible"
      title="替换子件料号 / 调整用量"
      size="760px"
      destroy-on-close
      @closed="cancelEdit"
    >
      <div class="replace-drawer">
        <section class="drawer-section">
          <div class="drawer-section-title">当前 BOM 行</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="当前子件料号">{{ editingRow?.childCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="品名">{{ editingRow?.childName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="型号">{{ editingRow?.childModel || '-' }}</el-descriptions-item>
            <el-descriptions-item label="当前用量">{{ editingRow?.usageQty ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="父件料号">{{ editingRow?.parentCode || '-' }}</el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="drawer-section">
          <div class="drawer-section-title">替换料号</div>
          <el-form label-position="top">
            <el-form-item label="从料品库选择子件料号">
              <div class="material-picker">
                <el-input
                  v-model="materialSearchKeyword"
                  clearable
                  placeholder="输入料号 / 品名 / 型号 / 规格查询"
                  class="drawer-control"
                  @keyup.enter="searchChildMaterials(materialSearchKeyword)"
                  @clear="searchChildMaterials('')"
                >
                  <template #append>
                    <el-button :loading="materialOptionLoading" @click="searchChildMaterials(materialSearchKeyword)">
                      查询
                    </el-button>
                  </template>
                </el-input>

                <el-table
                  v-loading="materialOptionLoading"
                  :data="materialOptions"
                  border
                  highlight-current-row
                  row-key="materialCode"
                  size="small"
                  max-height="260"
                  class="material-option-table"
                  @row-dblclick="handleMaterialSelected"
                >
                  <el-table-column prop="materialCode" label="料号" min-width="130" show-overflow-tooltip />
                  <el-table-column prop="materialName" label="品名" min-width="120" show-overflow-tooltip />
                  <el-table-column label="型号/规格" min-width="150" show-overflow-tooltip>
                    <template #default="{ row }">{{ materialModelText(row) || '-' }}</template>
                  </el-table-column>
                  <el-table-column prop="unit" label="单位" width="70" />
                  <el-table-column prop="materialAttribute" label="材料属性" width="110" show-overflow-tooltip />
                  <el-table-column prop="shapeAttribute" label="形态属性" width="110" show-overflow-tooltip />
                  <el-table-column label="操作" width="76" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="handleMaterialSelected(row)">选用</el-button>
                    </template>
                  </el-table-column>
                  <template #empty>
                    <el-empty description="输入关键字查询料品库" />
                  </template>
                </el-table>
              </div>
            </el-form-item>

            <div class="material-preview">
              <div>
                <span>替换后料号</span>
                <strong>{{ editForm.childCode || '-' }}</strong>
              </div>
              <div>
                <span>替换后品名</span>
                <strong>{{ editForm.childName || '-' }}</strong>
              </div>
              <div>
                <span>型号/规格</span>
                <strong>{{ editForm.childModel || '-' }}</strong>
              </div>
              <div>
                <span>单位</span>
                <strong>{{ editForm.unit || '-' }}</strong>
              </div>
              <div>
                <span>材料属性</span>
                <strong>{{ editForm.materialAttribute || '-' }}</strong>
              </div>
              <div>
                <span>形态属性</span>
                <strong>{{ editForm.shapeAttribute || '-' }}</strong>
              </div>
            </div>

            <el-form-item label="本次核算用量">
              <el-input-number
                v-model="editForm.usageQty"
                :controls="false"
                :min="0"
                :precision="6"
                class="drawer-control"
              />
            </el-form-item>
          </el-form>
        </section>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="cancelEdit">取消</el-button>
          <el-button type="primary" :loading="savingRowId === editingRow?.id" @click="saveBomRow(editingRow)">
            保存
          </el-button>
        </div>
      </template>
    </el-drawer>

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
import { ArrowLeft, Edit, Refresh } from '@element-plus/icons-vue'
import BomNodeDetailDrawer from '../components/BomNodeDetailDrawer.vue'
import CostRunTraceDrawer from '../components/CostRunTraceDrawer.vue'
import { getBomHierarchy } from '../api/bom'
import {
  adjustPriceType,
  cancelCostingBomConfirm,
  confirmCostingBom,
  confirmPriceType,
  confirmQuoteCostRun,
  exportQuoteCostRunVersion,
  fetchQuoteCostRun,
  fetchQuoteCostingWorkbench,
  fetchQuotePricePrepare,
  fetchQuotePriceTypeConfirmation,
  generateQuotePricePrepare,
  importMissingPriceType,
  trialQuoteCostRun,
  updateCostingBomRow,
} from '../api/quoteRequests'
import { confirmPricePrepareNoScrap } from '../api/pricePrepare'
import { fetchU9MaterialOptions } from '../api/u9MaterialMaster'
import { formatDateTime, statusLabel, statusTagType } from '../utils/quoteRequestWorkbench'

const route = useRoute()
const router = useRouter()

const oaNo = computed(() => String(route.params.oaNo || ''))
const itemId = computed(() => String(route.params.itemId || ''))
const loading = ref(false)
const refreshingTabs = ref(false)
const activeTab = ref('PRODUCT_DETAIL')
const editingRowId = ref(null)
const editingRow = ref(null)
const editDrawerVisible = ref(false)
const savingRowId = ref(null)
const bomActionLoading = ref(false)
const materialOptionLoading = ref(false)
const materialOptions = ref([])
const materialSearchKeyword = ref('')
const editForm = ref(emptyEditForm())
const bomTree = ref(null)
const bomTreeRef = ref(null)
const bomTreeLoading = ref(false)
const bomNodeDrawerVisible = ref(false)
const selectedBomNode = ref(null)
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
const bomRows = computed(() => Array.isArray(workbench.value.bomRows) ? workbench.value.bomRows : [])
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
const bomConfirmStatusText = computed(() => {
  if (bomConfirmation.value.confirmStatus === 'CONFIRMED') return '已确认'
  if (bomConfirmation.value.confirmStatus === 'VOIDED') return '已撤销'
  return '待确认'
})
const modifiedBomCount = computed(() => bomRows.value.filter((row) => row.manualModified).length)
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
const priceTypeSummary = computed(() => priceType.value.summary || {})
const flatPriceTypeRows = computed(() => flattenRows(priceType.value.rows || []))
const missingPriceTypeRows = computed(() => flatPriceTypeRows.value.filter((row) => isMissingPriceTypeRow(row)))
const filteredPriceTypeRows = computed(() => filterTreeRows(priceType.value.rows || []))
const priceTypeDrawerTitle = computed(() => priceTypeDrawerMode.value === 'IMPORT_MISSING' ? '维护缺失价格类型' : '调整价格类型')
const pricePrepareItems = computed(() => Array.isArray(pricePrepare.value.items?.records) ? pricePrepare.value.items.records : [])
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
const pricePrepareReady = computed(() => {
  const readiness = pricePrepare.value.readiness || {}
  const gapCount = Number(readiness.gapCount ?? pricePrepareGaps.value.length)
  return readiness.status === 'READY' && gapCount === 0
})
const priceSourceChecked = computed(() => {
  const readiness = pricePrepare.value.readiness || {}
  const status = String(readiness.status || '').toUpperCase()
  if (status && status !== 'NOT_PREPARED') return true
  return Boolean(latestPrepare.value.prepareNo || pricePrepareItems.value.length || pricePrepareGaps.value.length)
})
const priceSourceReady = computed(() => priceSourceChecked.value && pricePrepareReady.value && priceSourceGapSummary.value.total === 0)
const costRunBlockingText = computed(() => {
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
  cancelEdit()
  clearBomTree()
  try {
    workbench.value = await fetchQuoteCostingWorkbench(oaNo.value, itemId.value)
    if (resetTab || !activeTab.value) {
      activeTab.value = 'PRODUCT_DETAIL'
    }
    loadBomTree()
    if (loadChildren) {
      await refreshAllTabData()
    }
    applyInputGapGuide()
    applyRouteTab()
  } catch (error) {
    workbench.value = { header: {}, item: {}, bomRows: [], tabs: [], workflowStatus: {} }
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
  await Promise.allSettled([
    loadPriceType(false),
    loadPricePrepare(false),
    loadCostRun(false),
  ])
  refreshingTabs.value = false
}

function applyInputGapGuide() {
  if (route.query.guide !== 'costing-input-gap') return
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

function applyRouteTab() {
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
  try {
    costRun.value = await fetchQuoteCostRun(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
    })
  } catch (error) {
    costRun.value = emptyCostRunResponse()
    if (showError) ElMessage.error(error?.message || '获取成本核算失败')
  } finally {
    costRunLoading.value = false
  }
}

function goBack() {
  router.push(`/ingest/quote-requests/${encodeURIComponent(oaNo.value)}`)
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
    bomTree.value = await getBomHierarchy(topProductCode, { sourceType: 'U9' })
  } catch (error) {
    bomTree.value = null
    ElMessage.error(error?.message || '查询 BOM 层级树失败')
  } finally {
    bomTreeLoading.value = false
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
  const nodesMap = bomTreeRef.value?.store?.nodesMap || {}
  Object.values(nodesMap).forEach((node) => {
    node.expanded = expanded
  })
}

function isTakeoverNode(node) {
  return (node?.materialName || '').includes('接管')
}

function emptyEditForm() {
  return {
    childCode: '',
    childName: '',
    childModel: '',
    usageQty: null,
    unit: '',
    materialAttribute: '',
    shapeAttribute: '',
  }
}

function isEditing(row) {
  return editingRowId.value === row.id
}

function startEdit(row) {
  editingRow.value = row
  editingRowId.value = row.id
  editDrawerVisible.value = true
  materialSearchKeyword.value = row.childCode || ''
  editForm.value = {
    childCode: row.childCode || '',
    childName: row.childName || '',
    childModel: row.childModel || '',
    usageQty: row.usageQty ?? null,
    unit: row.unit || '',
    materialAttribute: row.materialAttribute || '',
    shapeAttribute: row.shapeAttribute || '',
  }
  materialOptions.value = row.childCode ? [optionFromRow(row)] : []
  searchChildMaterials(row.childCode || '')
}

function cancelEdit() {
  editingRowId.value = null
  editingRow.value = null
  editDrawerVisible.value = false
  savingRowId.value = null
  editForm.value = emptyEditForm()
  materialOptions.value = []
  materialSearchKeyword.value = ''
}

async function searchChildMaterials(keyword) {
  const query = String(keyword || '').trim()
  materialOptionLoading.value = true
  try {
    materialOptions.value = await fetchU9MaterialOptions(query, 20)
  } catch (error) {
    materialOptions.value = []
    ElMessage.error(error?.message || '搜索子件料号失败')
  } finally {
    materialOptionLoading.value = false
  }
}

function handleMaterialSelected(material) {
  const selected = typeof material === 'string'
    ? materialOptions.value.find((option) => option.materialCode === material)
    : material
  if (!selected) return
  editForm.value.childCode = selected.materialCode || ''
  editForm.value.childName = selected.materialName || ''
  editForm.value.childModel = materialModelText(selected)
  editForm.value.unit = selected.unit || ''
  editForm.value.materialAttribute = selected.materialAttribute || ''
  editForm.value.shapeAttribute = selected.shapeAttribute || ''
  materialSearchKeyword.value = formatMaterialOption(selected)
}

async function saveBomRow(row = editingRow.value) {
  if (!row || !isEditing(row)) return
  if (!String(editForm.value.childCode || '').trim()) {
    ElMessage.error('请选择子件料号')
    return
  }
  if (editForm.value.usageQty === null || editForm.value.usageQty === '' || !Number.isFinite(Number(editForm.value.usageQty))) {
    ElMessage.error('请输入有效用量')
    return
  }
  savingRowId.value = row.id
  try {
    const saved = await updateCostingBomRow(oaNo.value, itemId.value, row.id, {
      childCode: editForm.value.childCode,
      childName: editForm.value.childName,
      childModel: editForm.value.childModel,
      usageQty: editForm.value.usageQty,
      unit: editForm.value.unit,
      materialAttribute: editForm.value.materialAttribute,
      shapeAttribute: editForm.value.shapeAttribute,
    })
    Object.assign(row, saved)
    ElMessage.success('BOM 行已保存')
    cancelEdit()
    await loadWorkbench({ resetTab: false, loadChildren: false })
  } catch (error) {
    ElMessage.error(error?.message || '保存 BOM 行失败')
  } finally {
    if (savingRowId.value === row.id) {
      savingRowId.value = null
    }
  }
}

async function confirmBomRows() {
  bomActionLoading.value = true
  try {
    await confirmCostingBom(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      confirmRemark: '前端确认报价物料明细',
    })
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
    return await generatePricePrepare(successText)
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
  costRunActionLoading.value = true
  try {
    const response = await trialQuoteCostRun(oaNo.value, itemId.value, {
      periodMonth: workbench.value.periodMonth,
      pricePrepareNo: latestPrepare.value.prepareNo || pricePrepare.value.readiness?.prepareNo,
    })
    if (response) {
      costRun.value = response
    } else {
      await loadCostRun(false)
    }
    ElMessage.success('成本核算试算已完成')
    const trialRow = costRunVersions.value.find((row) => row?.status === 'TRIAL') || costRunVersions.value[0]
    if (trialRow?.canViewSheet) openCostRunDetail(trialRow)
  } catch (error) {
    ElMessage.error(error?.message || '开始核算失败')
  } finally {
    costRunActionLoading.value = false
  }
}

async function confirmCostRun(row = null) {
  const costRunNo = row?.costRunNo || costRun.value.latestTrial?.costRunNo
  if (!costRunNo) return
  costRunActionLoading.value = true
  try {
    await confirmQuoteCostRun(oaNo.value, itemId.value, costRunNo, {
      confirmMessage: '前端确认成本核算',
    })
    await refreshAfterAction('成本核算已确认')
  } catch (error) {
    ElMessage.error(error?.message || '确认成本核算失败')
  } finally {
    costRunActionLoading.value = false
  }
}

async function exportCostRun(row = null) {
  const versionId = row?.id || costRun.value.currentDisplayVersion?.id
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

function optionFromRow(row) {
  return {
    materialCode: row.childCode || '',
    materialName: row.childName || '',
    childModel: row.childModel || '',
    materialModel: row.childModel || '',
    materialSpec: row.childModel || '',
    unit: row.unit || '',
    materialAttribute: row.materialAttribute || '',
    shapeAttribute: row.shapeAttribute || '',
  }
}

function formatMaterialOption(option) {
  return [
    option.materialCode,
    option.materialName,
    materialModelText(option),
  ].filter(Boolean).join(' / ')
}

function materialModelText(material) {
  return material?.childModel || material?.materialModel || material?.materialSpec || ''
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN') : value
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

function tabBadgeLabel(tab) {
  const code = normalizeTabCode(tab?.code)
  if (code === 'PRODUCT_DETAIL') return bomTree.value ? '已加载' : '查看'
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
  if (code === 'PRODUCT_DETAIL') return 'info'
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

function emptyPricePrepareResponse() {
  return {
    readiness: {},
    batches: { records: [] },
    items: { records: [] },
    gaps: { records: [] },
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
  await refreshPriceSourceFromReturn()
  await ensurePriceSourceChecked()
}

watch([oaNo, itemId], () => {
  initializeWorkbench()
})

watch(activeTab, () => {
  ensurePriceSourceChecked()
})

watch(() => route.query.tab, () => {
  applyRouteTab()
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

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.replace-drawer,
.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-section-title {
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.drawer-control {
  width: 100%;
}

.material-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.material-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.material-option-table {
  width: 100%;
}

.material-preview div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5eaf3;
  border-radius: 4px;
  background: #f9fafb;
}

.material-preview span {
  display: block;
  color: #697386;
  font-size: 12px;
  line-height: 1.35;
}

.material-preview strong {
  display: block;
  margin-top: 4px;
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

  .material-preview,
  .version-strip {
    grid-template-columns: 1fr;
  }

  .search-control {
    width: 100%;
  }
}
</style>
