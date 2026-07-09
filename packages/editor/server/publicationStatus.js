import { styleText } from 'node:util'

/**
 * @vocab: 公開ステータス判定器
 * @test tests/editor/publish.test.js
 * @param {string} filePath - プロジェクトルートからの相対パス（例: `src/pages/post/hello.md`）
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').RemoteState} remoteState
 * @returns {Promise<'new'|'modified'|'published'|'unknown'>}
 */
export async function getPublicationStatus(filePath, remoteState) {
  try {
    const exists = await remoteState.existsInRemote(filePath)
    if (!exists) return 'new'
    const diff = await remoteState.diffFromRemote(filePath)
    return diff ? 'modified' : 'published'
  } catch (e) {
    console.log(styleText('red', '[error]'), e)
    return 'unknown'
  }
}
