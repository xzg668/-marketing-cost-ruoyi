import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import pinia from './store'
import hasPermi from './directive/hasPermi'
import hasRole from './directive/hasRole'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.directive('hasPermi', hasPermi)
app.directive('hasRole', hasRole)
app.mount('#app')
