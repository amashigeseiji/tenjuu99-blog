/**
 * @vocab: Markdown挿入器
 * @test: tests/editor/editor-image-upload.test.js
 * @param {string} content
 * @param {number} cursorPos
 * @param {string} markdownUrl
 * @returns {string}
 */
export function insertImageMarkdown(content, cursorPos, markdownUrl) {
  const imageRef = `![](${markdownUrl})`
  return content.slice(0, cursorPos) + imageRef + content.slice(cursorPos)
}
