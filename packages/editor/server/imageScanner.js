import { readdirSync, existsSync } from 'node:fs'
import nodePath from 'node:path'

const IMAGE_EXT_PATTERN = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i

function scanDir(dir, prefix) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...scanDir(nodePath.join(dir, entry.name), relPath))
    } else if (IMAGE_EXT_PATTERN.test(entry.name)) {
      results.push(relPath)
    }
  }
  return results
}

/**
 * @vocab: 画像スキャナー
 * @test tests/editor/image-library.test.js
 * `imageDir` 配下の画像ファイルを再帰的に列挙する。存在しないディレクトリには空配列を返す。
 * @param {string} imageDir
 * @returns {string[]} imageDir からの相対パス一覧（`/` 区切り）
 */
export function scanImages(imageDir) {
  if (!existsSync(imageDir)) return []
  return scanDir(imageDir, '')
}
