export const classificationScope = (oaNo, itemId, month) => JSON.stringify([oaNo, String(itemId), month])
export const canConfirmClassification = (preview, file, scope, currentScope) => Boolean(file && preview?.valid && preview.fingerprint && scope === currentScope)

export async function downloadAuthenticatedBlob(path, filename, { isCurrent = () => true, signal } = {}) {
  const active = () => !signal?.aborted && isCurrent()
  if (!active()) return false
  const response = await fetch((import.meta.env.VITE_API_BASE_URL || '') + path, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    signal,
  })
  if (!active()) return false
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || contentType.includes('json')) {
    let message = '下载文件失败'
    try { message = (await response.json()).msg || message } catch { /* 非 JSON 错误保留下载上下文。 */ }
    if (!active()) return false
    throw new Error(message)
  }
  const blob = await response.blob()
  if (!active()) return false
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    if (!active()) return false
    link.click()
    return true
  } finally { URL.revokeObjectURL(url) }
}
