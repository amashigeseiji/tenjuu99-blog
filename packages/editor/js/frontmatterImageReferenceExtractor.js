import { parseFrontmatter } from '@tenjuu99/blog/lib/pageData.js'
import { isImagePath } from './imagePathDetector.js'

/**
 * @vocab フロントマター画像参照抽出器
 * @test tests/editor/imageReference.test.js
 * @param {string} content - frontmatter を含む記事の文字列
 * @returns {import('./imageReferenceExtractor.js').ImageReference[]} frontmatter の値のうち画像パスの形をもつもの（フロントマター画像参照）
 */
export function extractFrontmatterImageReferences(content) {
  const values = Object.values(parseFrontmatter(content))
  return values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(isImagePath)
}
