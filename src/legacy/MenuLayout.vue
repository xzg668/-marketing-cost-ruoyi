<template>
  <el-container class="layout">
    <el-aside width="260px" class="sidebar">
      <div class="sidebar-title">产品成本核算</div>
      <el-menu
        class="app-menu"
        :default-active="active"
        :default-openeds="defaultOpeneds"
        @select="handleSelect"
      >
        <el-sub-menu
          v-for="group in menus"
          :key="group.index"
          :index="group.index"
        >
          <template #title>
            <span>{{ group.title }}</span>
          </template>
          <el-menu-item
            v-for="item in group.children"
            :key="item.index"
            :index="item.index"
          >
            {{ item.title }}
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ currentTitle }}</div>
        <div class="header-actions">
          <el-button type="primary">导入</el-button>
          <el-button>修改</el-button>
          <el-button type="danger">删除</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <el-card shadow="never">
          <el-table :data="tableRows" stripe>
            <el-table-column prop="id" label="编号" width="140" />
            <el-table-column prop="name" label="名称" min-width="200" />
            <el-table-column prop="source" label="数据来源" width="120" />
            <el-table-column prop="month" label="月份" width="120" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === '已导入' ? 'success' : 'info'">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="180" />
          </el-table>
        </el-card>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
const active = ref('cost-list')
const defaultOpeneds = [
  'cost',
  'ingest',
  'master',
  'price',
  'fee',
  'rules',
  'audit',
  'report',
]

const menus = [
  {
    index: 'cost',
    title: '成本核算',
    children: [
      { index: 'cost-run', title: '成本试算/生成' },
      { index: 'cost-list', title: '成本一览表' },
      { index: 'cost-version', title: '版本/批次管理' },
      { index: 'cost-exception', title: '异常与待补录' },
    ],
  },
  {
    index: 'ingest',
    title: '数据接入',
    children: [
      { index: 'ingest-u9', title: 'U9 数据：BOM 明细、料品档案、厂商价目表' },
      { index: 'ingest-oa', title: 'OA 数据：产品主数据、报价单、结算价' },
      { index: 'ingest-excel', title: '供管部/Excel：联动价、区间价' },
      { index: 'ingest-cms', title: 'CMS：辅料/可变费用' },
      { index: 'ingest-manual', title: '手工录入：补充费用/异常' },
    ],
  },
  {
    index: 'master',
    title: '基础数据管理',
    children: [
      { index: 'master-product', title: '产品/客户' },
      { index: 'master-material', title: '物料/部品' },
      { index: 'master-map', title: '料品-价格类型对照' },
      { index: 'master-org', title: '组织结构（事业部/部门/区域）' },
    ],
  },
  {
    index: 'price',
    title: '价格源管理',
    children: [
      { index: 'price-linked', title: '联动价' },
      { index: 'price-fixed', title: '固定价' },
      { index: 'price-range', title: '区间价' },
      { index: 'price-settle', title: '结算价' },
      { index: 'price-rule', title: '取价规则/配额' },
    ],
  },
  {
    index: 'fee',
    title: '费用源管理',
    children: [
      { index: 'fee-fixed', title: '经费（包装/大修/水电/工装零星修理费）' },
      { index: 'fee-aux', title: '辅料/气体/清洗费' },
      { index: 'fee-labor', title: '人工与制造费用率' },
      { index: 'fee-three', title: '三项费用费率' },
      { index: 'fee-other', title: '其他费用（运费/认证费）' },
    ],
  },
  {
    index: 'rules',
    title: '规则与参数',
    children: [
      { index: 'rules-formula', title: '计算口径/公式' },
      { index: 'rules-rate', title: '比率/费率配置' },
      { index: 'rules-unit', title: '单位/换算' },
    ],
  },
  {
    index: 'audit',
    title: '审计与权限',
    children: [
      { index: 'audit-change', title: '调整记录' },
      { index: 'audit-log', title: '操作日志' },
      { index: 'audit-role', title: '角色权限' },
    ],
  },
  {
    index: 'report',
    title: '报表与导出',
    children: [
      { index: 'report-month', title: '月度汇总' },
      { index: 'report-dim', title: '客户/产品维度' },
      { index: 'report-export', title: '导出模板' },
    ],
  },
]

const menuTitleMap = menus.reduce((acc, group) => {
  group.children.forEach((item) => {
    acc[item.index] = item.title
  })
  return acc
}, {})

const currentTitle = computed(() => menuTitleMap[active.value] || '菜单')

const handleSelect = (index) => {
  active.value = index
}

const tableRows = ref([
  {
    id: 'U9-2026-02',
    name: 'U9 BOM 明细',
    source: 'U9',
    month: '2026-02',
    status: '已导入',
    updatedAt: '2026-02-02 11:13',
  },
  {
    id: 'OA-2026-02',
    name: 'OA 结算价',
    source: 'OA',
    month: '2026-02',
    status: '已导入',
    updatedAt: '2026-02-01 09:20',
  },
  {
    id: 'EXCEL-2026-02',
    name: '联动价/区间价',
    source: 'Excel',
    month: '2026-02',
    status: '待导入',
    updatedAt: '2026-01-30 16:45',
  },
])
</script>

<style scoped>
.layout {
  height: 100vh;
  background: #f5f7fb;
}

.sidebar {
  border-right: 1px solid #ebeef5;
  background: #ffffff;
}

.sidebar-title {
  padding: 16px 18px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a37;
  border-bottom: 1px solid #ebeef5;
}

.app-menu {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a37;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.main {
  padding: 16px;
}
</style>
