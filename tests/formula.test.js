import assert from 'node:assert/strict'
import test from 'node:test'
import { toCodeExpr } from '../src/utils/formula.js'

test('toCodeExpr converts chinese variables to codes', () => {
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
