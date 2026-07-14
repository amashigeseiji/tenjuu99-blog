
/**
 * @vocab: 画像参照
 * @typedef {string} ImageReference 記事が参照する画像のローカルパス（本文・frontmatter いずれの経路も同じ形）
 */

const MARKDOWN_IMAGE_REGEXP = /!\[.*?\]\(([^\s)]+)/g
const IMG_TAG_REGEXP = /<img\s[^>]*?src=["']([^"']+)["']/gi

const isLocalPath = (url) =>
  !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')

/**
 * @vocab: 画像参照抽出器
 * @test tests/editor/publish.test.js
 * @test tests/editor/imageReference.test.js
 * @param {string} markdownContent - Markdown テキスト
 * @returns {ImageReference[]} 本文画像参照（Markdown 画像記法・img タグ）のローカル画像パスの配列
 */
export function extractImageReferences(markdownContent) {
  const paths = []
  for (const regex of [MARKDOWN_IMAGE_REGEXP, IMG_TAG_REGEXP]) {
    let match
    while ((match = regex.exec(markdownContent)) !== null) {
      const url = match[1]
      if (isLocalPath(url)) {
        paths.push(url)
      }
    }
  }
  return paths
}
