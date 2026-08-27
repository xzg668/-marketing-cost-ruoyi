import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildElectronicDrawingMappingSelections,
  mergeElectronicDrawingMaterialOptions,
  pendingElectronicDrawingMappings,
  validateElectronicDrawingExcelFile,
} from '../src/utils/electronicDrawingExcelImport.js'

const api = readFileSync(new URL('../src/api/technicalCollaborationTasks.js', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/components/ElectronicDrawingExcelImportPanel.vue', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/TechnicalBomDraftWorkspace.vue', import.meta.url), 'utf8')

test('formal electronic drawing upload accepts only xlsx within 10 MB', () => {
  assert.equal(validateElectronicDrawingExcelFile({ name: 'formal.xlsx', size: 1024 }), '')
  assert.equal(validateElectronicDrawingExcelFile({ name: 'formal.xls', size: 1024 }), '请选择电子图库下载的 .xlsx 文件')
  assert.equal(validateElectronicDrawingExcelFile({ name: 'formal.xlsx', size: 10 * 1024 * 1024 + 1 }), '电子图库 Excel 不能超过 10 MB')
})

test('pending mapping list never treats auto matches as manual work', () => {
  const rows = [
    { nodeId: 'N1', status: 'AUTO_MATCHED' },
    { nodeId: 'N2', status: 'UNMATCHED' },
    { nodeId: 'N3', status: 'AMBIGUOUS' },
    { nodeId: 'N4', status: 'CONFIRMED' },
  ]
  assert.deepEqual(pendingElectronicDrawingMappings(rows).map(row => row.nodeId), ['N2', 'N3'])
  assert.deepEqual(buildElectronicDrawingMappingSelections(rows, {
    N1: '1001', N2: ' 2002 ', N3: '', N4: '4004',
  }), [{ nodeId: 'N2', materialCode: '2002' }])
})

test('material option merge keeps one current-organization option per formal code', () => {
  const first = { materialCode: '1001', materialName: '旧显示' }
  const current = { materialCode: '1001', materialName: '当前显示' }
  const second = { materialCode: '1002', materialName: '第二条' }
  assert.deepEqual(mergeElectronicDrawingMaterialOptions([first], [current, second]), [current, second])
})

test('API contract uses multipart upload, server state recovery, current-org search and versioned mapping save', () => {
  assert.match(api, /uploadTechnicalElectronicBomExcel/)
  assert.match(api, /new FormData\(\)/)
  assert.match(api, /form\.append\('file', file\)/)
  assert.match(api, /params: \{ expectedVersion \}/)
  assert.match(api, /electronic-bom\/import-result/)
  assert.match(api, /electronic-bom\/material-options/)
  assert.match(api, /electronic-bom\/mappings/)
  assert.match(api, /method: 'PUT', body: \{ expectedVersion, selections \}/)
  assert.match(api, /electronic-bom\/import\/confirm/)
  assert.match(panel, /确认此 BOM 并检查价格/)
  assert.match(panel, /confirmTechnicalElectronicBomImport/)
})

test('technical workspace exposes upload, explicit ambiguity handling and refresh recovery without browser cache', () => {
  assert.match(workspace, /ElectronicDrawingExcelImportPanel/)
  assert.match(workspace, /ELECTRONIC_DRAWING_EXCEL/)
  assert.match(panel, /电子图库正式 Excel/)
  assert.match(panel, /系统不会在多个候选中擅自选第一条/)
  assert.match(panel, /fetchTechnicalElectronicBomImportResult/)
  assert.match(panel, /watch\(\(\) => \[props\.taskId, props\.taskVersion\], loadResult, \{ immediate: true \}\)/)
  assert.match(panel, /defineExpose\(\{ refresh: loadResult \}\)/)
  assert.match(workspace, /ref="electronicImportPanel"/)
  assert.match(workspace, /electronicImportPanel\.value\?\.refresh\(\)/)
  assert.match(panel, /applyTechnicalElectronicBomMappings/)
  assert.match(panel, /sourceRowNumber/)
  assert.match(panel, /drawingCode/)
  assert.doesNotMatch(panel, /localStorage|sessionStorage/)
})
