import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connectTableHorizontalScroll } from '../src/utils/tableHorizontalScroll.js'

function fixture() {
  const element = () => Object.assign(new EventTarget(), { style: {}, scrollLeft: 0 })
  const viewport = Object.assign(element(), { clientWidth: 700, scrollWidth: 1500 })
  const bar = element(), spacer = element(), content = element()
  let resized, overflow, disconnected = false
  const observed = []
  const binding = connectTableHorizontalScroll({ viewport, bar, spacer, content,
    onOverflow: value => { overflow = value },
    createObserver: callback => { resized = callback; return { observe: node => observed.push(node), disconnect: () => { disconnected = true } } },
  })
  const scroll = (node, left) => { node.scrollLeft = left; node.dispatchEvent(new Event('scroll')) }
  return { viewport, bar, spacer, content, observed, binding, scroll, resize: () => resized(), overflow: () => overflow, disconnected: () => disconnected }
}

test('upper and original scrollbars move the same columns in both directions', () => {
  const f = fixture()
  assert.equal(f.overflow(), true)
  assert.equal(f.bar.style.width, '700px')
  assert.equal(f.spacer.style.width, '1500px')
  f.scroll(f.bar, 460)
  assert.equal(f.viewport.scrollLeft, 460)
  f.scroll(f.viewport, 215)
  assert.equal(f.bar.scrollLeft, 215)
})

test('width changes hide unnecessary scrolling and restore the correct scroll range', () => {
  const f = fixture()
  assert.deepEqual(f.observed, [f.viewport, f.content])
  f.viewport.clientWidth = 1600; f.resize()
  assert.equal(f.overflow(), false)
  f.viewport.clientWidth = 600; f.viewport.scrollWidth = 2000; f.resize()
  assert.equal(f.overflow(), true)
  assert.equal(f.bar.style.width, '600px')
  assert.equal(f.spacer.style.width, '2000px')
  f.scroll(f.bar, 1900)
  assert.equal(f.viewport.scrollLeft, 1400)
})

test('temporarily hidden tabs preserve the table position for reopening', () => {
  const f = fixture()
  f.scroll(f.viewport, 400)
  f.viewport.clientWidth = 0; f.resize(); f.scroll(f.bar, 0)
  assert.equal(f.overflow(), false)
  assert.equal(f.viewport.scrollLeft, 400)
  f.viewport.clientWidth = 700; f.resize()
  assert.equal(f.overflow(), true)
  assert.equal(f.bar.scrollLeft, 400)
})

test('separate price scenarios keep independent horizontal and vertical positions', () => {
  const finance = fixture(), oa = fixture()
  finance.viewport.scrollTop = 240
  oa.viewport.scrollTop = 80
  finance.scroll(finance.bar, 320)
  oa.scroll(oa.bar, 110)
  assert.equal(finance.viewport.scrollLeft, 320)
  assert.equal(oa.viewport.scrollLeft, 110)
  assert.equal(finance.viewport.scrollTop, 240)
  assert.equal(oa.viewport.scrollTop, 80)
  finance.binding.destroy()
  oa.scroll(oa.viewport, 400)
  assert.equal(oa.bar.scrollLeft, 400)
})

test('leaving or replacing the table releases listeners and ignores pending resize callbacks', () => {
  const f = fixture()
  f.binding.destroy()
  assert.equal(f.disconnected(), true)
  f.scroll(f.bar, 300)
  assert.equal(f.viewport.scrollLeft, 0)
  f.scroll(f.viewport, 500)
  assert.equal(f.bar.scrollLeft, 300)
  f.viewport.clientWidth = 200; f.resize()
  assert.equal(f.bar.style.width, '700px')
})
