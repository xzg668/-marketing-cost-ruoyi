import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { computed, ref, reactive, watch, nextTick } from 'vue'
const source = fs.readFileSync(new URL('../src/components/MaterialSpecialPricePanel.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function panel(api = {}) {
  const user = reactive({ permissions: ['base:material-price-type:edit'], businessUnitType: 'COMMERCIAL' })
  const bindings = { computed, ref, watch, onMounted() {}, onBeforeUnmount() {}, useUserStore: () => user, ElMessage: { success() {} }, fetchSpecialPriceRules: async () => [], findSpecialPriceMaterial: async () => [], saveSpecialPriceRule: async () => true, ...api }
  return { user, ...new Function(...Object.keys(bindings), `${source}; return { load, edit, lookup, save, rows, form, opened, error, editError, saving }`)(...Object.values(bindings)) }
}
test('迟到的旧查询不能覆盖新筛选结果', async () => {
  const first = pending(), second = pending(); let call = 0
  const p = panel({ fetchSpecialPriceRules: () => (++call === 1 ? first.promise : second.promise) })
  const a = p.load(), b = p.load(); second.resolve([{ materialCode: '339950198' }]); await b
  first.resolve([{ materialCode: '201851022' }]); await a
  assert.equal(p.rows.value[0].materialCode, '339950198')
})
test('改料号后迟到的档案不能填入新物料', async () => {
  const master = pending(); const p = panel({ findSpecialPriceMaterial: () => master.promise })
  p.edit(); p.form.value.materialCode = '201851022'; const reading = p.lookup(); p.form.value.materialCode = '339950198'
  master.resolve([{ materialName: '调理芯片', materialModel: 'SNU529W' }]); await reading
  assert.equal(p.form.value.materialName, '')
})
test('档案型号为空时保持为空，规格正常带出', async () => {
  const p = panel({ findSpecialPriceMaterial: async () => [{ materialName: '信号调理芯片', materialSpec: 'SNU501', materialModel: null }] })
  p.edit(); p.form.value.materialCode = '339950198'; await p.lookup()
  assert.equal(p.form.value.materialModel, ''); assert.equal(p.form.value.materialSpec, 'SNU501')
})
test('保存中重复点击只提交一次，业务单元切换清理旧配置', async () => {
  const response = pending(); let saves = 0
  const p = panel({ saveSpecialPriceRule: () => { ++saves; return response.promise } })
  p.edit(); p.form.value.materialCode = '201851022'; const a = p.save(); await p.save(); assert.equal(saves, 1)
  p.user.businessUnitType = 'HOUSEHOLD'; await nextTick(); assert.equal(p.opened.value, false); assert.equal(p.rows.value.length, 0)
  response.resolve(true); await a; assert.equal(p.saving.value, false)
})
test('只有查看权限不能提交配置', async () => {
  let saves = 0; const p = panel({ saveSpecialPriceRule: async () => { ++saves } })
  p.user.permissions = ['base:material-price-type:list']; p.edit(); p.form.value.materialCode = '201851022'; await p.save()
  assert.equal(saves, 0)
})
