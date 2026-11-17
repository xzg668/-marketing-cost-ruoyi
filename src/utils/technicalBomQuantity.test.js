import test from 'node:test'
import assert from 'node:assert/strict'
import { technicalBomQuantity } from './technicalBomQuantity.js'

test('reference quantities retain zero and exact decimal digits from Java BigDecimal', () => {
  assert.equal(technicalBomQuantity('0E-8'), '0.00000000')
  assert.equal(technicalBomQuantity('1.234567890123456789E-3'), '0.001234567890123456789')
  assert.equal(technicalBomQuantity('1.25E+3'), '1250')
  assert.equal(technicalBomQuantity('123456789012345678901234'), '123456789012345678901234')
  assert.equal(technicalBomQuantity(null), '')
})
