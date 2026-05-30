import { request } from './http.js'

const COLLABORATE_BASE_URL = '/api/v1/collaborate/bom-supplement'

export const PRODUCT_TYPE_LABELS = {
  BARE: '裸品',
  NON_BARE: '非裸品',
}

export const TASK_TYPE_LABELS = {
  NON_BARE_FULL_BOM: '非裸品完整 BOM 补录',
  BARE_BODY_BOM: '裸品本体 BOM 补录',
  BARE_PACKAGE_REFERENCE: '裸品包装参考选择',
  BARE_BODY_BOM_AND_PACKAGE_REFERENCE: '裸品本体 BOM 补录 + 包装参考选择',
}

export function fetchBomSupplementContext(token) {
  return request(`${COLLABORATE_BASE_URL}/context`, { params: { token } })
}

export function fetchBomPackageReference(params) {
  return request(`${COLLABORATE_BASE_URL}/package-reference`, { params })
}

export function saveBomSupplementDraft(taskId, token, body) {
  return request(`${COLLABORATE_BASE_URL}/${taskId}/save-draft`, {
    method: 'POST',
    params: { token },
    body,
  })
}

export function submitBomSupplement(taskId, token, body) {
  return request(`${COLLABORATE_BASE_URL}/${taskId}/submit`, {
    method: 'POST',
    params: { token },
    body,
  })
}

export function normalizeBomSupplementContext(raw) {
  const context = raw || {}
  const detail = context.detail || {}
  const preparation = detail.preparation || {}
  const task = detail.task || {}
  return {
    ...context,
    taskId: context.taskId ?? task.taskId ?? preparation.taskId ?? null,
    oaNo: context.oaNo || preparation.oaNo || '',
    quoteProductCode: context.quoteProductCode || preparation.quoteProductCode || task.productCode || '',
    taskType: context.taskType || task.taskType || '',
    detail: {
      ...detail,
      task,
      preparation: {
        ...preparation,
        bodyBomLines: toArray(preparation.bodyBomLines),
        packageLines: toArray(preparation.packageLines),
        missingScopes: toArray(preparation.missingScopes),
        gapMessages: toArray(preparation.gapMessages),
      },
      supplementLines: normalizeSupplementLines(detail.supplementLines),
      packageReference: detail.packageReference || null,
      packageLines: normalizePackageLines(detail.packageLines),
    },
  }
}

export function bodyBomNeedsSupplement(context) {
  const preparation = context?.detail?.preparation || {}
  const bodyLines = toArray(preparation.bodyBomLines)
  if (preparation.bodyBomReady && bodyLines.length > 0) {
    return false
  }
  return Boolean(preparation.needTechnicianTask || context?.taskType || context?.detail?.task?.missingBomScope)
}

export function packageReferenceVisible(context) {
  const preparation = context?.detail?.preparation || {}
  const taskType = context?.taskType || context?.detail?.task?.taskType || ''
  return Boolean(preparation.needPackage || taskType.includes('PACKAGE_REFERENCE'))
}

export function createBlankSupplementLine(lineNo = 1) {
  return {
    lineNo,
    level: 1,
    parentCode: '',
    materialCode: '',
    materialName: '',
    materialSpec: '',
    materialModel: '',
    drawingNo: '',
    shapeAttr: '',
    mainCategoryCode: '',
    sourceCategory: 'TECH_SUPPLEMENT',
    costElementCode: '',
    bomPurpose: '',
    bomVersion: '',
    qtyPerParent: null,
    qtyPerTop: null,
    parentBaseQty: null,
    unit: '',
    path: '',
    sortSeq: lineNo,
    remark: '',
  }
}

export function normalizeSupplementLines(lines) {
  return toArray(lines).map((line, index) => ({
    ...createBlankSupplementLine(index + 1),
    ...line,
    lineNo: line?.lineNo ?? index + 1,
    sortSeq: line?.sortSeq ?? line?.lineNo ?? index + 1,
  }))
}

