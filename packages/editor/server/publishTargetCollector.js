import { extractImageReferences } from '../js/imageReferenceExtractor.js'

/**
 * @vocab: 公開対象コレクター (docs/dictionary.md#公開対象コレクター)
 * @test tests/editor/publish.test.js
 * @param {string} filePath - pages ディレクトリからの相対パス（例: `post/hello.md`）
 * @param {string} fileContent - Markdown 本文
 * @param {string} [srcDir='src'] - ソースディレクトリ名
 * @returns {{ markdownFile: string, imageFiles: string[] }}
 */
export function collectTarget(filePath, fileContent, srcDir = 'src') {
  const imageUrls = extractImageReferences(fileContent)
  return {
    markdownFile: `${srcDir}/pages/${filePath}`,
    imageFiles: imageUrls
      .filter(url => !url.includes('..'))
      .map(url => url.startsWith('/') ? `${srcDir}${url}` : `${srcDir}/${url}`)
  }
}
