import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from './storage'

describe('StorageAdapter（内存实现）', () => {
  it('set 后 get 返回原值', async () => {
    const s = createMemoryStorage()
    await s.set('k', { a: 1 })
    expect(await s.get<{ a: number }>('k')).toEqual({ a: 1 })
  })

  it('get 不存在的 key 返回 null', async () => {
    const s = createMemoryStorage()
    expect(await s.get('nope')).toBeNull()
  })

  it('del 后 get 返回 null', async () => {
    const s = createMemoryStorage()
    await s.set('k', 1)
    await s.del('k')
    expect(await s.get('k')).toBeNull()
  })

  it('list 按 prefix 过滤，无 prefix 返回全部', async () => {
    const s = createMemoryStorage()
    await s.set('qr:1', 'a')
    await s.set('qr:2', 'b')
    await s.set('pdf:1', 'c')
    expect(await s.list('qr:')).toEqual(['qr:1', 'qr:2'])
    expect(await s.list()).toHaveLength(3)
  })
})
