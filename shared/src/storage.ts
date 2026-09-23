import { createStore, del as idbDel, get as idbGet, keys as idbKeys, set as idbSet } from 'idb-keyval'

/**
 * 存储适配器（规格 §10）。
 * 一期默认 IndexedDB 实现；二期在此接口下新增远程同步实现，工具代码零改动。
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  /** 返回所有以 prefix 开头的 key；不传 prefix 返回全部 */
  list(prefix?: string): Promise<string[]>
}

function filterByPrefix(keys: string[], prefix?: string): string[] {
  return keys.filter((k) => !prefix || k.startsWith(prefix))
}

/** 测试与非持久场景用 */
export function createMemoryStorage(): StorageAdapter {
  const map = new Map<string, unknown>()
  return {
    async get<T>(key: string) {
      return map.has(key) ? (map.get(key) as T) : null
    },
    async set<T>(key: string, value: T) {
      map.set(key, value)
    },
    async del(key: string) {
      map.delete(key)
    },
    async list(prefix?: string) {
      return filterByPrefix([...map.keys()], prefix)
    },
  }
}

/** 浏览器 IndexedDB 实现，经 idb-keyval */
export function createIdbStorage(dbName = 'toolforge', storeName = 'kv'): StorageAdapter {
  const store = createStore(dbName, storeName)
  return {
    async get<T>(key: string) {
      const v = await idbGet<T>(key, store)
      return v ?? null
    },
    async set<T>(key: string, value: T) {
      await idbSet(key, value, store)
    },
    async del(key: string) {
      await idbDel(key, store)
    },
    async list(prefix?: string) {
      const all = await idbKeys(store)
      return filterByPrefix(all.map(String), prefix)
    },
  }
}
