
/**
 * @vocab ImageReferenceExtractor (plans/editor-publish/dictionary.md#画像参照抽出器)
 * @test tests/editor/publish.test.js
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
