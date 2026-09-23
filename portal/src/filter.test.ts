import { describe, expect, it } from 'vitest'
import { filterTools } from './filter'
import type { ToolEntry } from './types'

const tools: ToolEntry[] = [
  {
    id: 'pdf-kit',
    name: 'PDF 手术台',
    description: '合并拆分旋转 PDF',
    icon: '/tools/pdf-kit/icon.svg',
    category: 'docs',
    offline: true,
    entry: '/tools/pdf-kit/index.html',
  },
  {
    id: 'qr-factory',
    name: '二维码工厂',
    description: '生成与解码 QR',
    icon: '/tools/qr-factory/icon.svg',
    category: 'fun',
    offline: true,
    entry: '/tools/qr-factory/index.html',
  },
]

describe('filterTools', () => {
  it('query 为空或纯空白返回全部', () => {
    expect(filterTools(tools, '')).toHaveLength(2)
    expect(filterTools(tools, '   ')).toHaveLength(2)
  })

  it('按名称匹配且大小写不敏感', () => {
    expect(filterTools(tools, 'pdf')).toHaveLength(1)
    expect(filterTools(tools, 'PDF')).toHaveLength(1)
  })

  it('按描述匹配', () => {
    expect(filterTools(tools, '二维码')).toHaveLength(1)
  })

  it('无匹配返回空数组', () => {
    expect(filterTools(tools, '不存在')).toEqual([])
  })
})
