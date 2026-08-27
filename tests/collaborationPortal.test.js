import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  captureCollaborationPortalToken,
  clearCollaborationPortalToken,
  collaborationRequestHeaders,
  getCollaborationPortalToken,
  hasCollaborationPortalSession,
} from '../src/utils/collaborationPortal.js'

const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../src/layout/CollaborateLayout.vue', import.meta.url), 'utf8')
const http = readFileSync(new URL('../src/api/http.js', import.meta.url), 'utf8')
const taskPage = readFileSync(new URL('../src/pages/TechnicalCollaborationTaskPage.vue', import.meta.url), 'utf8')

test('OA fragment token is stored only in the current tab and removed from address bar', () => {
  const values = new Map()
  const replaced = []
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { pathname: '/collaborate/tasks', search: '?source=oa', hash: '#access_token=secret-1' },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
  })
  Object.defineProperty(globalThis, 'history', {
    configurable: true,
    value: { state: null, replaceState: (...args) => replaced.push(args) },
  })

  assert.equal(captureCollaborationPortalToken(), 'secret-1')
  assert.equal(getCollaborationPortalToken(), 'secret-1')
  assert.equal(hasCollaborationPortalSession(), true)
  assert.deepEqual(collaborationRequestHeaders(), { 'X-Collaboration-Token': 'secret-1' })
  assert.equal(replaced[0][2], '/collaborate/tasks?source=oa')
  clearCollaborationPortalToken()
  assert.equal(getCollaborationPortalToken(), '')
  assert.equal(hasCollaborationPortalSession(), false)
})

test('restricted portal exposes only one collaboration task menu and reuses the formal workbench', () => {
  assert.match(router, /path: 'tasks'[\s\S]*collaboration\/technical\/index\.vue/)
  assert.match(router, /path: 'product-tasks\/:taskId'[\s\S]*TechnicalCollaborationTaskPage\.vue/)
  assert.match(router, /collaborationPortal: true/)
  assert.match(router, /hasCollaborationPortalSession\(\)[\s\S]*!to\.meta\?\.collaborationPortal/)
  assert.match(layout, /el-menu-item index="\/collaborate\/tasks"/)
  assert.match(layout, /<span>协作任务<\/span>/)
  assert.doesNotMatch(layout, /报价管理|成本核算|系统管理/)
  assert.match(layout, /协作链接无效/)
  assert.match(layout, /captureCollaborationPortalToken/)
  assert.match(http, /X-Collaboration-Token/)
  assert.match(taskPage, /\/collaborate\/tasks/)
})
