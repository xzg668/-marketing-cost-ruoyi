import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createWorkbook } from '../src/utils/workbookTransfer.js'
import { workbookDefinitions } from '../src/utils/workbookCatalog.js'
import { inquiryTemplateRows } from '../src/utils/inquiryWorkbook.js'

for (const template of [true, false]) test(`${template ? '模板' : '导出'}保留无编码询价、公式及区间`, () => {
  const input = inquiryTemplateRows()
  input[1].source.rule.compiled.expression = '(([factor_0])*0.02+1)/1.13'
  const book = createWorkbook(XLSX, workbookDefinitions.inquiry, input, template)
  const restored = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellFormula: true })
  const rows = XLSX.utils.sheet_to_json(restored.Sheets['询价'], { defval: '' })
  assert.equal(rows.length, 5)
  for (const row of rows) for (const name of ['料号', '供方名称', '供应商代码']) assert.equal(row[name], '')
  assert.deepEqual(rows.slice(2).map(row => [row['区间下限'], row['区间上限'], row['区间单价(元)']]),
    [[90000, 100000, 2], [100000, 110000, 2.4], [110000, '', 2.8]])
  assert.ok(restored.Sheets['询价'].H3.f.includes("'影响因素'!$B$2"))
  assert.doesNotMatch(restored.Sheets['询价'].H3.f, /\[|\]/)
  assert.deepEqual(rows.slice(2).map(row => row['行情因素']), Array(3).fill('1#电解铜'))
  assert.equal(restored.Sheets['影响因素'].A2.v, '1#电解铜')
  assert.equal(restored.Sheets['影响因素'].B2.v, 90)
})

test('询价导出保留已保存的行情因素标识，便于原样重导', () => {
  const saved = inquiryTemplateRows().at(-1)
  saved.source.rule.range.factorKey = 'AVG|1#CU'
  const book = createWorkbook(XLSX, workbookDefinitions.inquiry, [saved])
  const rows = XLSX.utils.sheet_to_json(book.Sheets['询价'])
  assert.deepEqual(rows.map(row => row['行情因素']), Array(3).fill('AVG|1#CU'))
})

test('询价填写说明给出财务全称及能逐格照填的区间示例', () => {
  const create = template => XLSX.utils.sheet_to_json(
    createWorkbook(XLSX, workbookDefinitions.inquiry, [], template).Sheets['填写说明'],
    { header: 1, defval: '' })
  const instructions = create(true)
  const factors = ['1#电解铜', '1#锌', 'A00铝', 'H65黄铜边料', '美国柜装黄铜']
  for (const factor of factors) {
    assert.ok(instructions.some(row => row[1] === factor), `缺少目录全称 ${factor}`)
  }
  assert.deepEqual(instructions.find(row => row[0] === '铜价第2档'),
    ['铜价第2档', 'M 填 100000，N 填 110000', 'O 填 2.4'])
  assert.deepEqual(instructions.find(row => row[0] === '锌价第2档'),
    ['锌价第2档', 'M 填 30，N 留空', 'O 填 1.65'])
  assert.match(instructions.find(row => row[0] === '未命中当月行情')[1], /基价.*区间/)
  assert.equal(create(false).some(row => row[0] === '铜价第2档'), false)
})