export function normalizePackageLines(lines) {
  return toArray(lines).map((line, index) => {
    const packageMaterialCode = line?.packageChildCode ?? line?.packageMaterialCode ?? ''
    const packageMaterialName = line?.packageChildName ?? line?.packageMaterialName ?? ''
    return {
      ...line,
      rowKey: [
        line?.snapshotId ?? '',
        line?.snapshotDetailId ?? '',
        line?.lineNo ?? index + 1,
        line?.sourceTopProductCode ?? '',
        packageMaterialCode,
      ].join('|'),
      lineNo: line?.lineNo ?? index + 1,
      selected: line?.selected ?? true,
      referenceFinishedCode: line?.referenceFinishedCode || '',
      sourceTopProductCode: line?.sourceTopProductCode || line?.referenceFinishedCode || '',
      packageMaterialCode,
      packageMaterialName,
      packageMaterialSpec: line?.packageChildSpec ?? line?.packageMaterialSpec ?? '',
      packageMaterialModel: line?.packageChildModel ?? line?.packageMaterialModel ?? '',
      packageMaterialDrawingNo: line?.packageChildDrawingNo ?? line?.packageMaterialDrawingNo ?? '',
      packageMaterialMainCategoryCode:
        line?.packageChildMainCategoryCode ?? line?.packageMaterialMainCategoryCode ?? '',
      childQtyPerParent: line?.childQtyPerParent ?? null,
      childQtyPerTop: line?.childQtyPerTop ?? null,
      childParentBaseQty: line?.childParentBaseQty ?? null,
      adjustedPackageQtyPerParent: line?.adjustedPackageQtyPerParent ?? null,
      adjustedPackageQtyPerTop: line?.adjustedPackageQtyPerTop ?? null,
      adjustedPackageParentBaseQty: line?.adjustedPackageParentBaseQty ?? null,
      adjustedChildQtyPerParent: line?.adjustedChildQtyPerParent ?? null,
      adjustedChildQtyPerTop: line?.adjustedChildQtyPerTop ?? null,
      adjustedChildParentBaseQty: line?.adjustedChildParentBaseQty ?? null,
      remark: line?.remark || '',
    }
  })
}

export function buildBomSupplementPayload({ supplementLines, packageReference, packageLines, remark }) {
  return {
    submittedBy: null,
    submittedByName: '',
    remark: trimText(remark),
    supplementLines: normalizeSupplementLines(supplementLines)
      .filter((line) => hasSupplementLineContent(line))
      .map((line, index) => ({
        ...line,
        lineNo: Number(line.lineNo || index + 1),
        level: numberOrNull(line.level),
        sortSeq: numberOrNull(line.sortSeq) ?? Number(line.lineNo || index + 1),
        qtyPerParent: decimalOrNull(line.qtyPerParent),
        qtyPerTop: decimalOrNull(line.qtyPerTop),
        parentBaseQty: decimalOrNull(line.parentBaseQty),
      })),
    packageReference: buildPackageReferencePayload(packageReference, packageLines),
  }
}

function buildPackageReferencePayload(packageReference, packageLines) {
  const reference = packageReference || {}
  const selectedLines = normalizePackageLines(packageLines)
    .filter((line) => line.selected)
    .map((line) => ({
      snapshotId: line.snapshotId ?? null,
      snapshotDetailId: line.snapshotDetailId ?? null,
      lineNo: numberOrNull(line.lineNo),
      selected: true,
      adjustedPackageQtyPerParent: decimalOrNull(line.adjustedPackageQtyPerParent),
      adjustedPackageQtyPerTop: decimalOrNull(line.adjustedPackageQtyPerTop),
      adjustedPackageParentBaseQty: decimalOrNull(line.adjustedPackageParentBaseQty),
      adjustedChildQtyPerParent: decimalOrNull(line.adjustedChildQtyPerParent),
      adjustedChildQtyPerTop: decimalOrNull(line.adjustedChildQtyPerTop),
      adjustedChildParentBaseQty: decimalOrNull(line.adjustedChildParentBaseQty),
      remark: trimText(line.remark),
    }))
  if (!trimText(reference.referenceFinishedCode) && selectedLines.length === 0) {
    return null
  }
  return {
    referenceFinishedCode: trimText(reference.referenceFinishedCode),
    sourceTopProductCode: trimText(reference.sourceTopProductCode) || trimText(reference.referenceFinishedCode),
    periodMonth: trimText(reference.periodMonth),
    selectedLines,
    remark: trimText(reference.remark),
  }
}

export function hasSupplementLineContent(line) {
  return Boolean(
    trimText(line?.materialCode) ||
      trimText(line?.materialName) ||
      trimText(line?.parentCode) ||
      trimText(line?.remark)
  )
}

export function labelForProductType(productType) {
  return PRODUCT_TYPE_LABELS[productType] || productType || '-'
}

export function labelForTaskType(taskType) {
  return TASK_TYPE_LABELS[taskType] || taskType || '-'
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function decimalOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}
