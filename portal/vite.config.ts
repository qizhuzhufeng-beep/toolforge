import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 部署到 GitHub Pages 子路径时由 CI 注入 VITE_BASE（Task 7）；本地默认根路径
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      base,
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,webmanifest,ico,png}'],
      },
      includeAssets: ['tools.json', 'icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'ToolForge 工具集',
        short_name: 'ToolForge',
        description: '本地优先的跨设备实用工具集',
        lang: 'zh-CN',
        theme_color: '#3568d4',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
