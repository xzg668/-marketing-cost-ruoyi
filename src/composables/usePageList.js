import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

export function usePageList({ fetchApi, deleteApi, buildParams = () => ({}) }) {
  const loading = ref(false)
  const tableRows = ref([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)

  const fetchList = async () => {
    loading.value = true
    try {
      const params = {
        page: currentPage.value,
        pageSize: pageSize.value,
        ...buildParams()
      }
      const res = await fetchApi(params)
      if (res && res.records) {
        tableRows.value = res.records
        total.value = res.total || 0
      } else if (Array.isArray(res)) {
        tableRows.value = res
        total.value = res.length
      }
    } catch (e) {
      ElMessage.error(e.message || '加载失败')
    } finally {
      loading.value = false
    }
  }

  const applyFilters = () => {
    currentPage.value = 1
    fetchList()
  }

  const resetFilters = (filterObj) => {
    if (filterObj && typeof filterObj === 'object') {
      Object.keys(filterObj).forEach((key) => {
        filterObj[key] = ''
      })
    }
    applyFilters()
  }

  const removeRow = async (id, confirmMsg = '确认删除该记录？') => {
    if (!deleteApi) return
    try {
      await ElMessageBox.confirm(confirmMsg, '提示', { type: 'warning' })
      await deleteApi(id)
      ElMessage.success('删除成功')
      fetchList()
    } catch (e) {
      if (e !== 'cancel') {
        ElMessage.error(e.message || '删除失败')
      }
    }
  }

  const handlePageChange = (page) => {
    currentPage.value = page
    fetchList()
  }

  const handleSizeChange = (size) => {
    pageSize.value = size
    currentPage.value = 1
    fetchList()
  }

  return {
    loading,
    tableRows,
    total,
    currentPage,
    pageSize,
    fetchList,
    applyFilters,
    resetFilters,
    removeRow,
    handlePageChange,
    handleSizeChange
  }
}
