import type { OutputFormat } from './core/format'
import type { ResizeSettings } from './core/resize'
import type { WatermarkPosition } from './core/watermark'

export interface WatermarkSettings {
  enabled: boolean
  text: string
  position: WatermarkPosition
  fontSize: number
  /** 0-100 */
  opacity: number
  color: string
}

export interface ImageSettings {
  format: OutputFormat
  /** 1-100，仅对 jpeg/webp 生效 */
  quality: number
  resize: ResizeSettings
  watermark: WatermarkSettings
}

export const DEFAULT_SETTINGS: ImageSettings = {
  format: 'original',
  quality: 80,
  resize: { mode: 'none', value: 1280 },
  watermark: {
    enabled: false,
    text: '',
    position: 'se',
    fontSize: 32,
    opacity: 60,
    color: '#ffffff',
  },
}

export interface ProcessedImage {
  blob: Blob
  name: string
  width: number
  height: number
  url: string
}

export type ItemStatus = 'pending' | 'processing' | 'done' | 'error'

export interface SourceItem {
  id: number
  file: File
  url: string
  status: ItemStatus
  error?: string
  result?: ProcessedImage
}
