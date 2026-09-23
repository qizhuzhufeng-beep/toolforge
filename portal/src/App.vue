<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { filterTools } from './filter'
import type { ToolEntry, ToolRegistry } from './types'
import ToolCard from './components/ToolCard.vue'

const tools = ref<ToolEntry[]>([])
const loading = ref(true)
const failed = ref(false)
const query = ref('')

const visible = computed(() => filterTools(tools.value, query.value))

// SFC 模板内的绝对路径不会被 Vite 重写 base，子路径部署须显式拼接
const logoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/icon.svg`

onMounted(async () => {
  try {
    const base = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`
    const res = await fetch(`${base}tools.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const registry: ToolRegistry = await res.json()
    tools.value = registry.tools
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <header class="hero">
    <img :src="logoUrl" alt="" class="logo" />
    <h1>ToolForge 工具集</h1>
    <p class="subtitle">本地处理 · 跨设备可用 · 免安装即用</p>
    <input v-model="query" class="search" type="search" placeholder="搜索工具…" />
  </header>

  <main>
    <p v-if="loading" class="state">加载中…</p>
    <p v-else-if="failed" class="state">注册表加载失败，请刷新重试。</p>
    <p v-else-if="visible.length === 0" class="state">
      {{ tools.length === 0 ? '还没有工具：向 tools/ 添加文件夹并重新构建。' : '没有匹配的工具。' }}
    </p>
    <div v-else class="grid">
      <ToolCard v-for="t in visible" :key="t.id" :tool="t" />
    </div>
  </main>
</template>
