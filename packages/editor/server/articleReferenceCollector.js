import { readdirSync, readFileSync, existsSync } from 'node:fs'
import nodePath from 'node:path'
import { extractImageReferences } from '../js/imageReferenceExtractor.js'
import { extractFrontmatterImageReferences } from '../js/frontmatterImageReferenceExtractor.js'

const MARKDOWN_EXT_PATTERN = /\.md$/i

function scanDir(dir, prefix) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...scanDir(nodePath.join(dir, entry.name), relPath))
    } else if (MARKDOWN_EXT_PATTERN.test(entry.name)) {
      results.push(relPath)
    }
  }
  return results
}

/**
 * 画像参照の値を画像ライブラリの path 表記（例: `image/post/hello/a.jpg`）に正規化する。
 * `..` を含む値は解決できない参照として除外する。
 * @param {string} url
 * @returns {string|null}
 */
function normalizeImagePath(url) {
  if (url.includes('..')) return null
  return url.startsWith('/') ? url.slice(1) : url
}

/**
 * @vocab: 記事参照コレクター
 * @test tests/editor/image-library.test.js
 * @typedef {{ path: string, imagePaths: string[] }} ArticleImageReferences - 記事1件分の画像参照（path は pagesDir からの相対パス）
 */

/**
 * @vocab: 記事参照コレクター
 * @test tests/editor/image-library.test.js
 * pagesDir 配下の全記事を走査し、それぞれの画像参照（本文＋frontmatter）を収集する。
 * @param {string} pagesDir - 記事ディレクトリの絶対パス（例: `${srcDir}/pages`）
 * @returns {ArticleImageReferences[]}
 */
export function collectArticleReferences(pagesDir) {
  if (!existsSync(pagesDir)) return []
  return scanDir(pagesDir, '').map(relPath => {
    const content = readFileSync(nodePath.join(pagesDir, relPath), 'utf-8')
    const rawPaths = [
      ...extractImageReferences(content),
      ...extractFrontmatterImageReferences(content),
    ]
    const imagePaths = [...new Set(rawPaths.map(normalizeImagePath).filter(Boolean))]
    return { path: relPath, imagePaths }
  })
}
