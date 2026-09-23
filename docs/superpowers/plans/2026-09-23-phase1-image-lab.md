# ToolForge 一期·image-lab 图片工作台（计划 2/5）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 tools/image-lab 图片工作台：批量压缩、png/jpeg/webp 转格式、尺寸调整、文字水印、ZIP 批量下载，全程浏览器本地处理。

**Architecture:** 纯静态 Vite SPA（无独立 PWA，规格 §9.4 将工具级 PWA 留给 qr-factory 示范，故本工具 `offline: false` 诚实标注，也不引入 vite-plugin-pwa——plan-1 的 workbox-window gotcha 因此不适用）。处理核心拆为可单测的纯函数（尺寸/水印几何/格式与命名）+ 一层薄 Canvas 编码（浏览器环境，不做单测）；图片顺序处理并即时释放位图以满足内存验收。

**Tech Stack:** Vue 3 + TypeScript + Vite 7 + vitest + jszip 3.10 + Canvas API（无 PWA 插件）。

**Spec:** `docs/superpowers/specs/2026-09-23-toolforge-design.md`（§6 契约、§8 铁律、§9.1 本工具、§10 数据、§12 测试、§13 错误处理）

## Global Constraints

- 工具间禁止互相 import（规格 §8）；本工具不依赖 portal/scripts 的任何模块；允许依赖 `@toolforge/shared`（本计划仅用其 theme.css）。
- 全部 UI 与错误文案为中文（规格 §13）。
- TypeScript `strict: true`（extends `tsconfig.base.json`）；包 `"type": "module"`。
- **base 约定**：`process.env.VITE_BASE ?? '/'` 去尾斜杠后拼 `/tools/image-lab/`（CI 注入 `/toolforge/` 时 → `/toolforge/tools/image-lab/`，与注册表根相对路径 `/tools/image-lab/...` 和 CI 汇聚逻辑严丝合缝）。
- manifest 契约（规格 §6）：`id` 必须等于文件夹名 `image-lab`；`category: media`；`offline: false`；icon 用相对路径。
- 图片**顺序**处理（for-of await，禁止 Promise.all 并发），处理完 `bitmap.close()`——内存验收（10×8MB 不崩）依赖此约束。
- 处理全程零网络请求：src/ 内禁止 fetch/XHR/外链资源（验收标准）。
- Canvas 编码层（process.ts）不做单元测试（浏览器 API）；纯函数必须 TDD。
- 测试基线：当前全仓 23 个测试（shared 4 + scripts 15 + portal 4）；本计划完成后 41 个（+18：resize 6 + watermark 4 + format 8）。

---

### Task 1: 工具包脚手架 + 注册表冒烟

**Files:**
- Create: `tools/image-lab/manifest.json`
- Create: `tools/image-lab/package.json`
- Create: `tools/image-lab/tsconfig.json`
- Create: `tools/image-lab/vite.config.ts`
- Create: `tools/image-lab/index.html`
- Create: `tools/image-lab/public/icon.svg`
- Create: `tools/image-lab/src/main.ts`
- Create: `tools/image-lab/src/app.css`
- Create: `tools/image-lab/src/App.vue`（占位版，Task 3 替换）

**Interfaces:**
- Consumes: `@toolforge/shared/theme.css`（CSS 变量）；根 tsconfig.base.json；scripts CLI（仅命令行调用，非 import）。
- Produces: `image-lab` workspace 包（`pnpm --filter image-lab dev|build|test`）；注册表新增条目 `{id:'image-lab', category:'media', entry:'/tools/image-lab/index.html', offline:false, icon:'/tools/image-lab/icon.svg'}`——portal 卡片与 CI 汇聚据此工作，后续任务消费。

- [ ] **Step 1: 写包配置**

`tools/image-lab/manifest.json`：
```json
{
  "id": "image-lab",
  "name": "图片工作台",
  "description": "批量压缩、转格式、调尺寸、加文字水印，全程本地处理，照片不出设备",
  "icon": "icon.svg",
  "category": "media",
  "offline": false
}
```

