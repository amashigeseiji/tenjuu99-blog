/**
 * @vocab: 公開ステータス判定器 (plans/editor-publish/dictionary.md#公開ステータス判定器)
 * @test tests/editor/publish.test.js
 * @param {string} filePath - git ルートからの相対パス（例: `src/pages/post/hello.md`）
 * @param {{ existsInRemote: (path: string) => Promise<boolean>, diffFromRemote: (path: string) => Promise<string> }} publishedState - リモート参照抽象
 * @returns {Promise<'new'|'modified'|'published'|'unknown'>}
 */
export async function getPublicationStatus(filePath, publishedState) {
  try {
    const exists = await publishedState.existsInRemote(filePath)
    if (!exists) return 'new'
    const diff = await publishedState.diffFromRemote(filePath)
    return diff ? 'modified' : 'published'
  } catch {
    return 'unknown'
  }
}
