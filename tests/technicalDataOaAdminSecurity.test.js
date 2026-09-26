import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('../src/api/technicalDataTasks.js', import.meta.url), 'utf8')
const http = readFileSync(new URL('../src/api/http.js', import.meta.url), 'utf8')
const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const taskList = readFileSync(new URL('../src/views/technical-data/tasks/index.vue', import.meta.url), 'utf8')
const workbench = readFileSync(new URL('../src/components/technical-data/TechnicalDataProductEditor.vue', import.meta.url), 'utf8')
const ticketPage = readFileSync(new URL('../src/pages/TechnicalDataAccessTicketPage.vue', import.meta.url), 'utf8')

test('administrator and quotation operator see supplement information without a personal task selector', () => {
  assert.match(taskList, /canViewSupplementOverview/)
  assert.doesNotMatch(taskList, /可管理任务|我的任务|filters\.scope/)
  assert.doesNotMatch(taskList, /saveTechnicalDataProfile|proxyOperatorUserId/)
  assert.match(workbench, /canEditTechnicalModule/)
})

test('T12 one-time ticket exchanges into a session-scoped task route', () => {
  assert.match(api, /access-tickets\/exchange/)
  assert.match(api, /skipAuth:\s*true/)
  assert.match(ticketPage, /technicalDataAccessToken/)
  assert.match(ticketPage, /technicalDataAccessTaskId/)
  assert.match(router, /path:\s*'\/technical-data-access'/)
  assert.match(router, /technicalDataShortSession:\s*true/)
  assert.match(router, /String\(to\.params\.taskId\) !== scopedTaskId/)
  assert.match(http, /window\.location\.pathname\.startsWith\('\/technical-data-access'\)/)
  assert.match(http, /sessionStorage\.getItem\('technicalDataAccessToken'\)/)
})

test('short ticket is never persisted as the normal reusable login token', () => {
  assert.doesNotMatch(ticketPage, /localStorage\.setItem/)
  assert.match(ticketPage, /sessionStorage\.setItem/)
  assert.doesNotMatch(api, /lp_collaboration_token|X-Collaboration-Token/)
})
