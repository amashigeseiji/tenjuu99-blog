import { getPublicationStatus } from './publicationStatus.js'
/**
 * @vocab ファイルステータスコレクター
 * @test tests/editor/editor-sidebar-status.test.js
 * @test tests/editor/sync-operations.test.js
 * 手元のファイル群の公開ステータスを収集する。pagesPrefix が与えられたときは、
 * 手元に無いがリモートにあるファイルも 'remote-only' として収集する
 * （一覧が参照できない手段では検出をあきらめ、手元の収集は続ける）。
 * @param {Array<{treePath: string, localPath: string}>} fileMappings
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').RemoteState} remoteState
 * @param {{ pagesPrefix?: string }} [options] - pagesPrefix: 原稿の置き場所（例: 'src/pages/'）
 * @returns {Promise<Object.<string, 'new'|'modified'|'published'|'unknown'|'remote-only'>>}
 */
export async function collectStatuses(fileMappings, remoteState, { pagesPrefix } = {}) {
  const entries = await Promise.all(
    fileMappings.map(async ({ treePath, localPath }) => {
      const status = await getPublicationStatus(localPath, remoteState)
      return [treePath, status]
    })
  )
  const statusMap = Object.fromEntries(entries)
  if (pagesPrefix) {
    try {
      const remoteFiles = await remoteState.listRemoteFiles()
      const localPaths = new Set(fileMappings.map(m => m.localPath))
      for (const remotePath of remoteFiles) {
        if (!remotePath.startsWith(pagesPrefix) || localPaths.has(remotePath)) continue
        statusMap[remotePath.slice(pagesPrefix.length)] = 'remote-only'
      }
    } catch {
      // 一覧が参照できない手段ではリモートのみの検出をあきらめる
    }
  }
  return statusMap
}
