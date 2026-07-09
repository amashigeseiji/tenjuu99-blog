import { getPublicationStatus } from './publicationStatus.js'
/**
 * @vocab ファイルステータスコレクター
 * @test tests/editor/editor-sidebar-status.test.js
 * @param {Array<{treePath: string, gitPath: string}>} fileMappings
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublishedState} publishedState
 * @returns {Promise<Object.<string, 'new'|'modified'|'published'|'unknown'>>}
 */
export async function collectStatuses(fileMappings, publishedState) {
  const entries = await Promise.all(
    fileMappings.map(async ({ treePath, gitPath }) => {
      const status = await getPublicationStatus(gitPath, publishedState)
      return [treePath, status]
    })
  )
  return Object.fromEntries(entries)
}
