import type { ToolEntry } from './types'

/** 按名称/描述过滤（大小写不敏感的包含匹配）；query 为空返回全部 */
export function filterTools(tools: ToolEntry[], query: string): ToolEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter(
    (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  )
}
