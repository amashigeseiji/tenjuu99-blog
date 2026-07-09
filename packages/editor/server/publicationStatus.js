import { styleText } from 'node:util'

/**
 * @vocab: 公開ステータス判定器
 * @test tests/editor/publish.test.js
 * @param {string} filePath - プロジェクトルートからの相対パス（例: `src/pages/post/hello.md`）
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublishedState} publishedState
 * @returns {Promise<'new'|'modified'|'published'|'unknown'>}
 */
export async function getPublicationStatus(filePath, publishedState) {
  try {
    const exists = await publishedState.existsInRemote(filePath)
    if (!exists) return 'new'
    const diff = await publishedState.diffFromRemote(filePath)
    return diff ? 'modified' : 'published'
  } catch (e) {
    console.log(styleText('red', '[error]'), e)
    return 'unknown'
  }
}
