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
    if (manifest[field] == null) {
      errors.push(`${folderName}/manifest.json: 缺少必填字段 "${field}"`)
    }
  }
  for (const field of ['id', 'name', 'description', 'icon']) {
    if (manifest[field] != null && typeof manifest[field] !== 'string') {
      errors.push(`${folderName}/manifest.json: 字段 "${field}" 必须为字符串`)
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
