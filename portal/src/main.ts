import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import '@toolforge/shared/theme.css'
import './app.css'
import App from './App.vue'

registerSW({ immediate: true })

createApp(App).mount('#app')
