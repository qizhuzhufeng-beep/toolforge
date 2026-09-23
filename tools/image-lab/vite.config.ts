import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 与 CI 约定对齐：VITE_BASE 是部署根（缺省 '/'），工具固定挂在 tools/<id>/ 下
const root = process.env.VITE_BASE ?? '/'
const base = `${root.replace(/\/$/, '')}/tools/image-lab/`

export default defineConfig({
  base,
  plugins: [vue()],
})
