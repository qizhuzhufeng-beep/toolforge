# ToolForge 一期·基础设施与门户（计划 1/5）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭好 pnpm workspace 骨架（shared 存储适配器 + manifest 脚本）并交付可安装、离线可用的 PWA 门户，门户能自动列出未来加入的所有工具。

**Architecture:** pnpm workspace 多包仓库；`scripts/` 构建期扫描 `tools/*/manifest.json` 生成注册表 `portal/public/tools.json`；门户（Vue 3 SPA）运行时拉取注册表渲染工具卡片。零后端。

**Tech Stack:** Vue 3 + TypeScript + Vite 7 + vite-plugin-pwa + vitest + idb-keyval + pnpm workspace。

**Spec:** `docs/superpowers/specs/2026-09-23-toolforge-design.md`（§5 结构、§6 契约、§7 自动发现、§9.0 门户、§10 数据策略、§11 部署、§12 测试）

## Global Constraints

- 工具间禁止互相 import（规格 §8 铁律）；本计划内 portal 依赖 `@toolforge/shared`，scripts 不依赖任何 workspace 包。
- 全部 UI 文案为中文；错误信息面向使用者（规格 §13）。
- TypeScript `strict: true`；所有包 `"type": "module"`。
- Node >= 22，pnpm >= 10。
- manifest 校验失败必须使构建失败（规格 §6），不允许静默跳过。
- 零后端、无账号、无统计（规格 §14）。
- 亮/暗色仅经 CSS 变量 + `prefers-color-scheme`（规格 §14）。
- 注册表 `tools.json` 中 icon/entry 存「根相对路径」（如 `/tools/<id>/index.html`），门户运行时拼接 `import.meta.env.BASE_URL`——这样 base 换成 `/repo/` 部署到 GitHub Pages 时无需重新生成注册表。

---

### Task 1: 仓库根骨架

**Files:**
- Create: `package.json`（仓库根）
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `README.md`

**Interfaces:**
- Produces: workspace 布局（`portal`、`tools/*`、`shared`、`scripts` 四类包位）；根命令 `pnpm build` / `pnpm test` / `pnpm dev:portal`；`tsconfig.base.json` 供后续所有包 extends。

- [ ] **Step 1: 确认 pnpm 可用**

Run: `pnpm -v`
Expected: 输出 10.x 或更高。若报命令不存在，先执行 `npm i -g pnpm` 再验证。

- [ ] **Step 2: 写根配置文件**

