import { normalizeExportPage } from './workbookTransfer.js'

// Enrich each requested page with the same saved effective prices used by the list.
export async function priceExportPage(query, { fetchPage, fetchEffective, kind, fetchLegacyTrace }) {
  const page = normalizeExportPage(await fetchPage(query))
  const originals = page.rows.filter(row => kind === 'linked' ? row.expressionVersion === 'ORIGINAL_V1' : row.rangeBasis === 'FACTOR' && row.sourceCellRef)
  const identity = row => kind === 'linked' ? row.id : row.factorRuleId
  const ids = [...new Set(originals.map(identity))], prices = new Map()
  for (let start=0;start<ids.length;start+=100) {
    for (const price of await fetchEffective(ids.slice(start,start+100), kind === 'linked' ? query.pricingMonth : query.effectiveFrom)) prices.set(String(price.originalId),price)
  }
  const output = []
  for (let start=0;start<page.rows.length;start+=5) {
    const rows = await Promise.all(page.rows.slice(start,start+5).map(async row => {
      const original = kind === 'linked' ? row.expressionVersion === 'ORIGINAL_V1' : row.rangeBasis === 'FACTOR' && row.sourceCellRef
      if (original) {
        const saved=prices.get(String(identity(row)))
        if(!saved) throw Error('部分价格依据未能读取，请重试导出')
        return {...row, exportPrice:saved.unitPrice, exportStatus:saved.status, exportFinanceMonth:saved.financeMonth, exportMessage:saved.message}
      }
      if(kind==='linked' && row.formulaExpr && fetchLegacyTrace) {
        const response=await fetchLegacyTrace(row.id)
        const trace=typeof response.traceJson==='string'?JSON.parse(response.traceJson):response.traceJson
        return {...row,exportPrice:trace?.result,exportMessage:trace?.error,exportStatus:trace?.error?'ERROR':'READY'}
      }
      return {...row,exportPrice:kind==='linked'?row.manualPrice:row.priceExclTax,exportStatus:'READY'}
    }))
    output.push(...rows)
  }
  return { rows:output, total:page.total }
}
