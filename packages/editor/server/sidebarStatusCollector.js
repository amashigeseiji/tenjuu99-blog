import { getPublicationStatus } from './publicationStatus.js'
/**
 * @vocab ファイルステータスコレクター
 * @test tests/editor/editor-sidebar-status.test.js
 * @param {Array<{treePath: string, gitPath: string}>} fileMappings
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').RemoteState} remoteState
 * @returns {Promise<Object.<string, 'new'|'modified'|'published'|'unknown'>>}
 */
export async function collectStatuses(fileMappings, remoteState) {
  const entries = await Promise.all(
    fileMappings.map(async ({ treePath, gitPath }) => {
      const status = await getPublicationStatus(gitPath, remoteState)
      return [treePath, status]
    })
  )
  return Object.fromEntries(entries)
}
