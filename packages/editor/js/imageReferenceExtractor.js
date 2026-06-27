
/**
 * @vocab: 画像参照抽出器 (docs/dictionary.md#画像参照抽出器)
 * @test tests/editor/publish.test.js
 * @param {string} markdownContent - Markdown テキスト
 * @returns {string[]} http/https を除いたローカル画像パスの配列
 */
export function extractImageReferences(markdownContent) {
  const regex = /!\[.*?\]\(([^\s)]+)/g
  const paths = []
  let match
  while ((match = regex.exec(markdownContent)) !== null) {
    const url = match[1]
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
      paths.push(url)
    }
  }
  return paths
}
