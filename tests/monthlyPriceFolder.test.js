import test from 'node:test'
import assert from 'node:assert/strict'
import { folderPath, canCompleteFolder, folderReceiptRows, folderReceiptCsv, folderIssueText } from '../src/components/monthlyPriceFolderUtils.js'

const identity = { orgCode: '210', materialCode: '001234', supplierCode: 'S01', supplierName: '供应商' }
const candidate = (id, signature) => ({ id, signature, fileId: 1, fileName: '主表.xlsx', sheet: '合并联动价表', row: 2, identity, kind: 'LINKED', formula: '=1+2' })
const report = () => ({ status: 'PARTIAL', summary: { pendingFiles: 0, errorRows: 0 },
  groups: [{ status: 'PREPARED', variantCount: 2, candidates: [candidate('a', 'A'), candidate('b', 'A'), candidate('c', 'B'), { ...candidate('saved-a', 'A'), fileId: null, sourceState: 'STAGED' }, { ...candidate('saved-b', 'B'), fileId: null, sourceState: 'STAGED' }] }],
  files: [{ path: '主表.xlsx', kind: 'LINKED', rowCount: 4, notices: [{ sheet: '主表', row: 3, materialCode: 'NO-PRICE', code: 'NO_PRICE', message: '无价跳过' }], errors: [] }] })

test('folder paths retain nested directories and do not depend on root folder name', () => {
  assert.equal(folderPath({ name: '价表.xlsx', webkitRelativePath: '11月/供方/价表.xlsx' }), '供方/价表.xlsx')
  assert.equal(folderPath({ name: '价表.xlsx' }), '价表.xlsx')
})
test('completion requires every file and row to be accounted for', () => {
  const r = report(); assert.equal(canCompleteFolder(r), true)
  r.groups[0].status = 'READY'; assert.equal(canCompleteFolder(r), false)
  r.groups[0].status = 'PREPARED'; r.summary.errorRows = 1; assert.equal(canCompleteFolder(r), false)
  r.summary.errorRows = 0; r.summary.pendingFiles = 1; assert.equal(canCompleteFolder(r), false)
})
test('receipt includes every competing source and every skipped material', () => {
  const rows = folderReceiptRows(report())
  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map(row => row[7]), ['待整体生效', '重复合并', '待整体生效', '无价跳过'])
  assert.equal(rows[3][4], 'NO-PRICE')
  assert.ok(folderReceiptCsv(report()).includes("\"'=1+2\""))
})
test('unreadable files remain unknown and cannot be represented as zero successful rows', () => {
  const r = report(); r.files.push({ path: '坏文件.xlsx', kind: 'ERROR', rowCount: -1, message: '行数未知', notices: [], errors: [] })
  assert.ok(folderReceiptRows(r).some(row => row[0] === '坏文件.xlsx' && row[7] === '未读取'))
})

test('missing finance factors show the source row and actionable month instead of internal batch metadata', () => {
  const message = '物料=301240213，合并联动价表!O9：物料=301240213，缺少财务因素=AVG|下单月宁波宝新SUS301S/BT1.5冷卷出厂价格，来源月=2026-11，批次=65'
  const text = folderIssueText({ message }, '2026-11')
  assert.match(text, /合并联动价表 · 第9行 · 料号 301240213/)
  assert.match(text, /缺少 2026-11 财务基价「下单月宁波宝新SUS301S\/BT1.5冷卷出厂价格」/)
  assert.doesNotMatch(text, /AVG\||批次=|来源月=/)
  assert.match(text, /补齐该项基价后重试/)
})

test('structured error locations take precedence and other failures retain their actual explanation', () => {
  assert.equal(folderIssueText({ sheet: '主表', row: 4, materialCode: '001', message: '公式循环引用' }, '2026-11'),
    '主表 第4行 001：公式循环引用')
  assert.equal(folderIssueText({ message: '文件无法读取，工作簿已损坏' }, '2026-11'), '文件无法读取，工作簿已损坏')
  const text = folderIssueText({ sheet: '主表', row: 10, materialCode: '002', message: '旧表!O9，缺少财务因素=AVG|Cu，批次=65' }, '2026-11')
  assert.match(text, /^主表 · 第10行 · 料号 002：/)
})