`package.json`：
```json
{
  "name": "toolforge",
  "private": true,
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev:portal": "pnpm --filter portal dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

`pnpm-workspace.yaml`：
```yaml
packages:
  - portal
  - tools/*
  - shared
  - scripts
```

`tsconfig.base.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

`README.md`：
```markdown
# ToolForge 工具集

本地优先、跨设备可用的实用工具集（一期开发中：门户 + 4 个纯静态工具）。

## 开发

```bash
pnpm install
pnpm dev:portal   # 门户开发服务器；加 -- --host 供局域网手机/平板访问
pnpm test         # 全部单元测试
pnpm build        # 生成注册表并构建全部包
```

设计文档见 `docs/superpowers/specs/`，实施计划见 `docs/superpowers/plans/`。
```

- [ ] **Step 3: 验证 workspace 被识别**

Run: `pnpm install`
Expected: 成功（目前无子包，输出不报错）；生成 `pnpm-lock.yaml`。

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json README.md pnpm-lock.yaml
git commit -m "chore: pnpm workspace 根骨架"
```

---

### Task 2: shared 包 — 存储适配器 + 主题

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/storage.ts`
- Test: `shared/src/storage.test.ts`
- Create: `shared/src/theme.css`
- Create: `shared/src/index.ts`

**Interfaces:**
- Produces: `@toolforge/shared` 包；`StorageAdapter` 接口 `{ get<T>(key): Promise<T|null>; set<T>(key, value): Promise<void>; del(key): Promise<void>; list(prefix?): Promise<string[]> }`；工厂 `createMemoryStorage(): StorageAdapter` 与 `createIdbStorage(dbName?, storeName?): StorageAdapter`（规格 §10 的适配器接口）。后续工具计划经 `import { createIdbStorage, type StorageAdapter } from '@toolforge/shared'` 消费。主题经 `import '@toolforge/shared/theme.css'` 消费。

- [ ] **Step 1: 写 shared 包配置**

`shared/package.json`：
```json
{
  "name": "@toolforge/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./theme.css": "./src/theme.css"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "idb-keyval": "^6.2.1"
  },
  "devDependencies": {
    "vitest": "^3.2.0"
  }
}
```

`shared/tsconfig.json`：
```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: 写失败的测试（内存实现先行）**

`shared/src/storage.test.ts`：
```ts
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
```

- [ ] **Step 3: 安装依赖并运行测试确认失败**

Run: `pnpm install && pnpm --filter @toolforge/shared test`
Expected: FAIL — `Cannot find module './storage'`（storage.ts 尚不存在）。

- [ ] **Step 4: 写实现**

`shared/src/storage.ts`：
```ts
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

import { createStore, del as idbDel, get as idbGet, keys as idbKeys, set as idbSet } from 'idb-keyval'
```

注：import 放文件顶部更符合惯例——实现时把该 import 移到文件第一行，此处代码块顺序仅为阅读便利。**执行时必须置于顶部。**

`shared/src/theme.css`：
```css
:root {
  color-scheme: light dark;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --text: #1c1e21;
  --text-secondary: #5a6270;
  --border: #e2e5ea;
  --accent: #3568d4;
  --accent-soft: #e8eefc;
  --radius: 12px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --surface: #1e2127;
    --text: #e8eaed;
    --text-secondary: #9aa1ad;
    --border: #2d3138;
    --accent: #6f9bf0;
    --accent-soft: #243047;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
}
```

`shared/src/index.ts`：
```ts
export type { StorageAdapter } from './storage'
export { createIdbStorage, createMemoryStorage } from './storage'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @toolforge/shared test`
Expected: PASS — 4 个测试全绿。

- [ ] **Step 6: Commit**

```bash
git add shared pnpm-lock.yaml
git commit -m "feat(shared): 存储适配器接口（内存+IndexedDB 实现）与主题变量"
```

---

### Task 3: scripts 包 — manifest 校验器

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/lib/validate-manifest.mjs`
- Test: `scripts/lib/validate-manifest.test.mjs`

**Interfaces:**
- Produces: `validateManifest(manifest, folderName, fileExists?): string[]`——返回中文错误数组，空数组即通过；常量 `CATEGORIES: ['media','docs','data','dev','life','fun']`（规格 §6 的校验规则）。Task 4 的注册表生成器与未来 CI 都消费它。

- [ ] **Step 1: 写 scripts 包配置**

`scripts/package.json`：
```json
{
  "name": "@toolforge/scripts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.0"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: 写失败的测试**

`scripts/lib/validate-manifest.test.mjs`：
```ts
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
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @toolforge/scripts test`
Expected: FAIL — 无法解析 `./validate-manifest.mjs`。

- [ ] **Step 4: 写实现**

`scripts/lib/validate-manifest.mjs`：
```js
import { join } from 'node:path'

export const CATEGORIES = ['media', 'docs', 'data', 'dev', 'life', 'fun']
const REQUIRED = ['id', 'name', 'description', 'icon', 'category', 'offline']

/**
 * 校验单个工具 manifest（规格 §6）。
 * @param {*} manifest 解析后的 JSON
 * @param {string} folderName tools/ 下的文件夹名
 * @param {(relPath: string) => boolean} fileExists 检查 tools/ 下相对路径是否存在，默认放行（纯函数测试可注入）
 * @returns {string[]} 中文错误列表，空数组 = 通过
 */
