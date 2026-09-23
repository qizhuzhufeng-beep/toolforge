export type OutputFormat = 'original' | 'png' | 'jpeg' | 'webp'

const SUPPORTED_MIMES = ['image/png', 'image/jpeg', 'image/webp']

/** 解析输出 MIME；original 遇不受支持的源格式回退 png */
export function resolveMime(format: OutputFormat, originalMime: string): string {
  if (format === 'png') return 'image/png'
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return SUPPORTED_MIMES.includes(originalMime) ? originalMime : 'image/png'
}

export function mimeExtension(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

/** 输出文件名：去掉原扩展名，换成本次 MIME 对应的扩展名 */
export function buildOutputName(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return `${base}.${mimeExtension(mime)}`
}

/** 批量下载防重名：重名则在扩展名前追加中文序号，并登记进 used */
export function dedupeName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let candidate = ''
  let n = 2
  do {
    candidate = `${base}（${n}）${ext}`
    n += 1
  } while (used.has(candidate))
  used.add(candidate)
  return candidate
}

/** 字节数人性化：B / KB / MB，一位小数 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
