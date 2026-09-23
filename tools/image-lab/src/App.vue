<script setup lang="ts">
import JSZip from 'jszip'
import { computed, onBeforeUnmount, ref } from 'vue'
import { dedupeName } from './core/format'
import { processImage } from './core/process'
import { DEFAULT_SETTINGS, type ImageSettings, type SourceItem } from './types'
import FileItem from './components/FileItem.vue'
import SettingsPanel from './components/SettingsPanel.vue'

// 门户部署在站点根：去掉本工具的 base 后缀即门户地址（开发与子路径部署都成立）
const portalBase = import.meta.env.BASE_URL.replace(/\/tools\/image-lab\/$/, '/') || '/'

const items = ref<SourceItem[]>([])
const settings = ref<ImageSettings>(structuredClone(DEFAULT_SETTINGS))
const processing = ref(false)
const dragging = ref(false)

let nextId = 1
const input = ref<HTMLInputElement | null>(null)

const doneCount = computed(() => items.value.filter((i) => i.status === 'done').length)

function addFiles(list: FileList | File[]) {
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue
    items.value.push({ id: nextId++, file, url: URL.createObjectURL(file), status: 'pending' })
  }
}

function onPick(e: Event) {
  addFiles((e.target as HTMLInputElement).files ?? [])
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  addFiles(e.dataTransfer?.files ?? [])
}

function removeItem(item: SourceItem) {
  URL.revokeObjectURL(item.url)
  if (item.result) URL.revokeObjectURL(item.result.url)
  items.value = items.value.filter((i) => i.id !== item.id)
}

function clearAll() {
  if (processing.value) return
  for (const item of items.value) {
    URL.revokeObjectURL(item.url)
    if (item.result) URL.revokeObjectURL(item.result.url)
  }
  items.value = []
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

async function processAll() {
  if (processing.value || items.value.length === 0) return
  processing.value = true
  try {
    // 顺序处理：内存验收（10×8MB）依赖不并发
    for (const item of items.value) {
      if (item.status === 'done') continue
      item.status = 'processing'
      try {
        item.result = await processImage(item.file, settings.value)
        item.status = 'done'
      } catch (e) {
        item.status = 'error'
        item.error = e instanceof Error ? e.message : '处理失败，请重试'
      }
    }
  } finally {
    processing.value = false
  }
}

async function downloadAll() {
  const done = items.value.filter((i) => i.status === 'done' && i.result)
  if (done.length === 0) return
  const zip = new JSZip()
  const used = new Set<string>()
  for (const item of done) {
    zip.file(dedupeName(item.result!.name, used), item.result!.blob)
  }
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  saveBlob(await zip.generateAsync({ type: 'blob' }), `image-lab-${stamp}.zip`)
}

onBeforeUnmount(() => clearAll())
</script>

<template>
  <header class="top">
    <a class="back" :href="portalBase">← 返回门户</a>
    <h1>图片工作台</h1>
    <p class="sub">压缩、转格式、调尺寸、加水印——全部在本机浏览器内完成，图片不会上传。</p>
  </header>

  <main>
    <div class="layout">
      <section>
        <div
          class="dropzone"
          :class="{ drag: dragging }"
          @click="input?.click()"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          点击选择图片，或拖拽到此处<br />
          <span class="hint">支持批量 · png / jpeg / webp / gif 等常见格式</span>
        </div>
        <input ref="input" type="file" accept="image/*" multiple hidden @change="onPick" />

        <div class="filelist">
          <p class="empty" v-if="items.length === 0">还没有图片。选几张试试？</p>
          <FileItem
            v-for="item in items"
            :key="item.id"
            :item="item"
            @download="item.result && saveBlob(item.result.blob, item.result.name)"
            @remove="removeItem(item)"
          />
        </div>
      </section>

      <SettingsPanel :settings="settings" :disabled="processing" @update="settings = $event" />

      <div class="actions" style="grid-column: 1 / -1">
        <button class="btn primary" :disabled="processing || items.length === 0" @click="processAll">
          {{ processing ? '处理中…' : `开始处理（${items.length} 张）` }}
        </button>
        <button class="btn" :disabled="processing || doneCount === 0" @click="downloadAll">
          全部下载（ZIP，{{ doneCount }} 张）
        </button>
        <button class="btn" :disabled="processing || items.length === 0" @click="clearAll">清空</button>
      </div>

      <p class="note" style="grid-column: 1 / -1">
        处理在本地完成；大图建议一次 ≤ 20 张。JPEG 输出会自动铺白底（不支持透明）。
      </p>
    </div>
  </main>
</template>
