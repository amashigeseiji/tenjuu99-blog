/**
 * @vocab PublicationStatusResolver (plans/editor-publish/dictionary.md#公開ステータス判定器)
 * @test tests/editor/publish.test.js
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
