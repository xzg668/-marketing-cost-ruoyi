// First release and the current calculation/check are independent facts.
export function monthlyRepricePublication(view) {
  const batch = view?.batch
  const successful = batch?.successCount ?? 0
  const uncalculated = Math.max(0, (batch?.totalCount ?? 0) - successful)
  const unresolved = batch?.unresolvedSourceCount ?? 0
  const released = Boolean(batch?.confirmedAt)
  const allDone = released && batch?.status === 'CONFIRMED' && successful > 0 && uncalculated === 0 && unresolved === 0
  const canCheck = successful > 0 && ['FAILED', 'RUNNING'].includes(batch?.status)
  const canConfirm = successful > 0 && batch?.status === 'WAIT_CONFIRM' && batch?.checkStatus === 'PASSED'
    && batch.checkedRevision != null && batch.checkedRevision === batch.resultRevision
  return { successful, uncalculated, unresolved, released, allDone, canCheck, canConfirm,
    releaseLabel: allDone ? '本月调价已完成' : '已确认成功结果，可继续报价',
    confirmLabel: released ? '确认本次补算结果' : '确认成功结果并恢复报价',
  }
}
