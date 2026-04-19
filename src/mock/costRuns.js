const costRunList = [
  {
    oaNo: 'OA-2026-0001',
    customer: 'Customer A',
    formType: 'FI-SR-005',
    applyDate: '2026-01-08',
    status: '未审核',
  },
  {
    oaNo: 'OA-2026-0002',
    customer: 'Customer B',
    formType: 'FI-SC-006',
    applyDate: '2026-01-12',
    status: '已审核',
  },
  {
    oaNo: 'OA-2026-0003',
    customer: 'Customer C',
    formType: 'FI-SR-005',
    applyDate: '2026-02-02',
    status: '未审核',
  },
  {
    oaNo: 'OA-2026-0004',
    customer: 'Customer D',
    formType: 'FI-SC-006',
    applyDate: '2026-02-05',
    status: '已审核',
  },
]

const costRunItemsMap = {
  'OA-2026-0001': [
    {
      id: 'OA-2026-0001-01',
      productName: 'Valve Core A',
      materialCode: 'MAT-1001',
      customerDrawing: 'DRW-1001',
      spec: 'DN10',
      unitCost: 12.6,
      totalCost: 6380,
    },
    {
      id: 'OA-2026-0001-02',
      productName: 'Valve Core B',
      materialCode: 'MAT-1002',
      customerDrawing: 'DRW-1002',
      spec: 'DN12',
      unitCost: 14.2,
      totalCost: 7100,
    },
  ],
  'OA-2026-0002': [
    {
      id: 'OA-2026-0002-01',
      productName: 'Pipe Assembly A',
      materialCode: 'MAT-2001',
      customerDrawing: 'DRW-2001',
      spec: '12x8',
      unitCost: 9.8,
      totalCost: 4900,
    },
    {
      id: 'OA-2026-0002-02',
      productName: 'Pipe Assembly B',
      materialCode: 'MAT-2002',
      customerDrawing: 'DRW-2002',
      spec: '16x10',
      unitCost: 11.4,
      totalCost: 5700,
    },
  ],
  'OA-2026-0003': [
    {
      id: 'OA-2026-0003-01',
      productName: 'Housing A',
      materialCode: 'MAT-3001',
      customerDrawing: 'DRW-3001',
      spec: '60mm',
      unitCost: 18.9,
      totalCost: 9450,
    },
    {
      id: 'OA-2026-0003-02',
      productName: 'Housing B',
      materialCode: 'MAT-3002',
      customerDrawing: 'DRW-3002',
      spec: '72mm',
      unitCost: 21.5,
      totalCost: 10750,
    },
  ],
  'OA-2026-0004': [
    {
      id: 'OA-2026-0004-01',
      productName: 'Connector A',
      materialCode: 'MAT-4001',
      customerDrawing: 'DRW-4001',
      spec: 'Type-A',
      unitCost: 6.4,
      totalCost: 3200,
    },
    {
      id: 'OA-2026-0004-02',
      productName: 'Connector B',
      materialCode: 'MAT-4002',
      customerDrawing: 'DRW-4002',
      spec: 'Type-B',
      unitCost: 7.1,
      totalCost: 3550,
    },
  ],
}

const isWithinRange = (dateText, startDate, endDate) => {
  if (!startDate && !endDate) {
    return true
  }
  const value = Date.parse(dateText)
  if (Number.isNaN(value)) {
    return false
  }
  if (startDate) {
    const startValue = Date.parse(startDate)
    if (!Number.isNaN(startValue) && value < startValue) {
      return false
    }
  }
  if (endDate) {
    const endValue = Date.parse(endDate)
    if (!Number.isNaN(endValue) && value > endValue) {
      return false
    }
  }
  return true
}

const buildFallbackItems = (oaNo) => [
  {
    id: `${oaNo}-01`,
    productName: 'Default Product A',
    materialCode: 'MAT-0001',
    customerDrawing: 'DRW-0001',
    spec: 'N/A',
    unitCost: 10,
    totalCost: 5000,
  },
  {
    id: `${oaNo}-02`,
    productName: 'Default Product B',
    materialCode: 'MAT-0002',
    customerDrawing: 'DRW-0002',
    spec: 'N/A',
    unitCost: 12,
    totalCost: 6000,
  },
]

export const fetchCostRuns = async (params = {}) => {
  const oaNo = params.oaNo ? String(params.oaNo).trim() : ''
  const customer = params.customer ? String(params.customer).trim() : ''
  const startDate = params.startDate ? String(params.startDate).trim() : ''
  const endDate = params.endDate ? String(params.endDate).trim() : ''

  return costRunList.filter((item) => {
    if (oaNo && item.oaNo !== oaNo) {
      return false
    }
    if (customer && item.customer !== customer) {
      return false
    }
    if (!isWithinRange(item.applyDate, startDate, endDate)) {
      return false
    }
    return true
  })
}

export const fetchCostRunResult = async (oaNo) => {
  const trimmed = String(oaNo || '').trim()
  const meta = costRunList.find((item) => item.oaNo === trimmed) || {
    oaNo: trimmed,
    customer: 'Unknown',
    formType: 'N/A',
    applyDate: 'N/A',
    status: '未审核',
  }
  const items = costRunItemsMap[trimmed] || buildFallbackItems(trimmed || 'OA')
  return {
    meta,
    items,
  }
}