export function validateManifest(manifest, folderName, fileExists = () => true) {
  if (typeof manifest !== 'object' || manifest === null) {
    return [`${folderName}/manifest.json: 内容不是 JSON 对象`]
  }
  const errors = []
  for (const field of REQUIRED) {
    if (manifest[field] === undefined) {
      errors.push(`${folderName}/manifest.json: 缺少必填字段 "${field}"`)
    }
  }
  if (manifest.id !== undefined && manifest.id !== folderName) {
    errors.push(`${folderName}/manifest.json: id "${manifest.id}" 与文件夹名 "${folderName}" 不一致`)
  }
  if (manifest.category !== undefined && !CATEGORIES.includes(manifest.category)) {
    errors.push(`${folderName}/manifest.json: category "${manifest.category}" 非法，允许值：${CATEGORIES.join(', ')}`)
  }
  if (manifest.offline !== undefined && typeof manifest.offline !== 'boolean') {
    errors.push(`${folderName}/manifest.json: offline 必须为布尔值`)
  }
  if (manifest.icon !== undefined && typeof manifest.icon === 'string' && !fileExists(join(folderName, manifest.icon))) {
    errors.push(`${folderName}/manifest.json: 图标文件不存在: ${manifest.icon}`)
  }
  return errors
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @toolforge/scripts test`
Expected: PASS — 7 个测试全绿。

- [ ] **Step 6: Commit**

```bash
git add scripts pnpm-lock.yaml
git commit -m "feat(scripts): manifest 校验器（规格 §6 规则）"
```

---

### Task 4: scripts 包 — 注册表生成器 + CLI

**Files:**
- Create: `scripts/lib/generate-registry.mjs`
- Test: `scripts/lib/generate-registry.test.mjs`

**Interfaces:**
- Consumes: `validateManifest`（Task 3）。
- Produces: `buildRegistry(toolFolders, readManifest, fileExists): { entries, errors }`——`entries` 为排序后的注册表条目数组（字段 `id/name/description/icon/category/offline/entry`，icon 与 entry 为根相对路径）；CLI 入口 `node scripts/lib/generate-registry.mjs` 扫描 `tools/` 写出 `portal/public/tools.json`，校验失败 `process.exit(1)`（规格 §7 自动发现）。

- [ ] **Step 1: 写失败的测试**

`scripts/lib/generate-registry.test.mjs`：
```ts
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
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @toolforge/scripts test`
Expected: FAIL — 无法解析 `./generate-registry.mjs`。

- [ ] **Step 3: 写实现**

`scripts/lib/generate-registry.mjs`：
```js
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { validateManifest } from './validate-manifest.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const toolsDir = join(repoRoot, 'tools')
const outputFile = join(repoRoot, 'portal', 'public', 'tools.json')

/**
 * 纯函数核心：由文件夹清单构建注册表条目。
 * @param {string[]} toolFolders tools/ 下的一级文件夹名
 * @param {(folder: string) => string} readManifest 返回该文件夹 manifest.json 原始文本
 * @param {(relPath: string) => boolean} fileExists 检查 tools/ 下相对路径是否存在
 * @returns {{ entries: object[], errors: string[] }}
 */
export function buildRegistry(toolFolders, readManifest, fileExists) {
  const entries = []
  const errors = []
  for (const folder of toolFolders) {
    let parsed
    try {
      parsed = JSON.parse(readManifest(folder))
    } catch (e) {
      errors.push(`${folder}/manifest.json: JSON 解析失败 — ${e.message}`)
      continue
    }
    const errs = validateManifest(parsed, folder, fileExists)
    errors.push(...errs)
    if (errs.length === 0) {
      entries.push({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        // 根相对路径；门户运行时拼接 BASE_URL，便于任意 base 部署
        icon: `/tools/${parsed.id}/${parsed.icon}`,
        category: parsed.category,
        offline: parsed.offline,
        entry: `/tools/${parsed.id}/${parsed.entry ?? 'index.html'}`,
      })
    }
  }
  entries.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
  return { entries, errors }
}

/** CLI：扫描 tools/，校验失败即退出码 1，成功写 portal/public/tools.json */
export function main() {
  let folders = []
  try {
    folders = readdirSync(toolsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    // tools/ 尚不存在 → 空注册表，门户可先行开发
  }
  const { entries, errors } = buildRegistry(
    folders,
    (f) => readFileSync(join(toolsDir, f, 'manifest.json'), 'utf8'),
    (rel) => existsSync(join(toolsDir, rel)),
  )
  if (errors.length > 0) {
    console.error('✗ manifest 校验失败：')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, JSON.stringify({ generatedAt: new Date().toISOString(), tools: entries }, null, 2) + '\n')
  console.log(`✓ 注册表已生成：${entries.length} 个工具 → portal/public/tools.json`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @toolforge/scripts test`
Expected: PASS — 共 12 个测试全绿（含 Task 3 的 7 个）。

- [ ] **Step 5: 手动冒烟：无 tools/ 目录时 CLI 正常产出空注册表**

Run: `node scripts/lib/generate-registry.mjs && cat portal/public/tools.json`
Expected: 输出 `✓ 注册表已生成：0 个工具`，文件内容为 `"tools": []`。

- [ ] **Step 6: Commit**

```bash
git add scripts portal/public/tools.json
git commit -m "feat(scripts): 注册表生成器 CLI（规格 §7 自动发现）"
```

---

### Task 5: portal 脚手架（PWA 可安装、空状态可用）

**Files:**
- Create: `portal/package.json`
- Create: `portal/tsconfig.json`
- Create: `portal/vite.config.ts`
- Create: `portal/index.html`
- Create: `portal/public/icon.svg`
- Create: `portal/public/icon-maskable.svg`
- Create: `portal/src/main.ts`
- Create: `portal/src/vite-env.d.ts`
- Create: `portal/src/app.css`
- Create: `portal/src/App.vue`（占位版，Task 6 替换）

**Interfaces:**
- Consumes: `@toolforge/shared`（theme.css）。
- Produces: 可 `pnpm dev` / `pnpm build` 的 PWA 应用骨架；`vite.config.ts` 中 `base = process.env.VITE_BASE ?? '/'` 的约定（Task 7 的部署工作流依赖此环境变量）。后续 4 个工具计划的 vite.config 沿用同一 base 约定。

- [ ] **Step 1: 写包配置与构建配置**

`portal/package.json`：
```json
{
  "name": "portal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "node ../scripts/lib/generate-registry.mjs && vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@toolforge/shared": "workspace:*",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0",
    "vite-plugin-pwa": "^1.0.0",
    "vitest": "^3.2.0",
    "vue-tsc": "^3.0.0"
  }
}
```

`portal/tsconfig.json`：
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`portal/vite.config.ts`：
```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 部署到 GitHub Pages 子路径时由 CI 注入 VITE_BASE（Task 7）；本地默认根路径
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      base,
      registerType: 'autoUpdate',
      manifest: {
        name: 'ToolForge 工具集',
        short_name: 'ToolForge',
        description: '本地优先的跨设备实用工具集',
        lang: 'zh-CN',
        theme_color: '#3568d4',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
```

- [ ] **Step 2: 写入口文件**

`portal/index.html`：
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#3568d4" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <title>ToolForge 工具集</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`portal/public/icon.svg`：
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#3568d4"/>
  <text x="50" y="66" font-size="44" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-weight="700">TF</text>
</svg>
```

`portal/public/icon-maskable.svg`（图形收进安全区）：
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#3568d4"/>
  <text x="50" y="63" font-size="38" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-weight="700">TF</text>
</svg>
```

`portal/src/vite-env.d.ts`：
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

`portal/src/main.ts`：
```ts
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import '@toolforge/shared/theme.css'
import './app.css'
import App from './App.vue'

registerSW({ immediate: true })

createApp(App).mount('#app')
```

`portal/src/app.css`：
```css
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.hero { padding: 48px 16px 8px; text-align: center; }

.logo { width: 56px; height: 56px; border-radius: 14px; }

h1 { margin: 12px 0 4px; font-size: 26px; }

.subtitle { margin: 0 0 20px; color: var(--text-secondary); font-size: 14px; }

.search {
  width: min(480px, 100%);
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 15px;
  outline: none;
}

.search:focus { border-color: var(--accent); }

main { max-width: 880px; margin: 0 auto; padding: 24px 16px 48px; }

.state { text-align: center; color: var(--text-secondary); margin-top: 48px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.card {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.card:hover { border-color: var(--accent); }

.icon { width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; }

.title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

h2 { margin: 0; font-size: 16px; }

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}

.badge.offline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.meta p { margin: 4px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
```

- [ ] **Step 3: 写占位 App.vue**

`portal/src/App.vue`：
```vue
<template>
  <header class="hero">
    <h1>ToolForge 工具集</h1>
    <p class="subtitle">门户骨架已就绪，工具网格在下一任务实现。</p>
  </header>
</template>
```

- [ ] **Step 4: 安装依赖并验证构建链**

Run: `pnpm install && pnpm --filter portal build`
Expected: 三段依次成功——注册表生成（0 个工具）、`vue-tsc --noEmit` 无类型错误、vite build 产出 `portal/dist/`（含 `sw.js`、`manifest.webmanifest`、`tools.json`）。

- [ ] **Step 5: 本地冒烟验证 PWA 产物**

Run: `pnpm --filter portal preview` 后浏览器访问终端提示地址
Expected: 页面显示标题；查看源码含 `manifest.webmanifest` 链接；地址栏出现安装图标（Chrome）。完成后 Ctrl+C。

- [ ] **Step 6: Commit**

```bash
git add portal pnpm-lock.yaml
git commit -m "feat(portal): PWA 骨架（可安装、离线、VITE_BASE 可配置）"
```

---

### Task 6: portal 工具网格 + 搜索

**Files:**
- Create: `portal/src/types.ts`
- Create: `portal/src/filter.ts`
- Test: `portal/src/filter.test.ts`
- Create: `portal/src/components/ToolCard.vue`
- Modify: `portal/src/App.vue`（替换占位版）

**Interfaces:**
- Consumes: `tools.json` 的 `ToolRegistry` 结构（Task 4 产出：`{ generatedAt: string, tools: ToolEntry[] }`，entry 字段 `id/name/description/icon/category/offline/entry`，icon/entry 为根相对路径）。
- Produces: `filterTools(tools: ToolEntry[], query: string): ToolEntry[]`（大小写不敏感，匹配 name 或 description，空/空白 query 返回全部）；`ToolEntry` / `CATEGORY_LABELS`（供未来门户扩展复用）。

- [ ] **Step 1: 写类型定义**

`portal/src/types.ts`：
```ts
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
```

- [ ] **Step 2: 写失败的测试**

`portal/src/filter.test.ts`：
```ts
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
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter portal test`
Expected: FAIL — `Cannot find module './filter'`。

- [ ] **Step 4: 写 filter 实现**

`portal/src/filter.ts`：
```ts
import type { ToolEntry } from './types'

/** 按名称/描述过滤（大小写不敏感的包含匹配）；query 为空返回全部 */
export function filterTools(tools: ToolEntry[], query: string): ToolEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter(
    (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  )
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter portal test`
Expected: PASS — 4 个测试全绿。

- [ ] **Step 6: 写 ToolCard 组件**

`portal/src/components/ToolCard.vue`：
```vue
<script setup lang="ts">
import type { ToolEntry } from '../types'
import { CATEGORY_LABELS } from '../types'

const props = defineProps<{ tool: ToolEntry }>()

// 注册表里是根相对路径，这里拼上部署 base（GitHub Pages 子路径也能用）
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const iconUrl = `${base}${props.tool.icon}`
const entryUrl = `${base}${props.tool.entry}`
</script>

<template>
  <a class="card" :href="entryUrl">
    <img :src="iconUrl" alt="" class="icon" />
    <div class="meta">
      <div class="title-row">
        <h2>{{ tool.name }}</h2>
        <span class="badge">{{ CATEGORY_LABELS[tool.category] }}</span>
        <span v-if="tool.offline" class="badge offline">离线可用</span>
      </div>
      <p>{{ tool.description }}</p>
    </div>
  </a>
</template>
```

- [ ] **Step 7: 替换 App.vue 完整实现**

`portal/src/App.vue`：
```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { filterTools } from './filter'
import type { ToolEntry, ToolRegistry } from './types'
import ToolCard from './components/ToolCard.vue'

const tools = ref<ToolEntry[]>([])
const loading = ref(true)
const failed = ref(false)
const query = ref('')

const visible = computed(() => filterTools(tools.value, query.value))

onMounted(async () => {
  try {
    const base = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`
    const res = await fetch(`${base}tools.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const registry: ToolRegistry = await res.json()
    tools.value = registry.tools
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <header class="hero">
    <img src="/icon.svg" alt="" class="logo" />
    <h1>ToolForge 工具集</h1>
    <p class="subtitle">本地处理 · 跨设备可用 · 免安装即用</p>
    <input v-model="query" class="search" type="search" placeholder="搜索工具…" />
  </header>

  <main>
    <p v-if="loading" class="state">加载中…</p>
    <p v-else-if="failed" class="state">注册表加载失败，请刷新重试。</p>
    <p v-else-if="visible.length === 0" class="state">
      {{ tools.length === 0 ? '还没有工具：向 tools/ 添加文件夹并重新构建。' : '没有匹配的工具。' }}
    </p>
    <div v-else class="grid">
      <ToolCard v-for="t in visible" :key="t.id" :tool="t" />
    </div>
  </main>
</template>
```

- [ ] **Step 8: 全量验证**

Run: `pnpm --filter portal build && pnpm test`
Expected: portal 构建（含 vue-tsc 类型检查）成功；全仓测试通过（shared 4 + scripts 12 + portal 4）。

Run: `pnpm --filter portal preview`，浏览器确认：空状态文案正常显示；DevTools Application 面板能看到 PWA manifest。完成后 Ctrl+C。

- [ ] **Step 9: Commit**

```bash
git add portal/src
git commit -m "feat(portal): 工具卡片网格与搜索（读取注册表渲染）"
```

---

### Task 7: GitHub Pages 部署工作流

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: 根 `pnpm build` / `pnpm test`（Task 1）；portal 与未来工具的 `VITE_BASE` 约定（Task 5）。
- Produces: 推送 main → Pages 自动发布；deploy-dist 汇聚逻辑对 `tools/*/dist` 的存在与否宽容（后续工具计划无需改动此文件）。

- [ ] **Step 1: 写工作流**

`.github/workflows/deploy.yml`：
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
        env:
          # 仓库子路径部署；portal 与各工具的 vite.config 均读取此变量
          VITE_BASE: /${{ github.event.repository.name }}/
      - name: 汇聚各包产物
        run: |
          mkdir -p deploy-dist
          cp -r portal/dist/* deploy-dist/
          for d in tools/*/dist; do
            if [ -d "$d" ]; then
              mkdir -p "deploy-dist/tools"
              cp -r "$d" "deploy-dist/${d%/dist}"
            fi
          done
      - uses: actions/upload-pages-artifact@v3
        with:
          path: deploy-dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 本地模拟 CI 的汇聚逻辑**

Run（Git Bash）: `pnpm build && VITE_BASE=/toolstest/ pnpm --filter portal build && grep -c '/toolstest/assets/' portal/dist/index.html`
Expected: 全仓 build 成功；grep 输出 ≥ 1（index.html 中的脚本/样式引用带 `/toolstest/` 前缀）。

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: GitHub Pages 自动部署（汇聚 portal 与 tools 产物）"
```

- [ ] **Step 4: （人工步骤，提醒用户）**

仓库推送到 GitHub 后：Settings → Pages → Source 选 **GitHub Actions**。首次部署后手机访问 Pages 地址 → 「添加到主屏幕」验证安装与离线打开（规格 §16 成功标准 3、5 的线上部分）。

---

## 计划完成后的后续

本计划交付后，`docs/superpowers/plans/` 下按需新增 4 份工具计划（image-lab → pdf-kit → format-wash → qr-factory）。每份工具计划开工前对照已落地的 portal/shared 真实代码编写，复用本计划确立的：VITE_BASE 约定、`@toolforge/shared` 存储接口、manifest 契约与注册表流程。
