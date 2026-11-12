import { onScopeDispose, ref, watch } from 'vue'

// Use the existing classified detail results; a pending product alone does not imply three gaps.
export function useCostingGapAvailability(oaNo, pendingCount, revision, fetchDetails) {
  const counts = ref({}), details = ref({}), error = ref('')
  let generation = 0
  async function refresh() {
    const id = ++generation, number = oaNo.value
    counts.value = {}; details.value = {}; error.value = ''
    if (!number || !pendingCount.value) return
    const categories = ['RATIO', 'PRICE', 'OTHER']
    const results = await Promise.allSettled(categories.map(category => fetchDetails(number, category)))
    if (id !== generation || number !== oaNo.value) return
    const nextCounts = {}, nextDetails = {}, failures = []
    results.forEach((result, index) => {
      const category = categories[index]
      if (result.status === 'fulfilled') {
        const records = result.value?.records || []
        nextCounts[category] = Number(result.value?.materialCount ?? records.length)
        nextDetails[category] = records
      } else failures.push(result.reason?.message || '缺口状态读取失败，请刷新重试')
    })
    counts.value = nextCounts; details.value = nextDetails; error.value = [...new Set(failures)].join('；')
  }
  watch([oaNo, pendingCount, revision], refresh, { immediate: true })
  onScopeDispose(() => { generation++ })
  return { counts, details, error, refresh }
}
