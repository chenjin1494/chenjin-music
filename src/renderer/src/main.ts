import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import './appearance.css'
import './soft-ui.css'
createApp(App).use(createPinia()).mount('#app')
