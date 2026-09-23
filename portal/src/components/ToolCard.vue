<script setup lang="ts">
import type { ToolEntry } from '../types'
import { CATEGORY_LABELS } from '../types'

const props = defineProps<{ tool: ToolEntry }>()

// 注册表里是根相对路径，这里拼上部署 base（GitHub Pages 子路径也能用）
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const iconUrl = `${base}${props.tool.icon}`
const entryUrl = `${base}${props.tool.entry}`
</script>

<template>
  <a class="card" :href="entryUrl">
    <img :src="iconUrl" alt="" class="icon" />
    <div class="meta">
      <div class="title-row">
        <h2>{{ tool.name }}</h2>
        <span class="badge">{{ CATEGORY_LABELS[tool.category] }}</span>
        <span v-if="tool.offline" class="badge offline">离线可用</span>
      </div>
      <p>{{ tool.description }}</p>
    </div>
  </a>
</template>
