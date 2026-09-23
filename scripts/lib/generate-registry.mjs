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
