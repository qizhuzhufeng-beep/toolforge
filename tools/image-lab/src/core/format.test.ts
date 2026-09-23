import { describe, expect, it } from 'vitest'
import { buildOutputName, dedupeName, formatBytes, mimeExtension, resolveMime } from './format'

describe('resolveMime', () => {
  it('显式选择三大格式', () => {
    expect(resolveMime('png', 'image/jpeg')).toBe('image/png')
    expect(resolveMime('jpeg', 'image/png')).toBe('image/jpeg')
    expect(resolveMime('webp', 'image/png')).toBe('image/webp')
  })

  it('original 保留受支持的原始格式', () => {
    expect(resolveMime('original', 'image/jpeg')).toBe('image/jpeg')
    expect(resolveMime('original', 'image/webp')).toBe('image/webp')
  })

  it('original 遇不受支持格式（如 gif）回退 png', () => {
    expect(resolveMime('original', 'image/gif')).toBe('image/png')
  })
})

describe('mimeExtension', () => {
  it('jpeg 映射 jpg，其余已知映射，未知回退 png', () => {
    expect(mimeExtension('image/jpeg')).toBe('jpg')
    expect(mimeExtension('image/webp')).toBe('webp')
    expect(mimeExtension('image/png')).toBe('png')
    expect(mimeExtension('image/whatever')).toBe('png')
  })
})

describe('buildOutputName', () => {
  it('替换扩展名（含大写扩展名）', () => {
    expect(buildOutputName('photo.JPG', 'image/jpeg')).toBe('photo.jpg')
    expect(buildOutputName('截图.2026', 'image/webp')).toBe('截图.webp')
  })
})

describe('dedupeName', () => {
  it('重名追加序号（2）（3），并登记使用', () => {
    const used = new Set<string>()
    expect(dedupeName('a.jpg', used)).toBe('a.jpg')
    expect(dedupeName('a.jpg', used)).toBe('a（2）.jpg')
    expect(dedupeName('a.jpg', used)).toBe('a（3）.jpg')
    expect(used).toEqual(new Set(['a.jpg', 'a（2）.jpg', 'a（3）.jpg']))
  })

  it('无扩展名文件也安全', () => {
    expect(dedupeName('blob', new Set(['blob']))).toBe('blob（2）')
  })
})

describe('formatBytes', () => {
  it('B / KB / MB 三档，保留一位小数', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
