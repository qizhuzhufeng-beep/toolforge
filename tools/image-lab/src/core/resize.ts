export interface ResizeSettings {
  mode: 'none' | 'width' | 'height' | 'percent'
  value: number
}

/** 由原始尺寸与缩放设置计算目标尺寸；结果四舍五入且最小 1px */
export function computeTargetSize(
  width: number,
  height: number,
  settings: ResizeSettings,
): { width: number; height: number } {
  const clamp = (n: number) => Math.max(1, Math.round(n))
  switch (settings.mode) {
    case 'none':
      return { width: clamp(width), height: clamp(height) }
    case 'width':
      return { width: clamp(settings.value), height: clamp((settings.value * height) / width) }
    case 'height':
      return { width: clamp((settings.value * width) / height), height: clamp(settings.value) }
    case 'percent': {
      const factor = Math.max(1, settings.value) / 100
      return { width: clamp(width * factor), height: clamp(height * factor) }
    }
  }
}
