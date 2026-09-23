import { describe, expect, it } from 'vitest'
import { CATEGORIES, validateManifest } from './validate-manifest.mjs'

const good = {
  id: 'pdf-kit',
  name: 'PDF 手术台',
  description: '合并拆分 PDF',
  icon: 'icon.svg',
  category: 'docs',
  offline: true,
}

describe('validateManifest', () => {
  it('合法 manifest 返回空错误数组', () => {
    expect(validateManifest(good, 'pdf-kit', () => true)).toEqual([])
  })

  it('缺少必填字段被逐个指出', () => {
    const { id, icon, ...partial } = good
    const errors = validateManifest(partial, 'pdf-kit', () => true)
    expect(errors).toHaveLength(2)
    expect(errors.join('\n')).toContain('"id"')
    expect(errors.join('\n')).toContain('"icon"')
  })

  it('id 与文件夹名不一致报错', () => {
    const errors = validateManifest({ ...good, id: 'other' }, 'pdf-kit', () => true)
    expect(errors.join('\n')).toContain('不一致')
  })

  it('category 非法报错且列出允许值', () => {
    const errors = validateManifest({ ...good, category: 'nope' }, 'pdf-kit', () => true)
    expect(errors.join('\n')).toContain('media')
    expect(CATEGORIES).toEqual(['media', 'docs', 'data', 'dev', 'life', 'fun'])
  })

  it('offline 非布尔报错', () => {
    const errors = validateManifest({ ...good, offline: 'yes' }, 'pdf-kit', () => true)
    expect(errors.join('\n')).toContain('布尔')
  })

  it('图标文件不存在报错', () => {
    const errors = validateManifest(good, 'pdf-kit', () => false)
    expect(errors.join('\n')).toContain('icon.svg')
  })

  it('manifest 非 JSON 对象返回单条错误', () => {
    expect(validateManifest('oops', 'pdf-kit', () => true)).toHaveLength(1)
    expect(validateManifest(null, 'pdf-kit', () => true)).toHaveLength(1)
  })

  it('字段为 null 视为缺失', () => {
    const errors = validateManifest({ ...good, name: null }, 'pdf-kit', () => true)
    expect(errors.join('\n')).toContain('"name"')
  })

  it('字符串字段为非字符串报错', () => {
    const errors = validateManifest({ ...good, icon: 123 }, 'pdf-kit', () => true)
    expect(errors.join('\n')).toContain('必须为字符串')
  })
})
