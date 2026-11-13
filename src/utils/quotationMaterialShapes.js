export const isOriginalManufactured = node => ['MANUFACTURE', '制造件', '自制件'].includes(node.sourceMaterialShape)
export const canAdjustMaterialShape = node => Boolean(node.multiPriceSource) &&
  node.shapeResolutionSource !== 'STRUCTURE_ROOT' && (isOriginalManufactured(node) || ['OUTSOURCE', '委外加工件'].includes(node.sourceMaterialShape))
export const materialShapeKey = node => `${node.priceOrgCode}:${node.materialCode}`
export function shapeSelections(nodes, selectedShape) {
  const unique = [...new Map(nodes.map(node => [materialShapeKey(node), node])).values()]
  if (!unique.length || unique.some(node => !canAdjustMaterialShape(node))) throw Error('请选择公共多源价格表中允许调整的物料')
  if (selectedShape === 'MANUFACTURE' && unique.some(node => !isOriginalManufactured(node))) throw Error('原始采购件或委外加工件不能改成制造件')
  return unique.map(node => ({ materialCode: node.materialCode, organization: node.priceOrgCode,
    selectedShape, expectedVersion: node.shapeSelectionVersion || 0 }))
}
