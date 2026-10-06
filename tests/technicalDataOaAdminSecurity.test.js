import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const taskList = readFileSync(new URL('../src/views/technical-data/tasks/index.vue', import.meta.url), 'utf8')
const workbench = readFileSync(new URL('../src/components/technical-data/TechnicalDataProductEditor.vue', import.meta.url), 'utf8')
test('administrator and quotation operator see supplement information without a personal task selector', () => {
  assert.match(taskList, /canViewSupplementOverview/)
  assert.doesNotMatch(taskList, /可管理任务|我的任务|filters\.scope/)
  assert.doesNotMatch(taskList, /saveTechnicalDataProfile|proxyOperatorUserId/)
  assert.match(workbench, /canEditTechnicalModule/)
})
