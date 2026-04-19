import { defineStore } from 'pinia'
import { ref } from 'vue'

const COLLAPSE_KEY = 'sidebarCollapsed'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed.value ? '1' : '0')
  }

  return { sidebarCollapsed, toggleSidebar }
})