`tools/image-lab/package.json`：
```json
{
  "name": "image-lab",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@toolforge/shared": "workspace:*",
    "jszip": "^3.10.1",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0",
    "vue-tsc": "^3.0.0"
  }
}
```

`tools/image-lab/tsconfig.json`：
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`tools/image-lab/vite.config.ts`：
```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 与 CI 约定对齐：VITE_BASE 是部署根（缺省 '/'），工具固定挂在 tools/<id>/ 下
const root = process.env.VITE_BASE ?? '/'
const base = `${root.replace(/\/$/, '')}/tools/image-lab/`

export default defineConfig({
  base,
  plugins: [vue()],
})
```

- [ ] **Step 2: 写入口与占位页**

`tools/image-lab/index.html`（favicon 用相对路径——SFC/HTML 内绝对路径不会被 Vite 按 base 重写，plan-1 的教训）：
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="icon.svg" type="image/svg+xml" />
    <title>图片工作台 — ToolForge</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`tools/image-lab/public/icon.svg`：
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#3568d4"/>
  <rect x="22" y="26" width="56" height="44" rx="6" fill="#fff" opacity="0.95"/>
  <circle cx="38" cy="40" r="6" fill="#f5b83d"/>
  <path d="M22 64 L42 46 L54 58 L64 50 L78 64 Z" fill="#6f9bf0"/>
</svg>
```

`tools/image-lab/src/main.ts`：
```ts
import { createApp } from 'vue'
import '@toolforge/shared/theme.css'
import './app.css'
import App from './App.vue'

createApp(App).mount('#app')
```

`tools/image-lab/src/App.vue`（占位）：
```vue
<template>
  <header class="top">
    <h1>图片工作台</h1>
    <p class="sub">界面在下一任务实现。</p>
  </header>
</template>
```

`tools/image-lab/src/app.css`：
```css
body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.top {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 0;
}

h1 { margin: 0; font-size: 22px; }

.sub { margin: 4px 0 0; color: var(--text-secondary); font-size: 13px; }

.back {
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px 16px 48px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; }
}

.dropzone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 36px 16px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s;
}

.dropzone.drag {
  border-color: var(--accent);
  color: var(--accent);
}

.panel,
.filelist {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}

.panel h2 {
  margin: 0 0 10px;
  font-size: 15px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.field .label {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
}

.field select,
.field input[type='number'],
.field input[type='text'] {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}

.hint { font-size: 12px; color: var(--text-secondary); }

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 10px;
}

.filelist { padding: 6px 8px; }

.filelist .empty {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 18px 0;
}

.file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--border);
}

.file:last-child { border-bottom: none; }

.file img.thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

.file .meta { min-width: 0; flex: 1; }

