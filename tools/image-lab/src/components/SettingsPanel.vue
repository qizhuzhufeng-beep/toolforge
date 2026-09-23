<script setup lang="ts">
import type { ImageSettings } from '../types'
import type { OutputFormat } from '../core/format'
import type { ResizeSettings } from '../core/resize'
import type { WatermarkPosition } from '../core/watermark'

const props = defineProps<{ settings: ImageSettings; disabled: boolean }>()
const emit = defineEmits<{ update: [settings: ImageSettings] }>()

function patch(part: Partial<ImageSettings>) {
  emit('update', { ...props.settings, ...part })
}

function patchResize(part: Partial<ResizeSettings>) {
  emit('update', { ...props.settings, resize: { ...props.settings.resize, ...part } })
}

function patchWatermark(part: Partial<ImageSettings['watermark']>) {
  emit('update', { ...props.settings, watermark: { ...props.settings.watermark, ...part } })
}

const POSITION_LABELS: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'nw', label: '左上' },
  { value: 'n', label: '上中' },
  { value: 'ne', label: '右上' },
  { value: 'w', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'e', label: '右中' },
  { value: 'sw', label: '左下' },
  { value: 's', label: '下中' },
  { value: 'se', label: '右下' },
]
</script>

<template>
  <section class="panel">
    <h2>输出设置</h2>

    <div class="field">
      <span class="label">输出格式</span>
      <select
        :value="settings.format"
        :disabled="disabled"
        @change="patch({ format: ($event.target as HTMLSelectElement).value as OutputFormat })"
      >
        <option value="original">保留原格式</option>
        <option value="jpeg">JPEG（体积小）</option>
        <option value="png">PNG（无损）</option>
        <option value="webp">WebP（更小）</option>
      </select>
    </div>

    <div class="field" v-if="settings.format !== 'png'">
      <span class="label">
        <span>压缩质量</span>
        <span>{{ settings.quality }}</span>
      </span>
      <input
        type="range"
        min="1"
        max="100"
        :value="settings.quality"
        :disabled="disabled"
        @input="patch({ quality: Number(($event.target as HTMLInputElement).value) })"
      />
      <span class="hint" v-if="settings.format === 'original'">仅对 JPEG / WebP 输出生效</span>
    </div>

    <div class="field">
      <span class="label">尺寸调整</span>
      <div class="row2">
        <select
          :value="settings.resize.mode"
          :disabled="disabled"
          @change="patchResize({ mode: ($event.target as HTMLSelectElement).value as ResizeSettings['mode'] })"
        >
          <option value="none">保持原尺寸</option>
          <option value="width">按宽度</option>
          <option value="height">按高度</option>
          <option value="percent">按百分比</option>
        </select>
        <input
          v-if="settings.resize.mode !== 'none'"
          type="number"
          min="1"
          :max="settings.resize.mode === 'percent' ? 100 : undefined"
          :value="settings.resize.value"
          :disabled="disabled"
          @input="patchResize({ value: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <span class="hint" v-if="settings.resize.mode === 'width'">等比缩放到目标宽度（px）</span>
      <span class="hint" v-else-if="settings.resize.mode === 'height'">等比缩放到目标高度（px）</span>
      <span class="hint" v-else-if="settings.resize.mode === 'percent'">按原图的百分比缩放</span>
    </div>

    <label class="check">
      <input
        type="checkbox"
        :checked="settings.watermark.enabled"
        :disabled="disabled"
        @change="patchWatermark({ enabled: ($event.target as HTMLInputElement).checked })"
      />
      添加文字水印
    </label>

    <template v-if="settings.watermark.enabled">
      <div class="field">
        <span class="label">水印文字</span>
        <input
          type="text"
          :value="settings.watermark.text"
          placeholder="如：@我的名字"
          :disabled="disabled"
          @input="patchWatermark({ text: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="field">
        <span class="label">位置</span>
        <select
          :value="settings.watermark.position"
          :disabled="disabled"
          @change="patchWatermark({ position: ($event.target as HTMLSelectElement).value as WatermarkPosition })"
        >
          <option v-for="p in POSITION_LABELS" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div class="field">
        <span class="label">
          <span>字号（px）</span>
        </span>
        <input
          type="number"
          min="8"
          max="400"
          :value="settings.watermark.fontSize"
          :disabled="disabled"
          @input="patchWatermark({ fontSize: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="field">
        <span class="label">
          <span>不透明度</span>
          <span>{{ settings.watermark.opacity }}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          :value="settings.watermark.opacity"
          :disabled="disabled"
          @input="patchWatermark({ opacity: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="field">
        <span class="label">颜色</span>
        <input
          type="text"
          :value="settings.watermark.color"
          :disabled="disabled"
          @input="patchWatermark({ color: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>
  </section>
</template>
