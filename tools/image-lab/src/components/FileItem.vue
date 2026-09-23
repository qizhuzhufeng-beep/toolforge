<script setup lang="ts">
import type { SourceItem } from '../types'
import { formatBytes } from '../core/format'

defineProps<{ item: SourceItem }>()
defineEmits<{ download: []; remove: [] }>()

function saving(item: SourceItem): string {
  if (!item.result) return ''
  const pct = Math.round((1 - item.result.blob.size / item.file.size) * 100)
  return pct > 0 ? `省 ${pct}%` : `+${-pct}%`
}
</script>

<template>
  <div class="file">
    <img class="thumb" :src="item.url" alt="" />
    <div class="meta">
      <div class="name">{{ item.file.name }}</div>
      <div class="sizes" v-if="item.status === 'pending'">{{ formatBytes(item.file.size) }} · 待处理</div>
      <div class="sizes" v-else-if="item.status === 'processing'">处理中…</div>
      <div class="sizes" v-else-if="item.status === 'done' && item.result">
        {{ formatBytes(item.file.size) }} → {{ formatBytes(item.result.blob.size) }}
        <span class="saved">{{ saving(item) }}</span>
      </div>
      <div class="err" v-else-if="item.status === 'error'">{{ item.error }}</div>
    </div>
    <button class="iconbtn" v-if="item.status === 'done'" @click="$emit('download')">下载</button>
    <button class="iconbtn dim" @click="$emit('remove')" :disabled="item.status === 'processing'">移除</button>
  </div>
</template>
