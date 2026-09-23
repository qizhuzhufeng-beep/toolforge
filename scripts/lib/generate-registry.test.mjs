import { describe, expect, it } from 'vitest'
import { buildRegistry } from './generate-registry.mjs'

const manifest = JSON.stringify({
  id: 'pdf-kit',
  name: 'PDF 手术台',
  description: '合并拆分 PDF',
  icon: 'icon.svg',
  category: 'docs',
  offline: true,
})
const manifestB = JSON.stringify({
  id: 'image-lab',
  name: '图片工作台',
  description: '批量压缩图片',
  icon: 'icon.svg',
  category: 'media',
  offline: true,
})

describe('buildRegistry', () => {
  it('生成根相对路径的条目并按分类排序', () => {
    const { entries, errors } = buildRegistry(
      ['pdf-kit', 'image-lab'],
      (f) => (f === 'pdf-kit' ? manifest : manifestB),
      () => true,
    )
    expect(errors).toEqual([])
    expect(entries.map((e) => e.id)).toEqual(['pdf-kit', 'image-lab']) // docs 在 media 前
    expect(entries[0]).toMatchObject({
      id: 'pdf-kit',
      icon: '/tools/pdf-kit/icon.svg',
      entry: '/tools/pdf-kit/index.html',
      offline: true,
    })
  })

  it('entry 缺省为 index.html，存在则采用', () => {
    const custom = JSON.stringify({ ...JSON.parse(manifest), entry: 'app.html' })
    const { entries } = buildRegistry(['pdf-kit'], () => custom, () => true)
    expect(entries[0].entry).toBe('/tools/pdf-kit/app.html')
  })

  it('非法 JSON 进入 errors 且不产出条目', () => {
    const { entries, errors } = buildRegistry(['bad'], () => '{oops', () => true)
    expect(entries).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('JSON 解析失败')
  })

  it('校验错误透传自 validateManifest', () => {
    const badId = JSON.stringify({ ...JSON.parse(manifest), id: 'mismatch' })
    const { entries, errors } = buildRegistry(['pdf-kit'], () => badId, () => true)
    expect(entries).toEqual([])
    expect(errors[0]).toContain('不一致')
  })

  it('空文件夹列表产出空注册表', () => {
    const { entries, errors } = buildRegistry([], () => '', () => true)
    expect(entries).toEqual([])
    expect(errors).toEqual([])
  })

  it('缺失 manifest.json 报文件不存在而非解析失败', () => {
    const err = new Error('ENOENT')
    err.code = 'ENOENT'
    const { errors } = buildRegistry(['ghost'], () => { throw err }, () => true)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('文件不存在')
  })
})
