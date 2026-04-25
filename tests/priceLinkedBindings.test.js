import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T6：行局部变量绑定前端改造的静态契约测试。
 *
 * <p>node --test 不拉 JSDOM，走"读源文件 + 正则断言"的轻量契约校验：
 * <ul>
 *   <li>api/priceLinkedBindings.js 的 6 个方法与后端 controller 路由对齐</li>
 *   <li>components/PriceLinkedBindingDrawer.vue 有表格 / 编辑弹窗 / 历史 / 来源徽章</li>
 *   <li>pages/PriceLinkedResultPage.vue 已接线：徽章 + CSV 按钮 + 行按钮 + drawer + pending 拉取</li>
 * </ul>
 */

const readFile = (relativePath) =>
  fs.readFileSync(
    path.resolve(import.meta.dirname, '..', relativePath),
    'utf-8',
  )

// ============================ api/priceLinkedBindings.js ============================
describe('api/priceLinkedBindings.js', () => {
  const src = readFile('src/api/priceLinkedBindings.js')

  it('导出 fetchBindings 并打 GET /api/v1/price-linked/bindings', () => {
    assert.match(src, /export\s+const\s+fetchBindings\b/)
    assert.match(src, /['"]\/api\/v1\/price-linked\/bindings['"]/)
    // 必须带 linkedItemId 作为 params
    assert.match(src, /params:\s*\{\s*linkedItemId\s*\}/)
  })

  it('导出 fetchHistory 并打 /bindings/history', () => {
    assert.match(src, /export\s+const\s+fetchHistory\b/)
    assert.match(src, /\/bindings\/history/)
    assert.match(src, /linkedItemId[\s\S]*?tokenName/)
  })

  it('导出 saveBinding 走 POST', () => {
    assert.match(src, /export\s+const\s+saveBinding\b/)
    assert.match(
      src,
      /saveBinding[\s\S]*?method:\s*['"]POST['"]/,
    )
  })

  it('导出 deleteBinding 走 DELETE /{id}', () => {
    assert.match(src, /export\s+const\s+deleteBinding\b/)
    assert.match(src, /\/api\/v1\/price-linked\/bindings\/\$\{id\}/)
    assert.match(src, /method:\s*['"]DELETE['"]/)
  })

  it('导出 fetchPending 并打 /bindings/pending', () => {
    assert.match(src, /export\s+const\s+fetchPending\b/)
    assert.match(src, /\/bindings\/pending/)
  })

  it('导出 importBindings 走 POST /import + FormData field=file', () => {
    assert.match(src, /export\s+const\s+importBindings\b/)
    assert.match(src, /\/bindings\/import/)
    assert.match(src, /form\.append\(['"]file['"]/)
    assert.match(src, /new\s+FormData\(\)/)
  })
})

// ============================ components/PriceLinkedBindingDrawer.vue ============================
describe('components/PriceLinkedBindingDrawer.vue', () => {
  const src = readFile('src/components/PriceLinkedBindingDrawer.vue')

  it('使用 el-drawer 右侧抽屉 + v-model:visible', () => {
    assert.match(src, /<el-drawer[\s\S]{0,400}v-model="visibleModel"/)
    assert.match(src, /direction="rtl"/)
  })

  it('导入 api/priceLinkedBindings 的四个方法', () => {
    assert.match(src, /fetchBindings/)
    assert.match(src, /fetchHistory/)
    assert.match(src, /saveBinding/)
    assert.match(src, /deleteBinding/)
  })

  it('导入 fetchCatalog 用于影响因素下拉', () => {
    assert.match(src, /fetchCatalog/)
    assert.match(src, /from\s+['"]\.\.\/api\/priceVariables['"]/)
  })

  it('表格展示 token / 影响因素 / 价源 / 来源 / 生效日期', () => {
    assert.match(src, /label="Token"/)
    assert.match(src, /label="影响因素"/)
    assert.match(src, /label="价源"/)
    assert.match(src, /label="来源"/)
    assert.match(src, /label="生效日期"/)
  })

  it('来源徽章三态：EXCEL_INFERRED=danger / SUPPLY_CONFIRMED=success / MANUAL=primary', () => {
    // 核心分支出现在 sourceTagType 里
    assert.match(src, /EXCEL_INFERRED['"]?\s*:\s*\n?\s*return\s*['"]danger/)
    assert.match(
      src,
      /SUPPLY_CONFIRMED['"]?\s*:\s*\n?\s*return\s*['"]success/,
    )
    assert.match(src, /MANUAL['"]?\s*:\s*\n?\s*return\s*['"]primary/)
  })

  it('B 组 token 四个选项硬编码（与后端 VALID_TOKEN_NAMES 对齐）', () => {
    assert.match(src, /材料含税价格/)
    assert.match(src, /材料价格/)
    assert.match(src, /废料含税价格/)
    assert.match(src, /废料价格/)
  })

  it('新增 / 编辑 弹窗有 effectiveDate + priceSource + factorCode 字段', () => {
    assert.match(src, /effectiveDate/)
    assert.match(src, /priceSource/)
    assert.match(src, /factorCode/)
    assert.match(src, /label="生效日期"/)
  })

  it('删除前有 ElMessageBox.confirm 二次确认', () => {
    assert.match(src, /ElMessageBox\.confirm/)
  })

  it('支持历史时间线：openHistory 调 fetchHistory(row.id, tokenName)', () => {
    assert.match(
      src,
      /const\s+openHistory\s*=[\s\S]*?fetchHistory\(\s*props\.row\.id\s*,\s*tokenName\s*\)/,
    )
  })

  it('editingId 存在时 Token 下拉禁用（防止改 key 触发冲突）', () => {
    assert.match(src, /:disabled="!!editingId"/)
  })
})

// ============================ pages/PriceLinkedResultPage.vue ============================
describe('PriceLinkedResultPage.vue T6 改造', () => {
  const src = readFile('src/pages/PriceLinkedResultPage.vue')

  it('导入 PriceLinkedBindingDrawer 组件', () => {
    assert.match(
      src,
      /import\s+PriceLinkedBindingDrawer\s+from\s+['"]\.\.\/components\/PriceLinkedBindingDrawer\.vue['"]/,
    )
  })

  it('导入 fetchPending / importBindings', () => {
    assert.match(
      src,
      /import\s*\{[^}]*fetchPending[^}]*importBindings[^}]*\}\s*from\s*['"]\.\.\/api\/priceLinkedBindings['"]/s,
    )
  })

  it('模板中包含 PriceLinkedBindingDrawer 绑定 visible + row', () => {
    assert.match(
      src,
      /<PriceLinkedBindingDrawer[\s\S]{0,200}v-model:visible="bindingDrawerVisible"[\s\S]{0,200}:row="bindingRow"/,
    )
  })

  it('顶部徽章展示"待绑定 N"并可点击', () => {
    assert.match(src, /待绑定\s*\{\{\s*pendingTotal\s*\}\}/)
    assert.match(src, /@click="openPendingList"/)
  })

  it('绑定 CSV 导入按钮走 handleBindingCsvChange', () => {
    assert.match(src, /绑定\s*CSV/)
    // el-upload 用 :on-change 绑定，不是 @change
    assert.match(src, /:on-change="handleBindingCsvChange"/)
  })

  it('handleBindingCsvChange 调 importBindings + 刷新 loadPending', () => {
    assert.match(
      src,
      /const\s+handleBindingCsvChange\s*=\s*async[\s\S]*?importBindings\(/,
    )
    assert.match(
      src,
      /handleBindingCsvChange[\s\S]*?loadPending\(\)/,
    )
  })

  it('表格行新增"变量绑定"按钮，点击打开 openBinding(row)', () => {
    assert.match(src, /变量绑定/)
    assert.match(src, /@click="openBinding\(row\)"/)
  })

  it('derivedRows 计算 unbound 标记（pendingItemIds 命中）', () => {
    assert.match(src, /pendingItemIds\.value\.has\(row\.id\)/)
    assert.match(src, /unbound/)
  })

  it('onBindingChanged 回调触发 loadPending 刷新徽章', () => {
    assert.match(
      src,
      /const\s+onBindingChanged\s*=[\s\S]*?loadPending\(\)/,
    )
    assert.match(src, /@changed="onBindingChanged"/)
  })

  it('onMounted(loadPending) 首屏拉取 pending', () => {
    assert.match(src, /onMounted\(loadPending\)/)
  })

  it('loadPending 失败时不打扰（徽章归零即可）', () => {
    // 不调用 ElMessage.error，catch 里把 pendingTotal 归 0
    assert.match(
      src,
      /const\s+loadPending\s*=\s*async[\s\S]*?catch[\s\S]*?pendingTotal\.value\s*=\s*0/,
    )
  })
})
