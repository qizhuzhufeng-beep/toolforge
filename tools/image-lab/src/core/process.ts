import { buildOutputName, resolveMime } from './format'
import { computeTargetSize } from './resize'
import { computeWatermarkPosition } from './watermark'
import type { ImageSettings, ProcessedImage } from '../types'

/**
 * 单张处理：解码 → 缩放绘制 → 水印 → 编码。
 * 调用方必须顺序 await（内存验收：10×8MB 不并发）。
 */
export async function processImage(file: File, settings: ImageSettings): Promise<ProcessedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`无法解码图片：${file.name}（该格式可能不被浏览器支持）`)
  }
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, settings.resize)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('无法创建画布，请更换浏览器重试')
  }

  const mime = resolveMime(settings.format, file.type)
  // JPEG 无透明通道：透明区域编码后变黑，先铺白底
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)

  if (settings.watermark.enabled && settings.watermark.text.trim()) {
    const wm = settings.watermark
    ctx.globalAlpha = Math.min(100, Math.max(0, wm.opacity)) / 100
    ctx.fillStyle = wm.color
    ctx.font = `${wm.fontSize}px sans-serif`
    ctx.textBaseline = 'top'
    const metrics = ctx.measureText(wm.text)
    const pos = computeWatermarkPosition(wm.position, width, height, metrics.width, wm.fontSize, Math.round(wm.fontSize / 2))
    ctx.fillText(wm.text, pos.x, pos.y)
    ctx.globalAlpha = 1
  }

  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : settings.quality / 100),
  )
  if (!blob) throw new Error(`图片编码失败：${file.name}`)

  return { blob, name: buildOutputName(file.name, mime), width, height, url: URL.createObjectURL(blob) }
}
