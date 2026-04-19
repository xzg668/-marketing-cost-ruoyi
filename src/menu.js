export const menuGroups = [
  // {
  //   index: 'cost',
  //   title: '成本核算',
  //   children: [
  //     { index: '/cost/run', title: '产品成本明细' },
  //     { index: '/ingest/oa-form', title: 'OA报价单' },
  //   ],
  // },
  {
    index: 'ingest',
    title: '数据接入',
    children: [
      { index: '/ingest/oa-form', title: 'OA报价单' },
      { index: '/base/u9Bom', title: 'U9 BOM明细' },
      { index: '/base/eleDraw', title: '电子图库BOM明细' },
      { index: '/base/addbom', title: 'BOM明细录入' },
    ],
  },
  {
    index: 'base',
    title: '基础数据',
    children: [

      { index: '/base/bomfilter', title: 'BOM明细过滤规则' },
      { index: '/base/material', title: 'BOM数据' },
      { index: '/base/map', title: '物料价格类型对照表' },

      // { index: '/base/org', title: '业务单元' },
      // { index: '/base/orgDept', title: '部门' },
      { index: '/base/fixed', title: '部门经费率对照表' },
      {
        index: '/base/aux',
        title: '辅料管理',
        children: [
          { index: '/base/aux/subject', title: '辅料价格表' },
          { index: '/base/aux/item', title: '辅料上浮比率表' },
        ],
      },

      { index: '/base/materweight', title: '物料表' },

      { index: '/base/salary', title: '工资表' },
      { index: '/base/quantityLoss', title: '质量损失率对照表' },
      { index: '/base/manufactureRate', title: '制造费用率对照表' },
      { index: '/base/threeExpenseRate', title: '三项费用费率对照表' },
      { index: '/base/productProperty', title: '产品属性对照表' },
      { index: '/base/other', title: '其他费用率对照表' },

    ],
  },
  {
    index: 'price',
    title: '价格源管理',
    children: [
      {
        index: '/price/linked',
        title: '联动价',
        children: [
          { index: '/price/linked/result', title: '联动价格表' },
          { index: '/price/linked/oa-result', title: '联动价计算' },
          { index: '/price/linked/formula', title: '公式配置' },
          { index: '/price/linked/finance-base', title: '影响因素表' },
        ],
      },
      { index: '/price/range', title: '区间价' },
      { index: '/price/settle', title: '结算价' },
      { index: '/price/fixed', title: '固定价' },
      { index: '/price/outsource_settle', title: '委外结算价表' },
      { index: '/price/outsource_fixed', title: '委外固定价表' },

    ]
  },

  {
    index: 'cost',
    title: '成本核算',
    children: [
      { index: '/cost/run', title: '实时成本计算' },
      { index: '/cost/run/completed', title: '已核算成本明细' },
    ],
  },
  {
    index: 'analysis',
    title: '数据分析',
    children: [
      { index: '/analysis/cost', title: '成本分析' },
      { index: '/analysis/report', title: '报表' },
    ],
  },
  {
    index: 'settlement',
    title: '结账',
    children: [{ index: '/settlement/monthly-adjustment', title: '月度调价' }],
  },
]
