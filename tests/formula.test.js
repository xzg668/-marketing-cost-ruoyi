import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFormulaIndex, toCodeExpr } from '../src/utils/formula.js'

test('toCodeExpr converts chinese variables to codes', () => {
  // 老调用点：扁平 code→name map（不带 [code] 包装），保持向后兼容
  const variables = {
    Cu: '铜基价',
    Zn: '锌基价',
    blank_weight: '毛坯定额单重(g)',
    process_fee: '毛坯锻造加工费',
    us_brass_price: '美国柜装黄铜价格',
  }
  const expr =
    '（铜基价*0.15+锌基价*0.1+美国柜装黄铜价格*0.75*1.05）*1.02+0.1+毛坯锻造加工费'
  const encoded = toCodeExpr(expr, variables)
  assert.equal(
    encoded,
    '(Cu*0.15+Zn*0.1+us_brass_price*0.75*1.05)*1.02+0.1+process_fee',
  )
})

// 构造 index：模拟后端 /price-linked/variables 返回的格式
const buildTestIndex = () =>
  buildFormulaIndex({
    variables: [
      { variableCode: 'Cu', variableName: '电解铜' },
      { variableCode: 'Ag', variableName: '电解银' },
      { variableCode: 'In', variableName: '精铟' },
      { variableCode: 'Pcu', variableName: '磷铜合金' },
      { variableCode: 'Sn', variableName: '不锈钢基价' },
      { variableCode: 'Zn', variableName: '锌基价' },
      { variableCode: 'Mn', variableName: '锰基价' },
      { variableCode: 'process_fee', variableName: '加工费' },
    ],
  })

test('toCodeExpr (index): 中文别名通路不破', () => {
  const out = toCodeExpr('电解铜+加工费', buildTestIndex())
  assert.equal(out, '[Cu]+[process_fee]')
})

test('toCodeExpr (index): 裸 code 也能识别', () => {
  const out = toCodeExpr('Cu+加工费', buildTestIndex())
  assert.equal(out, '[Cu]+[process_fee]')
})

test('toCodeExpr (index): 已规范的 [code] 形式不被二次包装', () => {
  const out = toCodeExpr('[Cu]+[process_fee]', buildTestIndex())
  assert.equal(out, '[Cu]+[process_fee]')
})

test('toCodeExpr (index): Pcu 不被 Cu 误伤（最长匹配 + word boundary）', () => {
  const out = toCodeExpr('Pcu*0.4867+Cu*0.5+加工费', buildTestIndex())
  assert.equal(out, '[Pcu]*0.4867+[Cu]*0.5+[process_fee]')
})

test('toCodeExpr (index): 完整混合形式（裸 code + 系数 + 中文）', () => {
  const out = toCodeExpr(
    'Ag*0.012+Cu*0.5+In*0.0013+Pcu*0.4867+加工费',
    buildTestIndex(),
  )
  assert.equal(
    out,
    '[Ag]*0.012+[Cu]*0.5+[In]*0.0013+[Pcu]*0.4867+[process_fee]',
  )
})

test('toCodeExpr (index): 部分已包装 + 部分裸 code 共存', () => {
  const out = toCodeExpr('[Cu]*0.5+Ag*0.012', buildTestIndex())
  assert.equal(out, '[Cu]*0.5+[Ag]*0.012')
})