.file .name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file .sizes {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.file .sizes .saved { color: var(--accent); }

.file .err {
  font-size: 12px;
  color: #d4506c;
  margin-top: 2px;
}

.iconbtn {
  border: none;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
  flex-shrink: 0;
}

.iconbtn.dim { color: var(--text-secondary); }

.actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: 安装依赖并验证构建链**

Run: `pnpm install && pnpm --filter image-lab build`
Expected: `vue-tsc --noEmit` 与 vite build 均成功，产出 `tools/image-lab/dist/`（含 index.html、icon.svg）。

- [ ] **Step 4: 注册表冒烟——门户现在应能看到本工具**

Run: `node scripts/lib/generate-registry.mjs && cat portal/public/tools.json`
Expected: 输出 `✓ 注册表已生成：1 个工具`；`tools.json` 含 `"id": "image-lab"`、`"entry": "/tools/image-lab/index.html"`、`"offline": false`、`"category": "media"`。若校验失败，输出会指出具体字段——修 manifest 后重跑（校验器工作正常的表现，不是环境问题）。

- [ ] **Step 5: base 约定冒烟**

Run: `MSYS2_ENV_CONV_EXCL="VITE_BASE" VITE_BASE=/toolforge/ pnpm --filter image-lab build && grep -c '/toolforge/tools/image-lab/assets/' tools/image-lab/dist/index.html`
Expected: grep 输出 ≥ 1。（Git Bash 必须带 MSYS2_ENV_CONV_EXCL，否则 VITE_BASE 被路径改写产生假结果；CI/Linux 不需要。）

- [ ] **Step 6: Commit**

```bash
git add tools/image-lab portal/public/tools.json pnpm-lock.yaml
git commit -m "feat(image-lab): 工具包脚手架（manifest 契约 + Vite SPA 骨架）"
```

---

### Task 2: 处理核心纯函数（TDD）

**Files:**
- Create: `tools/image-lab/src/core/resize.ts`
- Test: `tools/image-lab/src/core/resize.test.ts`
- Create: `tools/image-lab/src/core/watermark.ts`
- Test: `tools/image-lab/src/core/watermark.test.ts`
- Create: `tools/image-lab/src/core/format.ts`
- Test: `tools/image-lab/src/core/format.test.ts`

**Interfaces:**
- Produces（Task 3 消费，签名精确如下）:
  - `computeTargetSize(width: number, height: number, settings: ResizeSettings): { width: number; height: number }`，`type ResizeSettings = { mode: 'none' | 'width' | 'height' | 'percent'; value: number }`
  - `computeWatermarkPosition(position: WatermarkPosition, canvasW: number, canvasH: number, textW: number, textH: number, padding: number): { x: number; y: number }`，`type WatermarkPosition = 'nw' | 'n' | 'ne' | 'w' | 'center' | 'e' | 'sw' | 's' | 'se'`
  - `resolveMime(format: OutputFormat, originalMime: string): string`；`buildOutputName(name: string, mime: string): string`；`dedupeName(name: string, used: Set<string>): string`；`formatBytes(bytes: number): string`；`type OutputFormat = 'original' | 'png' | 'jpeg' | 'webp'`

- [ ] **Step 1: 写三个失败的测试文件**

`tools/image-lab/src/core/resize.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { computeTargetSize } from './resize'

describe('computeTargetSize', () => {
  it('mode none 原样返回', () => {
    expect(computeTargetSize(1000, 500, { mode: 'none', value: 1280 })).toEqual({ width: 1000, height: 500 })
  })

  it('按宽缩放保持纵横比', () => {
    expect(computeTargetSize(1000, 500, { mode: 'width', value: 800 })).toEqual({ width: 800, height: 400 })
  })

  it('按高缩放保持纵横比', () => {
    expect(computeTargetSize(1000, 500, { mode: 'height', value: 300 })).toEqual({ width: 600, height: 300 })
  })

  it('按百分比缩放', () => {
    expect(computeTargetSize(1000, 500, { mode: 'percent', value: 50 })).toEqual({ width: 500, height: 250 })
  })

  it('结果四舍五入', () => {
    expect(computeTargetSize(1000, 501, { mode: 'width', value: 333 })).toEqual({ width: 333, height: 167 })
  })

  it('极小值钳制到 1，避免 0 尺寸', () => {
    expect(computeTargetSize(100, 50, { mode: 'width', value: 0.4 })).toEqual({ width: 1, height: 1 })
  })
})
```

`tools/image-lab/src/core/watermark.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { computeWatermarkPosition } from './watermark'

describe('computeWatermarkPosition', () => {
  it('center 水平垂直居中', () => {
    expect(computeWatermarkPosition('center', 800, 600, 200, 50, 16)).toEqual({ x: 300, y: 275 })
  })

  it('nw 贴左上角，留 padding', () => {
    expect(computeWatermarkPosition('nw', 800, 600, 200, 50, 16)).toEqual({ x: 16, y: 16 })
  })

  it('se 贴右下角', () => {
    expect(computeWatermarkPosition('se', 800, 600, 200, 50, 16)).toEqual({ x: 584, y: 534 })
  })

  it('n 水平居中、贴顶部（单字符方位没有东西语义）', () => {
    expect(computeWatermarkPosition('n', 800, 600, 200, 50, 16)).toEqual({ x: 300, y: 16 })
  })
})
```

`tools/image-lab/src/core/format.test.ts`：
```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter image-lab test`
Expected: FAIL — 三个测试文件均报 `Cannot find module './resize'`（或 './watermark' / './format'）。

- [ ] **Step 3: 写实现**

`tools/image-lab/src/core/resize.ts`：
```ts
export interface ResizeSettings {
  mode: 'none' | 'width' | 'height' | 'percent'
  value: number
}

/** 由原始尺寸与缩放设置计算目标尺寸；结果四舍五入且最小 1px */
export function computeTargetSize(
  width: number,
  height: number,
  settings: ResizeSettings,
): { width: number; height: number } {
  const clamp = (n: number) => Math.max(1, Math.round(n))
  switch (settings.mode) {
    case 'none':
      return { width: clamp(width), height: clamp(height) }
    case 'width':
      return { width: clamp(settings.value), height: clamp((settings.value * height) / width) }
    case 'height':
      return { width: clamp((settings.value * width) / height), height: clamp(settings.value) }
    case 'percent': {
      const factor = Math.max(1, settings.value) / 100
      return { width: clamp(width * factor), height: clamp(height * factor) }
    }
  }
}
```

`tools/image-lab/src/core/watermark.ts`：
```ts
export type WatermarkPosition = 'nw' | 'n' | 'ne' | 'w' | 'center' | 'e' | 'sw' | 's' | 'se'

/** 九宫格定位：返回 fillText 的锚点（textBaseline='top' 语义），x/y 距边 padding */
export function computeWatermarkPosition(
  position: WatermarkPosition,
  canvasW: number,
  canvasH: number,
  textW: number,
  textH: number,
  padding: number,
): { x: number; y: number } {
  const x = position.endsWith('w')
    ? padding
    : position.endsWith('e')
      ? canvasW - textW - padding
      : (canvasW - textW) / 2
  const y = position.startsWith('n')
    ? padding
    : position.startsWith('s')
      ? canvasH - textH - padding
      : (canvasH - textH) / 2
  return { x, y }
}
```

`tools/image-lab/src/core/format.ts`：
```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter image-lab test`
Expected: PASS — 18 个测试全绿（resize 6 + watermark 4 + format 8），输出无警告。

- [ ] **Step 5: Commit**

```bash
git add tools/image-lab/src/core
git commit -m "feat(image-lab): 处理核心纯函数（尺寸/水印几何/格式与命名）"
```

---

### Task 3: Canvas 编码层 + 完整界面 + 集成验证

**Files:**
- Create: `tools/image-lab/src/core/process.ts`
- Create: `tools/image-lab/src/types.ts`
- Create: `tools/image-lab/src/components/SettingsPanel.vue`
- Create: `tools/image-lab/src/components/FileItem.vue`
- Modify: `tools/image-lab/src/App.vue`（替换占位版）

**Interfaces:**
- Consumes: Task 2 全部纯函数（签名见 Task 2 Interfaces）；`@toolforge/shared/theme.css` 的 CSS 变量（`--bg/--surface/--text/--text-secondary/--border/--accent/--accent-soft/--radius/--shadow`，已在 app.css 使用）。
- Produces: `processImage(file: File, settings: ImageSettings): Promise<ProcessedImage>`，其中 `ProcessedImage = { blob: Blob; name: string; width: number; height: number; url: string }`；`ImageSettings`（types.ts）= `{ format: OutputFormat; quality: number; resize: ResizeSettings; watermark: WatermarkSettings }`，`DEFAULT_SETTINGS` 常量。

- [ ] **Step 1: 写类型与默认值**

`tools/image-lab/src/types.ts`：
```ts
import type { OutputFormat } from './core/format'
import type { ResizeSettings } from './core/resize'
import type { WatermarkPosition } from './core/watermark'

export interface WatermarkSettings {
  enabled: boolean
  text: string
  position: WatermarkPosition
  fontSize: number
  /** 0-100 */
  opacity: number
  color: string
}

export interface ImageSettings {
  format: OutputFormat
  /** 1-100，仅对 jpeg/webp 生效 */
  quality: number
  resize: ResizeSettings
  watermark: WatermarkSettings
}

export const DEFAULT_SETTINGS: ImageSettings = {
  format: 'original',
  quality: 80,
  resize: { mode: 'none', value: 1280 },
  watermark: {
    enabled: false,
    text: '',
    position: 'se',
    fontSize: 32,
    opacity: 60,
    color: '#ffffff',
  },
}

export interface ProcessedImage {
  blob: Blob
  name: string
  width: number
  height: number
  url: string
}

export type ItemStatus = 'pending' | 'processing' | 'done' | 'error'

export interface SourceItem {
  id: number
  file: File
  url: string
  status: ItemStatus
  error?: string
  result?: ProcessedImage
}
```

- [ ] **Step 2: 写 Canvas 编码层（薄壳，无单测）**

`tools/image-lab/src/core/process.ts`：
```ts
import { buildOutputName, resolveMime } from './format'
import { computeTargetSize, type ResizeSettings } from './resize'
import { computeWatermarkPosition, type WatermarkPosition } from './watermark'
import type { OutputFormat } from './format'
import type { ProcessedImage } from '../types'

export interface ImageSettings {
  format: OutputFormat
  quality: number
  resize: ResizeSettings
  watermark: {
    enabled: boolean
    text: string
    position: WatermarkPosition
    fontSize: number
    opacity: number
    color: string
  }
}

/**
 * 单张处理：解码 → 缩放绘制 → 水印 → 编码。
 * 调用方必须顺序 await（内存验收：10×8MB 不并发）。
 */
export async function processImage(file: File, settings: ImageSettings): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, settings.resize)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('无法创建画布，请更换浏览器重试')
  }

  const mime = resolveMime(settings.format, file.type)
  // JPEG 无透明通道：透明区域编码后变黑，先铺白底
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)

  if (settings.watermark.enabled && settings.watermark.text.trim()) {
    const wm = settings.watermark
    ctx.globalAlpha = Math.min(100, Math.max(0, wm.opacity)) / 100
    ctx.fillStyle = wm.color
    ctx.font = `${wm.fontSize}px sans-serif`
    ctx.textBaseline = 'top'
    const metrics = ctx.measureText(wm.text)
    const pos = computeWatermarkPosition(wm.position, width, height, metrics.width, wm.fontSize, Math.round(wm.fontSize / 2))
    ctx.fillText(wm.text, pos.x, pos.y)
    ctx.globalAlpha = 1
  }

  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : settings.quality / 100),
  )
  if (!blob) throw new Error(`图片编码失败：${file.name}`)

  return { blob, name: buildOutputName(file.name, mime), width, height, url: URL.createObjectURL(blob) }
}
```

注意：`ImageSettings` 在 types.ts 与 process.ts 各有一份结构定义（字段一致）——为避免两处漂移，执行时将 process.ts 改为 `import type { ImageSettings } from '../types'` 并删除本地重复定义（types.ts 不 import process.ts，无循环）。**以此为准，上面代码块中的本地 interface 是展开示意。**

- [ ] **Step 3: 写设置面板组件**

`tools/image-lab/src/components/SettingsPanel.vue`：
```vue
<script setup lang="ts">
import type { ImageSettings } from '../types'
import type { OutputFormat } from '../core/format'
import type { ResizeSettings } from '../core/resize'
import type { WatermarkPosition } from '../core/watermark'

const props = defineProps<{ settings: ImageSettings; disabled: boolean }>()
const emit = defineEmits<{ update: [settings: ImageSettings] }>()

function patch(part: Partial<ImageSettings>) {
  emit('update', { ...props.settings, ...part })
}

function patchResize(part: Partial<ResizeSettings>) {
  emit('update', { ...props.settings, resize: { ...props.settings.resize, ...part } })
}

function patchWatermark(part: Partial<ImageSettings['watermark']>) {
  emit('update', { ...props.settings, watermark: { ...props.settings.watermark, ...part } })
}

const POSITION_LABELS: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'nw', label: '左上' },
  { value: 'n', label: '上中' },
  { value: 'ne', label: '右上' },
  { value: 'w', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'e', label: '右中' },
  { value: 'sw', label: '左下' },
  { value: 's', label: '下中' },
  { value: 'se', label: '右下' },
]
</script>

<template>
  <section class="panel">
    <h2>输出设置</h2>

    <div class="field">
      <span class="label">输出格式</span>
      <select
        :value="settings.format"
        :disabled="disabled"
        @change="patch({ format: ($event.target as HTMLSelectElement).value as OutputFormat })"
      >
        <option value="original">保留原格式</option>
        <option value="jpeg">JPEG（体积小）</option>
        <option value="png">PNG（无损）</option>
        <option value="webp">WebP（更小）</option>
      </select>
    </div>

    <div class="field" v-if="settings.format !== 'png'">
      <span class="label">
        <span>压缩质量</span>
        <span>{{ settings.quality }}</span>
      </span>
      <input
        type="range"
        min="1"
        max="100"
        :value="settings.quality"
        :disabled="disabled"
        @input="patch({ quality: Number(($event.target as HTMLInputElement).value) })"
      />
      <span class="hint" v-if="settings.format === 'original'">仅对 JPEG / WebP 输出生效</span>
    </div>

    <div class="field">
      <span class="label">尺寸调整</span>
      <div class="row2">
        <select
          :value="settings.resize.mode"
          :disabled="disabled"
          @change="patchResize({ mode: ($event.target as HTMLSelectElement).value as ResizeSettings['mode'] })"
        >
          <option value="none">保持原尺寸</option>
          <option value="width">按宽度</option>
          <option value="height">按高度</option>
          <option value="percent">按百分比</option>
        </select>
        <input
          v-if="settings.resize.mode !== 'none'"
          type="number"
          min="1"
          :max="settings.resize.mode === 'percent' ? 100 : undefined"
          :value="settings.resize.value"
          :disabled="disabled"
          @input="patchResize({ value: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <span class="hint" v-if="settings.resize.mode === 'width'">等比缩放到目标宽度（px）</span>
      <span class="hint" v-else-if="settings.resize.mode === 'height'">等比缩放到目标高度（px）</span>
      <span class="hint" v-else-if="settings.resize.mode === 'percent'">按原图的百分比缩放</span>
    </div>

    <label class="check">
      <input
        type="checkbox"
        :checked="settings.watermark.enabled"
        :disabled="disabled"
        @change="patchWatermark({ enabled: ($event.target as HTMLInputElement).checked })"
      />
      添加文字水印
    </label>

    <template v-if="settings.watermark.enabled">
      <div class="field">
        <span class="label">水印文字</span>
        <input
          type="text"
          :value="settings.watermark.text"
          placeholder="如：@我的名字"
          :disabled="disabled"
          @input="patchWatermark({ text: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="field">
        <span class="label">位置</span>
        <select
          :value="settings.watermark.position"
          :disabled="disabled"
          @change="patchWatermark({ position: ($event.target as HTMLSelectElement).value as WatermarkPosition })"
        >
          <option v-for="p in POSITION_LABELS" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div class="field">
        <span class="label">
          <span>字号（px）</span>
        </span>
        <input
          type="number"
          min="8"
          max="400"
          :value="settings.watermark.fontSize"
          :disabled="disabled"
          @input="patchWatermark({ fontSize: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="field">
        <span class="label">
          <span>不透明度</span>
          <span>{{ settings.watermark.opacity }}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          :value="settings.watermark.opacity"
          :disabled="disabled"
          @input="patchWatermark({ opacity: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="field">
        <span class="label">颜色</span>
        <input
          type="text"
          :value="settings.watermark.color"
          :disabled="disabled"
          @input="patchWatermark({ color: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>
  </section>
</template>
```

- [ ] **Step 4: 写文件条目组件**

`tools/image-lab/src/components/FileItem.vue`：
```vue
<script setup lang="ts">
import type { SourceItem } from '../types'
import { formatBytes } from '../core/format'

defineProps<{ item: SourceItem }>()
defineEmits<{ download: []; remove: [] }>()

function saving(item: SourceItem): string {
  if (!item.result) return ''
  const pct = Math.round((1 - item.result.blob.size / item.file.size) * 100)
  return pct > 0 ? `省 ${pct}%` : `+${-pct}%`
}
</script>

<template>
  <div class="file">
    <img class="thumb" :src="item.url" alt="" />
    <div class="meta">
      <div class="name">{{ item.file.name }}</div>
      <div class="sizes" v-if="item.status === 'pending'">{{ formatBytes(item.file.size) }} · 待处理</div>
      <div class="sizes" v-else-if="item.status === 'processing'">处理中…</div>
      <div class="sizes" v-else-if="item.status === 'done' && item.result">
        {{ formatBytes(item.file.size) }} → {{ formatBytes(item.result.blob.size) }}
        <span class="saved">{{ saving(item) }}</span>
      </div>
      <div class="err" v-else-if="item.status === 'error'">{{ item.error }}</div>
    </div>
    <button class="iconbtn" v-if="item.status === 'done'" @click="$emit('download')">下载</button>
    <button class="iconbtn dim" @click="$emit('remove')" :disabled="item.status === 'processing'">移除</button>
  </div>
</template>
```

- [ ] **Step 5: 替换 App.vue 完整实现**

`tools/image-lab/src/App.vue`：
```vue
<script setup lang="ts">
import JSZip from 'jszip'
import { computed, onBeforeUnmount, ref } from 'vue'
import { dedupeName } from './core/format'
import { processImage } from './core/process'
import { DEFAULT_SETTINGS, type ImageSettings, type SourceItem } from './types'
import FileItem from './components/FileItem.vue'
import SettingsPanel from './components/SettingsPanel.vue'

// 门户部署在站点根：去掉本工具的 base 后缀即门户地址（开发与子路径部署都成立）
const portalBase = import.meta.env.BASE_URL.replace(/\/tools\/image-lab\/$/, '/') || '/'

const items = ref<SourceItem[]>([])
const settings = ref<ImageSettings>(structuredClone(DEFAULT_SETTINGS))
const processing = ref(false)
const dragging = ref(false)

let nextId = 1
const input = ref<HTMLInputElement | null>(null)

const doneCount = computed(() => items.value.filter((i) => i.status === 'done').length)

function addFiles(list: FileList | File[]) {
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue
    items.value.push({ id: nextId++, file, url: URL.createObjectURL(file), status: 'pending' })
  }
}

function onPick(e: Event) {
  addFiles((e.target as HTMLInputElement).files ?? [])
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  addFiles(e.dataTransfer?.files ?? [])
}

function removeItem(item: SourceItem) {
  URL.revokeObjectURL(item.url)
  if (item.result) URL.revokeObjectURL(item.result.url)
  items.value = items.value.filter((i) => i.id !== item.id)
}

function clearAll() {
  if (processing.value) return
  for (const item of items.value) {
    URL.revokeObjectURL(item.url)
    if (item.result) URL.revokeObjectURL(item.result.url)
  }
  items.value = []
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

async function processAll() {
  if (processing.value || items.value.length === 0) return
  processing.value = true
  try {
    // 顺序处理：内存验收（10×8MB）依赖不并发
    for (const item of items.value) {
      if (item.status === 'done') continue
      item.status = 'processing'
      try {
        item.result = await processImage(item.file, settings.value)
        item.status = 'done'
      } catch (e) {
        item.status = 'error'
        item.error = e instanceof Error ? e.message : '处理失败，请重试'
      }
    }
  } finally {
    processing.value = false
  }
}

async function downloadAll() {
  const done = items.value.filter((i) => i.status === 'done' && i.result)
  if (done.length === 0) return
  const zip = new JSZip()
  const used = new Set<string>()
  for (const item of done) {
    zip.file(dedupeName(item.result!.name, used), item.result!.blob)
  }
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  saveBlob(await zip.generateAsync({ type: 'blob' }), `image-lab-${stamp}.zip`)
}

onBeforeUnmount(() => clearAll())
</script>

<template>
  <header class="top">
    <a class="back" :href="portalBase">← 返回门户</a>
    <h1>图片工作台</h1>
    <p class="sub">压缩、转格式、调尺寸、加水印——全部在本机浏览器内完成，图片不会上传。</p>
  </header>

  <main>
    <div class="layout">
      <section>
        <div
          class="dropzone"
          :class="{ drag: dragging }"
          @click="input?.click()"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          点击选择图片，或拖拽到此处<br />
          <span class="hint">支持批量 · png / jpeg / webp / gif 等常见格式</span>
        </div>
        <input ref="input" type="file" accept="image/*" multiple hidden @change="onPick" />

        <div class="filelist">
          <p class="empty" v-if="items.length === 0">还没有图片。选几张试试？</p>
          <FileItem
            v-for="item in items"
            :key="item.id"
            :item="item"
            @download="item.result && saveBlob(item.result.blob, item.result.name)"
            @remove="removeItem(item)"
          />
        </div>
      </section>

      <SettingsPanel :settings="settings" :disabled="processing" @update="settings = $event" />

      <div class="actions" style="grid-column: 1 / -1">
        <button class="btn primary" :disabled="processing || items.length === 0" @click="processAll">
          {{ processing ? '处理中…' : `开始处理（${items.length} 张）` }}
        </button>
        <button class="btn" :disabled="processing || doneCount === 0" @click="downloadAll">
          全部下载（ZIP，{{ doneCount }} 张）
        </button>
        <button class="btn" :disabled="processing || items.length === 0" @click="clearAll">清空</button>
      </div>

      <p class="note" style="grid-column: 1 / -1">
        处理在本地完成；大图建议一次 ≤ 20 张。JPEG 输出会自动铺白底（不支持透明）。
      </p>
    </div>
  </main>
</template>
```

- [ ] **Step 6: 类型检查 + 构建 + 全仓测试**

Run: `pnpm --filter image-lab build && pnpm test`
Expected: image-lab 构建绿（vue-tsc + vite）；全仓 **41** 个测试全绿（shared 4 + scripts 15 + portal 4 + image-lab 18）。

- [ ] **Step 7: 零网络请求与集成冒烟**

Run: `grep -rniE "fetch\(|XMLHttpRequest|https?://" tools/image-lab/src/ | grep -v "svg" | wc -l`
Expected: `0`（src/ 内零网络引用；验收标准「全程零网络请求」的静态面）。

Run: `pnpm --filter image-lab preview` 后 `curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/`（或终端提示端口），确认 200 后 Ctrl+C。真机批量压缩验收（10×8MB → ≤2MB、手机流畅）留给人事实核，见「计划完成后」。

- [ ] **Step 8: Commit**

```bash
git add tools/image-lab
git commit -m "feat(image-lab): Canvas 编码层与完整界面（批量/水印/ZIP 下载）"
```

---

## 计划完成后（人工验收，非子代理任务）

1. `pnpm dev:portal` → portal 卡片应出现「图片工作台」→ 点击新标签进入（规格 §9.0/§7 端到端）。
2. 用 ~10 张 8MB 手机照片实测：质量 80 + 按宽度 1280，核对每张 ≤2MB 且界面不卡死（规格 §9.1 验收）。
3. 推送 main 后 CI 自动部署，手机访问线上门户安装使用（规格 §16.5）。

## 后续计划占位说明

- 计划 3/5（pdf-kit）：pdf-lib；拆分页码范围解析为纯函数 TDD。
- 计划 5/5（qr-factory）示范工具级 PWA 时：必须显式声明 `workbox-window`（vite-plugin-pwa peer dep，pnpm 严格布局），并建议经 pnpm catalog 统一版本。
