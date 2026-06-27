import { extractImageReferences } from '../js/imageReferenceExtractor.js'

/**
 * @vocab PublishTargetCollector (plans/editor-publish/dictionary.md#公開対象コレクター)
 * @test tests/editor/publish.test.js
 */
export function collectTarget(filePath, fileContent, srcDir = 'src') {
  const imageUrls = extractImageReferences(fileContent)
  return {
    markdownFile: `${srcDir}/pages/${filePath}`,
    imageFiles: imageUrls.map(url => `${srcDir}${url}`)
  }
}
