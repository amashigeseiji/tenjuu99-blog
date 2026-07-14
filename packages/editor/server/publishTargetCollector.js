import { extractImageReferences } from '../js/imageReferenceExtractor.js'
import { extractFrontmatterImageReferences } from '../js/frontmatterImageReferenceExtractor.js'

/**
 * @vocab: 公開対象コレクター
 * @test tests/editor/publish.test.js
 * @test tests/editor/imageReference.test.js
 * @param {string} filePath - pages ディレクトリからの相対パス（例: `post/hello.md`）
 * @param {string} fileContent - frontmatter を含む記事の内容
 * @param {string} [srcDir='src'] - ソースディレクトリ名
 * @returns {{ markdownFile: string, imageFiles: string[] }}
 */
export function collectTarget(filePath, fileContent, srcDir = 'src') {
  const imageUrls = [
    ...extractImageReferences(fileContent),
    ...extractFrontmatterImageReferences(fileContent),
  ]
  return {
    markdownFile: `${srcDir}/pages/${filePath}`,
    imageFiles: [...new Set(imageUrls)]
      .filter(url => !url.includes('..'))
      .map(url => url.startsWith('/') ? `${srcDir}${url}` : `${srcDir}/${url}`)
  }
}
