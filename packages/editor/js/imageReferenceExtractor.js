
/**
 * @vocab ImageReferenceExtractor (plans/editor-publish/dictionary.md#画像参照抽出器)
 * @test tests/editor/publish.test.js
 */
export function extractImageReferences(markdownContent) {
  const regex = /!\[.*?\]\((.*?)\)/g
  const paths = []
  let match
  while ((match = regex.exec(markdownContent)) !== null) {
    paths.push(match[1])
  }
  return paths
}
