import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('../src/api/financeCollaborationReviews.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/views/collaboration/finance/index.vue', import.meta.url), 'utf8')
const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')

test('QCBP-19 finance review uses only current-user scoped real APIs', () => {
  assert.match(api, /finance-reviews\/mine/)
  assert.match(api, /finance-reviews\/\$\{id\(reviewId\)\}/)
  assert.match(api, /items\/\$\{id\(reviewItemId\)\}/)
  assert.match(api, /decision/)
  assert.match(api, /retry-recheck/)
  assert.doesNotMatch(api, /userId|businessUnitType|reviewerUserId/)
  assert.match(api, /suppressErrorToast:\s*true/)
  assert.match(api, /finance-reviews\/\$\{id\(reviewId\)\}`,[^\n]*suppressErrorToast:\s*true/)
})

test('finance page renders one explicit access state instead of duplicate error toasts or a false empty state', () => {
  assert.match(page, /当前账号没有补录审核权限/)
  assert.match(page, /管理员账号不能代替财务审核人/)
  assert.match(page, /isDomainError\(error, 'TASK_ASSIGNEE_MISMATCH'\)/)
  assert.match(page, /showErrorOnce\(error, '审核清单加载失败'\)/)
  assert.doesNotMatch(page, /ElMessage\.error\(error\.message/)
})

test('left item selection reloads the matching right-side server detail', () => {
  assert.match(page, /@click="selectItem\(item\.reviewItemId\)"/)
  assert.match(page, /fetchFinanceReviewItem\(activeReviewId\.value, itemId\)/)
  assert.match(page, /item\.summary/)
  assert.match(page, /activeItem\.productCode/)
  assert.match(page, /本次补价与参考价格对比/)
  assert.match(page, /技术本次填写/)
  assert.match(page, /系统校验结论/)
  assert.doesNotMatch(page, /试算金额|成本试算|差异百分比/)
})

test('finance page exposes one state-valid final action and explicit retry semantics', () => {
  assert.match(page, /审核通过并生效/)
  assert.match(page, /退回技术修改/)
  assert.match(page, /重试重新取价/)
  assert.match(page, /重试不会重复发布/)
  assert.match(page, /canRetryRecheck/)
  assert.match(page, /item\.taskStatus/)
  assert.match(page, /PUBLISH_OR_REPRICE_FAILED/)
  assert.match(page, /发现缺价，已退回技术/)
  assert.match(page, /技术重新提交后会生成新一轮审核/)
  assert.match(page, /inputErrorMessage: '退回原因不能为空'/)
  assert.doesNotMatch(page, /localStorage|演示|模拟数据/)
})

test('finance future deep link and menu component point to the same production page', () => {
  assert.match(router, /path: '\/collaboration\/finance-reviews\/:reviewId'/)
  assert.match(router, /views\/collaboration\/finance\/index\.vue/)
  assert.match(router, /activeMenu: '\/collaboration\/finance-reviews'/)
  assert.match(page, /loadReviews\(resolveDeepLink = false\)/)
  assert.match(page, /\['PENDING', 'PARTIAL'\]\.includes\(requestedDetail\.status\)/)
  assert.match(page, /onMounted\(\(\) => loadReviews\(true\)\)/)
})
