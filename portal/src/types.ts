export type Category = 'media' | 'docs' | 'data' | 'dev' | 'life' | 'fun'

/** 对应 scripts/lib/generate-registry.mjs 产出的条目结构 */
export interface ToolEntry {
  id: string
  name: string
  description: string
  /** 根相对路径，如 /tools/pdf-kit/icon.svg */
  icon: string
  category: Category
  offline: boolean
  entry: string
}

export interface ToolRegistry {
  generatedAt: string
  tools: ToolEntry[]
}

export const CATEGORY_LABELS: Record<Category, string> = {
  media: '媒体',
  docs: '文档',
  data: '数据',
  dev: '开发',
  life: '生活',
  fun: '趣味',
}
